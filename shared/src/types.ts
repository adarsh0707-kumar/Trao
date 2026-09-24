/**
 * Core Types conforming strictly to Trao Engineering Assessment (FS-AI-INTERVIEW-01)
 * Appendix A: Kit Structure
 * Appendix B: Batch Input and Output
 */

// ---------------------------------------------------------------------------
// Appendix A: Kit Structure
// ---------------------------------------------------------------------------

export type RequirementKind = "technical" | "behavioural" | "domain";
export type RequirementPriority = "must" | "nice";

export interface Requirement {
  id: string; // e.g., "r1", "r2"
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
}

export type QuestionCategory =
  | "technical"
  | "behavioural"
  | "system-design"
  | "company-fit";

export interface Question {
  id: string; // e.g., "q1", "q2"
  requirement_ids: string[]; // Stable references to Requirement.id
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  
  // Builder Extension Metadata (optional, preserved in UI)
  isEdited?: boolean;
  isPinned?: boolean;
  origin?: "generated" | "user";
}

export interface Flashcard {
  id: string; // e.g., "f1", "f2"
  front: string;
  back: string;
  requirement_ids: string[]; // Stable references to Requirement.id

  // Practice & Builder Extension Metadata
  confidence?: 1 | 2 | 3 | 4 | 5;
  lastPracticedAt?: string;
  isEdited?: boolean;
  isPinned?: boolean;
  origin?: "generated" | "user";
}

export interface DaySchedule {
  day: number; // 1, 2, ... N
  focus: string;
  question_ids: string[]; // Must refer to existing questions
  minutes: number; // Integer minutes (e.g. 45, 60, 90)
}

export interface Schedule {
  days_available: number;
  days: DaySchedule[];
}

export interface SourceInfo {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number;
  researched_at: string; // ISO 8601 string
  pages_used: string[];
}

export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
}

export interface RoleInfo {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
}

export interface CoverageInfo {
  uncovered_requirement_ids: string[];
  passes: number;
}

export interface KitAppendixA {
  source: SourceInfo;
  company_brief: CompanyBrief;
  role: RoleInfo;
  questions: Question[];
  flashcards: Flashcard[];
  schedule: Schedule;
  coverage: CoverageInfo;
}

// ---------------------------------------------------------------------------
// Appendix B: Batch Input and Output
// ---------------------------------------------------------------------------

export interface BatchCaseInput {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

export interface BatchCaseError {
  code: string;
  message: string;
}

export interface BatchCaseOutput {
  id: string;
  status: "ok" | "failed";
  kit: KitAppendixA | null;
  error: BatchCaseError | null;
}

export interface BatchResultFile {
  version: "1.0";
  generated_at: string; // ISO 8601 string
  kits: BatchCaseOutput[];
}

// ---------------------------------------------------------------------------
// Pipeline & Crawler Internal Contracts
// ---------------------------------------------------------------------------

export interface ScrapedPage {
  url: string;
  title: string;
  content: string;
  isHiringPage?: boolean;
  isAboutPage?: boolean;
}

export interface CompanyResearchResult {
  pagesUsed: string[];
  summary: string;
  whatTheyDo: string;
  interviewInsights?: string;
  hiringCultureFound: boolean;
}

export interface PipelineProgressEvent {
  step:
    | "INIT"
    | "SSRF_CHECK"
    | "CRAWLING"
    | "JD_EXTRACTION"
    | "SYNTHESIS"
    | "QUESTION_GENERATION"
    | "FLASHCARD_GENERATION"
    | "COVERAGE_CHECK"
    | "SECOND_PASS"
    | "SCHEDULING"
    | "COMPLETE"
    | "FAILED";
  message: string;
  progressPercent: number;
  data?: any;
}
