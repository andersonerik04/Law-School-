import type { Attempt, Confidence, ExamRecord, QType, RootCause } from './types';
import { getQuestion, isLR, typeLabel, LR_TYPES, RC_TYPES } from './content';
import { scaledScore } from './scoring';

export const CONF_P: Record<Confidence, number> = { Certain: 0.92, Likely: 0.7, Guess: 0.35 };

export function accuracy(as: Attempt[]): number | null {
  return as.length ? as.filter((a) => a.correct).length / as.length : null;
}

/** Calibration: how closely stated confidence matches actual accuracy (100 = perfect). */
export function calibration(attempts: Attempt[]) {
  const rated = attempts.filter((a) => a.confidence);
  const buckets = (['Certain', 'Likely', 'Guess'] as Confidence[]).map((c) => {
    const as = rated.filter((a) => a.confidence === c);
    return { conf: c, stated: CONF_P[c] * 100, actual: as.length ? (as.filter((a) => a.correct).length / as.length) * 100 : null, n: as.length };
  });
  const totalN = buckets.reduce((s, b) => s + b.n, 0);
  const err = totalN ? buckets.reduce((s, b) => s + (b.actual === null ? 0 : Math.abs(b.stated - b.actual) * b.n), 0) / totalN : null;
  return { buckets, score: err === null ? null : Math.max(0, Math.round(100 - err * 1.5)), n: totalN };
}

/** Per-type calibration: stated vs actual (for over/under-confidence by type). */
export function calibrationByType(attempts: Attempt[]) {
  const types = Array.from(new Set(attempts.filter((a) => a.confidence).map((a) => a.type)));
  return types
    .map((t) => {
      const as = attempts.filter((a) => a.type === t && a.confidence);
      const stated = (as.reduce((s, a) => s + CONF_P[a.confidence!], 0) / as.length) * 100;
      const actual = (as.filter((a) => a.correct).length / as.length) * 100;
      return { type: t, label: typeLabel(t), stated, actual, n: as.length, gap: stated - actual };
    })
    .filter((x) => x.n >= 2);
}

export function byType(attempts: Attempt[], types: QType[] = [...LR_TYPES, ...RC_TYPES]) {
  return types.map((t) => {
    const as = attempts.filter((a) => a.type === t);
    const acc = accuracy(as);
    const time = as.length ? as.reduce((s, a) => s + a.timeMs, 0) / as.length : null;
    return { type: t, label: typeLabel(t), n: as.length, acc, time };
  });
}

export function rootCauses(ledger: { rootCause: RootCause }[]) {
  const order: RootCause[] = ['Comprehension', 'Conceptual', 'Process', 'Timing', 'Trap', 'Unclassified'];
  return order.map((r) => ({ cause: r, n: ledger.filter((l) => l.rootCause === r).length }));
}

export function examRaw(e: ExamRecord) {
  let raw = 0;
  let max = 0;
  e.sections.forEach((s) => {
    if (s.experimental) return;
    s.qids.forEach((id, i) => {
      const q = getQuestion(id);
      max++;
      if (q && s.answers[i] === q.answer) raw++;
    });
  });
  return { raw, max, scaled: scaledScore(raw, max) };
}

export function examBlind(e: ExamRecord) {
  if (!e.blind) return null;
  let raw = 0;
  let max = 0;
  e.sections.forEach((s) => {
    if (s.experimental) return;
    s.qids.forEach((id, i) => {
      const q = getQuestion(id);
      max++;
      const b = e.blind?.[id];
      const ans = b ? b.choice : s.answers[i];
      if (q && ans === q.answer) raw++;
    });
  });
  return { raw, max, scaled: scaledScore(raw, max) };
}

/** Fatigue: accuracy by section position and by first vs second half within sections. */
export function fatigue(exams: ExamRecord[]) {
  const pos = [0, 1, 2, 3].map((p) => {
    let c = 0;
    let n = 0;
    exams.forEach((e) => {
      const s = e.sections[p];
      if (!s) return;
      s.qids.forEach((id, i) => {
        const q = getQuestion(id);
        if (!q || s.answers[i] === null) return;
        n++;
        if (s.answers[i] === q.answer) c++;
      });
    });
    return { label: `Section ${p + 1}`, value: n ? (c / n) * 100 : 0, n };
  });
  const halves = ['First half', 'Second half'].map((label, h) => {
    let c = 0;
    let n = 0;
    exams.forEach((e) =>
      e.sections.forEach((s) =>
        s.qids.forEach((id, i) => {
          const inHalf = h === 0 ? i < s.qids.length / 2 : i >= s.qids.length / 2;
          const q = getQuestion(id);
          if (!inHalf || !q || s.answers[i] === null) return;
          n++;
          if (s.answers[i] === q.answer) c++;
        }),
      ),
    );
    return { label, value: n ? (c / n) * 100 : 0, n };
  });
  return { pos, halves };
}

/** Accuracy heat map by type × difficulty. */
export function heat(attempts: Attempt[]) {
  return (type: string, diff: string) => {
    const as = attempts.filter((a) => a.type === type && String(a.difficulty) === diff);
    return as.length ? (as.filter((a) => a.correct).length / as.length) * 100 : null;
  };
}

export function timeSinks(attempts: Attempt[], threshold = 150_000) {
  return attempts
    .filter((a) => a.timeMs > threshold && isLR(getQuestion(a.qid) ?? ({ section: 'RC' } as never)))
    .sort((a, b) => b.timeMs - a.timeMs);
}

/** Weekly buckets of activity for trend charts. */
export function weekly(attempts: Attempt[], weeks = 12) {
  const now = Date.now();
  const W = 7 * 86_400_000;
  return Array.from({ length: weeks }, (_, k) => {
    const end = now - (weeks - 1 - k) * W;
    const as = attempts.filter((a) => a.ts > end - W && a.ts <= end);
    return { label: `W−${weeks - 1 - k}`, n: as.length, acc: as.length ? Math.round((as.filter((a) => a.correct).length / as.length) * 100) : null };
  });
}
