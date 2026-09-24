import { describe, it, expect } from "vitest";
import { mergeCategoryRegeneration } from "../src/pipeline/builder.js";
import type { Question } from "@trao/shared";

describe("The Builder State Preservation (Section 6 Compliance)", () => {
  const initialQuestions: Question[] = [
    {
      id: "q1",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Original AI technical prompt",
      answer_outline: "Original outline",
      difficulty: 2,
      origin: "generated",
      isEdited: false,
      isPinned: false,
    },
    {
      id: "q2",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "User edited this technical prompt",
      answer_outline: "Custom candidate notes",
      difficulty: 3,
      origin: "generated",
      isEdited: true, // USER EDITED
      isPinned: false,
    },
    {
      id: "q3",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "User pinned this question",
      answer_outline: "Pinned answer",
      difficulty: 2,
      origin: "generated",
      isEdited: false,
      isPinned: true, // USER PINNED
    },
    {
      id: "q4",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Question written by hand by user",
      answer_outline: "User custom question",
      difficulty: 1,
      origin: "user", // HAND-WRITTEN BY USER
      isEdited: false,
      isPinned: false,
    },
    {
      id: "q5",
      requirement_ids: ["r2"],
      category: "behavioural",
      prompt: "Tell me about a leadership failure",
      answer_outline: "STAR format",
      difficulty: 2,
      origin: "generated",
      isEdited: false,
      isPinned: false,
    },
  ];

  const freshIncomingTechnicalQuestions: Question[] = [
    {
      id: "temp_1",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Brand new AI generated technical question",
      answer_outline: "Brand new outline",
      difficulty: 3,
    },
  ];

  it("preserves user-edited, user-pinned, and user-handwritten questions upon regenerating their category", () => {
    const result = mergeCategoryRegeneration(
      initialQuestions,
      freshIncomingTechnicalQuestions,
      "technical"
    );

    const prompts = result.map((q) => q.prompt);

    // 1. Untouched AI question (q1) should be replaced
    expect(prompts).not.toContain("Original AI technical prompt");

    // 2. User edited question (q2) MUST be preserved
    expect(prompts).toContain("User edited this technical prompt");
    const editedQ = result.find((q) => q.prompt === "User edited this technical prompt");
    expect(editedQ?.isEdited).toBe(true);
    expect(editedQ?.answer_outline).toBe("Custom candidate notes");

    // 3. User pinned question (q3) MUST be preserved
    expect(prompts).toContain("User pinned this question");
    const pinnedQ = result.find((q) => q.prompt === "User pinned this question");
    expect(pinnedQ?.isPinned).toBe(true);

    // 4. Hand-written question (q4) MUST be preserved
    expect(prompts).toContain("Question written by hand by user");
    const userQ = result.find((q) => q.prompt === "Question written by hand by user");
    expect(userQ?.origin).toBe("user");

    // 5. Fresh generated question must be included
    expect(prompts).toContain("Brand new AI generated technical question");

    // 6. Behavioural question (q5) in other category must be completely untouched
    expect(prompts).toContain("Tell me about a leadership failure");
  });
});
