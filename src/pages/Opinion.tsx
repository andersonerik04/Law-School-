import { useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { getQuestion, isLR, PASSAGE_BY_ID, typeLabel, TRAP_LABEL } from '../lib/content';
import { examRaw, examBlind, rootCauses } from '../lib/analytics';
import { percentile } from '../lib/scoring';
import { LETTERS, fmtTime, toRoman } from '../lib/util';
import { SkillRadar, SimpleBars } from '../components/Charts';
import { Empty, MethodNote } from '../components/common';
import { ROOT_CAUSES } from '../components/QuestionPlayer';
import { ArgumentDiagram, overlayForType } from '../visuals/ArgumentDiagram';
import { PassageMap } from '../visuals/RCVisuals';
import { Monogram, Icon } from '../visuals/Icon';
import type { QType } from '../lib/types';

export default function Opinion() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const exam = useStore((s) => s.exams.find((e) => e.id === id));
  const attempts = useStore((s) => s.attempts);
  const ledger = useStore((s) => s.ledger);
  const updateLedger = useStore((s) => s.updateLedger);
  const profile = useStore((s) => s.profile);
  const mine = useMemo(() => attempts.filter((a) => a.examId === id), [attempts, id]);

  const data = useMemo(() => {
    if (!exam) return null;
    const r = examRaw(exam);
    const b = examBlind(exam);
    const scoredAttempts = mine.filter((a) => a.sectionPos !== undefined && !exam.sections[a.sectionPos].experimental);
    const types = Array.from(new Set(scoredAttempts.map((a) => a.type)));
    const radar = types.map((t) => {
      const as = scoredAttempts.filter((a) => a.type === t);
      const blindCorrect = as.filter((a) => {
        const q = getQuestion(a.qid);
        const bl = exam.blind?.[a.qid];
        return q && (bl ? bl.choice : a.choice) === q.answer;
      }).length;
      return { label: typeLabel(t).replace('Most Strongly Supported', 'MSS').replace('Principle — ', 'Princ. '), value: (as.filter((a) => a.correct).length / as.length) * 100, value2: (blindCorrect / as.length) * 100 };
    });
    const times = scoredAttempts
      .filter((a) => isLR(getQuestion(a.qid)!))
      .map((a) => ({ label: `S${(a.sectionPos ?? 0) + 1}·${(a.posInSection ?? 0) + 1}`, value: a.timeMs / 1000, color: a.correct ? 'var(--success)' : 'var(--danger)' }));
    const misses = scoredAttempts.filter((a) => !a.correct);
    const costly = misses
      .slice()
      .sort((x, y) => x.difficulty - y.difficulty || y.timeMs - x.timeMs)
      .slice(0, 5);
    const examLedger = ledger.filter((l) => mine.some((a) => a.id === l.attemptId));
    const causes = rootCauses(examLedger).map((c) => ({ label: c.cause, value: c.n }));
    const fatigue = exam.sections.map((s, si) => {
      const as = mine.filter((a) => a.sectionPos === si);
      return { label: `${toRoman(si + 1)} · ${s.kind}${s.experimental ? ' (exp.)' : ''}`, value: as.length ? (as.filter((a) => a.correct).length / as.length) * 100 : 0 };
    });
    const byType = types
      .map((t) => {
        const as = scoredAttempts.filter((a) => a.type === t);
        return { t, acc: as.filter((a) => a.correct).length / as.length, n: as.length };
      })
      .sort((a, b) => a.acc - b.acc);
    return { r, b, radar, times, costly, causes, fatigue, byType, examLedger, scoredAttempts };
  }, [exam, mine, ledger]);

  if (!exam || !data) return <Empty>Examination not found.</Empty>;
  const { r, b } = data;
  const scaled = exam.scaled ?? r.scaled;
  const gap = b ? b.scaled - scaled : 0;
  const diagnosis = !b
    ? 'No blind review was conducted.'
    : gap >= 5
      ? `Blind review raised the score by ${gap} points. Your understanding outpaces your timed performance: the principal remedy is pacing and section management, not new doctrine.`
      : gap >= 2
        ? `Blind review raised the score by ${gap} points. Timing contributes, but most misses persisted untimed; doctrine and process both need attention.`
        : 'Blind review changed little: your misses are understanding problems, not timing problems. Prioritize the remedial doctrines below.';
  const totalTime = exam.sections.filter((s) => !s.experimental).reduce((t, s) => t + s.elapsedMs, 0);

  return (
    <div className="opinion" style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div className="card gilt paper-texture" style={{ padding: '28px 34px' }}>
        <div style={{ textAlign: 'center' }}>
          <Monogram size={64} />
          <div className="caption" style={{ color: 'var(--gold)', fontSize: 14, marginTop: 6 }}>
            in the court of examiners · the bar &amp; bench lsat academy
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontStyle: 'italic', marginTop: 8 }}>
            In re {profile.name || 'the Examinee'} — {exam.title}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            Decided {new Date(exam.ts).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <h1 style={{ margin: '14px 0 2px', letterSpacing: '0.12em' }}>OPINION OF THE EXAMINER</h1>
          <hr className="double-rule" style={{ maxWidth: 420, margin: '10px auto 18px' }} />
        </div>

        <h2>I. Holding</h2>
        <div className="grid" style={{ gridTemplateColumns: '190px 1fr', alignItems: 'center' }}>
          <div className="score-seal">
            <span className="n">{scaled}</span>
            <span className="muted" style={{ fontSize: 12 }}>
              ≈ {percentile(scaled)}th pct.
            </span>
          </div>
          <div className="book" style={{ fontSize: 17 }}>
            <p>
              The examinee is adjudged to have earned a scaled score of <b>{scaled}</b> on {r.raw} of {r.max} scored questions answered correctly{b ? <>, and a blind-review score of <b>{b.scaled}</b> ({b.raw}/{b.max})</> : null}. Time used on scored sections: {fmtTime(totalTime)}.
            </p>
            <p style={{ marginBottom: 0 }}>
              <i>{diagnosis}</i> {scaled >= 179 ? 'The target of 179 is met; affirm the method and protect it.' : `The distance to the 179 target is ${179 - scaled} points.`}
            </p>
          </div>
        </div>

        <h2 style={{ marginTop: 20 }}>II. Findings</h2>
        <h4>A. Sections</h4>
        <table className="ledger">
          <thead>
            <tr>
              <th>Section</th>
              <th>Type</th>
              <th>Raw</th>
              <th>Time used</th>
              <th>Flagged</th>
            </tr>
          </thead>
          <tbody>
            {exam.sections.map((s, si) => {
              const c = s.qids.filter((qid, i) => getQuestion(qid)?.answer === s.answers[i]).length;
              return (
                <tr key={si} style={s.experimental ? { opacity: 0.7 } : undefined}>
                  <td>{toRoman(si + 1)}</td>
                  <td>
                    {s.kind === 'LR' ? 'Logical Reasoning' : 'Reading Comprehension'}
                    {s.experimental && <span className="chip" style={{ marginLeft: 6 }}>experimental · unscored</span>}
                  </td>
                  <td>
                    {c}/{s.qids.length}
                  </td>
                  <td>{fmtTime(s.elapsedMs)}</td>
                  <td>{s.flags.filter(Boolean).length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="grid cols-2" style={{ marginTop: 14 }}>
          <div>
            <h4>B. Accuracy by question type</h4>
            <SkillRadar data={data.radar} height={300} second={b ? 'Blind review' : undefined} />
          </div>
          <div>
            <h4>C. Fatigue — accuracy by section position</h4>
            <SimpleBars data={data.fatigue} domain={[0, 100]} height={260} />
            <h4>D. Error root causes</h4>
            <SimpleBars data={data.causes} unit="" height={200} color="var(--secondary)" />
          </div>
        </div>
        <h4>E. Time per question (scored LR; red = missed; gold line = 1:20 pace)</h4>
        <SimpleBars data={data.times} unit="s" refLine={80} height={240} />
        <MethodNote id="errors" />

        <h2 style={{ marginTop: 20 }}>III. Remedies</h2>
        <h4>A. The five most costly errors</h4>
        <p className="muted book" style={{ marginTop: -4 }}>
          Ranked by cost: easier questions missed and time spent. Each is in your Ledger and spaced-review queue.<sup className="fn">1</sup>
        </p>
        {data.costly.length === 0 && <Empty>No scored errors. A clean record.</Empty>}
        <div className="stack">
          {data.costly.map((a, k) => {
            const q = getQuestion(a.qid)!;
            const led = data.examLedger.find((l) => l.attemptId === a.id);
            const trap = q.brief.analysis.wrong.find((w) => w.choice === a.choice);
            return (
              <div key={a.id} className="card flat">
                <div className="row between">
                  <div className="row">
                    <b style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>{k + 1}.</b>
                    <span className="chip gold">{typeLabel(q.type)}</span>
                    <span className="chip">Difficulty {q.difficulty}</span>
                    <span className="chip">{fmtTime(a.timeMs)}</span>
                    <span className="chip danger">
                      Chose {a.choice === null ? '—' : `(${LETTERS[a.choice]})`}
                      {trap ? ` · ${TRAP_LABEL[trap.label]}` : ''}
                    </span>
                    <span className="chip success">Answer ({LETTERS[q.answer]})</span>
                  </div>
                  <Link to={`/q/${q.id}`}>Brief →</Link>
                </div>
                <p className="book" style={{ fontSize: 15, margin: '8px 0' }}>
                  <b>Holding:</b> {q.brief.holding}
                </p>
                <div style={{ maxWidth: 760 }}>{isLR(q) ? <ArgumentDiagram q={q} overlay={overlayForType(q.type)} overlayText={q.choices[q.answer]} compact /> : <PassageMap paragraphs={PASSAGE_BY_ID[q.passageId]?.passages.flatMap((p) => p.paragraphs) ?? []} />}</div>
                {led && (
                  <div className="row" style={{ marginTop: 6 }}>
                    <span className="label">root cause</span>
                    {ROOT_CAUSES.map((rc) => (
                      <button key={rc.id} title={rc.blurb} className={`small ${led.rootCause === rc.id ? 'selected' : ''}`} onClick={() => updateLedger(led.id, { rootCause: rc.id })}>
                        {rc.id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <h4 style={{ marginTop: 16 }}>B. Prescribed drills</h4>
        <div className="row">
          {data.byType.slice(0, 3).map((x) => (
            <button key={x.t} onClick={() => nav(`/chambers?type=${x.t}&mode=adaptive`)}>
              <Icon name="gavel" size={14} /> {typeLabel(x.t as QType)} · {Math.round(x.acc * 100)}% ({x.n})
            </button>
          ))}
          <Link className="btn primary" to="/ledger">
            Brief every error in the Ledger
          </Link>
        </div>
        <div className="footnotes">
          <sup>1</sup> The curve is modeled on recent post-2024 forms (≈76 scored questions) and is approximate. Experimental-section results are reported but excluded from the score, as on the real test.
        </div>
        <p style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontStyle: 'italic', marginTop: 16 }}>So ordered. — The Examiner</p>
      </div>
    </div>
  );
}
