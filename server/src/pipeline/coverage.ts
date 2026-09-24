import type { Requirement, Question, CoverageInfo } from "@trao/shared";

/**
 * Computes coverage gaps between questions and requirements deterministically.
 * Per Trao specification Section 3 & 4:
 * "Comparing the extracted requirements against the generated questions to find
 * the gaps is likewise your code's decision to make, not the model's."
 *
 * Rules:
 * 1. Only MUST-have requirements count as gaps if uncovered.
 * 2. Nice-to-have requirements are tracked but do not constitute critical gaps.
 * 3. Every question explicitly maps to one or more requirement IDs.
 */
export function computeCoverageGaps(
  requirements: Requirement[],
  questions: Question[],
  currentPasses: number = 1
): CoverageInfo {
  // 1. Identify all must-have requirement IDs
  const mustReqs = requirements.filter((r) => r.priority === "must");
  const mustReqIdSet = new Set(mustReqs.map((r) => r.id));

  // 2. Identify all requirement IDs referenced in the questions
  const coveredReqIdSet = new Set<string>();
  for (const q of questions) {
    if (Array.isArray(q.requirement_ids)) {
      for (const reqId of q.requirement_ids) {
        coveredReqIdSet.add(reqId);
      }
    }
  }

  // 3. Any must-have requirement ID not in coveredReqIdSet is an uncovered gap
  const uncovered_requirement_ids: string[] = [];
  for (const mustReq of mustReqs) {
    if (!coveredReqIdSet.has(mustReq.id)) {
      uncovered_requirement_ids.push(mustReq.id);
    }
  }

  return {
    uncovered_requirement_ids,
    passes: currentPasses,
  };
}

/**
 * Validates if any must-have requirements remain uncovered
 */
export function hasUncoveredMustHaves(coverage: CoverageInfo): boolean {
  return coverage.uncovered_requirement_ids.length > 0;
}
