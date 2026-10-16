import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { projectScore, percentile } from '../lib/scoring';
import type { School } from '../lib/types';
import { uid } from '../lib/util';
import { CasebookHeader, MethodNote, Section, Empty, toast } from '../components/common';

const blank = (): School => ({ id: uid('s_'), name: '', lsat25: null, lsatMedian: null, lsat75: null, gpaMedian: null, deadline: '', notes: '', tier: '' });
const num = (v: string, min: number, max: number) => {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
};

/** Horizontal range chart: each school's 25th–75th band with its median, against the projected score and band. */
function RangeChart({ schools, proj, goal }: { schools: School[]; proj: { score: number; low: number; high: number } | null; goal: number }) {
  const rows = schools.filter((s) => s.lsat25 != null || s.lsatMedian != null || s.lsat75 != null);
  if (!rows.length) return <Empty>Enter at least one school’s LSAT figures to draw the chart.</Empty>;
  const vals = rows.flatMap((s) => [s.lsat25, s.lsatMedian, s.lsat75].filter((v): v is number => v != null));
  if (proj) vals.push(proj.low, proj.high);
  vals.push(goal);
  const lo = Math.max(120, Math.floor(Math.min(...vals) / 5) * 5 - 5);
  const hi = Math.min(180, Math.ceil(Math.max(...vals) / 5) * 5 + 2);
  const W = 860;
  const L = 200;
  const R = 30;
  const rowH = 34;
  const top = 30;
  const H = top + rows.length * rowH + 30;
  const x = (v: number) => L + ((v - lo) / Math.max(1, hi - lo)) * (W - L - R);
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / 5) * 5; t <= hi; t += 5) ticks.push(t);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Projected score against each school's LSAT range">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={top - 8} y2={H - 24} stroke="var(--rule)" strokeDasharray="3 3" />
          <text x={x(t)} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--muted)">
            {t}
          </text>
        </g>
      ))}
      {proj && <rect x={x(proj.low)} width={Math.max(2, x(proj.high) - x(proj.low))} y={top - 10} height={H - top - 14} fill="var(--gold)" opacity={0.16} />}
      {proj && (
        <g>
          <line x1={x(proj.score)} x2={x(proj.score)} y1={top - 12} y2={H - 24} stroke="var(--gold)" strokeWidth={2.5} />
          <text x={x(proj.score)} y={top - 16} textAnchor="middle" fontSize={12} fill="var(--gold)" fontWeight={700}>
            projected {proj.score}
          </text>
        </g>
      )}
      <line x1={x(goal)} x2={x(goal)} y1={top - 6} y2={H - 24} stroke="var(--primary)" strokeWidth={1.5} strokeDasharray="6 4" />
      <text x={x(goal) + 4} y={H - 26} fontSize={11} fill="var(--primary)">
        goal {goal}
      </text>
      {rows.map((s, i) => {
        const y = top + i * rowH + rowH / 2;
        const a = s.lsat25 ?? s.lsatMedian ?? s.lsat75!;
        const b = s.lsat75 ?? s.lsatMedian ?? s.lsat25!;
        return (
          <g key={s.id}>
            <text x={L - 10} y={y + 4} textAnchor="end" fontSize={14} fill="var(--ink)" fontFamily="var(--font-body)">
              {s.name.length > 24 ? s.name.slice(0, 23) + '…' : s.name || 'Unnamed'}
            </text>
            <rect x={x(a)} y={y - 8} width={Math.max(3, x(b) - x(a))} height={16} rx={3} fill="var(--secondary)" opacity={0.55} />
            {s.lsatMedian != null && <rect x={x(s.lsatMedian) - 1.5} y={y - 11} width={3} height={22} fill="var(--primary)" />}
            {s.lsat25 != null && (
              <text x={x(s.lsat25) - 4} y={y + 4} textAnchor="end" fontSize={10} fill="var(--muted)">
                {s.lsat25}
              </text>
            )}
            {s.lsat75 != null && (
              <text x={x(s.lsat75) + 4} y={y + 4} fontSize={10} fill="var(--muted)">
                {s.lsat75}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function standing(s: School, score: number | null) {
  if (score == null || (s.lsat25 == null && s.lsatMedian == null && s.lsat75 == null)) return { label: '—', cls: '' };
  if (s.lsat75 != null && score >= s.lsat75) return { label: 'At or above 75th', cls: 'success' };
  if (s.lsatMedian != null && score >= s.lsatMedian) return { label: 'Median–75th', cls: 'success' };
  if (s.lsat25 != null && score >= s.lsat25) return { label: '25th–median', cls: 'gold' };
  return { label: 'Below 25th', cls: 'danger' };
}

export default function Admissions() {
  const schools = useStore((s) => s.schools);
  const upsert = useStore((s) => s.upsertSchool);
  const del = useStore((s) => s.deleteSchool);
  const attempts = useStore((s) => s.attempts);
  const profile = useStore((s) => s.profile);
  const [edit, setEdit] = useState<School | null>(null);
  const [goal, setGoal] = useState(179);
  const proj = useMemo(() => projectScore(attempts.filter((a) => a.context !== 'tutor')), [attempts]);
  const score = proj?.score ?? profile.diagnosticScore ?? null;
  const sorted = [...schools].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));

  const save = () => {
    if (!edit || !edit.name.trim()) return;
    upsert({ ...edit, name: edit.name.trim() });
    toast('School filed', edit.name);
    setEdit(null);
  };

  return (
    <div>
      <CasebookHeader chapter="THE ADMISSIONS OFFICE" title="Where the Score Takes You" subtitle="Enter each school’s published figures yourself. Nothing here is pre-loaded, so check the school’s current ABA 509 disclosure." />
      <MethodNote id="habit">Seeing the target next to your projection keeps the 40 weeks concrete.</MethodNote>

      <div className="grid cols-3">
        <div className="card">
          <div className="label">projected score</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 44 }}>{proj ? proj.score : '—'}</div>
          <div className="muted">{proj ? `band ${proj.low}–${proj.high} · ${percentile(proj.score)}th percentile · ${proj.n} questions` : 'Answer at least 8 questions to project a score.'}</div>
        </div>
        <div className="card">
          <div className="label">diagnostic</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 44 }}>{profile.diagnosticScore ?? '—'}</div>
          <div className="muted">Starting point from Matriculation</div>
        </div>
        <div className="card">
          <div className="label">goal</div>
          <input type="number" min={120} max={180} value={goal} onChange={(e) => setGoal(Math.min(180, Math.max(120, +e.target.value || 120)))} style={{ fontFamily: 'var(--font-display)', fontSize: 34, width: 120 }} aria-label="Goal score" />
          <div className="muted">{proj ? (proj.score >= goal ? 'Projection meets the goal.' : `${goal - proj.score} points to go.`) : 'Set the score you are working toward.'}</div>
        </div>
      </div>

      <Section numeral="I" title="The range chart" right={<span className="muted" style={{ fontSize: 13 }}>bar = 25th–75th · tick = median · gold = projection & band</span>}>
        <div className="card">
          <RangeChart schools={sorted} proj={proj} goal={goal} />
        </div>
      </Section>

      <Section numeral="II" title="Your schools" right={<button className="primary small" onClick={() => setEdit(blank())}>+ Add school</button>}>
        {edit && (
          <div className="card gilt stack" style={{ marginBottom: 12 }}>
            <div className="grid cols-3">
              <label className="field">
                <span>School name</span>
                <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus />
              </label>
              <label className="field">
                <span>Application deadline</span>
                <input type="date" value={edit.deadline} onChange={(e) => setEdit({ ...edit, deadline: e.target.value })} />
              </label>
              <label className="field">
                <span>Category</span>
                <select value={edit.tier} onChange={(e) => setEdit({ ...edit, tier: e.target.value as School['tier'] })}>
                  <option value="">—</option>
                  <option value="reach">Reach</option>
                  <option value="target">Target</option>
                  <option value="safety">Safety</option>
                </select>
              </label>
              {(
                [
                  ['lsat25', 'LSAT 25th'],
                  ['lsatMedian', 'LSAT median'],
                  ['lsat75', 'LSAT 75th'],
                ] as const
              ).map(([k, l]) => (
                <label key={k} className="field">
                  <span>{l}</span>
                  <input type="number" min={120} max={180} value={edit[k] ?? ''} onChange={(e) => setEdit({ ...edit, [k]: num(e.target.value, 120, 180) })} />
                </label>
              ))}
              <label className="field">
                <span>GPA median</span>
                <input type="number" step="0.01" min={0} max={4.33} value={edit.gpaMedian ?? ''} onChange={(e) => setEdit({ ...edit, gpaMedian: num(e.target.value, 0, 4.33) })} />
              </label>
            </div>
            <label className="field">
              <span>Notes (programs, international law clinics, scholarships…)</span>
              <textarea rows={2} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </label>
            {edit.lsat25 != null && edit.lsat75 != null && edit.lsat25 > edit.lsat75 && <div className="chip danger">The 25th percentile is above the 75th. Check the figures.</div>}
            <div className="row">
              <button className="primary" onClick={save} disabled={!edit.name.trim()}>
                Save
              </button>
              <button onClick={() => setEdit(null)}>Cancel</button>
            </div>
          </div>
        )}
        {sorted.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="ledger">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Category</th>
                  <th>25th / Median / 75th</th>
                  <th>GPA</th>
                  <th>Your standing</th>
                  <th>Deadline</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => {
                  const st = standing(s, score);
                  const days = s.deadline ? Math.ceil((new Date(s.deadline + 'T23:59:00').getTime() - Date.now()) / 86_400_000) : null;
                  return (
                    <tr key={s.id}>
                      <td>
                        <b>{s.name}</b>
                        {s.notes && <div className="muted" style={{ fontSize: 13 }}>{s.notes}</div>}
                      </td>
                      <td>{s.tier ? <span className="chip">{s.tier}</span> : '—'}</td>
                      <td className="mono">
                        {s.lsat25 ?? '—'} / {s.lsatMedian ?? '—'} / {s.lsat75 ?? '—'}
                      </td>
                      <td className="mono">{s.gpaMedian ?? '—'}</td>
                      <td>{st.label === '—' ? '—' : <span className={`chip ${st.cls}`}>{st.label}</span>}</td>
                      <td>
                        {s.deadline ? new Date(s.deadline + 'T12:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                        {days != null && <div className={days < 0 ? 'muted' : days <= 30 ? 'danger' : 'muted'} style={{ fontSize: 12 }}>{days < 0 ? 'passed' : `${days} days`}</div>}
                      </td>
                      <td className="row" style={{ flexWrap: 'nowrap' }}>
                        <button className="small" onClick={() => setEdit({ ...s })}>
                          Edit
                        </button>
                        <button
                          className="small"
                          onClick={() => {
                            if (confirm(`Remove ${s.name}?`)) del(s.id);
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !edit && <Empty>No schools yet. Add the schools you are considering, with figures from their official disclosures.</Empty>
        )}
      </Section>

      <Section numeral="III" title="The application calendar">
        <div className="card stack tight">
          <div className="row between">
            <span>LSAT test date</span>
            <b>{new Date(profile.testDate + 'T12:00:00').toLocaleDateString(undefined, { dateStyle: 'long' })}</b>
          </div>
          {sorted
            .filter((s) => s.deadline)
            .map((s) => (
              <div key={s.id} className="row between">
                <span>{s.name} deadline</span>
                <span>
                  {new Date(s.deadline + 'T12:00:00').toLocaleDateString(undefined, { dateStyle: 'long' })}
                  {s.deadline < profile.testDate && <span className="chip danger" style={{ marginLeft: 8 }}>before your test date</span>}
                </span>
              </div>
            ))}
        </div>
      </Section>
    </div>
  );
}
