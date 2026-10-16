import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Attempt, AttemptContext, Confidence, PracticeMode, Question, RootCause, WhyGrade } from '../lib/types';
import { isLR, stimulusText, PASSAGE_BY_ID, typeLabel, TRAP_LABEL, LR_PACE_MS } from '../lib/content';
import { useStore } from '../lib/store';
import { gradeWhy, needsWhy } from '../lib/grading';
import { LETTERS, fmtTime } from '../lib/util';
import { Highlightable, type Highlight } from './Highlightable';
import { CaseBrief } from './CaseBrief';
import { DiagramBuilder, PassageMapBuilder } from './DiagramBuilder';
import { MethodNote, Modal, KeyHint, ReadAloud } from './common';
import { ArgumentDiagram, overlayForType } from '../visuals/ArgumentDiagram';
import { PassageMap } from '../visuals/RCVisuals';
import { Icon } from '../visuals/Icon';

export const CONFIDENCES: Confidence[] = ['Certain', 'Likely', 'Guess'];
export const ROOT_CAUSES: { id: RootCause; blurb: string }[] = [
  { id: 'Comprehension', blurb: 'Misread the stimulus, stem, or an answer' },
  { id: 'Conceptual', blurb: "Didn't know the rule or concept" },
  { id: 'Process', blurb: 'Skipped a step of the method' },
  { id: 'Timing', blurb: 'Rushed or ran short of time' },
  { id: 'Trap', blurb: 'Fell for a known wrong-answer pattern' },
];

export interface PlayerProps {
  q: Question;
  context: AttemptContext;
  mode?: PracticeMode;
  feedback?: 'immediate' | 'none';
  requireConfidence?: boolean;
  requireWhy?: boolean;
  diagramFirst?: boolean;
  revealType?: boolean;
  record?: boolean;
  onNext?: () => void;
  onAttempt?: (a: Attempt) => void;
  nextLabel?: string;
  header?: React.ReactNode;
}

export function PassagePanel({ passageId, highlights, setHighlights, register, hlColor }: { passageId: string; highlights: Highlight[]; setHighlights: (h: Highlight[]) => void; register?: (fn: (c?: 1 | 2 | 3) => boolean) => void; hlColor?: 1 | 2 | 3 }) {
  const p = PASSAGE_BY_ID[passageId];
  if (!p) return null;
  const text = p.passages.map((x) => (p.comparative ? `${x.label}\n\n` : '') + x.paragraphs.map((pp) => pp.text).join('\n\n')).join('\n\n\n');
  return (
    <div>
      <div className="row between">
        <div className="label">{p.comparative ? 'comparative reading' : 'passage'} · {p.title}</div>
        <ReadAloud text={text} label="Read passage" />
      </div>
      <Highlightable text={text} highlights={highlights} onChange={setHighlights} className="stimulus" registerApply={register} color={hlColor} />
    </div>
  );
}

export function QuestionPlayer({
  q,
  context,
  mode,
  feedback = 'immediate',
  requireConfidence = true,
  requireWhy,
  diagramFirst = false,
  revealType = false,
  record = true,
  onNext,
  onAttempt,
  nextLabel = 'Next question →',
  header,
}: PlayerProps) {
  const settings = useStore((s) => s.settings);
  const recordAttempt = useStore((s) => s.recordAttempt);
  const setWhyGrade = useStore((s) => s.setWhyGrade);
  const updateLedger = useStore((s) => s.updateLedger);
  const ledger = useStore((s) => s.ledger);

  const whyRequired = requireWhy ?? needsWhy(settings.requireWhy, q.id);
  const [choice, setChoice] = useState<number | null>(null);
  const [struck, setStruck] = useState<Set<number>>(new Set());
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [why, setWhy] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [grade, setGrade] = useState<WhyGrade | null>(null);
  const [grading, setGrading] = useState(false);
  const [selfRated, setSelfRated] = useState(false);
  const [diagramDone, setDiagramDone] = useState(!diagramFirst);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [passageHl, setPassageHl] = useState<Highlight[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const start = useRef(Date.now());
  const applyRef = useRef<((c?: 1 | 2 | 3) => boolean) | null>(null);
  const applyPassageRef = useRef<((c?: 1 | 2 | 3) => boolean) | null>(null);

  // reset when the question changes
  useEffect(() => {
    setChoice(null);
    setStruck(new Set());
    setConfidence(null);
    setWhy('');
    setSubmitted(false);
    setAttempt(null);
    setGrade(null);
    setSelfRated(false);
    setDiagramDone(!diagramFirst);
    setHighlights([]);
    setFlagged(false);
    start.current = Date.now();
    setElapsed(0);
  }, [q.id, diagramFirst]);

  useEffect(() => {
    if (submitted) return;
    const t = setInterval(() => setElapsed(Date.now() - start.current), 1000);
    return () => clearInterval(t);
  }, [submitted, q.id]);

  const canSubmit = choice !== null && (!requireConfidence || confidence) && (!whyRequired || why.trim().split(/\s+/).length >= 4) && diagramDone;

  const submit = useCallback(async () => {
    if (!canSubmit || submitted) return;
    const timeMs = Date.now() - start.current;
    const correct = choice === q.answer;
    setSubmitted(true);
    let a: Attempt | null = null;
    if (record) {
      a = recordAttempt({ qid: q.id, choice, correct, confidence: confidence ?? undefined, why: why || undefined, timeMs, context, mode, type: q.type, difficulty: q.difficulty });
      setAttempt(a);
      onAttempt?.(a);
    }
    if (feedback === 'none') {
      onNext?.();
      return;
    }
    if (why.trim()) {
      setGrading(true);
      const g = await gradeWhy(q, choice, why);
      setGrading(false);
      setGrade(g);
      if (a) {
        const lucky = g.source === 'ai' && correct && g.verdict === 'flawed';
        setWhyGrade(a.id, g, lucky || undefined);
        if (g.source === 'ai') setSelfRated(true);
      }
    }
  }, [canSubmit, submitted, choice, q, confidence, why, context, mode, record, recordAttempt, feedback, onNext, onAttempt, setWhyGrade]);

  // keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (!diagramDone) return;
      if (!submitted && 'abcde'.includes(k) && k.length === 1) {
        const i = 'abcde'.indexOf(k);
        if (e.shiftKey) {
          setStruck((s) => {
            const n = new Set(s);
            n.has(i) ? n.delete(i) : n.add(i);
            return n;
          });
          if (choice === i) setChoice(null);
        } else if (!struck.has(i)) setChoice(i);
        e.preventDefault();
      } else if (k === 'c' && !submitted) {
        setConfidence((c) => CONFIDENCES[(CONFIDENCES.indexOf(c ?? 'Guess') + 1) % 3]);
      } else if (k === 'f') {
        setFlagged((f) => !f);
      } else if (k === 'h') {
        if (!applyRef.current?.()) applyPassageRef.current?.();
      } else if (k === 'm') {
        if (submitted) setShowMap((s) => !s);
      } else if (k === 'enter') {
        if (!submitted) submit();
        else if (selfRated || !why.trim() || grade?.source === 'ai') onNext?.();
      } else if (k === 'arrowright' && submitted) {
        onNext?.();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [submitted, choice, struck, submit, onNext, diagramDone, selfRated, why, grade]);

  const lr = isLR(q);
  const stimulus = useMemo(() => (lr ? stimulusText(q) : ''), [q, lr]);
  const ledgerEntry = attempt ? ledger.find((l) => l.attemptId === attempt.id) : undefined;
  const correct = submitted && choice === q.answer;
  const pace = lr ? LR_PACE_MS : 85_000;
  const showFeedback = submitted && feedback === 'immediate';

  const questionColumn = (
    <div>
      {lr && (
        <div className="row between" style={{ marginBottom: 4 }}>
          <span />
          <ReadAloud text={stimulus + ' ' + q.stem} label="Read aloud" />
        </div>
      )}
      {lr && <Highlightable text={stimulus} highlights={highlights} onChange={setHighlights} className="stimulus" registerApply={(fn) => (applyRef.current = fn)} />}
      <div className="stem">{q.stem}</div>
      <div className="choices" role="radiogroup" aria-label="Answer choices">
        {q.choices.map((c, i) => {
          const cls = ['choice'];
          if (choice === i) cls.push('selected');
          if (struck.has(i)) cls.push('struck');
          if (showFeedback && i === q.answer) cls.push('correct');
          if (showFeedback && choice === i && i !== q.answer) cls.push('wrong');
          const trap = showFeedback ? q.brief.analysis.wrong.find((w) => w.choice === i) : undefined;
          return (
            <div
              key={i}
              className={cls.join(' ')}
              role="radio"
              aria-checked={choice === i}
              tabIndex={0}
              onClick={() => !submitted && !struck.has(i) && setChoice(i)}
              onKeyDown={(e) => e.key === ' ' && !submitted && setChoice(i)}
            >
              <span className="letter">{LETTERS[i]}</span>
              <span className="ctext">
                {c}
                {trap && (
                  <span className="chip danger" style={{ marginLeft: 8, fontSize: 11 }}>
                    {TRAP_LABEL[trap.label]}
                  </span>
                )}
              </span>
              {!submitted && (
                <button
                  className="ghost small strike-btn"
                  title="Strike out (Shift+letter)"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStruck((s) => {
                      const n = new Set(s);
                      n.has(i) ? n.delete(i) : n.add(i);
                      return n;
                    });
                    if (choice === i) setChoice(null);
                  }}
                >
                  S̶
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!submitted && (
        <div className="stack" style={{ marginTop: 14, maxWidth: 820 }}>
          {requireConfidence && (
            <div>
              <div className="row">
                <span className="label">confidence</span>
                {CONFIDENCES.map((c) => (
                  <button key={c} className={`small ${confidence === c ? 'selected' : ''}`} onClick={() => setConfidence(c)}>
                    {c}
                  </button>
                ))}
                <KeyHint k="C" />
              </div>
            </div>
          )}
          {whyRequired && (
            <label className="field">
              <span>
                <b style={{ color: 'var(--primary)', fontFamily: 'var(--font-display)', fontSize: 17 }}>WHY?</b> In one or two sentences, justify your choice before you see the result.
              </span>
              <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} placeholder="e.g., The argument assumes the sample is representative; (C) attacks that assumption…" />
            </label>
          )}
          <div className="row">
            <button className="primary" disabled={!canSubmit} onClick={submit}>
              Submit <KeyHint k="Enter" />
            </button>
            <button className={`small ${flagged ? 'selected' : 'ghost'}`} onClick={() => setFlagged((f) => !f)}>
              <Icon name="flag" size={14} /> {flagged ? 'Flagged' : 'Flag'}
            </button>
            <span className="muted" style={{ fontSize: 12 }}>
              <KeyHint k="A–E" /> select · <KeyHint k="⇧+A–E" /> strike · <KeyHint k="H" /> highlight · <KeyHint k="F" /> flag
            </span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fade-in">
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="row">
          {header}
          {(revealType || submitted) && <span className="chip gold">{typeLabel(q.type)}</span>}
          <span className="chip">Difficulty {'●'.repeat(q.difficulty)}{'○'.repeat(5 - q.difficulty)}</span>
          {q.section === 'LR' && (q as { custom?: boolean }).custom && <span className="chip">AI-generated</span>}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className={`chip ${elapsed > pace ? 'danger' : ''}`} title="Time on this question (pace target ~1:20 for LR)">
            <Icon name="timer" size={13} /> {fmtTime(submitted && attempt ? attempt.timeMs : elapsed)}
          </span>
        </div>
      </div>

      {!diagramDone && lr && <DiagramBuilder q={q} onDone={() => setDiagramDone(true)} />}
      {!diagramDone && !lr && <PassageMapBuilder passage={PASSAGE_BY_ID[q.passageId]} onDone={() => setDiagramDone(true)} />}

      {diagramDone &&
        (lr ? (
          questionColumn
        ) : (
          <div className="grid cols-2" style={{ alignItems: 'start' }}>
            <div className="card flat" style={{ maxHeight: '75vh', overflow: 'auto' }}>
              <PassagePanel passageId={q.passageId} highlights={passageHl} setHighlights={setPassageHl} register={(fn) => (applyPassageRef.current = fn)} />
            </div>
            <div>{questionColumn}</div>
          </div>
        ))}

      {showFeedback && (
        <div className="stack" style={{ marginTop: 18 }}>
          <div className={`card ${correct ? '' : ''}`} style={{ borderColor: correct ? 'var(--success)' : 'var(--danger)', borderWidth: 2 }}>
            <div className="row between">
              <h3 style={{ margin: 0, color: correct ? 'var(--success)' : 'var(--danger)' }}>
                {correct ? 'Sustained.' : 'Overruled.'} {correct ? `(${LETTERS[q.answer]}) is correct.` : `You chose (${choice !== null ? LETTERS[choice] : '—'}); the answer is (${LETTERS[q.answer]}).`}
              </h3>
              <div className="row">
                {confidence && <span className="chip">You rated: {confidence}</span>}
                {correct && confidence === 'Guess' && <span className="chip danger">Guess → sent to review</span>}
              </div>
            </div>
            {why.trim() && (
              <div style={{ marginTop: 10 }}>
                <MethodNote id="elaboration" />
                <div className="card sunk" style={{ padding: 10 }}>
                  <div className="label">your reasoning</div>
                  <div className="book" style={{ fontSize: 16 }}>
                    “{why}”
                  </div>
                  {grading && <div className="muted">Grading your reasoning…</div>}
                  {grade && (
                    <div style={{ marginTop: 6 }}>
                      <span className={`chip ${grade.verdict === 'sound' ? 'success' : grade.verdict === 'partial' ? 'gold' : 'danger'}`}>
                        Reasoning: {grade.verdict} ({grade.score}/3) · {grade.source === 'ai' ? 'graded by the Faculty' : 'keyword check'}
                      </span>
                      {grade.source === 'ai' && correct && grade.verdict === 'flawed' && <span className="chip danger" style={{ marginLeft: 6 }}>Lucky win — returned to review</span>}
                      <p style={{ margin: '6px 0 0' }}>{grade.feedback}</p>
                    </div>
                  )}
                  {grade && grade.source !== 'ai' && !selfRated && (
                    <div className="row" style={{ marginTop: 8 }}>
                      <span className="muted" style={{ fontSize: 13 }}>
                        Read the Holding below, then judge your reasoning honestly:
                      </span>
                      <button className="small" onClick={() => { setSelfRated(true); if (attempt) setWhyGrade(attempt.id, { ...grade, verdict: 'sound', score: 3, source: 'self' }); }}>
                        Sound
                      </button>
                      <button className="small" onClick={() => { setSelfRated(true); if (attempt) setWhyGrade(attempt.id, { ...grade, verdict: 'partial', score: 2, source: 'self' }); }}>
                        Partly right
                      </button>
                      <button className="small danger" onClick={() => { setSelfRated(true); if (attempt) setWhyGrade(attempt.id, { ...grade, verdict: 'flawed', score: 1, source: 'self' }, correct); }}>
                        {correct ? 'I got lucky' : 'Flawed'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {!correct && ledgerEntry && (
              <div style={{ marginTop: 10 }}>
                <MethodNote id="errors" />
                <div className="row">
                  <span className="label">root cause</span>
                  {ROOT_CAUSES.map((r) => (
                    <button key={r.id} title={r.blurb} className={`small ${ledgerEntry.rootCause === r.id ? 'selected' : ''}`} onClick={() => updateLedger(ledgerEntry.id, { rootCause: r.id })}>
                      {r.id}
                    </button>
                  ))}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Logged in the Clerk's Ledger and scheduled for spaced review.
                </div>
              </div>
            )}
          </div>
          <div className="card">
            <CaseBrief q={q} chosen={choice} />
          </div>
          {onNext && (
            <div className="row">
              <button className="primary" onClick={onNext} disabled={grading}>
                {nextLabel} <KeyHint k="Enter" />
              </button>
              <button className="ghost" onClick={() => setShowMap(true)}>
                <Icon name="map" size={15} /> Diagram <KeyHint k="M" />
              </button>
            </div>
          )}
        </div>
      )}

      {showMap && (
        <Modal onClose={() => setShowMap(false)} title="The Diagram">
          {lr ? <ArgumentDiagram q={q} overlay={overlayForType(q.type)} overlayText={q.choices[q.answer]} /> : <PassageMap paragraphs={PASSAGE_BY_ID[q.passageId]?.passages.flatMap((p) => p.paragraphs) ?? []} />}
        </Modal>
      )}
    </div>
  );
}
