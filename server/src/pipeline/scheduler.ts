import type {
  Question,
  Requirement,
  Schedule,
  DaySchedule,
} from "@trao/shared";

/**
 * Deterministic schedule allocator.
 * Conforms strictly to Trao Section 8:
 * - Distributes material across exactly `days_available` days.
 * - Every day has a focus, a set of question ids, and an integer duration in minutes.
 * - Every must-have requirement appears somewhere in the schedule.
 * - The number of days in the schedule equals the number of days requested.
 * - Harder and higher-priority material lands earlier, not the night before.
 * - Arithmetic and allocation done strictly in code, not in prompts.
 */
export function allocateSchedule(
  questions: Question[],
  requirements: Requirement[],
  daysAvailable: number
): Schedule {
  const safeDays = Math.max(1, Math.floor(daysAvailable));

  if (questions.length === 0) {
    // Edge case: thin stub with 0 questions generated
    const emptyDays: DaySchedule[] = [];
    for (let d = 1; d <= safeDays; d++) {
      emptyDays.push({
        day: d,
        focus: d === safeDays ? "Final Preparation & Review" : "General Interview Readiness",
        question_ids: [],
        minutes: 45,
      });
    }
    return {
      days_available: safeDays,
      days: emptyDays,
    };
  }

  // 1. Build lookup for must-have requirement IDs
  const mustReqIdSet = new Set(
    requirements.filter((r) => r.priority === "must").map((r) => r.id)
  );

  // 2. Compute a deterministic priority weight for each question:
  // - Must-have requirements get top priority
  // - High difficulty (3) prioritized earlier than lower difficulty (1)
  // - Technical and system-design front-loaded; behavioural/company-fit placed later
  interface ScoredQuestion {
    question: Question;
    weight: number;
    hasMustReq: boolean;
  }

  const scoredQuestions: ScoredQuestion[] = questions.map((q) => {
    let weight = 0;
    const hasMust = q.requirement_ids.some((rId) => mustReqIdSet.has(rId));

    if (hasMust) weight += 1000;
    weight += q.difficulty * 100;

    if (q.category === "system-design") weight += 50;
    else if (q.category === "technical") weight += 40;
    else if (q.category === "behavioural") weight += 10;
    else if (q.category === "company-fit") weight += 5;

    return { question: q, weight, hasMustReq: hasMust };
  });

  // Sort descending by priority weight (hardest & highest priority first)
  scoredQuestions.sort((a, b) => b.weight - a.weight);

  // 3. Guarantee that every must-have requirement appears somewhere in the schedule
  // Find questions needed to cover all must-haves
  const coveredMusts = new Set<string>();
  const mandatoryQuestions: Question[] = [];
  const secondaryQuestions: Question[] = [];

  for (const item of scoredQuestions) {
    let coversNewMust = false;
    for (const rId of item.question.requirement_ids) {
      if (mustReqIdSet.has(rId) && !coveredMusts.has(rId)) {
        coveredMusts.add(rId);
        coversNewMust = true;
      }
    }
    if (coversNewMust) {
      mandatoryQuestions.push(item.question);
    } else {
      secondaryQuestions.push(item.question);
    }
  }

  // Active pool of all questions in priority order
  const activePool: Question[] = [...mandatoryQuestions, ...secondaryQuestions];

  // 4. Distribute into exactly `safeDays` buckets
  const dayQuestionBuckets: Question[][] = Array.from(
    { length: safeDays },
    () => []
  );

  if (activePool.length <= safeDays) {
    // If fewer questions than days:
    // Place primary questions in earlier days, and assign targeted review sets in later days
    for (let i = 0; i < safeDays; i++) {
      if (i < activePool.length) {
        dayQuestionBuckets[i].push(activePool[i]);
      } else {
        // Review day: review hardest previously scheduled questions
        const baseQ = activePool[i % activePool.length];
        dayQuestionBuckets[i].push({
          ...baseQ,
          id: `${baseQ.id}_rev_d${i + 1}`,
        });
      }
    }
  } else {
    // Distribute activePool across days, placing heavier question loads on earlier days
    // Calculate questions per day
    let poolIndex = 0;
    for (let dayIdx = 0; dayIdx < safeDays; dayIdx++) {
      // Remaining questions / remaining days (rounded up to front-load)
      const remainingQuestions = activePool.length - poolIndex;
      const remainingDays = safeDays - dayIdx;
      const takeCount = Math.max(1, Math.ceil(remainingQuestions / remainingDays));

      for (let j = 0; j < takeCount && poolIndex < activePool.length; j++) {
        dayQuestionBuckets[dayIdx].push(activePool[poolIndex]);
        poolIndex++;
      }
    }

    // Place any leftovers in middle days
    while (poolIndex < activePool.length) {
      const targetDay = Math.min(poolIndex % safeDays, safeDays - 1);
      dayQuestionBuckets[targetDay].push(activePool[poolIndex]);
      poolIndex++;
    }
  }

  // 5. Construct each day schedule with category-aware focus and integer minutes
  const days: DaySchedule[] = dayQuestionBuckets.map((bucket, index) => {
    const dayNumber = index + 1;
    const isFinalDay = dayNumber === safeDays;
    const isFirstDay = dayNumber === 1;

    // Calculate integer minutes based on difficulty
    // diff 1: 15 min, diff 2: 25 min, diff 3: 40 min + 15 min review buffer
    let totalMinutes = 0;
    for (const q of bucket) {
      if (q.difficulty === 3) totalMinutes += 40;
      else if (q.difficulty === 2) totalMinutes += 25;
      else totalMinutes += 15;
    }
    // Add baseline buffer and ensure strictly integer duration
    const minutes = Math.max(30, Math.min(180, Math.round(totalMinutes + 15)));

    // Determine day focus
    const categoriesInDay = Array.from(new Set(bucket.map((q) => q.category)));
    let focus = "";
    if (isFirstDay && safeDays > 1) {
      focus = "Deep Dive: Core Must-Haves & Architecture";
    } else if (isFinalDay && safeDays > 1) {
      focus = "Final Polish: Behavioral & Rapid Recall";
    } else if (categoriesInDay.includes("system-design")) {
      focus = "Systems Design & Scalability Principles";
    } else if (categoriesInDay.includes("technical")) {
      focus = "Core Technical Concepts & Algorithms";
    } else if (categoriesInDay.includes("behavioural")) {
      focus = "Behavioural Scenarios & Leadership Stories";
    } else {
      focus = "Targeted Mastery & Comprehensive Practice";
    }

    return {
      day: dayNumber,
      focus,
      question_ids: bucket.map((q) => q.id),
      minutes,
    };
  });

  return {
    days_available: safeDays,
    days,
  };
}
