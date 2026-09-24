import { describe, it, expect } from "vitest";
import { KitAppendixASchema } from "@trao/shared";
import type { KitAppendixA } from "@trao/shared";

describe("Appendix A Kit Schema Compliance", () => {
  const validKit: KitAppendixA = {
    source: {
      company: "Acme Corp",
      company_url: "https://acme.example.com",
      role: "Senior Backend Engineer",
      location: "Remote",
      jd_chars: 1450,
      researched_at: "2026-09-24T00:00:00.000Z",
      pages_used: ["https://acme.example.com/careers"],
    },
    company_brief: {
      summary: "Acme Corp builds high-throughput payment infrastructure.",
      what_they_do: "Global payment rails and ledger accounting engines.",
      sources: ["https://acme.example.com/careers"],
    },
    role: {
      title: "Senior Backend Engineer",
      seniority: "Senior",
      responsibilities: ["Design high availability payment microservices"],
      requirements: [
        { id: "r1", text: "5+ years Node.js and distributed systems", kind: "technical", priority: "must" },
        { id: "r2", text: "Experience mentoring juniors", kind: "behavioural", priority: "must" },
      ],
    },
    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "How does Node.js event loop handle IO polling?",
        answer_outline: "Libuv, epoll/kqueue, poll phase...",
        difficulty: 2,
      },
      {
        id: "q2",
        requirement_ids: ["r2"],
        category: "behavioural",
        prompt: "Describe how you handle code review conflicts.",
        answer_outline: "Empathy, company standards, pairing...",
        difficulty: 1,
      },
    ],
    flashcards: [
      {
        id: "f1",
        front: "What is the primary event loop thread in Node.js?",
        back: "Single JavaScript execution thread backed by libuv thread pool.",
        requirement_ids: ["r1"],
      },
    ],
    schedule: {
      days_available: 2,
      days: [
        { day: 1, focus: "Core Technical Concepts", question_ids: ["q1"], minutes: 45 },
        { day: 2, focus: "Behavioural & Leadership", question_ids: ["q2"], minutes: 30 },
      ],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 1,
    },
  };

  it("validates a compliant Appendix A kit successfully", () => {
    const parsed = KitAppendixASchema.safeParse(validKit);
    expect(parsed.success).toBe(true);
  });

  it("fails validation if question references non-existent requirement id", () => {
    const invalidKit = JSON.parse(JSON.stringify(validKit));
    invalidKit.questions[0].requirement_ids = ["r999_nonexistent"];

    const parsed = KitAppendixASchema.safeParse(invalidKit);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message.includes("r999_nonexistent"))).toBe(true);
    }
  });

  it("fails validation if schedule day references non-existent question id", () => {
    const invalidKit = JSON.parse(JSON.stringify(validKit));
    invalidKit.schedule.days[0].question_ids = ["q999_nonexistent"];

    const parsed = KitAppendixASchema.safeParse(invalidKit);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message.includes("q999_nonexistent"))).toBe(true);
    }
  });

  it("fails validation if schedule days length does not match days_available", () => {
    const invalidKit = JSON.parse(JSON.stringify(validKit));
    invalidKit.schedule.days_available = 5; // but days.length is 2

    const parsed = KitAppendixASchema.safeParse(invalidKit);
    expect(parsed.success).toBe(false);
  });
});
