import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { getQuestion, isLR, stimulusText } from '../lib/content';
import { examBlind, examRaw } from '../lib/analytics';
import { LETTERS } from '../lib/util';
import { CasebookHeader, MethodNote, Empty } from '../components/common';
import { PassagePanel } from '../components/QuestionPlayer';
import { DiagramBuilder } from '../components/DiagramBuilder';
import type { Highlight } from '../components/Highlightable';

/** Re-answer flagged/uncertain questions untimed, with written justifications, BEFORE seeing any answers. */
export default function BlindReview() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const exam = useStore((s) => s.exams.find((e) => e.id === id));
  const saveExam = useStore((s) => s.saveExam);
  const [extra, setExtra] = useState<string[]>([]);
  const [cur, setCur] = useState(0);
  const [sketch, setSketch] = useState(false);
  const [phl, setPhl] = useState<Highlight[]>([]);

  const items = useMemo(() => {
    if (!exam) return [];
    const list: { qid: string; si: number; i: number; reason: string }[] = [];
    exam.sections.forEach((s, si) =>
      s.qids.forEach((qid, i) => {
        const reasons = [s.flags[i] && 'flagged', s.answers[i] === null && 'unanswered', s.confidence[i] && s.confidence[i] !== 'Certain' && `rated ${s.confidence[i]}`, extra.includes(qid) && 'added by you'].filter(Boolean);
        if (reasons.length) list.push({ qid, si, i, reason: reasons.join(', ') });
      }),
    );
    return list;
  }, [exam, extra]);

  if (!exam) return <Empty>Examination not found.</Empty>;
  if (exam.completed) return <Navigate to={`/opinion/${exam.id}`} replace />;
  const blind = exam.blind ?? {};
  const it = items[cur];
  const q = it ? getQuestion(it.qid) : undefined;
  const entry = it ? blind[it.qid] ?? { choice: exam.sections[it.si].answers[it.i], why: '' } : undefined;
  const setEntry = (patch: Partial<{ choice: number | null; why: string }>) => {
    if (!it) return;
    saveExam({ ...exam, blind: { ...blind, [it.qid]: { ...entry!, ...patch } } });
  };
  const seal = () => {
    const b = examBlind({ ...exam, blind });
    const r = examRaw(exam);
    saveExam({ ...exam, blind, blindScaled: b?.scaled, scaled: r.scaled, raw: r.raw, rawMax: r.max, completed: true, phase: 'done' });
    nav(`/opinion/${exam.id}`);
  };
  const allQids = exam.sections.flatMap((s, si) => s.qids.map((qid, i) => ({ qid, label: `S${si + 1} · Q${i + 1}` })));

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      <CasebookHeader chapter="BLIND REVIEW" title={exam.title} subtitle="Untimed. No answers shown. Justify every choice as if to a skeptical judge." />
      <MethodNote id="metacognition">Comparing your timed score with your blind-review score separates timing problems from understanding problems.</MethodNote>
      <div className="grid" style={{ gridTemplateColumns: '240px minmax(0,1fr)', alignItems: 'start' }}>
        <aside className="card stack tight" style={{ position: 'sticky', top: 70 }}>
          <div className="label">for review ({items.length})</div>
          {items.map((x, k) => (
            <button key={x.qid} className={`small ${k === cur ? 'selected' : ''}`} style={{ justifyContent: 'space-between' }} onClick={() => setCur(k)}>
              <span>
                S{x.si + 1} · Q{x.i + 1}
              </span>
              <span style={{ fontSize: 10 }}>{blind[x.qid]?.why ? '✓' : x.reason.split(',')[0]}</span>
            </button>
          ))}
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) setExtra((x) => [...x, e.target.value]);
            }}
          >
            <option value="">+ Add a question…</option>
            {allQids
              .filter((x) => !items.some((y) => y.qid === x.qid))
              .map((x) => (
                <option key={x.qid} value={x.qid}>
                  {x.label}
                </option>
              ))}
          </select>
          <hr />
          <button className="primary" onClick={seal}>
            Seal the review → Opinion
          </button>
          <button className="ghost small" onClick={seal}>
            Skip blind review
          </button>
        </aside>
        <div>
          {!it || !q ? (
            <div className="card">
              <p className="book">Nothing was flagged, skipped, or rated uncertain. Add questions from the list if you want to re-examine any, or seal the review.</p>
            </div>
          ) : (
            <div className="card page-turn" key={it.qid}>
              <div className="row between">
                <div className="label">
                  section {it.si + 1} · question {it.i + 1} · {it.reason}
                </div>
                <span className="chip">Timed answer: {exam.sections[it.si].answers[it.i] === null ? 'none' : `(${LETTERS[exam.sections[it.si].answers[it.i]!]})`}</span>
              </div>
              {isLR(q) ? (
                <>
                  <div className="stimulus" style={{ whiteSpace: 'pre-wrap' }}>
                    {stimulusText(q)}
                  </div>
                  <label className="row" style={{ fontSize: 13, margin: '8px 0' }}>
                    <input type="checkbox" checked={sketch} onChange={(e) => setSketch(e.target.checked)} /> Diagram the argument before deciding (optional)
                  </label>
                  {sketch && <DiagramBuilder key={q.id} q={q} onDone={() => undefined} />}
                </>
              ) : (
                <div className="card flat" style={{ maxHeight: 380, overflow: 'auto' }}>
                  <PassagePanel passageId={q.passageId} highlights={phl} setHighlights={setPhl} />
                </div>
              )}
              <div className="stem">{q.stem}</div>
              <div className="choices">
                {q.choices.map((c, i) => (
                  <div key={i} className={`choice ${entry?.choice === i ? 'selected' : ''}`} onClick={() => setEntry({ choice: i })}>
                    <span className="letter">{LETTERS[i]}</span>
                    <span className="ctext">{c}</span>
                    <span />
                  </div>
                ))}
              </div>
              <label className="field" style={{ marginTop: 12 }}>
                <span>
                  <b style={{ color: 'var(--primary)', fontFamily: 'var(--font-display)', fontSize: 17 }}>JUSTIFICATION</b> — why this answer, and why not your strongest alternative?
                </span>
                <textarea rows={3} value={entry?.why ?? ''} onChange={(e) => setEntry({ why: e.target.value })} />
              </label>
              <div className="row" style={{ marginTop: 10 }}>
                <button disabled={cur === 0} onClick={() => setCur(cur - 1)}>
                  ← Previous
                </button>
                <button className="primary" disabled={cur >= items.length - 1} onClick={() => setCur(cur + 1)}>
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
