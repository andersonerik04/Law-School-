import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CONCEPTS, CONCEPT_BY_ID, LR_QUESTIONS, PASSAGE_BY_ID } from '../lib/content';
import type { Concept } from '../lib/types';
import { CasebookHeader, Modal, MethodNote } from '../components/common';
import { ArgumentDiagram, overlayForType } from '../visuals/ArgumentDiagram';
import { ArrowChain, QuantVenn } from '../visuals/LogicGraphics';
import { PassageMap, ToneMeter } from '../visuals/RCVisuals';
import { ConceptMindMap } from '../visuals/MindMap';
import { idTree } from '../visuals/mindLayout';
import { Icon } from '../visuals/Icon';
import { wrap, SvgLines, ArrowDefs } from '../visuals/svgText';
import { lit } from '../lib/logic';

/** "How to Attack" flowchart: steps as gold-ruled boxes connected by arrows. */
export function AttackFlowchart({ steps, id = 'af' }: { steps: string[]; id?: string }) {
  const W = 320;
  const boxes = steps.map((s) => wrap(s, 40, 3));
  let y = 8;
  const pos = boxes.map((lines) => {
    const h = lines.length * 14 + 14;
    const p = { y, h };
    y += h + 18;
    return p;
  });
  return (
    <svg viewBox={`0 0 ${W} ${y}`} width="100%" style={{ maxWidth: W }} role="img" aria-label="How to attack flowchart">
      <ArrowDefs id={id} />
      {boxes.map((lines, i) => (
        <g key={i}>
          {i > 0 && <path d={`M${W / 2},${pos[i - 1].y + pos[i - 1].h} L${W / 2},${pos[i].y - 2}`} stroke="var(--gold)" strokeWidth={1.5} markerEnd={`url(#${id}-gold)`} />}
          <rect x={10} y={pos[i].y} width={W - 20} height={pos[i].h} rx={i === 0 || i === boxes.length - 1 ? 14 : 4} fill={i === boxes.length - 1 ? 'var(--gold-soft)' : 'var(--paper-2)'} stroke={i === boxes.length - 1 ? 'var(--gold)' : 'var(--rule-strong)'} />
          <text x={22} y={pos[i].y + 18} fontSize={10} fontWeight={700} fill="var(--gold)" fontFamily="var(--font-display)">
            {i + 1}
          </text>
          <SvgLines x={W / 2 + 6} y={pos[i].y + 18} lines={lines} size={11.5} lh={14} font="var(--font-ui)" />
        </g>
      ))}
    </svg>
  );
}

function MiniVisual({ c }: { c: Concept }) {
  if (c.kind === 'lr-type') {
    const q = LR_QUESTIONS.find((x) => `lr-${x.type}` === c.id);
    if (q) return <ArgumentDiagram q={q} overlay={overlayForType(q.type)} compact step={5} overlayText={q.choices[q.answer]} />;
  }
  if (c.kind === 'flaw') {
    const q = LR_QUESTIONS.find((x) => x.flaw && `flaw-${x.flaw}` === c.id && x.stimulus.some((s) => s.r === 'C'));
    if (q) return <ArgumentDiagram q={q} overlay="flaw" compact step={5} overlayText={c.oneLiner} />;
  }
  if (c.id === 'cl-quantifiers') return <QuantVenn sets={['A', 'B', 'C']} statements={[{ q: 'most', a: 'A', b: 'B' }, { q: 'all', a: 'B', b: 'C' }]} size={260} />;
  if (c.branch === 'CL') return <ArrowChain chain={[lit('A'), lit('B'), lit('C')]} interactive={false} labels />;
  if (c.id === 'rcs-tone' || c.id === 'rct-attitude') return <ToneMeter value={-0.8} word="Measured skepticism" />;
  if (c.branch === 'RC') return <PassageMap paragraphs={PASSAGE_BY_ID['rc-02']?.passages[0].paragraphs ?? []} />;
  return (
    <div style={{ textAlign: 'center', padding: 20 }}>
      <Icon name={c.icon} size={90} stroke={1} style={{ color: 'var(--primary)' }} />
    </div>
  );
}

export function BenchCard({ c }: { c: Concept }) {
  return (
    <article className="card gilt print-page" style={{ padding: '18px 22px' }}>
      <div className="row between" style={{ borderBottom: '1px solid var(--gold)', paddingBottom: 6 }}>
        <div className="row">
          <Icon name={c.icon} size={34} style={{ color: 'var(--primary)' }} />
          <div>
            <div className="label">{c.chapter ?? 'bench card'}</div>
            <h2 style={{ margin: 0 }}>{c.label}</h2>
          </div>
        </div>
        <span className="chip gold">Bench Card</span>
      </div>
      <p className="book" style={{ fontSize: 16, margin: '10px 0' }}>
        <b>Definition.</b> {c.definition ?? c.oneLiner}
      </p>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', alignItems: 'start', gap: 16 }}>
        <div className="stack">
          <div className="card flat" style={{ background: 'var(--paper)', padding: 8 }}>
            <MiniVisual c={c} />
          </div>
          {c.correctLooksLike && (
            <div>
              <div className="label">the right answer looks like</div>
              <div className="book" style={{ fontSize: 15 }}>
                {c.correctLooksLike}
              </div>
            </div>
          )}
          {(c.traps?.length ?? 0) > 0 && (
            <div>
              <div className="label">common traps</div>
              <ul className="book" style={{ fontSize: 15, margin: '2px 0' }}>
                {c.traps!.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {(c.stemCues?.length ?? 0) > 0 && (
            <div className="row" style={{ gap: 4 }}>
              <span className="label">stem cues</span>
              {c.stemCues!.map((s) => (
                <span key={s} className="chip">
                  “{s}”
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="label">how to attack</div>
          {c.attack ? <AttackFlowchart steps={c.attack} id={'af-' + c.id} /> : <p className="book">{c.oneLiner}</p>}
        </div>
      </div>
      {c.commonError && (
        <div className="method-note" style={{ marginTop: 8 }}>
          <b>Common error</b> — {c.commonError}
        </div>
      )}
    </article>
  );
}

const DECISION_TREE = {
  label: 'Read the stem',
  children: [
    { label: 'Accept the stimulus; find what follows', children: [{ label: '“must be true” → MBT' }, { label: '“most strongly supported” → MSS' }, { label: '“cannot be true / EXCEPT” → CBT' }] },
    { label: 'Describe the argument', children: [{ label: '“main conclusion” → MC' }, { label: '“role / figures in” → Role' }, { label: '“proceeds by” → Method' }, { label: '“vulnerable / flawed” → Flaw' }] },
    { label: 'Work the gap', children: [{ label: '“depends on / requires” → NA' }, { label: '“follows logically if” → SA' }, { label: '“strengthens” → Strengthen' }, { label: '“weakens” → Weaken' }, { label: '“useful to know” → Evaluate' }] },
    { label: 'Match a pattern', children: [{ label: '“most similar reasoning” → Parallel' }, { label: '“similar flawed” → Parallel Flaw' }, { label: '“principle … justify” → Principle–ID' }, { label: '“conforms to the principle” → Principle–Apply' }] },
    { label: 'Tension or two voices', children: [{ label: '“resolve / explain” → Paradox' }, { label: '“disagree over” → Point at Issue' }, { label: '“agree that” → Agreement' }] },
  ],
};
const ELIMINATION_TREE = {
  label: 'For each answer…',
  children: [
    { label: 'About the stimulus’s topic?', children: [{ label: 'No → Out of Scope' }, { label: 'Compares outside things → Irrelevant Comparison' }] },
    { label: 'Right strength?', children: [{ label: 'Overstates → Too Strong' }, { label: 'Some vs most → Wrong Degree' }] },
    { label: 'Right logic?', children: [{ label: 'Swapped arrow → Reversal' }, { label: 'Not established → Unsupported' }] },
    { label: 'Right task?', children: [{ label: 'Does the reverse → Opposite' }, { label: 'Repeats a premise → Restatement' }] },
    { label: 'Every word fits?', children: [{ label: 'One part fails → Half-Right' }, { label: 'Swapped term → Shell Game' }] },
  ],
};

export default function BenchCards() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'library' | 'deck' | 'decision' | 'elimination'>('library');
  const [filter, setFilter] = useState<'all' | 'lr-type' | 'flaw' | 'trap' | 'cl' | 'rc'>('all');
  const cards = useMemo(() => CONCEPTS.filter((c) => c.card && !['root', 'branch', 'group'].includes(c.kind)), []);
  const shown = cards.filter((c) => filter === 'all' || c.kind === filter || (filter === 'rc' && c.branch === 'RC') || (filter === 'cl' && c.branch === 'CL'));
  const openId = params.get('c');
  const [deckIdx, setDeckIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  useEffect(() => setFlipped(false), [deckIdx]);
  const deck = shown;
  const dc = deck[deckIdx % Math.max(1, deck.length)];

  return (
    <div>
      <CasebookHeader chapter="BENCH CARDS" title="The Bench Book" subtitle="A one-page visual summary for every question type, flaw, trap, and technique." />
      <MethodNote id="dual" />
      <div className="tabs no-print">
        {(
          [
            ['library', 'Card Library'],
            ['deck', 'Flip Deck'],
            ['decision', 'Type Decision Tree'],
            ['elimination', 'Elimination Tree'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {(tab === 'library' || tab === 'deck') && (
        <div className="row no-print" style={{ marginBottom: 12 }}>
          {(['all', 'lr-type', 'flaw', 'trap', 'cl', 'rc'] as const).map((f) => (
            <button key={f} className={`small ${filter === f ? 'selected' : ''}`} onClick={() => { setFilter(f); setDeckIdx(0); }}>
              {{ all: 'All', 'lr-type': 'Question types', flaw: 'Flaws', trap: 'Traps', cl: 'Conditional logic', rc: 'Reading comp.' }[f]}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <button onClick={() => window.print()}>
            <Icon name="print" size={14} /> Print / save all as PDF
          </button>
        </div>
      )}

      {tab === 'library' && (
        <>
          <div className="grid auto no-print">
            {shown.map((c) => (
              <button key={c.id} className="card" style={{ textAlign: 'left', display: 'block', cursor: 'pointer' }} onClick={() => setParams({ c: c.id })}>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <Icon name={c.icon} size={30} style={{ color: 'var(--primary)' }} />
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700 }}>{c.label}</div>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {c.oneLiner}
                </div>
              </button>
            ))}
          </div>
          <div className="print-only">
            {shown.map((c) => (
              <BenchCard key={c.id} c={c} />
            ))}
          </div>
        </>
      )}

      {tab === 'deck' && dc && (
        <div style={{ maxWidth: 900, margin: '0 auto' }} className="no-print">
          <div className="row between" style={{ marginBottom: 8 }}>
            <span className="muted">
              Card {(deckIdx % deck.length) + 1} of {deck.length}
            </span>
            <div className="row">
              <button onClick={() => setDeckIdx((i) => (i - 1 + deck.length) % deck.length)}>← Prev</button>
              <button className="gold" onClick={() => setFlipped((f) => !f)}>
                {flipped ? 'Show front' : 'Flip'}
              </button>
              <button onClick={() => setDeckIdx((i) => (i + 1) % deck.length)}>Next →</button>
            </div>
          </div>
          <div className="page-turn" key={dc.id + String(flipped)}>
            {!flipped ? (
              <div className="card gilt" style={{ textAlign: 'center', padding: 40, cursor: 'pointer' }} onClick={() => setFlipped(true)}>
                <Icon name={dc.icon} size={110} stroke={1} style={{ color: 'var(--primary)' }} />
                <h1 style={{ marginTop: 12 }}>{dc.label}</h1>
                <p className="book muted">{dc.card?.front}</p>
                <div className="muted" style={{ fontSize: 12 }}>
                  Recall the definition, method, and traps, then flip.
                </div>
              </div>
            ) : (
              <BenchCard c={dc} />
            )}
          </div>
        </div>
      )}

      {tab === 'decision' && (
        <div className="card">
          <p className="book">The master decision tree: classify any Logical Reasoning stem by its task and signature wording.</p>
          <ConceptMindMap tree={idTree(DECISION_TREE, 'dt-')} layout="horizontal" height={640} />
          <div className="row" style={{ marginTop: 8 }}>
            <Link to="/moot" className="btn primary">
              Practice: Identify-the-Type in 5 seconds →
            </Link>
          </div>
        </div>
      )}
      {tab === 'elimination' && (
        <div className="card">
          <p className="book">The wrong-answer elimination tree: interrogate each answer choice in order.</p>
          <ConceptMindMap tree={idTree(ELIMINATION_TREE, 'et-')} layout="horizontal" height={560} />
        </div>
      )}

      {openId && CONCEPT_BY_ID[openId] && (
        <Modal onClose={() => setParams({})} title="">
          <BenchCard c={CONCEPT_BY_ID[openId]} />
          <div className="row no-print" style={{ marginTop: 10 }}>
            <button onClick={() => window.print()}>
              <Icon name="print" size={14} /> Print / PDF
            </button>
            {CONCEPT_BY_ID[openId].lesson && (
              <Link className="btn" to={`/casebook/${openId}`}>
                Open the lesson
              </Link>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
