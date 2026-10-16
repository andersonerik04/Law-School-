import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { buildDocket } from '../lib/docket';
import { projectScore, percentile } from '../lib/scoring';
import { activeDays, streak } from '../lib/streak';
import { calibration, heat } from '../lib/analytics';
import { allMastery, termForWeek } from '../lib/mastery';
import { CONCEPTS, LR_TYPES, typeLabel } from '../lib/content';
import { MethodNote, RankBadge, Section } from '../components/common';
import { HeatGrid } from '../components/Charts';
import { Icon, Monogram } from '../visuals/Icon';
import { HONOR_BY_ID } from '../lib/honors';
import type { QType } from '../lib/types';
import { dateKey } from '../lib/util';

const KIND_ICON: Record<string, string> = { lesson: 'book', review: 'cards', practice: 'gavel', exam: 'exam', writing: 'quill', reflection: 'handbook' };

export default function Docket() {
  const nav = useNavigate();
  const profile = useStore((s) => s.profile);
  const lessons = useStore((s) => s.lessons);
  const srs = useStore((s) => s.srs);
  const attempts = useStore((s) => s.attempts);
  const studyLog = useStore((s) => s.studyLog);
  const cardsLog = useStore((s) => s.cardsReviewedLog);
  const honors = useStore((s) => s.honors);
  const reflections = useStore((s) => s.reflections);
  const setSettings = useStore((s) => s.setSettings);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('docket-' + dateKey()) ?? '{}');
    } catch {
      return {};
    }
  });

  const d = useMemo(() => buildDocket(profile, lessons, srs, attempts), [profile, lessons, srs, attempts]);
  const term = termForWeek(d.week);
  const proj = useMemo(() => projectScore(attempts.filter((a) => a.context !== 'tutor')), [attempts]);
  const st = useMemo(() => streak(activeDays(studyLog, attempts, cardsLog)), [studyLog, attempts, cardsLog]);
  const cal = useMemo(() => calibration(attempts), [attempts]);
  const mastery = useMemo(() => allMastery(attempts, lessons, srs), [attempts, lessons, srs]);
  const hoursTotal = Object.values(studyLog).reduce((a, b) => a + b, 0) / 60;
  const weekStart = Date.now() - 6 * 86_400_000;
  const hoursWeek = Object.entries(studyLog).filter(([k]) => new Date(k + 'T12:00:00').getTime() >= weekStart).reduce((a, [, v]) => a + v, 0) / 60;
  const daysLeft = Math.max(0, Math.ceil((new Date(profile.testDate + 'T09:00:00').getTime() - Date.now()) / 86_400_000));
  const heatFn = useMemo(() => heat(attempts), [attempts]);
  const reflectedThisWeek = reflections.some((r) => r.week === d.week);
  const toggle = (k: string) => {
    const n = { ...checked, [k]: !checked[k] };
    setChecked(n);
    try {
      localStorage.setItem('docket-' + dateKey(), JSON.stringify(n));
    } catch {
      /* storage unavailable */
    }
  };
  const lrConcepts = CONCEPTS.filter((c) => c.kind === 'lr-type');
  const recentHonors = honors.slice(-3).reverse();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <header className="row between" style={{ marginBottom: 6 }}>
        <div className="row">
          <Monogram size={58} />
          <div>
            <div className="label">the docket · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
            <h1 style={{ margin: 0 }}>
              {greet}
              {profile.name ? `, ${profile.name}` : ''}.
            </h1>
            <div className="muted" style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', fontSize: 18 }}>
              Fiat Justitia — Term {term.numeral}, “{term.motto},” Week {d.week}: {d.info.title}
            </div>
          </div>
        </div>
        <div className="row">
          <button className="small" onClick={() => setSettings({ homeView: 'map' })}>
            <Icon name="map" size={14} /> Map as home
          </button>
        </div>
      </header>
      <hr className="double-rule" />

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="stat">
            <span className="v">{daysLeft}</span>
            <span className="k">days to the bar</span>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Test date {profile.testDate}
          </div>
        </div>
        <div className="card">
          <div className="stat">
            <span className="v">{proj ? proj.score : '—'}</span>
            <span className="k">projected score</span>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {proj ? `range ${proj.low}–${proj.high} · ≈${percentile(proj.score)}th pct · target 179` : 'Answer 8+ questions to project'}
          </div>
        </div>
        <div className="card">
          <div className="stat">
            <span className="v">{st.current}</span>
            <span className="k">day streak</span>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {st.graceUsed ? 'Grace day used this week' : 'Grace day available'} · best {st.best}
          </div>
        </div>
        <div className="card">
          <div className="stat">
            <span className="v">{hoursWeek.toFixed(1)}</span>
            <span className="k">hours this week</span>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Goal {profile.hoursPerWeek} h · {hoursTotal.toFixed(1)} h total · calibration {cal.score ?? '—'}
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', alignItems: 'start' }}>
        <Section numeral="I" title="Today's Docket" right={<span className="chip gold">≈ {d.minutes} min</span>}>
          <MethodNote id="habit" />
          <div className="stack tight">
            {d.items.map((it) => {
              const k = it.kind + it.title;
              return (
                <div key={k} className="card row" style={{ padding: '10px 14px', flexWrap: 'nowrap', opacity: checked[k] ? 0.6 : 1 }}>
                  <input type="checkbox" checked={!!checked[k]} onChange={() => toggle(k)} aria-label="Mark done" />
                  <Icon name={KIND_ICON[it.kind]} size={22} style={{ color: 'var(--primary)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, textDecoration: checked[k] ? 'line-through' : undefined }}>{it.title}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {it.detail} · ~{it.minutes} min
                    </div>
                  </div>
                  <Link className="btn primary" to={it.to}>
                    Open
                  </Link>
                </div>
              );
            })}
          </div>
          {!reflectedThisWeek && new Date().getDay() >= 5 && (
            <div className="card gilt" style={{ marginTop: 12 }}>
              <div className="label">weekly reflection</div>
              <p className="book" style={{ margin: '4px 0' }}>
                What worked this week? What didn’t? What will you change?
              </p>
              <button className="small primary" onClick={() => nav('/planner#reflection')}>
                Write it now
              </button>
              <MethodNote id="metacognition" />
            </div>
          )}
        </Section>

        <div>
          <Section numeral="II" title="Ranks of Mastery">
            <div className="card" style={{ maxHeight: 360, overflow: 'auto' }}>
              <table className="ledger">
                <tbody>
                  {lrConcepts.map((c) => (
                    <tr key={c.id} onClick={() => nav(`/casebook/${c.id}`)} style={{ cursor: 'pointer' }}>
                      <td>
                        <Icon name={c.icon} size={15} style={{ color: 'var(--primary)', verticalAlign: 'middle', marginRight: 6 }} />
                        {c.label}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <RankBadge level={mastery[c.id]?.level ?? 0} small />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          {recentHonors.length > 0 && (
            <Section numeral="III" title="Honors">
              <div className="stack tight">
                {recentHonors.map((h) => (
                  <div key={h.id} className="card row" style={{ padding: '8px 12px' }}>
                    <Icon name="laurel" size={22} style={{ color: 'var(--gold)' }} />
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>{HONOR_BY_ID[h.id]?.title ?? h.id}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {new Date(h.ts).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      <Section numeral="IV" title="Accuracy by Type & Difficulty" right={<Link to="/law-review">The Law Review →</Link>}>
        <div className="card">
          <HeatGrid rows={LR_TYPES} cols={['1', '2', '3', '4', '5']} value={heatFn} rowLabel={(r) => typeLabel(r as QType)} colLabel={(c) => `D${c}`} onCell={(r) => nav(`/chambers?type=${r}`)} />
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Click a row to drill that type. Darker = stronger. Empty = not yet attempted.
          </div>
        </div>
      </Section>
    </div>
  );
}
