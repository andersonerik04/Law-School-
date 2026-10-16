import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import type { Attempt, LRQuestion, LRType } from '../lib/types';
import { LR_QUESTIONS, typeLabel, TRAP_LABEL, allLR } from '../lib/content';
import { hasKey, ask } from '../lib/ai';
import { questionForPrompt } from '../lib/grading';
import { shuffle, fmtTime, LETTERS, mentions } from '../lib/util';
import { CasebookHeader, MethodNote, Progress, Section } from '../components/common';
import { QuestionPlayer } from '../components/QuestionPlayer';
import { RichText } from '../components/Chat';
import { pickAdaptive } from '../lib/adaptive';

const SPRINT_N = 10;
const SPRINT_MS = SPRINT_N * 80_000;

function Sprint() {
  const theta = useStore((s) => s.theta);
  const addMoot = useStore((s) => s.addMoot);
  const moot = useStore((s) => s.moot);
  const [qs, setQs] = useState<LRQuestion[] | null>(null);
  const [i, setI] = useState(0);
  const [res, setRes] = useState<Attempt[]>([]);
  const [start, setStart] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!qs) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [qs]);
  const pr = useMemo(() => moot.filter((m) => m.kind === 'sprint').sort((a, b) => b.correct - a.correct || a.ms - b.ms)[0], [moot]);
  const finished = qs && (i >= qs.length || now - start > SPRINT_MS);
  useEffect(() => {
    if (finished && res.length) addMoot({ ts: Date.now(), kind: 'sprint', correct: res.filter((r) => r.correct).length, total: SPRINT_N, ms: Math.min(SPRINT_MS, now - start) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (!qs)
    return (
      <div className="card gilt stack">
        <h3>Ten questions. {fmtTime(SPRINT_MS)} on the clock.</h3>
        <p className="book" style={{ margin: 0 }}>A mixed, adaptive set at test pace (1:20 each). No feedback until the bench rises. Personal record: {pr ? `${pr.correct}/10 in ${fmtTime(pr.ms)}` : 'none yet'}.</p>
        <button
          className="primary"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            setQs(pickAdaptive(allLR(), theta, SPRINT_N, new Set()) as LRQuestion[]);
            setI(0);
            setRes([]);
            setStart(Date.now());
          }}
        >
          Call the case →
        </button>
      </div>
    );
  if (finished) {
    const c = res.filter((r) => r.correct).length;
    const isPR = !pr || c > pr.correct || (c === pr.correct && now - start < pr.ms);
    return (
      <div className="card gilt stack">
        <h2 style={{ margin: 0 }}>
          {c}/{SPRINT_N} · {fmtTime(Math.min(SPRINT_MS, now - start))} {isPR && <span className="chip gold">New personal record</span>}
        </h2>
        <div className="stack tight">
          {qs.map((q, k) => {
            const a = res.find((r) => r.qid === q.id);
            return (
              <div key={q.id} className="row" style={{ fontSize: 14 }}>
                <span style={{ width: 20 }}>{a ? (a.correct ? '✓' : '✗') : '—'}</span>
                <span style={{ width: 200 }}>{typeLabel(q.type)}</span>
                <span className="muted">{a ? fmtTime(a.timeMs) : 'not reached'}</span>
                <Link to={`/q/${q.id}`}>brief</Link>
                <span className="muted">#{k + 1}</span>
              </div>
            );
          })}
        </div>
        <button className="primary" style={{ alignSelf: 'flex-start' }} onClick={() => setQs(null)}>
          Another sprint
        </button>
      </div>
    );
  }
  return (
    <div>
      <div className="row between" style={{ marginBottom: 6 }}>
        <span className="chip">
          {i + 1} / {SPRINT_N}
        </span>
        <span className={`chip ${SPRINT_MS - (now - start) < 120_000 ? 'danger' : 'gold'}`}>{fmtTime(SPRINT_MS - (now - start))}</span>
      </div>
      <Progress value={now - start} max={SPRINT_MS} />
      <div style={{ height: 10 }} />
      <QuestionPlayer key={qs[i].id} q={qs[i]} context="sprint" mode="interleaved" feedback="none" requireConfidence={false} requireWhy={false} onAttempt={(a) => setRes((r) => [...r, a])} onNext={() => setI(i + 1)} />
    </div>
  );
}

function IdentifyType() {
  const addMoot = useStore((s) => s.addMoot);
  const moot = useStore((s) => s.moot);
  const N = 15;
  const [items, setItems] = useState<LRQuestion[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<LRType | 'timeout' | null>(null);
  const [score, setScore] = useState(0);
  const [t0, setT0] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const startRef = useRef(0);
  const best = moot.filter((m) => m.kind === 'identify').reduce((b, m) => Math.max(b, m.correct), 0);
  useEffect(() => {
    if (!items || picked) return;
    const t = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(t);
  }, [items, picked, i]);
  const left = 5000 - (now - t0);
  useEffect(() => {
    if (items && !picked && left <= 0) setPicked('timeout');
  }, [left, items, picked]);
  const groups: [string, LRType[]][] = [
    ['Prove', ['must-be-true', 'most-strongly-supported', 'cannot-be-true']],
    ['Describe', ['main-conclusion', 'role', 'method', 'flaw']],
    ['Gap', ['necessary-assumption', 'sufficient-assumption', 'strengthen', 'weaken', 'evaluate']],
    ['Match', ['parallel', 'parallel-flaw', 'principle-identify', 'principle-apply']],
    ['Tension', ['paradox', 'point-at-issue', 'point-of-agreement']],
  ];
  if (!items)
    return (
      <div className="card gilt stack">
        <h3>Identify the Type — five seconds per stem</h3>
        <p className="book" style={{ margin: 0 }}>You see only the stem. Classify it before the bar empties. Best: {best}/{N}.</p>
        <MethodNote id="interleaving">Recognizing the type instantly is the skill interleaving trains.</MethodNote>
        <button className="primary" style={{ alignSelf: 'flex-start' }} onClick={() => { setItems(shuffle(LR_QUESTIONS).slice(0, N)); setI(0); setScore(0); setPicked(null); setT0(Date.now()); startRef.current = Date.now(); }}>
          Begin
        </button>
      </div>
    );
  const it = items[i];
  if (!it) {
    return (
      <div className="card gilt stack">
        <h2 style={{ margin: 0 }}>
          {score}/{N} identified {score > best && <span className="chip gold">New record</span>}
        </h2>
        <button className="primary" style={{ alignSelf: 'flex-start' }} onClick={() => setItems(null)}>
          Again
        </button>
      </div>
    );
  }
  const next = () => {
    if (i + 1 >= N) addMoot({ ts: Date.now(), kind: 'identify', correct: score, total: N, ms: Date.now() - startRef.current });
    setI(i + 1);
    setPicked(null);
    setT0(Date.now());
    setNow(Date.now());
  };
  return (
    <div className="stack">
      <div className="row between">
        <span className="chip">
          {i + 1}/{N} · score {score}
        </span>
      </div>
      <div className="bar" style={{ height: 10 }}>
        <div style={{ width: `${Math.max(0, left) / 50}%`, background: left < 1500 ? 'var(--danger)' : undefined, transition: 'width 50ms linear' }} />
      </div>
      <div className="card gilt">
        <p className="stem" style={{ fontSize: 22, margin: 0 }}>
          {it.stem}
        </p>
      </div>
      <div className="grid cols-3">
        {groups.map(([g, ts]) => (
          <div key={g} className="card flat stack tight">
            <div className="label">{g}</div>
            {ts.map((t) => (
              <button
                key={t}
                className={picked ? (t === it.type ? 'selected' : picked === t ? 'danger' : '') : ''}
                onClick={() => {
                  if (picked) return;
                  setPicked(t);
                  if (t === it.type) setScore((s) => s + 1);
                }}
              >
                {typeLabel(t)}
              </button>
            ))}
          </div>
        ))}
      </div>
      {picked && (
        <div className="row fade-in">
          <span>{picked === it.type ? '✓ Correct.' : picked === 'timeout' ? `⏱ Time. It was ${typeLabel(it.type)}.` : `✗ It was ${typeLabel(it.type)}.`}</span>
          <button className="primary" onClick={next}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function CrossExamination() {
  const [q, setQ] = useState<LRQuestion>(() => shuffle(LR_QUESTIONS.filter((x) => x.difficulty >= 3))[0]);
  const [target] = useState(() => Math.floor(Math.random() * 5));
  const [choice, setChoice] = useState(target);
  const [role, setRole] = useState<'defend' | 'attack'>(() => (Math.random() < 0.5 ? 'defend' : 'attack'));
  const [arg, setArg] = useState('');
  const [verdict, setVerdict] = useState('');
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const fresh = () => {
    const nq = shuffle(LR_QUESTIONS.filter((x) => x.id !== q.id && x.difficulty >= 3))[0];
    setQ(nq);
    setChoice(Math.floor(Math.random() * 5));
    setRole(Math.random() < 0.5 ? 'defend' : 'attack');
    setArg('');
    setVerdict('');
    setRevealed(false);
  };
  const isCorrect = choice === q.answer;
  const trap = q.brief.analysis.wrong.find((w) => w.choice === choice);
  const submit = async () => {
    setRevealed(true);
    if (!hasKey()) return;
    setBusy(true);
    try {
      const text = await ask({
        system: 'You are presiding over a moot-court cross-examination of an LSAT answer choice. The student was assigned to DEFEND or ATTACK a specific choice (the assignment may be the "wrong side"—that is deliberate practice). Judge the written argument for precision, use of the stimulus, and logical rigor. If the student defends a wrong answer persuasively, note what made the trap tempting and why it still fails. 4–6 sentences, then "Ruling: Sustained / Overruled" on the quality of their argument, with a score out of 10.',
        messages: [{ role: 'user', content: `${questionForPrompt(q)}\n\nASSIGNMENT: ${role.toUpperCase()} answer (${LETTERS[choice]}).\nSTUDENT'S ARGUMENT: """${arg}"""` }],
        maxTokens: 2000,
        effort: 'low',
        onText: setVerdict,
      });
      setVerdict(text);
    } catch (e) {
      setVerdict('Ruling unavailable: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <MethodNote id="elaboration">Arguing either side of an answer choice forces you to articulate exactly why it wins or loses.</MethodNote>
      <div className="card">
        <span className="chip gold">{typeLabel(q.type)}</span>
        <div className="stimulus" style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
          {q.stimulus.map((s) => (s.s ? `${s.s}: ${s.t}` : s.t)).join(' ')}
        </div>
        <div className="stem">{q.stem}</div>
        <div className="choices">
          {q.choices.map((c, k) => (
            <div key={k} className={`choice ${k === choice ? 'selected' : ''} ${revealed && k === q.answer ? 'correct' : ''}`} style={{ cursor: 'default', opacity: k === choice || revealed ? 1 : 0.55 }}>
              <span className="letter">{LETTERS[k]}</span>
              <span className="ctext">{c}</span>
              <span />
            </div>
          ))}
        </div>
      </div>
      <div className="card gilt stack">
        <div className="row">
          <span className="label">your assignment</span>
          <button className={`small ${role === 'defend' ? 'selected' : ''}`} onClick={() => setRole('defend')}>
            Defend
          </button>
          <button className={`small ${role === 'attack' ? 'selected' : ''}`} onClick={() => setRole('attack')}>
            Attack
          </button>
          <span>
            answer <b>({LETTERS[choice]})</b>
          </span>
        </div>
        <textarea rows={5} value={arg} onChange={(e) => setArg(e.target.value)} placeholder={role === 'defend' ? `Make the strongest case that (${LETTERS[choice]}) is correct…` : `Show precisely why (${LETTERS[choice]}) fails…`} disabled={revealed} />
        <div className="row">
          <button className="primary" disabled={arg.trim().split(/\s+/).length < 15 || revealed} onClick={submit}>
            Rest my case
          </button>
          <button onClick={fresh}>New witness</button>
        </div>
        {revealed && (
          <div className="stack tight fade-in">
            <div>
              <b>The record:</b> ({LETTERS[choice]}) is {isCorrect ? <span style={{ color: 'var(--success)' }}>the correct answer</span> : <span style={{ color: 'var(--danger)' }}>wrong — {trap ? TRAP_LABEL[trap.label] : ''}</span>}. {isCorrect ? q.brief.analysis.correct : trap?.why}
            </div>
            {!hasKey() && (
              <div className="muted" style={{ fontSize: 13 }}>
                Self-check: your argument used {(q.reasoningKeys ?? []).filter((k) => mentions(arg, k)).length} of {(q.reasoningKeys ?? []).length} key ideas ({(q.reasoningKeys ?? []).join(', ')}). Holding: {q.brief.holding}
              </div>
            )}
            {(busy || verdict) && (
              <div className="card sunk">
                <b>The Bench:</b> {verdict ? <RichText text={verdict} /> : '…'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MootCourt() {
  const [tab, setTab] = useState<'sprint' | 'identify' | 'cross'>('sprint');
  const moot = useStore((s) => s.moot);
  return (
    <div>
      <CasebookHeader chapter="MOOT COURT" title="Speed & Fluency" subtitle="Sprints against the clock, five-second classifications, and cross-examination of answer choices." />
      <div className="tabs">
        <button className={tab === 'sprint' ? 'active' : ''} onClick={() => setTab('sprint')}>
          10-Question Sprint
        </button>
        <button className={tab === 'identify' ? 'active' : ''} onClick={() => setTab('identify')}>
          Identify the Type
        </button>
        <button className={tab === 'cross' ? 'active' : ''} onClick={() => setTab('cross')}>
          Cross-Examination
        </button>
      </div>
      <div className="page-turn" key={tab}>
        {tab === 'sprint' && <Sprint />}
        {tab === 'identify' && <IdentifyType />}
        {tab === 'cross' && <CrossExamination />}
      </div>
      {moot.length > 0 && (
        <Section numeral="I" title="The Record">
          <table className="ledger">
            <thead>
              <tr>
                <th>Date</th>
                <th>Event</th>
                <th>Result</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {moot
                .slice()
                .reverse()
                .slice(0, 12)
                .map((m, k) => (
                  <tr key={k}>
                    <td>{new Date(m.ts).toLocaleString()}</td>
                    <td>{m.kind === 'sprint' ? 'Sprint' : 'Identify the Type'}</td>
                    <td>
                      {m.correct}/{m.total}
                    </td>
                    <td>{fmtTime(m.ms)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}

