import type { SrsCard, SrsRating } from './types';

/**
 * Spaced-repetition engine — an SM-2 variant with a fixed early ladder.
 *
 * The first six reviews follow the ladder 1 → 3 → 7 → 14 → 30 → 60 days.
 * Beyond the ladder, intervals grow by the card's ease factor (SM-2 style).
 *   Again → back to the bottom of the ladder (due tomorrow), ease −0.20
 *   Hard  → stay on the current rung (interval ×1.2 beyond ladder), ease −0.15
 *   Good  → climb one rung
 *   Easy  → climb two rungs, ease +0.15
 */
export const LADDER = [1, 3, 7, 14, 30, 60];
export const DAY = 86_400_000;

export function startOfDay(ts = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function newCard(id: string, kind: SrsCard['kind'], ref: string, now = Date.now()): SrsCard {
  return {
    id,
    kind,
    ref,
    step: -1, // not yet reviewed — due immediately
    ease: 2.5,
    interval: 0,
    due: startOfDay(now),
    reps: 0,
    lapses: 0,
    history: [],
  };
}

export function schedule(card: SrsCard, rating: SrsRating, now = Date.now()): SrsCard {
  let { step, ease, interval, lapses } = card;
  const top = LADDER.length - 1;

  switch (rating) {
    case 'again':
      step = 0;
      ease = Math.max(1.3, ease - 0.2);
      lapses += 1;
      interval = LADDER[0];
      break;
    case 'hard':
      ease = Math.max(1.3, ease - 0.15);
      if (step < 0) step = 0;
      interval = step >= top ? Math.round(Math.max(interval, LADDER[top]) * 1.2) : LADDER[step];
      break;
    case 'good':
      step = step + 1;
      interval = step <= top ? LADDER[step] : Math.round(Math.max(interval, LADDER[top]) * ease);
      break;
    case 'easy':
      step = step + 2;
      ease = Math.min(3.2, ease + 0.15);
      interval = step <= top ? LADDER[step] : Math.round(Math.max(interval, LADDER[top]) * ease * 1.3);
      break;
  }
  return {
    ...card,
    step,
    ease,
    interval,
    lapses,
    reps: card.reps + 1,
    last: now,
    due: startOfDay(now) + interval * DAY,
    history: [...(card.history ?? []).slice(-19), { ts: now, rating }],
  };
}

export function isDue(card: SrsCard, now = Date.now()): boolean {
  return card.due <= now;
}

/** Preview the next interval for each rating, for button labels. */
export function previewIntervals(card: SrsCard): Record<SrsRating, number> {
  return {
    again: schedule(card, 'again').interval,
    hard: schedule(card, 'hard').interval,
    good: schedule(card, 'good').interval,
    easy: schedule(card, 'easy').interval,
  };
}

export function fmtInterval(days: number): string {
  if (days < 1) return 'today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${(days / 365).toFixed(1)} yr`;
}
