import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import type { Confidence, ExamRecord } from '../lib/types';
import { getQuestion, isLR, stimulusText, PASSAGE_BY_ID } from '../lib/content';
import { SECTION_MS, INTERMISSION_MS } from '../lib/exam';
import { examRaw } from '../lib/analytics';
import { LETTERS, fmtTime } from '../lib/util';
import { Highlightable, type Highlight } from '../components/Highlightable';
import { Modal, Empty } from '../components/common';
import { Icon, Monogram } from '../visuals/Icon';

const CONF: (Confidence | null)[] = [null, 'Certain', 'Likely', 'Guess'];

export default function ExamTake() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const stored = useStore((s) => s.exams.find((e) => e.id === id));
  const saveExam = useStore((s) => s.saveExam);
  const recordAttempt = useStore((s) => s.recordAttempt);
  const [ex, setEx] = useState<ExamRecord | null>(() => (stored ? structuredClone(stored) : null));
  const [qi, setQi] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [showTimer, setShowTimer] = useState(true);
  const [hlColor, setHlColor] = useState<1 | 2 | 3>(1);
  const [hl, setHl] = useState<Record<string, Highlight[]>>({});
  const [struck, setStruck] = useState<Record<string, number[]>>({});
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [warned, setWarned] = useState(false);
  const [showWarn, setShowWarn] = useState(false);
  const lastSwitch = useRef(Date.now());
  const applyStim = useRef<((c?: 1 | 2 | 3) => boolean) | null>(null);
  const applyPass = useRef<((c?: 1 | 2 | 3) => boolean) | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const persist = useCallback((e: ExamRecord) => {
    setEx(e);
    saveExam(e);
  }, [saveExam]);

  const sec = ex && ex.phase === 'section' ? ex.sections[ex.current ?? 0] : null;
  const remaining = ex && ex.phase === 'section' ? SECTION_MS - (now - (ex.sectionStart ?? now)) : 0;
  const interRemaining = ex && ex.phase === 'intermission' ? INTERMISSION_MS - (now - (ex.intermissionStart ?? now)) : 0;

  /** add time spent on the current question */
  const bank = useCallback(
    (e: ExamRecord, idx: number) => {
      const s = e.sections[e.current ?? 0];
      const t = Date.now();
      s.times[idx] += t - lastSwitch.current;
      lastSwitch.current = t;
    },
    [],
  );

  const go = (to: number) => {
    if (!ex || !sec) return;
    const e = structuredClone(ex);
    bank(e, qi);
    persist(e);
    setQi(Math.max(0, Math.min(sec.qids.length - 1, to)));
  };

  const finish = useCallback(
    (e: ExamRecord) => {
      // record every answered question as an attempt (no feedback is shown yet)
      e.sections.forEach((s, si) =>
        s.qids.forEach((qid, i) => {
          const q = getQuestion(qid);
          if (!q) return;
          recordAttempt({ qid, choice: s.answers[i], correct: s.answers[i] === q.answer, confidence: s.confidence[i] ?? undefined, timeMs: s.times[i], context: 'exam', mode: 'interleaved', type: q.type, difficulty: q.difficulty, examId: e.id, sectionPos: si, posInSection: i });
        }),
      );
      const r = examRaw(e);
      const done = { ...e, phase: 'blind' as const, raw: r.raw, rawMax: r.max, scaled: r.scaled };
      persist(done);
      nav(`/blind/${e.id}`);
    },
    [persist, recordAttempt, nav],
  );

  const endSection = useCallback(() => {
    if (!ex) return;
    const e = structuredClone(ex);
    const cur = e.current ?? 0;
    bank(e, qi);
    e.sections[cur].elapsedMs = Math.min(SECTION_MS, Date.now() - (e.sectionStart ?? Date.now()));
    setConfirmEnd(false);
    setWarned(false);
    setShowWarn(false);
    setQi(0);
    if (cur >= e.sections.length - 1) return finish(e);
    if (cur === 1) {
      e.phase = 'intermission';
      e.intermissionStart = Date.now();
      e.current = cur + 1;
    } else {
      e.current = cur + 1;
      e.sectionStart = Date.now();
    }
    lastSwitch.current = Date.now();
    persist(e);
  }, [ex, qi, bank, finish, persist]);

  // auto-advance when time expires
  useEffect(() => {
    if (ex?.phase === 'section' && remaining <= 0) endSection();
    if (ex?.phase === 'section' && remaining <= 5 * 60_000 && remaining > 0 && !warned) {
      setWarned(true);
      setShowWarn(true);
      setTimeout(() => setShowWarn(false), 8000);
    }
    if (ex?.phase === 'intermission' && interRemaining <= 0) {
      const e = structuredClone(ex);
      e.phase = 'section';
      e.sectionStart = Date.now();
      lastSwitch.current = Date.now();
      persist(e);
    }
  }, [remaining, interRemaining, ex, endSection, warned, persist]);

  const setAnswer = (i: number) => {
    if (!ex || !sec) return;
    const q = sec.qids[qi];
    if ((struck[q] ?? []).includes(i)) return;
    const e = structuredClone(ex);
    e.sections[e.current ?? 0].answers[qi] = i;
    persist(e);
  };
  const toggleStrike = (i: number) => {
    if (!sec) return;
    const q = sec.qids[qi];
    setStruck((s) => {
      const cur = s[q] ?? [];
      return { ...s, [q]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] };
    });
    if (sec.answers[qi] === i && ex) {
      const e = structuredClone(ex);
      e.sections[e.current ?? 0].answers[qi] = null;
      persist(e);
    }
  };
  const toggleFlag = () => {
    if (!ex) return;
    const e = structuredClone(ex);
    const s = e.sections[e.current ?? 0];
    s.flags[qi] = !s.flags[qi];
    persist(e);
  };
  const cycleConf = () => {
    if (!ex) return;
    const e = structuredClone(ex);
    const s = e.sections[e.current ?? 0];
    s.confidence[qi] = CONF[(CONF.indexOf(s.confidence[qi]) + 1) % CONF.length];
    persist(e);
  };

  useEffect(() => {
    const h = (ev: KeyboardEvent) => {
      if (!sec || confirmEnd) return;
      const t = ev.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const k = ev.key.toLowerCase();
      if ('abcde'.includes(k) && k.length === 1) {
        ev.preventDefault();
        if (ev.shiftKey) toggleStrike('abcde'.indexOf(k));
        else setAnswer('abcde'.indexOf(k));
      } else if (k === 'f') toggleFlag();
      else if (k === 'c') cycleConf();
      else if (k === 'h') {
        if (!applyStim.current?.(hlColor)) applyPass.current?.(hlColor);
      } else if (k === 'arrowright') go(qi + 1);
      else if (k === 'arrowleft') go(qi - 1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const qid = sec?.qids[qi];
  const q = qid ? getQuestion(qid) : undefined;
  const stim = useMemo(() => (q && isLR(q) ? stimulusText(q) : ''), [q]);

  if (!ex) return <Empty>Examination not found.</Empty>;
  if (ex.phase === 'blind' || ex.completed) return <Navigate to={ex.completed ? `/opinion/${ex.id}` : `/blind/${ex.id}`} replace />;

  if (ex.phase === 'intermission') {
    return (
      <div className="exam-center">
        <Monogram size={90} />
        <h1>Intermission</h1>
        <p className="book" style={{ fontSize: 18 }}>
          Ten minutes. Stand, stretch, drink water. Do not think about the sections behind you.
        </p>
        <div className="exam-clock">{fmtTime(interRemaining)}</div>
        <button
          className="primary"
          onClick={() => {
            const e = structuredClone(ex);
            e.phase = 'section';
            e.sectionStart = Date.now();
            lastSwitch.current = Date.now();
            persist(e);
          }}
        >
          Resume the examination now →
        </button>
      </div>
    );
  }
  if (!sec || !q) return <Empty>Loading section…</Empty>;
  const passage = !isLR(q) ? PASSAGE_BY_ID[q.passageId] : undefined;
  const passageText = passage ? passage.passages.map((x) => (passage.comparative ? `${x.label}\n\n` : '') + x.paragraphs.map((p) => p.text).join('\n\n')).join('\n\n\n') : '';
  const answeredCount = sec.answers.filter((a) => a !== null).length;

  const choices = (
    <div>
      <div className="stem" style={{ marginTop: 0 }}>
        {q.stem}
      </div>
      <div className="choices">
        {q.choices.map((c, i) => {
          const isStruck = (struck[q.id] ?? []).includes(i);
          return (
            <div key={i} className={`choice ${sec.answers[qi] === i ? 'selected' : ''} ${isStruck ? 'struck' : ''}`} onClick={() => setAnswer(i)} role="radio" aria-checked={sec.answers[qi] === i} tabIndex={0}>
              <span className="letter">{LETTERS[i]}</span>
              <span className="ctext">{c}</span>
              <button
                className="ghost small strike-btn"
                title="Strike out (Shift + letter)"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStrike(i);
                }}
              >
                ⊘
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="exam">
      <header className="exam-top">
        <div className="row">
          <Monogram size={30} />
          <b style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{ex.title}</b>
          <span className="chip">
            Section {(ex.current ?? 0) + 1} of {ex.sections.length}
          </span>
        </div>
        <div className="row">
          <span className="muted" style={{ fontSize: 12 }}>
            Highlighter
          </span>
          {([1, 2, 3] as const).map((c) => (
            <button key={c} className={`small ${hlColor === c ? 'selected' : ''}`} onClick={() => setHlColor(c)} title={`Highlight color ${c} (select text, press H)`}>
              <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: `var(--hl-${c})`, border: '1px solid var(--rule-strong)' }} />
            </button>
          ))}
          <button className="small" onClick={() => (applyStim.current?.(hlColor) ? null : applyPass.current?.(hlColor))}>
            <Icon name="highlight" size={14} /> H
          </button>
          <button className={`small ${sec.flags[qi] ? 'selected' : ''}`} onClick={toggleFlag}>
            <Icon name="flag" size={14} /> {sec.flags[qi] ? 'Flagged' : 'Flag'}
          </button>
          <button className="small" onClick={cycleConf} title="Optional: mark your confidence for blind review (C)">
            {sec.confidence[qi] ?? 'Confidence'}
          </button>
        </div>
        <div className="row">
          {showTimer ? <span className={`exam-timer ${remaining < 5 * 60_000 ? 'warn' : ''}`}>{fmtTime(remaining)}</span> : <span className="muted">timer hidden</span>}
          <button className="small ghost" onClick={() => setShowTimer((s) => !s)}>
            {showTimer ? 'Hide' : 'Show'}
          </button>
        </div>
      </header>
      {showWarn && <div className="exam-warning fade-in">Five minutes remain in this section.</div>}

      <div className={`exam-body ${passage ? 'split' : ''}`}>
        {passage ? (
          <>
            <div className="exam-pane">
              <Highlightable text={passageText} highlights={hl['p:' + passage.id] ?? []} onChange={(h) => setHl((m) => ({ ...m, ['p:' + passage.id]: h }))} className="stimulus" color={hlColor} registerApply={(fn) => (applyPass.current = fn)} />
            </div>
            <div className="exam-pane">
              <div className="label">question {qi + 1}</div>
              {choices}
            </div>
          </>
        ) : (
          <div className="exam-pane single">
            <div className="label">question {qi + 1}</div>
            <Highlightable text={stim} highlights={hl[q.id] ?? []} onChange={(h) => setHl((m) => ({ ...m, [q.id]: h }))} className="stimulus" color={hlColor} registerApply={(fn) => (applyStim.current = fn)} />
            <div style={{ height: 12 }} />
            {choices}
          </div>
        )}
      </div>

      <footer className="exam-bottom">
        <button onClick={() => go(qi - 1)} disabled={qi === 0}>
          ← Back
        </button>
        <div className="exam-nav" role="navigation" aria-label="Question navigator">
          {sec.qids.map((_, i) => (
            <button key={i} className={`exam-nav-btn ${i === qi ? 'current' : ''} ${sec.answers[i] !== null ? 'answered' : ''}`} onClick={() => go(i)} title={`Question ${i + 1}${sec.flags[i] ? ' (flagged)' : ''}`}>
              {i + 1}
              {sec.flags[i] && <span className="flag-dot" />}
            </button>
          ))}
        </div>
        <button onClick={() => go(qi + 1)} disabled={qi === sec.qids.length - 1}>
          Next →
        </button>
        <button className="primary" onClick={() => setConfirmEnd(true)}>
          End section
        </button>
      </footer>

      {confirmEnd && (
        <Modal onClose={() => setConfirmEnd(false)} title="End this section?">
          <p className="book">
            You have answered {answeredCount} of {sec.qids.length} questions{sec.flags.some(Boolean) ? ` and flagged ${sec.flags.filter(Boolean).length}` : ''}. Once you leave, this section is locked. {remaining > 0 ? `${fmtTime(remaining)} remain.` : ''}
          </p>
          <div className="row">
            <button className="primary" onClick={endSection}>
              End section {(ex.current ?? 0) + 1}
            </button>
            <button onClick={() => setConfirmEnd(false)}>Return to the section</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
