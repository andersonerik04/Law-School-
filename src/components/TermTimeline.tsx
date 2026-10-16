import { TERMS, WEEKS } from '../lib/content';
import { toRoman } from '../lib/util';

/** The 40-week journey as an illustrated, winding path with term bands and milestones. */
export function TermTimeline({ week, onWeek, selected, done }: { week: number; onWeek?: (w: number) => void; selected?: number; done?: (w: number) => number }) {
  const W = 1100;
  const rowH = 120;
  const perRow = 10;
  const rows = 4;
  const H = rows * rowH + 40;
  const pad = 70;
  const step = (W - pad * 2) / (perRow - 1);
  const pos = (w: number) => {
    const r = Math.floor((w - 1) / perRow);
    const k = (w - 1) % perRow;
    const x = r % 2 === 0 ? pad + k * step : W - pad - k * step;
    return { x, y: 40 + r * rowH + 30 };
  };
  let d = '';
  for (let w = 1; w <= 40; w++) {
    const p = pos(w);
    if (w === 1) d += `M${p.x},${p.y}`;
    else if ((w - 1) % perRow === 0) {
      const prev = pos(w - 1);
      const dir = Math.floor((w - 2) / perRow) % 2 === 0 ? 1 : -1;
      d += ` C${prev.x + dir * 60},${prev.y} ${p.x + dir * 60},${p.y} ${p.x},${p.y}`;
    } else d += ` L${p.x},${p.y}`;
  }
  const termColor = ['var(--m1)', 'var(--m2)', 'var(--m3)', 'var(--m4)', 'var(--m5)'];
  const milestones: Record<number, string> = { 1: 'Matriculation', 8: 'Term I Exam', 16: 'Term II Exam', 24: 'Term III Exam', 32: 'Term IV Exam', 40: 'The Bar' };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Term timeline">
      <path d={d} fill="none" stroke="var(--rule-strong)" strokeWidth={10} strokeLinecap="round" opacity={0.35} />
      <path d={d} fill="none" stroke="var(--gold)" strokeWidth={2} strokeDasharray="2 6" />
      {WEEKS.map((wk) => {
        const p = pos(wk.week);
        const isCur = wk.week === week;
        const past = wk.week < week;
        const frac = done ? done(wk.week) : past ? 1 : 0;
        const ms = milestones[wk.week];
        return (
          <g key={wk.week} style={{ cursor: onWeek ? 'pointer' : undefined }} onClick={() => onWeek?.(wk.week)}>
            {ms && <path d={`M${p.x},${p.y - 16} l0,-26 l22,7 l-22,7`} fill="var(--gold-soft)" stroke="var(--gold)" strokeWidth={1.4} />}
            <circle cx={p.x} cy={p.y} r={isCur ? 17 : 13} fill={frac >= 1 ? termColor[wk.term - 1] : 'var(--paper-2)'} stroke={selected === wk.week ? 'var(--primary)' : isCur ? 'var(--gold-bright)' : 'var(--rule-strong)'} strokeWidth={isCur || selected === wk.week ? 3 : 1.2} />
            {frac > 0 && frac < 1 && <circle cx={p.x} cy={p.y} r={13} fill="none" stroke={termColor[wk.term - 1]} strokeWidth={4} strokeDasharray={`${frac * 81.7} 81.7`} transform={`rotate(-90 ${p.x} ${p.y})`} />}
            <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fontFamily="var(--font-ui)" fill={frac >= 1 && wk.term >= 3 ? 'var(--m-ink-dark)' : 'var(--ink)'}>
              {wk.week}
            </text>
            {ms && (
              <text x={p.x} y={p.y + 32} textAnchor="middle" fontSize={11} fontFamily="var(--font-display)" fontWeight={700} fill="var(--gold)">
                {ms}
              </text>
            )}
            {isCur && (
              <text x={p.x} y={p.y - 24} textAnchor="middle" fontSize={10} fontFamily="var(--font-ui)" fontWeight={700} fill="var(--primary)">
                YOU ARE HERE
              </text>
            )}
          </g>
        );
      })}
      {TERMS.map((t) => {
        const p = pos(t.weeks[0]);
        return (
          <text key={t.n} x={p.x} y={p.y - 46} textAnchor={Math.floor((t.weeks[0] - 1) / perRow) % 2 === 0 ? 'start' : 'end'} fontFamily="var(--font-display)" fontSize={14} fontStyle="italic" fill="var(--ink-soft)" dx={Math.floor((t.weeks[0] - 1) / perRow) % 2 === 0 ? -10 : 10}>
            {t.weeks[0] === 1 ? '' : `Term ${toRoman(t.n)} · ${t.name}`}
          </text>
        );
      })}
      <text x={pos(1).x - 10} y={pos(1).y - 46} fontFamily="var(--font-display)" fontSize={14} fontStyle="italic" fill="var(--ink-soft)">
        Term I · Foundations
      </text>
    </svg>
  );
}
