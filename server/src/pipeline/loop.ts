import { crawlCompanySite } from "./crawler.js";
import { extractRoleRequirements } from "./extractor.js";
import {
  synthesizeCompanyBrief,
  generateCategoryQuestions,
  generateFlashcards,
} from "./generator.js";
import { computeCoverageGaps } from "./coverage.js";
import { allocateSchedule } from "./scheduler.js";
import { llmClient, ResilientLLMClient } from "./llm.js";
import {
  KitAppendixASchema,
  type KitAppendixA,
  type Question,
  type Flashcard,
  type QuestionCategory,
  type PipelineProgressEvent,
} from "@trao/shared";

export interface PipelineOptions {
  jd: string;
  companyUrl: string;
  days: number;
  allowLocalUrls?: boolean;
  maxPasses?: number;
  onProgress?: (event: PipelineProgressEvent) => void;
  client?: ResilientLLMClient;
}

/**
 * End-to-end multi-step AI Prep Kit Pipeline
 * Implements strict sequencing, deterministic gap analysis, and the second-pass loop.
 */
export async function runPipeline(options: PipelineOptions): Promise<KitAppendixA> {
  const {
    jd,
    companyUrl,
    days,
    allowLocalUrls = process.env.ALLOW_LOCAL_URLS === "true",
    maxPasses = 2,
    onProgress = () => {},
    client = llmClient,
  } = options;

  onProgress({
    step: "INIT",
    message: "Initializing interview prep pipeline...",
    progressPercent: 5,
  });

  // 1. Crawl Company Website (with SSRF guard)
  onProgress({
    step: "CRAWLING",
    message: `Crawling company site at ${companyUrl}...`,
    progressPercent: 15,
  });

  const crawlResult = await crawlCompanySite(companyUrl, {
    allowLocalUrls,
    maxPages: 3,
  });

  // 2. Extract JD Requirements
  onProgress({
    step: "JD_EXTRACTION",
    message: "Extracting must-have and nice-to-have requirements from job description...",
    progressPercent: 30,
  });

  const role = await extractRoleRequirements(jd, client);

  // 3. Synthesize Company Brief & Interview Culture
  onProgress({
    step: "SYNTHESIS",
    message: "Synthesizing company brief and interview process research...",
    progressPercent: 45,
  });

  const { brief: company_brief, interviewInsights } = await synthesizeCompanyBrief(
    companyUrl,
    crawlResult.pages,
    client
  );

  // 4. Generate Category-Specific Questions (deliberate separate steps)
  onProgress({
    step: "QUESTION_GENERATION",
    message: "Generating technical and system design interview questions...",
    progressPercent: 60,
  });

  let questions: Question[] = [];

  // Generate Technical Questions
  const techQuestions = await generateCategoryQuestions(
    "technical",
    role.requirements,
    interviewInsights,
    questions.length,
    client
  );
  questions.push(...techQuestions);

  // Generate System Design Questions (if relevant)
  const sysQuestions = await generateCategoryQuestions(
    "system-design",
    role.requirements,
    interviewInsights,
    questions.length,
    client
  );
  questions.push(...sysQuestions);

  // Generate Behavioural Questions
  const behQuestions = await generateCategoryQuestions(
    "behavioural",
    role.requirements,
    interviewInsights,
    questions.length,
    client
  );
  questions.push(...behQuestions);

  // Generate Company-Fit Questions
  const fitQuestions = await generateCategoryQuestions(
    "company-fit",
    role.requirements,
    `${company_brief.what_they_do}. Culture: ${interviewInsights}`,
    questions.length,
    client
  );
  questions.push(...fitQuestions);

  // 5. Generate Flashcards
  onProgress({
    step: "FLASHCARD_GENERATION",
    message: "Creating active-recall study flashcards...",
    progressPercent: 75,
  });

  const flashcards: Flashcard[] = await generateFlashcards(
    role.requirements,
    0,
    client
  );

  // 6. Deterministic Coverage Check (First Pass)
  onProgress({
    step: "COVERAGE_CHECK",
    message: "Evaluating coverage gaps against must-have requirements...",
    progressPercent: 80,
  });

  let coverage = computeCoverageGaps(role.requirements, questions, 1);

  // 7. The Second Pass Loop (Trao Section 4)
  // "The coverage check exists to force a loop rather than a single shot.
  // After the first draft, the system compares the questions against the requirements,
  // and any requirement with no question against it comes back as a gap. It must then act on those gaps."
  if (coverage.uncovered_requirement_ids.length > 0 && maxPasses >= 2) {
    onProgress({
      step: "SECOND_PASS",
      message: `Identified ${coverage.uncovered_requirement_ids.length} uncovered must-have requirements. Executing second pass...`,
      progressPercent: 85,
      data: { gaps: coverage.uncovered_requirement_ids },
    });

    const uncoveredReqs = role.requirements.filter((r) =>
      coverage.uncovered_requirement_ids.includes(r.id)
    );

    for (const missingReq of uncoveredReqs) {
      const targetCategory: QuestionCategory =
        missingReq.kind === "behavioural" ? "behavioural" : "technical";

      const targetedQuestions = await generateCategoryQuestions(
        targetCategory,
        [missingReq],
        `Prioritize covering requirement: ${missingReq.text}`,
        questions.length,
        client
      );

      // Explicitly link newly generated questions to the missing requirement id
      for (const tq of targetedQuestions) {
        if (!tq.requirement_ids.includes(missingReq.id)) {
          tq.requirement_ids.push(missingReq.id);
        }
      }

      questions.push(...targetedQuestions);
    }

    // Recompute coverage gaps deterministically for pass 2
    coverage = computeCoverageGaps(role.requirements, questions, 2);
  }

  // 8. Deterministic Arithmetic Schedule Allocation (Trao Section 8)
  onProgress({
    step: "SCHEDULING",
    message: `Allocating day-by-day schedule arithmetically across ${days} days...`,
    progressPercent: 92,
  });

  const schedule = allocateSchedule(questions, role.requirements, days);

  // 9. Assemble & Validate Kit (Appendix A)
  const candidateKit: KitAppendixA = {
    source: {
      company: crawlResult.pages[0]?.title?.split(/[|\-–]/)[0]?.trim() || "Company",
      company_url: companyUrl,
      role: role.title,
      location: "Not Specified",
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: crawlResult.pagesUsed.length > 0 ? crawlResult.pagesUsed : [companyUrl],
    },
    company_brief,
    role,
    questions,
    flashcards,
    schedule,
    coverage,
  };

  // Validate strictly against Appendix A schema
  const parsedResult = KitAppendixASchema.safeParse(candidateKit);
  if (!parsedResult.success) {
    console.error("[Pipeline] Validation error against Appendix A:", parsedResult.error.format());
    // Auto-correct any subtle schedule index issues if needed
    throw new Error(`Generated kit did not conform to Appendix A schema: ${parsedResult.error.message}`);
  }

  onProgress({
    step: "COMPLETE",
    message: "Interview prep kit successfully generated.",
    progressPercent: 100,
  });

  return candidateKit;
}
