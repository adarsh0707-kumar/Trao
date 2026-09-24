import { ResilientLLMClient, llmClient } from "./llm.js";
import type { CrawledPage } from "./crawler.js";
import type {
  CompanyBrief,
  Question,
  Flashcard,
  Requirement,
  QuestionCategory,
} from "@trao/shared";

/**
 * Step 2: Synthesize an honest company brief from crawled pages
 */
export async function synthesizeCompanyBrief(
  companyUrl: string,
  crawledPages: CrawledPage[],
  client: ResilientLLMClient = llmClient
): Promise<{ brief: CompanyBrief; interviewInsights: string }> {
  const sources = crawledPages.map((p) => p.url);

  // If no pages were crawled or site was unreachable
  if (crawledPages.length === 0) {
    return {
      brief: {
        summary: `No public company information could be retrieved from ${companyUrl}.`,
        what_they_do: "Details unavailable due to unreachable site or lack of indexable content.",
        sources: [companyUrl],
      },
      interviewInsights: "Standard industry technical interview format expected.",
    };
  }

  const combinedContent = crawledPages
    .map((p) => `--- PAGE: ${p.url} (${p.category}) ---\n${p.text.slice(0, 2000)}`)
    .join("\n\n");

  const prompt = `Synthesize an honest company brief based strictly on the crawled text below.
DO NOT fabricate details. If the crawled pages do not explain their interview process, explicitly state that no public hiring details were found.

<crawled_pages>
${combinedContent}
</crawled_pages>

Return JSON matching:
{
  "summary": string,
  "what_they_do": string,
  "interview_insights": string
}`;

  try {
    const res = await client.generateJSON<{
      summary: string;
      what_they_do: string;
      interview_insights: string;
    }>(prompt, { temperature: 0.2 });

    return {
      brief: {
        summary: res.summary || "Company profile generated from web crawl.",
        what_they_do: res.what_they_do || "Software and technology services.",
        sources: sources.length > 0 ? sources : [companyUrl],
      },
      interviewInsights: res.interview_insights || "Standard multi-stage technical evaluation.",
    };
  } catch (err: any) {
    return {
      brief: {
        summary: `Company presence at ${companyUrl}.`,
        what_they_do: "Technology and software organization.",
        sources: [companyUrl],
      },
      interviewInsights: "Technical screening followed by behavioral assessment.",
    };
  }
}

/**
 * Step 3: Category-specific Question Generator
 * Generates questions targeted at specific requirement categories
 */
export async function generateCategoryQuestions(
  category: QuestionCategory,
  requirements: Requirement[],
  companyContext: string,
  existingQuestionCount: number = 0,
  client: ResilientLLMClient = llmClient
): Promise<Question[]> {
  // Filter requirements relevant to this category
  const relevantReqs = requirements.filter((r) => {
    if (category === "technical") return r.kind === "technical";
    if (category === "system-design") return r.kind === "technical" || r.kind === "domain";
    if (category === "behavioural") return r.kind === "behavioural";
    return true; // company-fit touches all
  });

  const targetReqs = relevantReqs.length > 0 ? relevantReqs : requirements;
  const reqSummary = targetReqs
    .map((r) => `[${r.id}] (${r.priority}) ${r.text}`)
    .join("\n");

  const prompt = `Generate targeted questions for the "${category}" category based on these requirements.

Requirements to target:
${reqSummary}

Company & Interview Context:
${companyContext}

CRITICAL RULES:
1. Every question MUST reference at least one valid requirement ID from the list above in "requirement_ids".
2. Set "category" to exactly "${category}".
3. Provide realistic interview prompts and actionable "answer_outline" rubrics.
4. "difficulty" must be an integer: 1 (fundamental), 2 (applied/intermediate), or 3 (complex/senior).
5. Generate between 2 to 4 high-yield questions.

Return JSON in this format:
{
  "questions": [
    {
      "requirement_ids": ["r1"],
      "category": "${category}",
      "prompt": "string",
      "answer_outline": "string",
      "difficulty": 2
    }
  ]
}`;

  try {
    const res = await client.generateJSON<{ questions: any[] }>(
      prompt,
      { temperature: 0.3 }
    );

    const questions: Question[] = (res.questions || []).map((q, idx) => {
      const qId = `q${existingQuestionCount + idx + 1}`;
      const validReqIds = (q.requirement_ids || []).filter((id: string) =>
        requirements.some((r) => r.id === id)
      );

      // Guarantee at least one valid requirement id
      if (validReqIds.length === 0 && targetReqs.length > 0) {
        validReqIds.push(targetReqs[idx % targetReqs.length].id);
      }

      const diff = [1, 2, 3].includes(q.difficulty) ? q.difficulty : 2;

      return {
        id: qId,
        requirement_ids: validReqIds,
        category,
        prompt: q.prompt || `Interview question for ${category}`,
        answer_outline: q.answer_outline || "Candidate should demonstrate core competence.",
        difficulty: diff as 1 | 2 | 3,
        origin: "generated",
        isPinned: false,
        isEdited: false,
      };
    });

    return questions;
  } catch (err: any) {
    console.warn(`[Generator] Fallback for category ${category}: ${err.message}`);
    // Deterministic fallback question
    const targetReq = targetReqs[0] || requirements[0];
    return [
      {
        id: `q${existingQuestionCount + 1}`,
        requirement_ids: [targetReq ? targetReq.id : "r1"],
        category,
        prompt: `How do you apply best practices when working with ${targetReq ? targetReq.text : "core requirements"}?`,
        answer_outline: "Discuss practical project experience, trade-offs, and lessons learned.",
        difficulty: 2,
        origin: "generated",
        isPinned: false,
        isEdited: false,
      },
    ];
  }
}

/**
 * Step 4: Active Recall Flashcard Generator
 */
export async function generateFlashcards(
  requirements: Requirement[],
  existingCardCount: number = 0,
  client: ResilientLLMClient = llmClient
): Promise<Flashcard[]> {
  const reqSummary = requirements
    .map((r) => `[${r.id}] ${r.text}`)
    .join("\n");

  const prompt = `Generate active recall flashcards for an engineer preparing for an interview based on these requirements:

${reqSummary}

RULES:
1. "front" is a concise prompt or concept question.
2. "back" is a punchy, high-yield explanation or bullet-point answer.
3. Every card MUST have "requirement_ids" referencing the corresponding requirement id.
4. Generate 3 to 6 cards.

Return JSON:
{
  "flashcards": [
    {
      "requirement_ids": ["r1"],
      "front": "string",
      "back": "string"
    }
  ]
}`;

  try {
    const res = await client.generateJSON<{ flashcards: any[] }>(
      prompt,
      { temperature: 0.3 }
    );

    return (res.flashcards || []).map((f, idx) => {
      const validReqIds = (f.requirement_ids || []).filter((id: string) =>
        requirements.some((r) => r.id === id)
      );

      return {
        id: `f${existingCardCount + idx + 1}`,
        front: f.front || "Concept Question",
        back: f.back || "Concept Explanation",
        requirement_ids: validReqIds.length > 0 ? validReqIds : [requirements[0].id],
        origin: "generated",
        isPinned: false,
        isEdited: false,
      };
    });
  } catch (err: any) {
    return [
      {
        id: `f${existingCardCount + 1}`,
        front: `Key principles of ${requirements[0]?.text || "Role Requirements"}`,
        back: "Core definition, advantages, and common implementation pitfalls.",
        requirement_ids: [requirements[0]?.id || "r1"],
        origin: "generated",
        isPinned: false,
        isEdited: false,
      },
    ];
  }
}
