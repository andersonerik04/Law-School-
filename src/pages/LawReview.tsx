import { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { LR_TYPES, RC_TYPES, typeLabel, getQuestion, CONCEPTS } from '../lib/content';
import { byType, calibration, calibrationByType, fatigue, rootCauses, timeSinks, heat, examRaw } from '../lib/analytics';
import { projectScore, percentile } from '../lib/scoring';
import { allMastery, currentWeek, masteryFor } from '../lib/mastery';
import { CasebookHeader, Section, MethodNote, RankBadge, Empty } from '../components/common';
import { SkillRadar, ScoreTrajectory, SimpleBars, CalibrationScatter, HeatGrid, TrendLines } from '../components/Charts';
import { TermTimeline } from '../components/TermTimeline';
import { fmtTime } from '../lib/util';
import type { QType } from '../lib/types';
import { Icon } from '../visuals/Icon';

export default function LawReview() {
  const nav = useNavigate();
  const attempts = useStore((s) => s.attempts);
  const exams = useStore((s) => s.exams);
  const ledger = useStore((s) => s.ledger);
  const lessons = useStore((s) => s.lessons);
  const srs = useStore((s) => s.srs);
  const profile = useStore((s) => s.profile);
  const week = currentWeek(profile.startDate, profile.planWeeks);
  const real = useMemo(() => attempts.filter((a) => a.context !== 'tutor'), [attempts]);

  const trajectory = useMemo(() => {
    const pts: { label: string; score: number; low?: number; high?: number; ts: number }[] = [];
    if (profile.diagnosticScore) pts.push({ label: 'Diagnostic', score: profile.diagnosticScore, ts: profile.diagnosticTs ?? 0 });
    exams.filter((e) => e.completed).forEach((e) => pts.push({ label: e.title.replace('Practice Examination', 'PT').replace('Examination', 'Exam'), score: e.scaled ?? examRaw(e).scaled, ts: e.ts }));
    // weekly projections from rolling attempts
    const W = 7 * 86_400_000;
    const first = real[0]?.ts;
    if (first) {
      for (let t = first + W; t <= Date.now() + W; t += W) {
        const p = projectScore(real.filter((a) => a.ts <= t));
        if (p) pts.push({ label: new Date(Math.min(t, Date.now())).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), score: p.score, low: p.low, high: p.high, ts: Math.min(t, Date.now()) });
      }
    }
    return pts.sort((a, b) => a.ts - b.ts);
  }, [exams, real, profile]);

  const types = useMemo(() => byType(real), [real]);
  const radar = types.filter((t) => LR_TYPES.includes(t.type as never)).map((t) => ({ label: t.label.replace('Most Strongly Supported', 'MSS').replace('Principle — ', 'Princ. '), value: (t.acc ?? 0) * 100 }));
  const cal = calibration(real);
  const calType = calibrationByType(real);
  const fat = fatigue(exams.filter((e) => e.completed));
  const sinks = timeSinks(real).slice(0, 8);
  const heatFn = heat(real);
  const proj = projectScore(real);
  const mastery = allMastery(attempts, lessons, srs);

  const weakest = useMemo(
    () =>
      CONCEPTS.filter((c) => c.match && (c.kind === 'lr-type' || c.kind === 'flaw' || c.kind === 'rc-type'))
        .map((c) => ({ c, m: masteryFor(c, real, lessons, srs) }))
        .filter((x) => x.m.n >= 2)
        .sort((a, b) => (a.m.accuracy ?? 0) - (b.m.accuracy ?? 0) || a.m.level - b.m.level)
        .slice(0, 3),
    [real, lessons, srs],
  );

  const progression = useMemo(() => {
    const W = 7 * 86_400_000;
    const first = attempts[0]?.ts;
    if (!first) return [];
    const out: Record<string, number | string>[] = [];
    const lrConcepts = CONCEPTS.filter((c) => c.kind === 'lr-type');
    for (let t = first; t <= Date.now() + W; t += W) {
      const as = attempts.filter((a) => a.ts <= t);
      const avg = lrConcepts.reduce((s, c) => s + masteryFor(c, as, lessons, srs, t).level, 0) / lrConcepts.length;
      const certified = lrConcepts.filter((c) => masteryFor(c, as, lessons, srs, t).level === 5).length;
      out.push({ label: new Date(Math.min(t, Date.now())).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), avg: +avg.toFixed(2), certified });
    }
    return out;
  }, [attempts, lessons, srs]);

  const timeByDiff = [1, 2, 3, 4, 5].map((d) => {
    const as = real.filter((a) => a.difficulty === d);
    return { label: `D${d}`, value: as.length ? (as.filter((a) => a.correct).length / as.length) * 100 : 0 };
  });

  if (!real.length)
    return (
      <div>
        <CasebookHeader chapter="THE LAW REVIEW" title="Analytics" />
        <Empty>Your record is empty. Complete Matriculation and a few drills, and the Law Review will publish.</Empty>
      </div>
    );

  return (
    <div>
      <CasebookHeader chapter="THE LAW REVIEW" title="Volume I — The Record" subtitle={`${real.length} questions · ${exams.filter((e) => e.completed).length} examinations · projected ${proj?.score ?? '—'} (${proj ? percentile(proj.score) : '—'} pct.)`} />

      <Section numeral="I" title="Three Weakest Doctrines">
        <div className="grid cols-3">
          {weakest.length ? (
            weakest.map(({ c, m }) => (
              <div key={c.id} className="card gilt">
                <div className="row">
                  <Icon name={c.icon} size={26} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ margin: 0 }}>{c.label}</h3>
                </div>
                <div className="row" style={{ margin: '8px 0' }}>
                  <RankBadge level={m.level} />
                  <span className="chip">{Math.round((m.accuracy ?? 0) * 100)}% over {m.n}</span>
                </div>
                <div className="row">
                  <button className="primary small" onClick={() => nav(`/chambers?concept=${c.id}&mode=adaptive&n=10`)}>
                    Remedial drill
                  </button>
                  {c.lesson && (
                    <Link className="btn small" to={`/casebook/${c.id}`}>
                      Re-read §
                    </Link>
                  )}
                </div>
              </div>
            ))
          ) : (
            <Empty>Not enough data yet—attempt at least two questions per doctrine.</Empty>
          )}
        </div>
      </Section>

      <Section numeral="II" title="Score Trajectory">
        <div className="card">
          {trajectory.length >= 2 ? <ScoreTrajectory data={trajectory} /> : <Empty>The trajectory appears after your second week or exam.</Empty>}
          <div className="muted" style={{ fontSize: 12 }}>
            Gold band = projection confidence range; dashed line = your 179 target.
          </div>
        </div>
      </Section>

      <div className="grid cols-2">
        <Section numeral="III" title="Skill Radar">
          <div className="card">
            <SkillRadar data={radar} height={340} />
          </div>
        </Section>
        <Section numeral="IV" title="Confidence Calibration">
          <div className="card">
            <MethodNote id="metacognition" />
            <div className="row">
              {cal.buckets.map((b) => (
                <span key={b.conf} className="chip">
                  {b.conf}: stated {b.stated}% · actual {b.actual === null ? '—' : Math.round(b.actual) + '%'} (n={b.n})
                </span>
              ))}
              <span className="chip gold">Calibration score {cal.score ?? '—'}</span>
            </div>
            <CalibrationScatter data={calType} height={260} />
            <div className="muted" style={{ fontSize: 12 }}>
              Above the diagonal = underconfident · below = overconfident.{' '}
              {calType
                .filter((c) => Math.abs(c.gap) > 10)
                .slice(0, 2)
                .map((c) => `${c.label}: ${c.gap > 0 ? 'overconfident' : 'underconfident'} by ${Math.round(Math.abs(c.gap))} pts.`)
                .join(' ')}
            </div>
          </div>
        </Section>
      </div>

      <Section numeral="V" title="Accuracy & Time by Type">
        <div className="grid cols-2">
          <div className="card">
            <h4>Accuracy</h4>
            <SimpleBars data={types.filter((t) => t.n).map((t) => ({ label: t.label, value: (t.acc ?? 0) * 100 }))} domain={[0, 100]} refLine={85} />
          </div>
          <div className="card">
            <h4>Average time (seconds; pace line 80s)</h4>
            <SimpleBars data={types.filter((t) => t.n).map((t) => ({ label: t.label, value: (t.time ?? 0) / 1000, color: (t.time ?? 0) > 150_000 ? 'var(--danger)' : 'var(--secondary)' }))} unit="s" refLine={80} />
          </div>
        </div>
        <div className="grid cols-2" style={{ marginTop: 14 }}>
          <div className="card">
            <h4>Accuracy by difficulty</h4>
            <SimpleBars data={timeByDiff} domain={[0, 100]} height={220} />
          </div>
          <div className="card">
            <h4>Heat map — type × difficulty</h4>
            <HeatGrid rows={[...LR_TYPES, ...RC_TYPES].filter((t) => real.some((a) => a.type === t))} cols={['1', '2', '3', '4', '5']} value={heatFn} rowLabel={(r) => typeLabel(r as QType)} colLabel={(c) => `D${c}`} onCell={(r) => nav(`/chambers?type=${r}`)} />
          </div>
        </div>
      </Section>

      <div className="grid cols-2">
        <Section numeral="VI" title="Time Sinks (over 2:30)">
          <div className="card">
            {sinks.length ? (
              <table className="ledger">
                <tbody>
                  {sinks.map((a) => (
                    <tr key={a.id}>
                      <td>{typeLabel(a.type)}</td>
                      <td>{fmtTime(a.timeMs)}</td>
                      <td>{a.correct ? '✓' : '✗'}</td>
                      <td>
                        <Link to={`/q/${a.qid}`}>{getQuestion(a.qid)?.id}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>No question has taken longer than 2:30. Well paced.</Empty>
            )}
          </div>
        </Section>
        <Section numeral="VII" title="Error Root Causes">
          <div className="card">
            <SimpleBars data={rootCauses(ledger).map((c) => ({ label: c.cause, value: c.n }))} unit="" color="var(--secondary)" height={240} />
          </div>
        </Section>
      </div>

      <div className="grid cols-2">
        <Section numeral="VIII" title="Fatigue Analysis">
          <div className="card">
            {exams.some((e) => e.completed) ? (
              <>
                <SimpleBars data={fat.pos} domain={[0, 100]} height={200} />
                <SimpleBars data={fat.halves} domain={[0, 100]} height={180} color="var(--secondary)" />
              </>
            ) : (
              <Empty>Sit an examination to measure fatigue across sections.</Empty>
            )}
          </div>
        </Section>
        <Section numeral="IX" title="Mastery Progression">
          <div className="card">
            {progression.length >= 2 ? <TrendLines data={progression} keys={[{ key: 'avg', name: 'Avg LR rank (0–5)', color: 'var(--primary)' }, { key: 'certified', name: 'Types certified', color: 'var(--gold)' }]} /> : <Empty>Progression appears after your first week.</Empty>}
            <div className="row" style={{ gap: 4, marginTop: 6 }}>
              {CONCEPTS.filter((c) => c.kind === 'lr-type').map((c) => (
                <span key={c.id} title={c.label}>
                  <RankBadge level={mastery[c.id]?.level ?? 0} small />
                </span>
              ))}
            </div>
          </div>
        </Section>
      </div>

      <Section numeral="X" title="The Term Timeline">
        <div className="card">
          <TermTimeline week={week} onWeek={() => nav('/planner')} />
        </div>
      </Section>
    </div>
  );
}
