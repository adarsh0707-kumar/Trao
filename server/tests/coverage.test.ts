import { describe, it, expect } from "vitest";
import { computeCoverageGaps, hasUncoveredMustHaves } from "../src/pipeline/coverage.js";
import type { Question, Requirement } from "@trao/shared";

describe("Deterministic Coverage Gap Checker (Section 3 & 4 Compliance)", () => {
  const requirements: Requirement[] = [
    { id: "r1", text: "Strong proficiency with React", kind: "technical", priority: "must" },
    { id: "r2", text: "Experience with PostgreSQL indexing", kind: "technical", priority: "must" },
    { id: "r3", text: "Agile sprint leadership", kind: "behavioural", priority: "nice" },
  ];

  it("detects when a must-have requirement has no corresponding question", () => {
    // Only r1 covered
    const questions: Question[] = [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Explain React hooks rules",
        answer_outline: "Hooks order, fiber linked list...",
        difficulty: 2,
      },
    ];

    const coverage = computeCoverageGaps(requirements, questions, 1);
    expect(coverage.uncovered_requirement_ids).toEqual(["r2"]);
    expect(hasUncoveredMustHaves(coverage)).toBe(true);
    expect(coverage.passes).toBe(1);
  });

  it("does not flag nice-to-have requirements as uncovered critical gaps", () => {
    // r1 and r2 covered, r3 (nice) uncovered
    const questions: Question[] = [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "React hooks",
        answer_outline: "...",
        difficulty: 2,
      },
      {
        id: "q2",
        requirement_ids: ["r2"],
        category: "technical",
        prompt: "Postgres B-Trees vs Hash indexes",
        answer_outline: "...",
        difficulty: 3,
      },
    ];

    const coverage = computeCoverageGaps(requirements, questions, 1);
    expect(coverage.uncovered_requirement_ids).toEqual([]);
    expect(hasUncoveredMustHaves(coverage)).toBe(false);
  });

  it("handles questions that cover multiple requirements simultaneously", () => {
    const questions: Question[] = [
      {
        id: "q1",
        requirement_ids: ["r1", "r2"],
        category: "system-design",
        prompt: "Build a real-time analytics dashboard with React and Postgres",
        answer_outline: "Covers frontend state management and backend indexing strategies...",
        difficulty: 3,
      },
    ];

    const coverage = computeCoverageGaps(requirements, questions, 1);
    expect(coverage.uncovered_requirement_ids).toEqual([]);
    expect(hasUncoveredMustHaves(coverage)).toBe(false);
  });
});
