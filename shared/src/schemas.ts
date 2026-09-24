import { z } from "zod";

export const RequirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(["technical", "behavioural", "domain"]),
  priority: z.enum(["must", "nice"]),
});

export const QuestionCategorySchema = z.enum([
  "technical",
  "behavioural",
  "system-design",
  "company-fit",
]);

export const QuestionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string()),
  category: QuestionCategorySchema,
  prompt: z.string().min(1),
  answer_outline: z.string().min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  // Optional builder metadata
  isEdited: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  origin: z.enum(["generated", "user"]).optional(),
});

export const FlashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()),
  confidence: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  lastPracticedAt: z.string().optional(),
  isEdited: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  origin: z.enum(["generated", "user"]).optional(),
});

export const DayScheduleSchema = z.object({
  day: z.number().int().positive(),
  focus: z.string(),
  question_ids: z.array(z.string()),
  minutes: z.number().int().positive(),
});

export const ScheduleSchema = z.object({
  days_available: z.number().int().positive(),
  days: z.array(DayScheduleSchema),
});

export const SourceInfoSchema = z.object({
  company: z.string(),
  company_url: z.string(),
  role: z.string(),
  location: z.string(),
  jd_chars: z.number().int().nonnegative(),
  researched_at: z.string(),
  pages_used: z.array(z.string()),
});

export const CompanyBriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
  sources: z.array(z.string()),
});

export const RoleInfoSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(RequirementSchema),
});

export const CoverageInfoSchema = z.object({
  uncovered_requirement_ids: z.array(z.string()),
  passes: z.number().int().positive(),
});

export const KitAppendixASchema = z.object({
  source: SourceInfoSchema,
  company_brief: CompanyBriefSchema,
  role: RoleInfoSchema,
  questions: z.array(QuestionSchema),
  flashcards: z.array(FlashcardSchema),
  schedule: ScheduleSchema,
  coverage: CoverageInfoSchema,
}).superRefine((data, ctx) => {
  // Assessment Rule 1: Every requirement gets a stable id
  const reqIds = new Set(data.role.requirements.map((r) => r.id));

  // Assessment Rule 2: Every question references the requirement ids it covers
  const questionIds = new Set<string>();
  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    questionIds.add(q.id);
    for (const rId of q.requirement_ids) {
      if (!reqIds.has(rId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Question '${q.id}' references unknown requirement id '${rId}'`,
          path: ["questions", i, "requirement_ids"],
        });
      }
    }
  }

  // Assessment Rule: Every question_ids entry in the schedule must refer to a question that exists
  for (let i = 0; i < data.schedule.days.length; i++) {
    const day = data.schedule.days[i];
    for (const qId of day.question_ids) {
      if (!questionIds.has(qId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Schedule day ${day.day} references unknown question id '${qId}'`,
          path: ["schedule", "days", i, "question_ids"],
        });
      }
    }
  }

  // Assessment Rule: Durations are integer minutes
  for (let i = 0; i < data.schedule.days.length; i++) {
    const day = data.schedule.days[i];
    if (!Number.isInteger(day.minutes) || day.minutes <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Schedule day ${day.day} duration must be an integer minute count`,
        path: ["schedule", "days", i, "minutes"],
      });
    }
  }

  // Assessment Rule: Number of days in schedule equals days_available
  if (data.schedule.days.length !== data.schedule.days_available) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Schedule day count (${data.schedule.days.length}) does not match days_available (${data.schedule.days_available})`,
      path: ["schedule", "days"],
    });
  }
});

// Appendix B schemas
export const BatchCaseInputSchema = z.object({
  id: z.string().min(1),
  jd: z.string().min(1),
  company_url: z.string(),
  days: z.number().int().positive(),
});

export const BatchCaseInputsArraySchema = z.array(BatchCaseInputSchema);

export const BatchCaseOutputSchema = z.object({
  id: z.string(),
  status: z.enum(["ok", "failed"]),
  kit: KitAppendixASchema.nullable(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .nullable(),
});

export const BatchResultFileSchema = z.object({
  version: z.literal("1.0"),
  generated_at: z.string(),
  kits: z.array(BatchCaseOutputSchema),
});
