import type { ExamRecord, ExamSectionRecord } from './types';
import { allLR, RC_PASSAGES } from './content';
import { shuffle, uid } from './util';

export const SECTION_MS = 35 * 60_000;
export const INTERMISSION_MS = 10 * 60_000;

function section(kind: 'LR' | 'RC', qids: string[], experimental: boolean): ExamSectionRecord {
  return { kind, experimental, qids, answers: qids.map(() => null), times: qids.map(() => 0), flags: qids.map(() => false), confidence: qids.map(() => null), elapsedMs: 0 };
}

/**
 * Build a true-to-life exam: two scored LR sections, one scored RC section (four sets,
 * one comparative), and one unscored experimental section (LR or RC), in random order.
 * Questions not seen in earlier exams are preferred. If the bank is smaller than a full
 * form, sections are shortened proportionally (scores are curve-normalized).
 */
export function buildExam(title: string, kind: ExamRecord['kind'], previous: ExamRecord[]): ExamRecord {
  const used = new Set(previous.flatMap((e) => e.sections.flatMap((s) => s.qids)));
  const lr = allLR();
  const fresh = (xs: typeof lr) => [...shuffle(xs.filter((q) => !used.has(q.id))), ...shuffle(xs.filter((q) => used.has(q.id)))];
  const lrPool = fresh(lr);
  const experimentalKind: 'LR' | 'RC' = Math.random() < 0.6 ? 'LR' : 'RC';

  const perLR = Math.min(25, Math.floor(lrPool.length / (experimentalKind === 'LR' ? 2.5 : 2)));
  // order each LR section roughly easy → hard, as on the real test
  const byDiff = (ids: typeof lr) => ids.sort((a, b) => a.difficulty - b.difficulty).map((q) => q.id);
  const lr1 = byDiff(lrPool.slice(0, perLR));
  const lr2 = byDiff(lrPool.slice(perLR, perLR * 2));
  const lrExp = experimentalKind === 'LR' ? byDiff(lrPool.slice(perLR * 2, perLR * 2 + Math.min(25, lrPool.length - perLR * 2))) : [];

  const passages = [...shuffle(RC_PASSAGES.filter((p) => !p.questions.some((q) => used.has(q.id)))), ...shuffle(RC_PASSAGES.filter((p) => p.questions.some((q) => used.has(q.id))))];
  const comp = passages.filter((p) => p.comparative);
  const single = passages.filter((p) => !p.comparative);
  const scoredSets = [...single.slice(0, 3), ...comp.slice(0, 1)];
  const scoredOrder = shuffle(scoredSets);
  const rcScored = scoredOrder.flatMap((p) => p.questions.map((q) => q.id));
  const leftover = passages.filter((p) => !scoredSets.includes(p));
  const rcExp = experimentalKind === 'RC' ? leftover.slice(0, 4).flatMap((p) => p.questions.map((q) => q.id)) : [];

  const sections = [section('LR', lr1, false), section('LR', lr2, false), section('RC', rcScored, false)];
  const exp = experimentalKind === 'LR' ? section('LR', lrExp, true) : section('RC', rcExp, true);
  const ordered = shuffle(sections);
  if (exp.qids.length) ordered.splice(Math.floor(Math.random() * 4), 0, exp);
  return { id: uid('x_'), title, ts: Date.now(), sections: ordered, completed: false, phase: 'section', current: 0, sectionStart: Date.now(), kind };
}
