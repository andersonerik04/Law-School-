import { useEffect, useMemo, useState } from 'react';
import type { Concept, LRQuestion, SrsRating } from '../lib/types';
import { LR_QUESTIONS, LR_TYPES, typeLabel, stimulusText, TRAP_LABEL, CONCEPTS, CONCEPT_BY_ID, FLAW_LABEL, FLAWS, INDICATORS } from '../lib/content';
import { ArgumentDiagram, overlayForType } from '../visuals/ArgumentDiagram';
import { ArrowChain, QuantVenn } from '../visuals/LogicGraphics';
import { ConceptMindMap } from '../visuals/MindMap';
import { idTree } from '../visuals/mindLayout';
import { Icon } from '../visuals/Icon';
import { LETTERS, mentions, shuffle } from '../lib/util';
import { speak, stopSpeaking } from '../lib/tts';
import { useStore } from '../lib/store';
import { previewIntervals, fmtInterval } from '../lib/srs';
import { MethodNote, ReadAloud } from './common';
import { lit } from '../lib/logic';

// ── Step model for an LR question ─────────────────────────────

export interface Step {
  id: 'type' | 'conclusion' | 'gap' | 'predict' | 'answer';
  title: string;
  prompt: string;
  worked: string;
  diagramStep: number;
  options?: string[];
  correctIndex?: number;
}

function pickOthers<T>(all: T[], exclude: T, n: number, seed: number): T[] {
  return shuffle(all.filter((x) => x !== exclude), seed).slice(0, n);
}

export function stepsFor(q: LRQuestion): Step[] {
  const seed = q.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const steps: Step[] = [];
  const typeOpts = shuffle([q.type, ...pickOthers(LR_TYPES, q.type, 3, seed)], seed + 1);
  steps.push({
    id: 'type',
    title: 'Read the stem',
    prompt: 'First, read the stem. What type of question is this?',
    worked: `The stem says “${q.stem}” That is a ${typeLabel(q.type)} question, so we know how to read the stimulus before we read it.`,
    diagramStep: 1,
    options: typeOpts.map((t) => typeLabel(t)),
    correctIndex: typeOpts.indexOf(q.type),
  });
  const cIdx = q.stimulus.findIndex((s) => s.r === 'C');
  const speakers = new Set(q.stimulus.filter((s) => s.s).map((s) => s.s));
  if (cIdx >= 0 && speakers.size < 2) {
    steps.push({
      id: 'conclusion',
      title: 'Find the conclusion',
      prompt: 'Now find the conclusion. Which sentence is the claim the others support?',
      worked: `The conclusion is: “${q.stimulus[cIdx].t}” Apply the Why? test: every other sentence answers “why should I believe this?”—except context and counterpoints.`,
      diagramStep: 3,
      options: q.stimulus.map((s) => s.t),
      correctIndex: cIdx,
    });
  } else if (cIdx < 0) {
    steps.push({
      id: 'conclusion',
      title: 'Read the record',
      prompt: 'This stimulus has no conclusion. How should you treat it?',
      worked: 'There is no conclusion here: it is a set of facts. Accept every sentence as true and look for what they prove when combined.',
      diagramStep: 2,
      options: ['As facts to combine', 'As an argument to attack', 'As a dispute between speakers'],
      correctIndex: 0,
    });
  } else {
    steps.push({
      id: 'conclusion',
      title: 'Map both speakers',
      prompt: 'Two speakers. Where should you look for the point of contact?',
      worked: 'Summarize each speaker’s conclusion; disputes and agreements usually turn on their conclusions or concessions.',
      diagramStep: 2,
      options: ['Each speaker’s conclusion and concessions', 'The first sentence only', 'The longest sentence'],
      correctIndex: 0,
    });
  }
  if (q.diagram.gap) {
    const others = shuffle(
      LR_QUESTIONS.filter((x) => x.id !== q.id && x.diagram.gap).map((x) => x.diagram.gap!),
      seed + 2,
    ).slice(0, 2);
    const opts = shuffle([q.diagram.gap, ...others], seed + 3);
    steps.push({
      id: 'gap',
      title: 'Locate the gap',
      prompt: 'Where is the gap—the unstated link the argument (or task) turns on?',
      worked: `The gap: ${q.diagram.gap} That red marker is where the right answer will operate.`,
      diagramStep: 4,
      options: opts,
      correctIndex: opts.indexOf(q.diagram.gap),
    });
  }
  steps.push({
    id: 'predict',
    title: 'Predict',
    prompt: 'Before looking at the choices, predict in your own words what the correct answer will do.',
    worked: `Prediction, guided by the rule: ${q.brief.rule}`,
    diagramStep: 5,
  });
  steps.push({
    id: 'answer',
    title: 'Eliminate and choose',
    prompt: 'Now eliminate the traps and choose the answer.',
    worked: `${q.brief.analysis.correct} Eliminated: ${q.brief.analysis.wrong.map((w) => `(${LETTERS[w.choice]}) ${TRAP_LABEL[w.label]}`).join('; ')}.`,
    diagramStep: 5,
    options: q.choices.map((c, i) => `(${LETTERS[i]}) ${c}`),
    correctIndex: q.answer,
  });
  return steps;
}

/** I DO — the professor solves step by step while the diagram builds itself. */
export function WorkedExample({ q }: { q: LRQuestion }) {
  const steps = useMemo(() => stepsFor(q), [q]);
  const [i, setI] = useState(0);
  const [narrate, setNarrate] = useState(false);
  useEffect(() => {
    if (narrate) speak(steps[i].worked);
    return () => stopSpeaking();
  }, [i, narrate, steps]);
  const s = steps[i];
  return (
    <div className="stack">
      <MethodNote id="release">This is “I Do”: watch the method once, fully worked.</MethodNote>
      <div className="card flat">
        <div className="stimulus" style={{ whiteSpace: 'pre-wrap' }}>
          {stimulusText(q)}
        </div>
        <div className="stem">{q.stem}</div>
        <ol type="A" style={{ fontFamily: 'var(--font-book)', margin: 0 }}>
          {q.choices.map((c, k) => (
            <li key={k} style={{ opacity: s.id === 'answer' && k !== q.answer ? 0.45 : 1, fontWeight: s.id === 'answer' && k === q.answer ? 600 : 400 }}>
              {c}
            </li>
          ))}
        </ol>
      </div>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="row between">
            <div className="label">
              step {i + 1} of {steps.length} · {s.title}
            </div>
            <label className="row" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={narrate} onChange={(e) => setNarrate(e.target.checked)} /> Narrate
            </label>
          </div>
          <p className="book fade-in" key={i} style={{ fontSize: 17 }}>
            <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>Professor: </span>
            {s.worked}
          </p>
          <div className="row">
            <button disabled={i === 0} onClick={() => setI(i - 1)}>
              ← Back
            </button>
            <button className="primary" disabled={i === steps.length - 1} onClick={() => setI(i + 1)}>
              Next step →
            </button>
          </div>
        </div>
        <div className="card flat" style={{ background: 'var(--paper)' }}>
          <ArgumentDiagram q={q} step={s.diagramStep} overlay={overlayForType(q.type)} overlayText={q.choices[q.answer]} />
        </div>
      </div>
    </div>
  );
}

/**
 * WE DO — guided solving with scaffolding prompts. `userSteps` = how many of the final
 * steps the learner performs (faded worked examples: guidance removed one step at a time).
 */
export function GuidedSolver({ q, userSteps, onDone }: { q: LRQuestion; userSteps: number; onDone?: (correct: boolean) => void }) {
  const steps = useMemo(() => stepsFor(q), [q]);
  const firstUser = Math.max(0, steps.length - userSteps);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [hint, setHint] = useState(false);
  const [done, setDone] = useState(false);
  const s = steps[i];
  const isUser = i >= firstUser;
  const ok = picked !== null && picked === s.correctIndex;

  const advance = () => {
    if (i === steps.length - 1) {
      setDone(true);
      onDone?.(s.id === 'answer' ? ok : true);
      return;
    }
    setI(i + 1);
    setPicked(null);
    setText('');
    setHint(false);
  };

  return (
    <div className="stack">
      <div className="card flat">
        <div className="stimulus" style={{ whiteSpace: 'pre-wrap' }}>
          {stimulusText(q)}
        </div>
        <div className="stem">{q.stem}</div>
      </div>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="row between">
            <div className="label">
              step {i + 1} of {steps.length} · {s.title}
            </div>
            <span className={`chip ${isUser ? 'primary' : 'gold'}`}>{isUser ? 'Your move' : 'Worked for you'}</span>
          </div>
          {!isUser ? (
            <>
              <p className="book" style={{ fontSize: 16 }}>
                {s.worked}
              </p>
              <button className="primary" onClick={advance}>
                Continue →
              </button>
            </>
          ) : (
            <>
              <p className="book" style={{ fontSize: 16.5, fontWeight: 600 }}>
                {s.prompt}
              </p>
              {s.options ? (
                <div className="stack tight">
                  {s.options.map((o, k) => (
                    <button
                      key={k}
                      className={`choice ${picked === k ? (k === s.correctIndex ? 'correct' : 'wrong') : ''}`}
                      style={{ gridTemplateColumns: '1fr', display: 'block' }}
                      onClick={() => setPicked(k)}
                      disabled={picked !== null && ok}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              ) : (
                <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Your prediction…" rows={2} />
              )}
              {picked !== null && !ok && <div style={{ color: 'var(--danger)', fontSize: 14 }}>Not quite. Try again, or take a hint.</div>}
              {(ok || (!s.options && text.trim().length > 8)) && (
                <div className="card sunk fade-in" style={{ padding: 10, fontSize: 15 }}>
                  <b>Professor:</b> {s.worked}
                </div>
              )}
              <div className="row">
                {!hint && (
                  <button className="ghost small" onClick={() => setHint(true)}>
                    Hint
                  </button>
                )}
                {hint && <span className="muted" style={{ fontSize: 13 }}>Hint: {s.id === 'type' ? 'Look at the stem’s verb.' : s.id === 'conclusion' ? 'Which sentence would the author most want you to accept?' : s.id === 'gap' ? 'What must be true that the stimulus never says?' : s.id === 'answer' ? q.brief.rule : 'Use the rule for this type.'}</span>}
                <button className="primary" disabled={!(ok || (!s.options && text.trim().length > 8))} onClick={advance}>
                  {i === steps.length - 1 ? 'Finish' : 'Next step →'}
                </button>
              </div>
            </>
          )}
          {done && <div className="chip success" style={{ marginTop: 8 }}>Example complete.</div>}
        </div>
        <div className="card flat" style={{ background: 'var(--paper)' }}>
          <ArgumentDiagram q={q} step={Math.min(s.diagramStep, isUser && !ok ? Math.max(0, s.diagramStep - 1) : s.diagramStep)} overlay={overlayForType(q.type)} overlayText={q.choices[q.answer]} />
        </div>
      </div>
    </div>
  );
}

/** Concept walkthrough (for lessons without a matching LR question): animated mind map + narration. */
export function ConceptWalkthrough({ c }: { c: Concept }) {
  return (
    <div className="stack">
      <MethodNote id="release" />
      <div className="card book" style={{ fontSize: 17 }}>
        <div className="row between">
          <div className="label">the professor explains</div>
          <ReadAloud text={`${c.definition ?? c.oneLiner} The method: ${(c.attack ?? []).join('. ')}.`} />
        </div>
        <p>{c.definition}</p>
        <ol>
          {(c.attack ?? []).map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
      </div>
      {c.branch === 'CL' && <CLVisual c={c} />}
    </div>
  );
}

export function CLVisual({ c }: { c: Concept }) {
  if (c.id === 'cl-quantifiers')
    return (
      <div className="grid cols-2">
        <div className="card">
          <QuantVenn sets={['Bonds', 'Inv. grade', 'Euro']} statements={[{ q: 'most', a: 'Bonds', b: 'Inv. grade' }, { q: 'all', a: 'Inv. grade', b: 'Euro' }]} />
        </div>
        <div className="card">
          <QuantVenn sets={['Judges', 'Arbitrators']} statements={[{ q: 'some', a: 'Judges', b: 'Arbitrators' }]} />
        </div>
      </div>
    );
  const chain =
    c.id === 'cl-chaining'
      ? [lit('Signed 2010+'), lit('Arbitration clause'), lit('Bypass courts')]
      : c.id === 'cl-unless'
        ? [lit('Votes'), lit('Registered')]
        : [lit('Ratified'), lit('Binding')];
  return (
    <div className="card">
      <div className="label" style={{ textAlign: 'center' }}>
        {c.id === 'cl-unless' ? '“No shareholder may vote unless registered”' : 'watch the arrow flip and negate'}
      </div>
      <ArrowChain chain={chain} labels />
    </div>
  );
}

/** We Do for flaws: name the flaw in short arguments, with scaffolding. */
export function NameTheFlaw({ focus, n = 4 }: { focus?: string; n?: number }) {
  const items = useMemo(() => {
    const pool = FLAWS.flatMap((f) => (CONCEPT_BY_ID[`flaw-${f}`]?.examples ?? []).map((e) => ({ f, text: e.text })));
    const mine = focus ? pool.filter((p) => p.f === focus) : [];
    const rest = shuffle(pool.filter((p) => p.f !== focus)).slice(0, n - Math.min(2, mine.length));
    return shuffle([...mine.slice(0, 2), ...rest]);
  }, [focus, n]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const it = items[i];
  const options = useMemo(() => (it ? shuffle([it.f, ...shuffle(FLAWS.filter((f) => f !== it.f)).slice(0, 3)]) : []), [it]);
  if (!it) return <div className="chip success">Complete — {score}/{items.length}</div>;
  return (
    <div className="card">
      <div className="label">
        name that flaw · {i + 1}/{items.length}
      </div>
      <p className="book" style={{ fontSize: 17 }}>
        {it.text}
      </p>
      <div className="row">
        {options.map((o) => (
          <button
            key={o}
            className={picked ? (o === it.f ? 'selected' : picked === o ? 'danger' : '') : ''}
            onClick={() => {
              if (picked) return;
              setPicked(o);
              if (o === it.f) setScore((s) => s + 1);
            }}
          >
            <Icon name={o} size={15} /> {FLAW_LABEL[o as keyof typeof FLAW_LABEL]}
          </button>
        ))}
      </div>
      {picked && (
        <div className="stack tight fade-in" style={{ marginTop: 8 }}>
          <div>
            {picked === it.f ? '✓ Correct.' : '✗ Not quite.'} <b>{FLAW_LABEL[it.f]}</b>: {CONCEPT_BY_ID[`flaw-${it.f}`]?.oneLiner}
          </div>
          <button
            className="primary"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => {
              setPicked(null);
              setI(i + 1);
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

/** We Do for conditional logic: translate indicator sentences, guided. */
export function TranslateGuided({ ids }: { ids?: string[] }) {
  const items = useMemo(() => (ids ? INDICATORS.filter((x) => ids.includes(x.id)) : shuffle(INDICATORS).slice(0, 4)), [ids]);
  const [i, setI] = useState(0);
  const [txt, setTxt] = useState('');
  const [shown, setShown] = useState(false);
  const it = items[i];
  if (!it) return <div className="chip success">Translations complete.</div>;
  return (
    <div className="card">
      <div className="label">
        translate into arrows · {i + 1}/{items.length} · indicator “{it.phrase}”
      </div>
      <p className="book" style={{ fontSize: 18 }}>
        {it.example}
      </p>
      <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="e.g., Ratified → Binding" />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="ghost small" onClick={() => setShown(true)}>
          Show the rule
        </button>
        <button className="primary" onClick={() => setShown(true)} disabled={!txt.trim()}>
          Check
        </button>
      </div>
      {shown && (
        <div className="card sunk fade-in" style={{ marginTop: 8 }}>
          <div>
            <b>Rule:</b> {it.rule}
          </div>
          <div>
            <b>Translation:</b> <span className="mono">{it.translation}</span>
          </div>
          <button
            className="primary small"
            style={{ marginTop: 6 }}
            onClick={() => {
              setI(i + 1);
              setTxt('');
              setShown(false);
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

/** We Do for stem identification. */
export function StemIdGuided({ n = 6 }: { n?: number }) {
  const items = useMemo(() => shuffle(LR_QUESTIONS).slice(0, n), [n]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const it = items[i];
  const opts = useMemo(() => (it ? shuffle([it.type, ...shuffle(LR_TYPES.filter((t) => t !== it.type)).slice(0, 3)]) : []), [it]);
  if (!it) return <div className="chip success">Complete.</div>;
  const concept = CONCEPT_BY_ID[`lr-${it.type}`];
  return (
    <div className="card">
      <div className="label">
        classify the stem · {i + 1}/{items.length}
      </div>
      <p className="stem">{it.stem}</p>
      <div className="row">
        {opts.map((o) => (
          <button key={o} className={picked ? (o === it.type ? 'selected' : picked === o ? 'danger' : '') : ''} onClick={() => !picked && setPicked(o)}>
            {typeLabel(o)}
          </button>
        ))}
      </div>
      {picked && (
        <div className="fade-in" style={{ marginTop: 8 }}>
          {picked === it.type ? '✓' : '✗'} <b>{typeLabel(it.type)}</b>. Signal phrases: {(concept?.stemCues ?? []).map((s) => `“${s}”`).join(', ')}
          <div>
            <button className="primary small" style={{ marginTop: 6 }} onClick={() => { setPicked(null); setI(i + 1); }}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** BRAIN DUMP — free recall, then compare against the key points. */
export function BrainDump({ c, onDone }: { c: Concept; onDone: (hit: number, total: number, text: string) => void }) {
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  const kps = c.keyPoints ?? [];
  const hits = kps.map((k) => k.keywords.some((w) => mentions(text, w)));
  return (
    <div className="stack">
      <MethodNote id="retrieval">Write everything you remember—without scrolling up.</MethodNote>
      <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Everything you can recall about ${c.label}: definitions, the method, traps, examples…`} disabled={checked} />
      {!checked ? (
        <button className="primary" style={{ alignSelf: 'flex-start' }} disabled={text.trim().split(/\s+/).length < 8} onClick={() => setChecked(true)}>
          Compare with the key points
        </button>
      ) : (
        <div className="card fade-in">
          <div className="label">
            recall check — {hits.filter(Boolean).length} of {kps.length} key points
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0' }}>
            {kps.map((k, i) => (
              <li key={i} style={{ padding: '3px 0', color: hits[i] ? 'var(--ink)' : 'var(--danger)' }}>
                {hits[i] ? '✓' : '✗ MISSED —'} {k.point}
              </li>
            ))}
          </ul>
          <button className="primary" onClick={() => onDone(hits.filter(Boolean).length, kps.length, text)}>
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}

/** COLD CALL — retrieval on prior material before anything new. */
export function ColdCall({ c, onDone }: { c: Concept; onDone: () => void }) {
  const lessons = useStore((s) => s.lessons);
  const srs = useStore((s) => s.srs);
  const reviewCard = useStore((s) => s.reviewCard);
  const prior = useMemo(() => {
    const done = CONCEPTS.filter((x) => x.id !== c.id && lessons[x.id]?.completed && x.card);
    if (!done.length) return null;
    return done.sort((a, b) => (srs[`concept:${a.id}`]?.due ?? 0) - (srs[`concept:${b.id}`]?.due ?? 0))[0];
  }, [c.id, lessons, srs]);
  const [txt, setTxt] = useState('');
  const [revealed, setRevealed] = useState(false);
  const card = prior?.card;
  const cardState = prior ? srs[`concept:${prior.id}`] : undefined;
  const preview = cardState ? previewIntervals(cardState) : null;
  return (
    <div className="stack">
      <MethodNote id="retrieval">Every class opens with a cold call on earlier material.</MethodNote>
      <div className="card gilt">
        {card ? (
          <>
            <div className="label">cold call · {prior!.label}</div>
            <p className="book" style={{ fontSize: 19 }}>
              <Icon name={prior!.icon} size={22} style={{ color: 'var(--primary)', verticalAlign: 'middle', marginRight: 6 }} />
              {card.front}
            </p>
          </>
        ) : (
          <>
            <div className="label">cold call · prior knowledge</div>
            <p className="book" style={{ fontSize: 19 }}>
              Before we begin: in a sentence or two, what do you think “{c.label}” involves, and where have you seen it before?
            </p>
          </>
        )}
        <textarea rows={2} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Answer from memory…" disabled={revealed} />
        {!revealed ? (
          <button className="primary" style={{ marginTop: 8 }} disabled={!txt.trim()} onClick={() => setRevealed(true)}>
            Submit answer
          </button>
        ) : (
          <div className="fade-in stack tight" style={{ marginTop: 8 }}>
            {card && (
              <div className="card sunk" style={{ padding: 10 }}>
                <b>Model answer:</b> {card.back}
                <div className="muted" style={{ fontSize: 13 }}>
                  Keywords matched: {card.keywords.filter((k) => mentions(txt, k)).length}/{card.keywords.length}
                </div>
              </div>
            )}
            {card && cardState && preview ? (
              <div className="row">
                <span className="muted" style={{ fontSize: 13 }}>
                  Rate your recall:
                </span>
                {(['again', 'hard', 'good', 'easy'] as SrsRating[]).map((r) => (
                  <button
                    key={r}
                    className="small"
                    onClick={() => {
                      reviewCard(`concept:${prior!.id}`, r);
                      onDone();
                    }}
                  >
                    {r[0].toUpperCase() + r.slice(1)} · {fmtInterval(preview[r])}
                  </button>
                ))}
              </div>
            ) : (
              <button className="primary" style={{ alignSelf: 'flex-start' }} onClick={onDone}>
                Continue →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Lesson mind map from the concept's authored map. */
export function LessonMap({ c, height = 400 }: { c: Concept; height?: number }) {
  const tree = useMemo(() => (c.mindMap ? idTree(c.mindMap, c.id + '-') : null), [c]);
  if (!tree) return null;
  return <ConceptMindMap tree={tree} height={height} />;
}
