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
  targetCategory: QuestionCategory,
): Question[] {
  const otherCategories = existingQuestions.filter(
    (q) => q.category !== targetCategory,
  );

  const protectedQuestions = existingQuestions.filter(
    (q) =>
      q.category === targetCategory &&
      (q.isPinned || q.isEdited || q.origin === "user"),
  );

  const protectedPrompts = new Set(
    protectedQuestions.map((q) => q.prompt.trim().toLowerCase()),
  );

  const freshAdditions: Question[] = [];
  let nextIdCounter = existingQuestions.length + 1;

  for (const inc of incomingQuestions) {
    // Check prompt collision against protected items
    if (!protectedPrompts.has(inc.prompt.trim().toLowerCase())) {
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

  // Fallback: If all new items collided, attach incoming with explicit variant tags
  if (freshAdditions.length === 0 && incomingQuestions.length > 0) {
    for (const inc of incomingQuestions) {
      freshAdditions.push({
        ...inc,
        id: `q${nextIdCounter++}`,
        prompt: `${inc.prompt} (Updated Focus)`,
        category: targetCategory,
        origin: "generated",
        isPinned: false,
        isEdited: false,
      });
    }
  }

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
