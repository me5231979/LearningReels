/**
 * SM-2 Spaced Repetition Algorithm
 *
 * Quality ratings:
 * 0 - Complete failure (0-20%)
 * 1 - Incorrect, remembered upon seeing answer (20-40%)
 * 2 - Incorrect, but correct answer seemed easy to recall (40-60%)
 * 3 - Correct with serious difficulty (60-75%)
 * 4 - Correct with some hesitation (75-90%)
 * 5 - Perfect response (90-100%)
 */

export function scoreToQuality(score: number): number {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  if (score >= 20) return 1;
  return 0;
}

export function calculateNextReview(
  quality: number,
  repetitionCount: number,
  easeFactor: number,
  intervalDays: number
): {
  nextInterval: number;
  newEaseFactor: number;
  newRepetitionCount: number;
} {
  let newEaseFactor =
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  // Ease factor floor
  if (newEaseFactor < 1.3) newEaseFactor = 1.3;

  let newInterval: number;
  let newRepetitionCount: number;

  if (quality < 3) {
    // Failed — restart
    newRepetitionCount = 0;
    newInterval = 1;
  } else {
    newRepetitionCount = repetitionCount + 1;

    if (newRepetitionCount === 1) {
      newInterval = 1;
    } else if (newRepetitionCount === 2) {
      newInterval = 3;
    } else {
      newInterval = Math.round(intervalDays * newEaseFactor);
    }
  }

  // Cap at 90 days
  if (newInterval > 90) newInterval = 90;

  return {
    nextInterval: newInterval,
    newEaseFactor: newEaseFactor,
    newRepetitionCount: newRepetitionCount,
  };
}
