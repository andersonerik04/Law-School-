import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { TERMS, WEEKS, CONCEPTS } from '../lib/content';
import { currentWeek, weekStartDate, termForWeek, weekInfo, masteryFor, planWeeksFor } from '../lib/mastery';
import { CasebookHeader, MethodNote, Section, Progress, Empty, toast } from '../components/common';
import { TermTimeline } from '../components/TermTimeline';
import { TrendLines, SimpleBars } from '../components/Charts';
import type { CurriculumWeek } from '../lib/types';

const KIND_TO: Record<string, (ref?: string) => string> = {
  lesson: (ref) => (ref ? `/casebook/${ref}` : '/casebook'),
  drill: () => '/chambers',
  review: (ref) => (ref === 'ledger' ? '/ledger' : '/reviews'),
  exam: (ref) => (ref === 'diagnostic' ? '/matriculation' : '/exam'),
  writing: () => '/writing',
  reflection: () => '/planner#reflection',
  sprint: () => '/moot',
};
const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function Planner() {
  const profile = useStore((s) => s.profile);
  const attempts = useStore((s) => s.attempts);
  const lessons = useStore((s) => s.lessons);
  const srs = useStore((s) => s.srs);
  const checks = useStore((s) => s.plannerChecks);
  const toggle = useStore((s) => s.togglePlanner);
  const reflections = useStore((s) => s.reflections);
  const addReflection = useStore((s) => s.addReflection);
  const setProfile = useStore((s) => s.setProfile);

  const planWeeks = profile.planWeeks ?? 40;
  const week = currentWeek(profile.startDate, planWeeks);
  const [sel, setSel] = useState(week);
  const info: CurriculumWeek = weekInfo(sel);
  const term = termForWeek(sel);
  const [form, setForm] = useState({ worked: '', didnt: '', change: '' });

  useEffect(() => {
    if (location.hash.includes('reflection')) setTimeout(() => document.getElementById('reflection')?.scrollIntoView({ behavior: 'smooth' }), 150);
  }, []);

  const doneFor = (w: number) => {
    const ts = weekInfo(w).tasks;
    return ts.length ? ts.filter((t) => checks[t.id]).length / ts.length : 0;
  };

  // Auto-adjusted remediation: the weakest doctrines already introduced get extra tasks this week.
  const remedial = useMemo(() => {
    const real = attempts.filter((a) => a.context !== 'tutor');
    const introduced = new Set(WEEKS.filter((w) => w.week <= week).flatMap((w) => w.concepts));
    return CONCEPTS.filter((c) => c.match && introduced.has(c.id))
      .map((c) => ({ c, m: masteryFor(c, real, lessons, srs) }))
      .filter((x) => x.m.n >= 3 && (x.m.accuracy ?? 1) < 0.65)
      .sort((a, b) => (a.m.accuracy ?? 0) - (b.m.accuracy ?? 0))
      .slice(0, 3)
      .map(({ c, m }) => {
        const type = c.match?.types?.[0];
        return {
          id: `rem-${week}-${c.id}`,
          text: `Remedial: ${c.label} — ${Math.round((m.accuracy ?? 0) * 100)}% over ${m.n} attempts. Re-read the lesson, then 10 blocked questions.`,
          to: type ? `/chambers?mode=blocked&type=${type}&n=10` : `/casebook/${c.id}`,
          lesson: `/casebook/${c.id}`,
        };
      });
  }, [attempts, lessons, srs, week]);

  const ratioData = WEEKS.map((w) => ({ label: `W${w.week}`, blocked: Math.round(w.blockedRatio * 100), interleaved: Math.round((1 - w.blockedRatio) * 100) }));
  const examData = TERMS.map((t) => ({ label: `${t.numeral} · ${t.name}`, value: WEEKS.filter((w) => w.week >= t.weeks[0] && w.week <= t.weeks[1]).reduce((s, w) => s + w.exams, 0) }));
  const tasksDone = info.tasks.filter((t) => checks[t.id]).length;
  const testDays = Math.ceil((new Date(profile.testDate + 'T09:00:00').getTime() - Date.now()) / 86_400_000);
  const suggested = planWeeksFor(profile.startDate, profile.testDate);
  const weekReflections = reflections.filter((r) => r.week === sel);

  return (
    <div>
      <CasebookHeader chapter="THE TERM PLANNER" title="Forty Weeks to the Bench" subtitle={`Five terms, ${planWeeks < 40 ? `compressed into ${planWeeks} calendar weeks` : 'one week at a time'}. Test date ${new Date(profile.testDate + 'T12:00:00').toLocaleDateString(undefined, { dateStyle: 'long' })} (${Math.max(0, testDays)} days).`} />
      <MethodNote id="interleaving">The plan moves from blocked to interleaved practice and adds full exams as the test approaches.</MethodNote>
      {suggested !== planWeeks && (
        <div className="card flat row between" style={{ marginBottom: 12 }}>
          <span>
            Your start and test dates allow <b>{suggested}</b> calendar weeks; the plan is set to <b>{planWeeks}</b>.
          </span>
          <button className="small primary" onClick={() => { setProfile({ planWeeks: suggested }); toast('Plan re-paced', `40 curriculum weeks over ${suggested} calendar weeks.`); }}>
            Re-pace the plan
          </button>
        </div>
      )}

      <div className="card">
        <TermTimeline week={week} selected={sel} onWeek={setSel} done={doneFor} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', alignItems: 'start', marginTop: 14 }}>
        <div className="card stack">
          <div className="row between">
            <div>
              <div className="label">
                term {term.numeral} · {term.name} · week {sel} {sel === week ? '(this week)' : ''} · begins {fmtDate(weekStartDate(profile.startDate, sel, planWeeks))}
              </div>
              <h2 style={{ margin: '2px 0' }}>{info.title}</h2>
            </div>
            <div className="row">
              <button className="small" disabled={sel <= 1} onClick={() => setSel(sel - 1)} aria-label="Previous week">←</button>
              <button className="small" disabled={sel === week} onClick={() => setSel(week)}>Today</button>
              <button className="small" disabled={sel >= 40} onClick={() => setSel(sel + 1)} aria-label="Next week">→</button>
            </div>
          </div>
          <ul className="book" style={{ margin: 0 }}>
            {info.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
          <div className="row">
            <span className="chip">{Math.round(info.blockedRatio * 100)}% blocked</span>
            <span className="chip">{info.exams} full exam{info.exams === 1 ? '' : 's'}</span>
            {info.concepts.map((c) => (
              <Link key={c} to={`/casebook/${c}`} className="chip gold">
                {CONCEPTS.find((x) => x.id === c)?.label ?? c}
              </Link>
            ))}
          </div>
          <div className="label">
            tasks · {tasksDone}/{info.tasks.length}
          </div>
          <Progress value={tasksDone} max={info.tasks.length} />
          {info.tasks.map((t) => (
            <label key={t.id} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <input type="checkbox" checked={!!checks[t.id]} onChange={() => toggle(t.id)} />
              <span style={{ flex: 1, textDecoration: checks[t.id] ? 'line-through' : undefined, opacity: checks[t.id] ? 0.6 : 1 }}>{t.text}</span>
              <Link className="small" to={KIND_TO[t.kind]?.(t.ref) ?? '/'}>
                Open →
              </Link>
            </label>
          ))}
          {sel === week && remedial.length > 0 && (
            <>
              <div className="label" style={{ color: 'var(--danger)' }}>
                auto-adjusted · remedial tasks from your record
              </div>
              {remedial.map((r) => (
                <label key={r.id} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={!!checks[r.id]} onChange={() => toggle(r.id)} />
                  <span style={{ flex: 1, textDecoration: checks[r.id] ? 'line-through' : undefined }}>{r.text}</span>
                  <Link className="small" to={r.lesson}>Lesson</Link>
                  <Link className="small" to={r.to}>Drill →</Link>
                </label>
              ))}
            </>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <div className="label">the five terms</div>
            {TERMS.map((t) => {
              const ws = WEEKS.filter((w) => w.week >= t.weeks[0] && w.week <= t.weeks[1]);
              const pct = ws.reduce((s, w) => s + doneFor(w.week), 0) / Math.max(1, ws.length);
              return (
                <div key={t.n} style={{ margin: '8px 0', opacity: week < t.weeks[0] ? 0.65 : 1 }}>
                  <div className="row between">
                    <b>
                      {t.numeral}. {t.name}
                    </b>
                    <span className="muted" style={{ fontSize: 13 }}>
                      weeks {t.weeks[0]}–{t.weeks[1]} · {fmtDate(weekStartDate(profile.startDate, t.weeks[0], planWeeks))}
                    </span>
                  </div>
                  <div className="muted" style={{ fontStyle: 'italic', fontSize: 14 }}>{t.motto}</div>
                  <Progress value={Math.round(pct * 100)} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Section numeral="I" title="Blocked → interleaved, week by week">
        <div className="card">
          <TrendLines data={ratioData} keys={[{ key: 'blocked', color: 'var(--primary)', name: 'Blocked %' }, { key: 'interleaved', color: 'var(--gold)', name: 'Interleaved %' }]} domain={[0, 100]} height={240} />
        </div>
      </Section>
      <Section numeral="II" title="Full examinations by term">
        <div className="card">
          <SimpleBars data={examData} unit="" height={240} color="var(--secondary)" />
        </div>
      </Section>

      <Section numeral="III" title="Weekly reflection">
        <div id="reflection" className="card stack">
          <MethodNote id="habit">Three questions, five minutes, every week.</MethodNote>
          <div className="label">week {sel}</div>
          {(
            [
              ['worked', 'What worked this week?'],
              ['didnt', 'What did not work?'],
              ['change', 'What will I change next week?'],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="field">
              <span>{l}</span>
              <textarea rows={2} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </label>
          ))}
          <button
            className="primary"
            style={{ alignSelf: 'flex-start' }}
            disabled={!form.worked.trim() && !form.didnt.trim() && !form.change.trim()}
            onClick={() => {
              addReflection({ week: sel, ...form });
              const task = weekInfo(sel).tasks.find((t) => t.kind === 'reflection');
              if (task && !checks[task.id]) toggle(task.id);
              setForm({ worked: '', didnt: '', change: '' });
              toast('Reflection filed', `Week ${sel}`);
            }}
          >
            File reflection
          </button>
          {weekReflections.length ? (
            weekReflections
              .slice()
              .reverse()
              .map((r) => (
                <div key={r.id} className="card flat" style={{ fontSize: 15 }}>
                  <div className="label">{new Date(r.ts).toLocaleDateString()}</div>
                  {r.worked && <div><b>Worked:</b> {r.worked}</div>}
                  {r.didnt && <div><b>Didn’t:</b> {r.didnt}</div>}
                  {r.change && <div><b>Change:</b> {r.change}</div>}
                </div>
              ))
          ) : (
            <Empty>No reflection filed for week {sel}.</Empty>
          )}
        </div>
      </Section>
    </div>
  );
}
