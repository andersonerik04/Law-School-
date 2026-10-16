import type { Attempt, Concept, LessonProgress, SrsCard } from './types';
import { CONCEPTS, getQuestion, questionsForConcept, isLR, LR_PACE_MS, WEEKS, TERMS } from './content';
import { DAY } from './srs';

export const RANKS = ['Unbriefed', '1L', '2L', '3L', 'Law Review', 'Clerk'] as const;
export type Rank = (typeof RANKS)[number];

export const RANK_BLURB: Record<Rank, string> = {
  Unbriefed: 'Not yet studied.',
  '1L': 'Introduced — the lesson is underway or first attempts are logged.',
  '2L': 'Developing — roughly 55%+ accuracy on early attempts.',
  '3L': 'Proficient — 72%+ accuracy across a meaningful sample.',
  'Law Review': 'Advanced — 85%+ on recent attempts; certification within reach.',
  Clerk: 'Certified — 85%+ on 20 interleaved, on-pace questions at difficulty 3+.',
};

export const CERT = { threshold: 0.85, n: 20, minDifficulty: 3 };

export interface MasteryInfo {
  level: number; // 0–5
  rank: Rank;
  accuracy: number | null;
  n: number;
  qualified: number; // qualifying attempts toward certification
  qualifiedAcc: number | null;
  lastTs: number | null;
  decayed: number; // levels lost to neglect
  certified: boolean;
}

function credit(a: Attempt): number {
  if (!a.correct) return 0;
  if (a.lucky || a.confidence === 'Guess') return 0.5;
  return 1;
}

function withinPace(a: Attempt): boolean {
  const q = getQuestion(a.qid);
  if (!q) return true;
  const limit = isLR(q) ? LR_PACE_MS * 1.25 : 110_000;
  return a.timeMs <= limit;
}

/** Cache of concept → question id set */
const qidCache = new Map<string, Set<string>>();
export function conceptQids(c: Concept): Set<string> {
  let s = qidCache.get(c.id);
  if (!s) {
    s = new Set(questionsForConcept(c).map((q) => q.id));
    qidCache.set(c.id, s);
  }
  return s;
}
export function clearMasteryCache() {
  qidCache.clear();
}

export function masteryFor(
  c: Concept,
  attempts: Attempt[],
  lessons: Record<string, LessonProgress>,
  srs: Record<string, SrsCard>,
  now = Date.now(),
): MasteryInfo {
  const ids = conceptQids(c);
  const mine = ids.size ? attempts.filter((a) => ids.has(a.qid) && a.context !== 'tutor') : [];
  const recent = mine.slice(-20);
  const n = recent.length;
  const acc = n ? recent.reduce((s, a) => s + credit(a), 0) / n : null;
  const qualifiedList = mine
    .filter((a) => a.difficulty >= CERT.minDifficulty && a.context !== 'lesson' && a.mode !== 'blocked' && withinPace(a))
    .slice(-CERT.n);
  const qualified = qualifiedList.length;
  const qualifiedAcc = qualified ? qualifiedList.reduce((s, a) => s + credit(a), 0) / qualified : null;

  const lesson = lessons[c.id];
  const card = srs[`concept:${c.id}`];
  let level = 0;
  if (n > 0 || lesson) level = 1;
  if (ids.size) {
    if (n >= 4 && (acc ?? 0) >= 0.55) level = 2;
    if (n >= 6 && (acc ?? 0) >= 0.72) level = 3;
    if (n >= 10 && (acc ?? 0) >= 0.85) level = 4;
    if (qualified >= CERT.n && (qualifiedAcc ?? 0) >= CERT.threshold) level = 5;
  } else {
    // concepts without questions (traps, strategy, writing) advance via lesson + flashcard retention
    if (lesson?.completed) level = 2;
    if (card && card.step >= 2) level = 3;
    if (card && card.step >= 4) level = 4;
    if (card && card.step >= 5 && lesson?.completed) level = 5;
  }

  const lastTs = Math.max(mine.length ? mine[mine.length - 1].ts : 0, lesson?.ts ?? 0, card?.last ?? 0) || null;
  let decayed = 0;
  if (lastTs && level > 1) {
    const idle = (now - lastTs) / DAY;
    if (idle > 45) decayed = 2;
    else if (idle > 21) decayed = 1;
    decayed = Math.min(decayed, level - 1);
  }
  const finalLevel = level - decayed;
  return {
    level: finalLevel,
    rank: RANKS[finalLevel],
    accuracy: acc,
    n: mine.length,
    qualified,
    qualifiedAcc,
    lastTs,
    decayed,
    certified: level === 5 && decayed === 0,
  };
}

export function allMastery(attempts: Attempt[], lessons: Record<string, LessonProgress>, srs: Record<string, SrsCard>): Record<string, MasteryInfo> {
  const out: Record<string, MasteryInfo> = {};
  for (const c of CONCEPTS) {
    if (c.kind === 'root' || c.kind === 'branch' || c.kind === 'group') continue;
    out[c.id] = masteryFor(c, attempts, lessons, srs);
  }
  // roll up group/branch levels as the rounded mean of children
  const childrenOf = (id: string) => CONCEPTS.filter((c) => c.parent === id);
  const roll = (id: string): number => {
    const kids = childrenOf(id);
    if (!kids.length) return out[id]?.level ?? 0;
    const vals = kids.map((k) => (out[k.id] ? out[k.id].level : roll(k.id)));
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const lvl = Math.floor(mean + 0.0001);
    if (!out[id]) out[id] = { level: lvl, rank: RANKS[lvl], accuracy: null, n: 0, qualified: 0, qualifiedAcc: null, lastTs: null, decayed: 0, certified: false };
    return mean;
  };
  for (const c of CONCEPTS) if (c.kind === 'root' || c.kind === 'branch' || c.kind === 'group') roll(c.id);
  return out;
}

export const MASTERY_VAR = ['var(--m0)', 'var(--m1)', 'var(--m2)', 'var(--m3)', 'var(--m4)', 'var(--m5)'];
export function masteryInk(level: number) {
  return level >= 3 ? 'var(--m-ink-dark)' : 'var(--m-ink-light)';
}

// ── Curriculum position ──────────────────────────────────────

export function currentWeek(startDate: string, now = Date.now()): number {
  const start = new Date(startDate + 'T00:00:00').getTime();
  const w = Math.floor((now - start) / (7 * DAY)) + 1;
  return Math.max(1, Math.min(40, w));
}
export function termForWeek(week: number) {
  return TERMS.find((t) => week >= t.weeks[0] && week <= t.weeks[1]) ?? TERMS[0];
}
export function weekInfo(week: number) {
  return WEEKS.find((w) => w.week === week) ?? WEEKS[0];
}
/** Concepts introduced on or before this week. */
export function introducedConcepts(week: number): Set<string> {
  const s = new Set<string>();
  for (const w of WEEKS) if (w.week <= week) w.concepts.forEach((c) => s.add(c));
  return s;
}
