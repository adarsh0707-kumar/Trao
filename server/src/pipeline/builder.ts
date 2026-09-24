import type {
  Question,
  QuestionCategory,
  Requirement,
  Schedule,
} from "@trao/shared";
import { allocateSchedule } from "./scheduler.js";

/**
 * Merges regenerated category questions while strictly preserving user edits and pinned items.
 * Per Trao Section 6:
 * "Regenerating one section must not discard edits the user has made elsewhere,
 * and a question the user wrote or edited by hand must survive a regeneration of its category."
 */
export function mergeCategoryRegeneration(
  existingQuestions: Question[],
  incomingQuestions: Question[],
  targetCategory: QuestionCategory
): Question[] {
  // 1. Keep questions in other categories completely intact
  const otherCategories = existingQuestions.filter(
    (q) => q.category !== targetCategory
  );

  // 2. In target category, identify protected questions:
  //    - Pinned by user (isPinned === true)
  //    - Edited by user (isEdited === true)
  //    - Created by hand by user (origin === "user")
  const protectedQuestions = existingQuestions.filter(
    (q) =>
      q.category === targetCategory &&
      (q.isPinned || q.isEdited || q.origin === "user")
  );

  // 3. Normalize incoming questions to avoid duplicate prompts with protected items
  const protectedPrompts = new Set(
    protectedQuestions.map((q) => q.prompt.trim().toLowerCase())
  );

  // Filter out any incoming question that duplicates an already protected question
  const freshAdditions: Question[] = [];
  let nextIdCounter = existingQuestions.length + 1;

  for (const inc of incomingQuestions) {
    if (!protectedPrompts.has(inc.prompt.trim().toLowerCase())) {
      // Ensure incoming questions have unique sequential IDs
      freshAdditions.push({
        ...inc,
        id: `q${nextIdCounter++}`,
        category: targetCategory,
        origin: "generated",
        isPinned: false,
        isEdited: false,
      });
    }
  }

  // 4. Return combined list: Other categories + Protected items + Fresh generated questions
  return [...otherCategories, ...protectedQuestions, ...freshAdditions];
}

/**
 * Re-allocates the study schedule after questions or requirements are edited/regenerated
 */
export function recalculateSchedule(
  questions: Question[],
  requirements: Requirement[],
  daysAvailable: number
): Schedule {
  return allocateSchedule(questions, requirements, daysAvailable);
}
