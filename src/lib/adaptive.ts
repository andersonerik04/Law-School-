import type { Attempt, Question } from './types';

/**
 * Deliberate-practice engine (a lightweight Rasch / Elo model).
 * Each question type has an ability estimate θ; each difficulty level 1–5 maps to
 * an item difficulty b. P(correct) = σ(θ − b). The engine serves items whose
 * predicted accuracy is in the "desirable difficulty" zone of 60–75%.
 */
export const B_BY_DIFF: Record<number, number> = { 1: -1.6, 2: -0.8, 3: 0, 4: 0.8, 5: 1.6 };
const K = 0.28;

export function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

export function pCorrect(theta: Record<string, number>, type: string, difficulty: number): number {
  const t = (theta[type] ?? 0) * 0.75 + (theta.__global ?? 0) * 0.25;
  return sigmoid(t - (B_BY_DIFF[difficulty] ?? 0));
}

export function updateTheta(theta: Record<string, number>, a: Pick<Attempt, 'type' | 'difficulty' | 'correct' | 'confidence' | 'lucky'>): Record<string, number> {
  // Correct-but-guessed counts as half credit for ability estimation.
  const score = a.correct ? (a.confidence === 'Guess' || a.lucky ? 0.5 : 1) : 0;
  const p = pCorrect(theta, a.type, a.difficulty);
  const next = { ...theta };
  next[a.type] = (theta[a.type] ?? 0) + K * (score - p);
  next.__global = (theta.__global ?? 0) + (K / 3) * (score - p);
  return next;
}

export const ZONE: [number, number] = [0.6, 0.75];

/** Pick `n` questions from `pool` targeting the desirable-difficulty zone. */
export function pickAdaptive(pool: Question[], theta: Record<string, number>, n: number, recentIds: Set<string>): Question[] {
  const target = (ZONE[0] + ZONE[1]) / 2;
  const scored = pool.map((q) => {
    const p = pCorrect(theta, q.type, q.difficulty);
    const inZone = p >= ZONE[0] && p <= ZONE[1];
    const dist = Math.abs(p - target) + (recentIds.has(q.id) ? 0.5 : 0) + (inZone ? 0 : 0.1) + Math.random() * 0.06;
    return { q, p, dist };
  });
  scored.sort((a, b) => a.dist - b.dist);
  // diversify types: avoid more than 2 of a type in a row
  const out: Question[] = [];
  const typeCount: Record<string, number> = {};
  for (const s of scored) {
    if (out.length >= n) break;
    if ((typeCount[s.q.type] ?? 0) >= Math.max(2, Math.ceil(n / 5))) continue;
    out.push(s.q);
    typeCount[s.q.type] = (typeCount[s.q.type] ?? 0) + 1;
  }
  for (const s of scored) {
    if (out.length >= n) break;
    if (!out.includes(s.q)) out.push(s.q);
  }
  return out;
}
