/**
 * Raw → scaled score conversion modeled on recent LSAT curves (no Logic Games),
 * normalized to a 76-question scored test. Shorter or longer forms are converted by
 * proportion of misses. Values are approximate and for practice only.
 *
 * Anchors: misses → scaled
 */
const ANCHORS: [number, number][] = [
  [0, 180],
  [2, 180],
  [3, 179],
  [4, 178],
  [5, 177],
  [6, 176],
  [8, 175],
  [9, 174],
  [10, 173],
  [12, 172],
  [13, 171],
  [15, 170],
  [18, 168],
  [21, 166],
  [24, 164],
  [27, 162],
  [30, 160],
  [33, 158],
  [36, 156],
  [39, 154],
  [42, 152],
  [45, 150],
  [48, 148],
  [51, 145],
  [54, 143],
  [57, 140],
  [60, 137],
  [63, 134],
  [66, 130],
  [69, 126],
  [72, 122],
  [76, 120],
];
export const STANDARD_SCORED = 76;

export function scaledFromMisses76(misses: number): number {
  if (misses <= 0) return 180;
  for (let i = 1; i < ANCHORS.length; i++) {
    const [m1, s1] = ANCHORS[i];
    const [m0, s0] = ANCHORS[i - 1];
    if (misses <= m1) {
      const t = (misses - m0) / (m1 - m0);
      return Math.round(s0 + (s1 - s0) * t);
    }
  }
  return 120;
}

export function scaledScore(correct: number, total: number): number {
  if (total <= 0) return 120;
  const misses = ((total - correct) / total) * STANDARD_SCORED;
  return scaledFromMisses76(Math.round(misses));
}

/** Conversion table for display (misses allowed for each score). */
export function curveTable(total = STANDARD_SCORED): { scaled: number; maxMisses: number }[] {
  const rows: { scaled: number; maxMisses: number }[] = [];
  for (let s = 180; s >= 150; s--) {
    let max = -1;
    for (let m = 0; m <= total; m++) {
      if (scaledScore(total - m, total) >= s) max = m;
    }
    rows.push({ scaled: s, maxMisses: max });
  }
  return rows;
}

const PCT: [number, number][] = [
  [120, 0],
  [130, 2],
  [135, 5],
  [140, 12],
  [145, 24],
  [150, 41],
  [153, 52],
  [155, 60],
  [158, 70],
  [160, 77],
  [163, 85],
  [165, 89],
  [168, 94],
  [170, 96.5],
  [172, 98],
  [174, 99],
  [176, 99.5],
  [178, 99.8],
  [179, 99.9],
  [180, 99.97],
];

export function percentile(scaled: number): number {
  if (scaled <= 120) return 0;
  for (let i = 1; i < PCT.length; i++) {
    const [s1, p1] = PCT[i];
    const [s0, p0] = PCT[i - 1];
    if (scaled <= s1) {
      return +(p0 + ((p1 - p0) * (scaled - s0)) / (s1 - s0)).toFixed(1);
    }
  }
  return 99.97;
}

/**
 * Projected score from accuracy, weighting harder questions more and applying a
 * modest pace penalty. Returns point estimate and a confidence band that narrows
 * with sample size.
 */
export function projectScore(
  attempts: { correct: boolean; difficulty: number; timeMs: number; ts: number }[],
): { score: number; low: number; high: number; n: number } | null {
  const recent = attempts.slice(-150);
  if (recent.length < 8) return null;
  // Estimate accuracy on a "real test" mix (difficulty distribution ~ 1:15%, 2:20%, 3:30%, 4:22%, 5:13%)
  const mix: Record<number, number> = { 1: 0.15, 2: 0.2, 3: 0.3, 4: 0.22, 5: 0.13 };
  const byD: Record<number, { c: number; n: number }> = {};
  for (const a of recent) {
    const d = Math.min(5, Math.max(1, Math.round(a.difficulty)));
    byD[d] ??= { c: 0, n: 0 };
    byD[d].n += 1;
    byD[d].c += a.correct ? 1 : 0;
  }
  // smoothed accuracy per difficulty with a prior that declines with difficulty
  const prior: Record<number, number> = { 1: 0.85, 2: 0.75, 3: 0.62, 4: 0.5, 5: 0.38 };
  const overall = recent.filter((a) => a.correct).length / recent.length;
  let acc = 0;
  for (let d = 1; d <= 5; d++) {
    const b = byD[d] ?? { c: 0, n: 0 };
    const p = (prior[d] * 0.5 + overall * 0.5) as number;
    const est = (b.c + p * 3) / (b.n + 3);
    acc += est * mix[d];
  }
  const slow = recent.filter((a) => a.timeMs > 150_000).length / recent.length;
  acc = Math.max(0, acc - slow * 0.05);
  const score = scaledScore(Math.round(acc * STANDARD_SCORED), STANDARD_SCORED);
  const se = Math.sqrt((acc * (1 - acc)) / recent.length);
  const lo = scaledScore(Math.round(Math.max(0, acc - 1.6 * se) * STANDARD_SCORED), STANDARD_SCORED);
  const hi = scaledScore(Math.round(Math.min(1, acc + 1.6 * se) * STANDARD_SCORED), STANDARD_SCORED);
  return { score, low: lo, high: hi, n: recent.length };
}
