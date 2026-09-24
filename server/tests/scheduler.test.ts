import { describe, it, expect } from "vitest";
import { allocateSchedule } from "../src/pipeline/scheduler.js";
import type { Question, Requirement } from "@trao/shared";

describe("Deterministic Schedule Allocator (Section 8 Compliance)", () => {
  const mockRequirements: Requirement[] = [
    { id: "r1", text: "5+ years with React and TypeScript", kind: "technical", priority: "must" },
    { id: "r2", text: "Distributed systems and Node.js architecture", kind: "technical", priority: "must" },
    { id: "r3", text: "Mentoring junior engineers and code reviews", kind: "behavioural", priority: "must" },
    { id: "r4", text: "Familiarity with Kubernetes", kind: "technical", priority: "nice" },
  ];

  const mockQuestions: Question[] = [
    {
      id: "q1",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Explain React 18 concurrent rendering and fiber architecture.",
      answer_outline: "Covers fiber nodes, work loop, lane priorities...",
      difficulty: 3,
    },
    {
      id: "q2",
      requirement_ids: ["r2"],
      category: "system-design",
      prompt: "Design a horizontally scalable event processing queue.",
      answer_outline: "Discuss partitioning, consumer groups, idempotency...",
      difficulty: 3,
    },
    {
      id: "q3",
      requirement_ids: ["r3"],
      category: "behavioural",
      prompt: "Tell me about a time you mentored a struggling junior developer.",
      answer_outline: "STAR format: constructive feedback, pairing, outcome...",
      difficulty: 1,
    },
    {
      id: "q4",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "What is the difference between useMemo and useCallback?",
      answer_outline: "Memoizing values vs function references...",
      difficulty: 1,
    },
    {
      id: "q5",
      requirement_ids: ["r4"],
      category: "technical",
      prompt: "How does a Kubernetes Deployment manage replica sets?",
      answer_outline: "Pod controllers, rolling updates, rollbacks...",
      difficulty: 2,
    },
  ];

  it("produces exactly the requested number of days", () => {
    const daysRequested = [1, 3, 5, 7, 14, 30];
    for (const d of daysRequested) {
      const schedule = allocateSchedule(mockQuestions, mockRequirements, d);
      expect(schedule.days_available).toBe(d);
      expect(schedule.days.length).toBe(d);
    }
  });

  it("ensures every must-have requirement appears somewhere in the schedule", () => {
    const schedule = allocateSchedule(mockQuestions, mockRequirements, 5);
    const scheduledQuestionIds = new Set(schedule.days.flatMap((d) => d.question_ids));

    const scheduledReqIds = new Set<string>();
    for (const q of mockQuestions) {
      if (scheduledQuestionIds.has(q.id)) {
        for (const reqId of q.requirement_ids) {
          scheduledReqIds.add(reqId);
        }
      }
    }

    const mustReqs = mockRequirements.filter((r) => r.priority === "must");
    for (const must of mustReqs) {
      expect(scheduledReqIds.has(must.id)).toBe(true);
    }
  });

  it("front-loads harder material into earlier days", () => {
    const schedule = allocateSchedule(mockQuestions, mockRequirements, 5);
    const qMap = new Map(mockQuestions.map((q) => [q.id, q]));

    // Day 1 average difficulty should be >= Day 5 average difficulty
    const day1Questions = schedule.days[0].question_ids.map((id) => qMap.get(id)!);
    const day5Questions = schedule.days[4].question_ids.map((id) => qMap.get(id)!);

    const avgDay1 = day1Questions.reduce((acc, q) => acc + q.difficulty, 0) / day1Questions.length;
    const avgDay5 = day5Questions.reduce((acc, q) => acc + q.difficulty, 0) / day5Questions.length;

    expect(avgDay1).toBeGreaterThanOrEqual(avgDay5);
  });

  it("ensures all day durations are strictly integer minutes", () => {
    const schedule = allocateSchedule(mockQuestions, mockRequirements, 5);
    for (const day of schedule.days) {
      expect(Number.isInteger(day.minutes)).toBe(true);
      expect(day.minutes).toBeGreaterThan(0);
    }
  });

  it("ensures every question_id in schedule refers to an existing question", () => {
    const validQIds = new Set(mockQuestions.map((q) => q.id));
    const schedule = allocateSchedule(mockQuestions, mockRequirements, 5);

    for (const day of schedule.days) {
      for (const qId of day.question_ids) {
        expect(validQIds.has(qId)).toBe(true);
      }
    }
  });

  it("handles extreme edge case: 1-day schedule", () => {
    const schedule = allocateSchedule(mockQuestions, mockRequirements, 1);
    expect(schedule.days.length).toBe(1);
    expect(schedule.days[0].day).toBe(1);
    expect(schedule.days[0].question_ids.length).toBeGreaterThan(0);
    expect(Number.isInteger(schedule.days[0].minutes)).toBe(true);
  });
});
