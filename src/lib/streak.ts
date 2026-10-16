import { dateKey } from './util';
import type { Attempt } from './types';

/**
 * Study streak with a "grace day": one missed day within any rolling 7-day window
 * does not break the streak. A day counts if ≥ 5 study minutes were logged, a question
 * was attempted, or flashcards were reviewed.
 */
export function activeDays(studyLog: Record<string, number>, attempts: Attempt[], cards: Record<string, number>): Set<string> {
  const s = new Set<string>();
  for (const [k, v] of Object.entries(studyLog)) if (v >= 5) s.add(k);
  for (const a of attempts) s.add(dateKey(a.ts));
  for (const [k, v] of Object.entries(cards)) if (v > 0) s.add(k);
  return s;
}

export function streak(days: Set<string>, now = Date.now()): { current: number; graceUsed: boolean; best: number } {
  const DAY = 86_400_000;
  let current = 0;
  let graceUsedAt: number | null = null;
  let t = now;
  // today may not be done yet: if today is inactive, start from yesterday without penalty
  if (!days.has(dateKey(t))) t -= DAY;
  for (let i = 0; i < 2000; i++) {
    const k = dateKey(t - i * DAY);
    if (days.has(k)) {
      current++;
    } else {
      if (graceUsedAt === null || graceUsedAt - i >= 7) {
        // allow one miss per 7 days, but only if the streak continues on the other side
        if (days.has(dateKey(t - (i + 1) * DAY))) {
          graceUsedAt = i;
          continue;
        }
      }
      break;
    }
  }
  // best streak (simple scan, also with grace)
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  let graceInRun = false;
  for (const k of sorted) {
    const ts = new Date(k + 'T12:00:00').getTime();
    if (prev === null) run = 1;
    else {
      const gap = Math.round((ts - prev) / DAY);
      if (gap === 1) run++;
      else if (gap === 2 && !graceInRun) {
        run++;
        graceInRun = true;
      } else {
        run = 1;
        graceInRun = false;
      }
    }
    prev = ts;
    best = Math.max(best, run);
  }
  return { current, graceUsed: graceUsedAt !== null, best: Math.max(best, current) };
}
