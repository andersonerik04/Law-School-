import { useMemo, useState } from 'react';
import { useStore, type ChatThread } from '../lib/store';
import { hasKey, ask, askJSON } from '../lib/ai';
import { clerkSystem } from '../lib/tutor';
import { questionForPrompt } from '../lib/grading';
import { CONCEPTS, CONCEPT_BY_ID, LR_QUESTIONS, LR_TYPES, TRAP_LABEL, typeLabel } from '../lib/content';
import type { LRQuestion, TrapId } from '../lib/types';
import { uid, LETTERS, shuffle } from '../lib/util';
import { CasebookHeader, MethodNote, toast } from '../components/common';
import { Chat, NeedsKey, RichText } from '../components/Chat';
import { HONOR_BY_ID } from '../lib/honors';
import { Icon } from '../visuals/Icon';

const TRAP_IDS = Object.keys(TRAP_LABEL) as TrapId[];

function TeachTheClerk() {
  const allThreads = useStore((s) => s.threads);
  const threads = useMemo(() => allThreads.filter((t) => t.kind === 'feynman'), [allThreads]);
  const saveThread = useStore((s) => s.saveThread);
  const award = useStore((s) => s.award);
  const lessonConcepts = CONCEPTS.filter((c) => c.lesson && c.keyPoints?.length);
  const [conceptId, setConceptId] = useState(lessonConcepts[0]?.id ?? '');
  const [thread, setThread] = useState<ChatThread | null>(null);
  const c = CONCEPT_BY_ID[thread?.conceptId ?? conceptId];
  const begin = () => {
    const t: ChatThread = { id: uid('t_'), kind: 'feynman', title: `Teaching: ${CONCEPT_BY_ID[conceptId].label}`, ts: Date.now(), messages: [], conceptId };
    saveThread(t);
    setThread(t);
  };
  return (
    <div className="stack">
      <MethodNote id="feynman" />
      {!hasKey() ? (
        <NeedsKey what="Teach the Clerk" />
      ) : !thread ? (
        <div className="card stack">
          <p className="book">Choose a doctrine and explain it to the Clerk, an eager first-year who will ask follow-up questions until your explanation is airtight. When you are done, request the gap analysis.</p>
          <div className="row">
            <select value={conceptId} onChange={(e) => setConceptId(e.target.value)} style={{ maxWidth: 360 }}>
              {lessonConcepts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
            <button className="primary" onClick={begin}>
              Begin teaching
            </button>
          </div>
          {threads.length > 0 && (
            <div className="row">
              <span className="label">resume</span>
              {threads.slice(0, 6).map((t) => (
                <button key={t.id} className="small" onClick={() => setThread(t)}>
                  {t.title}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="stack">
          <div className="row between">
            <h3 style={{ margin: 0 }}>{thread.title}</h3>
            <button className="ghost small" onClick={() => setThread(null)}>
              ← Choose another doctrine
            </button>
          </div>
          <Chat
            key={thread.id}
            who="The Clerk"
            system={clerkSystem(c)}
            messages={thread.messages}
            placeholder={`Explain ${c.label} as if to a first-year…`}
            setMessages={(m) => {
              const t = { ...thread, messages: m };
              setThread(t);
              saveThread(t);
            }}
            onTurn={(m) => {
              const last = m[m.length - 1]?.content ?? '';
              if (/GAP ANALYSIS/i.test(last) && /AIRTIGHT/.test(last) && award('teaching-fellow')) toast(HONOR_BY_ID['teaching-fellow'].title, HONOR_BY_ID['teaching-fellow'].body);
            }}
          />
          <div className="muted" style={{ fontSize: 13 }}>
            When finished, send: <i>“I’m done. Please give me the gap analysis.”</i>
          </div>
        </div>
      )}
    </div>
  );
}

const DRAFT_RUBRIC = [
  'The stimulus is self-contained and uses neutral, precise language.',
  'The stem matches a real LSAT type and its task is unambiguous.',
  'Exactly one answer is defensibly best; I can prove it from the stimulus.',
  'Each wrong answer fails for a nameable reason (trap label).',
  'At least two wrong answers are genuinely tempting.',
  'No answer is correct for an outside-knowledge reason.',
];

function DraftAQuestion() {
  const saveDraft = useStore((s) => s.saveDraft);
  const drafts = useStore((s) => s.drafts);
  const [type, setType] = useState(LR_TYPES[0]);
  const [stimulus, setStimulus] = useState('');
  const [stem, setStem] = useState('');
  const [choices, setChoices] = useState(['', '', '', '', '']);
  const [answer, setAnswer] = useState(0);
  const [traps, setTraps] = useState<string[]>(['out-of-scope', 'too-strong', 'reversal', 'shell-game', 'opposite']);
  const [critique, setCritique] = useState('');
  const [busy, setBusy] = useState(false);
  const [rubric, setRubric] = useState<boolean[]>(DRAFT_RUBRIC.map(() => false));
  const ready = stimulus.trim().length > 40 && stem.trim() && choices.every((c) => c.trim());

  const submit = async () => {
    const id = uid('d_');
    const draft = { id, ts: Date.now(), stimulus, stem: `[${typeLabel(type)}] ${stem}`, choices, answer, trapLabels: traps };
    saveDraft(draft);
    if (!hasKey()) {
      toast('Draft filed', 'Saved to your Seminar drafts. Add an API key for the editor’s critique.');
      return;
    }
    setBusy(true);
    setCritique('');
    try {
      const text = await ask({
        system:
          'You are the senior articles editor of a law review who also writes LSAT questions professionally. Critique the student-drafted LSAT question rigorously but constructively. Structure: VALIDITY (is the keyed answer clearly best? is any other answer defensible?), AUTHENTICITY (does it read like a real LSAT question of this type?), TRAP QUALITY (does each wrong answer fail for its labeled reason; which are too easy?), PRECISION (wording problems), VERDICT (Publishable / Revise and resubmit / Reject) with a score out of 10, and ONE concrete revision. Praise process and craft where earned.',
        messages: [{ role: 'user', content: `Question type: ${typeLabel(type)}\nSTIMULUS: ${stimulus}\nSTEM: ${stem}\n${choices.map((c, i) => `(${LETTERS[i]}) ${c}${i === answer ? '   ← keyed correct' : `   [trap: ${TRAP_LABEL[traps[i] as TrapId] ?? traps[i]}]`}`).join('\n')}` }],
        maxTokens: 3000,
        effort: 'medium',
        onText: setCritique,
      });
      setCritique(text);
      saveDraft({ ...draft, critique: text });
    } catch (e) {
      setCritique('Critique unavailable: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <MethodNote id="bloom">Writing a question with four distinct traps is the “Create” rung of the ladder.</MethodNote>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', alignItems: 'start' }}>
        <div className="card stack">
          <label className="field">
            Question type
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              {LR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Stimulus
            <textarea rows={5} value={stimulus} onChange={(e) => setStimulus(e.target.value)} placeholder="An argument or fact set on international law, finance, jurisprudence…" />
          </label>
          <label className="field">
            Stem
            <input value={stem} onChange={(e) => setStem(e.target.value)} placeholder="Which one of the following, if true, most seriously weakens the argument?" />
          </label>
          {choices.map((c, i) => (
            <div key={i} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <label className="row" style={{ minWidth: 60 }}>
                <input type="radio" checked={answer === i} onChange={() => setAnswer(i)} /> <b>({LETTERS[i]})</b>
              </label>
              <textarea rows={2} value={c} onChange={(e) => setChoices(choices.map((x, j) => (j === i ? e.target.value : x)))} />
              {answer !== i ? (
                <select value={traps[i]} onChange={(e) => setTraps(traps.map((x, j) => (j === i ? e.target.value : x)))} style={{ width: 180 }}>
                  {TRAP_IDS.map((t) => (
                    <option key={t} value={t}>
                      {TRAP_LABEL[t]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="chip success" style={{ width: 180, justifyContent: 'center' }}>
                  Correct
                </span>
              )}
            </div>
          ))}
          <button className="primary" disabled={!ready || busy} onClick={submit}>
            {busy ? 'The editor is reading…' : hasKey() ? 'Submit to the Law Review editor' : 'File the draft'}
          </button>
        </div>
        <div className="stack">
          <div className="card">
            <div className="label">self-review rubric</div>
            {DRAFT_RUBRIC.map((r, i) => (
              <label key={i} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', margin: '4px 0', fontSize: 14 }}>
                <input type="checkbox" checked={rubric[i]} onChange={(e) => setRubric(rubric.map((x, j) => (j === i ? e.target.checked : x)))} /> {r}
              </label>
            ))}
          </div>
          {critique && (
            <div className="card gilt" style={{ whiteSpace: 'pre-wrap' }}>
              <div className="label">editor’s critique</div>
              <div className="book" style={{ fontSize: 15 }}>
                <RichText text={critique} />
              </div>
            </div>
          )}
          {drafts.length > 0 && (
            <div className="card">
              <div className="label">your drafts ({drafts.length})</div>
              {drafts.slice(0, 5).map((d) => (
                <div key={d.id} style={{ fontSize: 13, borderBottom: '1px solid var(--rule)', padding: '4px 0' }}>
                  {new Date(d.ts).toLocaleDateString()} — {d.stem.slice(0, 70)} {d.critique ? '· critiqued' : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RankTheWrongAnswers() {
  const pool = useMemo(() => LR_QUESTIONS.filter((q) => q.difficulty >= 4), []);
  const [q, setQ] = useState<LRQuestion>(() => shuffle(pool)[0]);
  const wrongIdx = q.choices.map((_, i) => i).filter((i) => i !== q.answer);
  const [order, setOrder] = useState<number[]>(wrongIdx);
  const [why, setWhy] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const n = order.slice();
    [n[i], n[j]] = [n[j], n[i]];
    setOrder(n);
  };
  const next = () => {
    const nq = shuffle(pool.filter((x) => x.id !== q.id))[0];
    setQ(nq);
    setOrder(nq.choices.map((_, i) => i).filter((i) => i !== nq.answer));
    setWhy('');
    setRevealed(false);
    setFeedback('');
  };
  const evaluate = async () => {
    setRevealed(true);
    if (!hasKey()) return;
    setBusy(true);
    try {
      const r = await askJSON<{ assessment: string; score: number }>({
        system: 'You are an LSAT professor evaluating a student’s ranking of wrong answers from most to least tempting, and their explanation of which is "more wrong" and why. Judge the quality of reasoning, not agreement with a single "true" order. Return JSON {assessment: 3–5 sentences, score: 0–10}.',
        messages: [{ role: 'user', content: `${questionForPrompt(q)}\n\nSTUDENT RANKING (most tempting first): ${order.map((i) => `(${LETTERS[i]})`).join(' > ')}\nSTUDENT EXPLANATION: ${why}` }],
        maxTokens: 1500,
        effort: 'low',
        schema: { type: 'object', additionalProperties: false, required: ['assessment', 'score'], properties: { assessment: { type: 'string' }, score: { type: 'integer' } } },
      });
      setFeedback(`${r.assessment} (Score: ${r.score}/10)`);
    } catch (e) {
      setFeedback('Evaluation unavailable: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <MethodNote id="bloom">“Evaluate”: judge which wrong answer is more wrong, and why.</MethodNote>
      <div className="card">
        <div className="row between">
          <span className="chip gold">{typeLabel(q.type)}</span>
          <span className="chip">The correct answer is ({LETTERS[q.answer]}) — your task is the other four.</span>
        </div>
        <div className="stimulus" style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
          {q.stimulus.map((s) => (s.s ? `${s.s}: ${s.t}` : s.t)).join(' ')}
        </div>
        <div className="stem">{q.stem}</div>
        <div className="choice correct" style={{ cursor: 'default' }}>
          <span className="letter">{LETTERS[q.answer]}</span>
          <span className="ctext">{q.choices[q.answer]}</span>
          <span />
        </div>
      </div>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card stack tight">
          <div className="label">rank the wrong answers — most tempting first</div>
          {order.map((ci, i) => {
            const w = q.brief.analysis.wrong.find((x) => x.choice === ci)!;
            return (
              <div key={ci} className="choice" style={{ gridTemplateColumns: '34px 1fr auto', cursor: 'default' }}>
                <span className="letter">{LETTERS[ci]}</span>
                <span className="ctext">
                  <b style={{ color: 'var(--gold)' }}>{i + 1}.</b> {q.choices[ci]}
                  {revealed && (
                    <span className="chip danger" style={{ marginLeft: 6 }}>
                      {TRAP_LABEL[w.label]}
                    </span>
                  )}
                </span>
                <span className="stack tight">
                  <button className="small ghost" onClick={() => move(i, -1)} aria-label="Move up">
                    ▲
                  </button>
                  <button className="small ghost" onClick={() => move(i, 1)} aria-label="Move down">
                    ▼
                  </button>
                </span>
              </div>
            );
          })}
        </div>
        <div className="card stack">
          <label className="field">
            Which of your top two is “more wrong,” and why?
            <textarea rows={5} value={why} onChange={(e) => setWhy(e.target.value)} />
          </label>
          <div className="row">
            <button className="primary" disabled={why.trim().split(/\s+/).length < 8 || busy} onClick={evaluate}>
              {busy ? 'Evaluating…' : 'Reveal & evaluate'}
            </button>
            <button onClick={next}>Another question</button>
          </div>
          {revealed && (
            <div className="stack tight fade-in">
              {q.brief.analysis.wrong.map((w) => (
                <div key={w.choice} style={{ fontSize: 14 }}>
                  <b>({LETTERS[w.choice]})</b> <span className="chip danger">{TRAP_LABEL[w.label]}</span> {w.why}
                </div>
              ))}
              {feedback && (
                <div className="card sunk" style={{ fontSize: 15 }}>
                  <b>Professor:</b> {feedback}
                </div>
              )}
              {!hasKey() && <div className="muted" style={{ fontSize: 13 }}>Compare your ranking with the trap labels. Too Strong and Shell Game answers are usually the most tempting; Out of Scope the least.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Seminar() {
  const [tab, setTab] = useState<'clerk' | 'draft' | 'rank'>('clerk');
  return (
    <div>
      <CasebookHeader chapter="THE SEMINAR" title="Higher-Order Learning" subtitle="Teach it, write it, judge it: the top of the cognitive ladder." />
      <div className="tabs">
        <button className={tab === 'clerk' ? 'active' : ''} onClick={() => setTab('clerk')}>
          <Icon name="seminar" size={15} /> Teach the Clerk
        </button>
        <button className={tab === 'draft' ? 'active' : ''} onClick={() => setTab('draft')}>
          <Icon name="quill" size={15} /> Draft a Question
        </button>
        <button className={tab === 'rank' ? 'active' : ''} onClick={() => setTab('rank')}>
          <Icon name="evaluate" size={15} /> Rank the Wrong Answers
        </button>
      </div>
      <div className="page-turn" key={tab}>
        {tab === 'clerk' && <TeachTheClerk />}
        {tab === 'draft' && <DraftAQuestion />}
        {tab === 'rank' && <RankTheWrongAnswers />}
      </div>
    </div>
  );
}
