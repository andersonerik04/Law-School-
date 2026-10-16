import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { translateItem, chainItem, quantItem, equivalent, PROPS, type TranslateItem, type ChainItem, type QuantItem } from '../lib/clgen';
import { contrapositive, lit, symLit, type Cond, type Lit } from '../lib/logic';
import { CasebookHeader, MethodNote, Progress } from '../components/common';
import { ArrowChain, LogicCircuit, QuantVenn } from '../visuals/LogicGraphics';
import { fmtTime, LETTERS } from '../lib/util';

const ROUND = 8;

function LitPicker({ value, onChange, tags, label }: { value: Lit | null; onChange: (l: Lit) => void; tags: string[]; label: string }) {
  return (
    <div className="stack tight">
      <span className="label">{label}</span>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <label className="row" style={{ fontSize: 13, flexWrap: 'nowrap', gap: 4 }}>
          <input type="checkbox" checked={!!value?.neg} onChange={(e) => value && onChange({ ...value, neg: e.target.checked })} disabled={!value} /> not
        </label>
        <select value={value?.v ?? ''} onChange={(e) => onChange(lit(e.target.value, value?.neg ?? false))}>
          <option value="">— choose —</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Translate({ onRound }: { onRound: (c: number, n: number, ms: number) => void }) {
  const [items] = useState<TranslateItem[]>(() => Array.from({ length: ROUND }, translateItem));
  const [i, setI] = useState(0);
  const [a, setA] = useState<Lit | null>(null);
  const [b, setB] = useState<Lit | null>(null);
  const [ca, setCa] = useState<Lit | null>(null);
  const [cb, setCb] = useState<Lit | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [start] = useState(Date.now());
  const [itemStart, setItemStart] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const it = items[i];
  if (!it) return <div className="card gilt"><h3>Round complete: {score}/{ROUND}</h3><p>Total time {fmtTime(now - start)}.</p></div>;
  const tags = PROPS.filter((p) => p.tag === it.cond.a.v || p.tag === it.cond.b.v).map((p) => p.tag);
  const mine: Cond | null = a && b ? { a, b } : null;
  const mineContra: Cond | null = ca && cb ? { a: ca, b: cb } : null;
  const tOk = !!mine && equivalent(mine, it.cond);
  const cOk = !!mine && !!mineContra && equivalent(mineContra, contrapositive(mine)) && !equivalent(mineContra, { a: mine.b, b: mine.a });
  const cExact = !!mine && !!mineContra && symLit(mineContra.a) === symLit(contrapositive(mine).a) && symLit(mineContra.b) === symLit(contrapositive(mine).b);
  const elapsed = now - itemStart;
  return (
    <div className="stack">
      <div className="row between">
        <span className="label">
          item {i + 1} of {ROUND} · indicator: {it.indicator}
        </span>
        <span className={`chip ${elapsed > 20000 ? 'danger' : 'gold'}`}>{fmtTime(elapsed)} (target 0:20)</span>
      </div>
      <div className="card gilt">
        <p className="book" style={{ fontSize: 21, margin: 0 }}>
          {it.text}
        </p>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <div className="label">1 · translate into an arrow</div>
          <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
            <LitPicker label="sufficient" value={a} onChange={setA} tags={tags} />
            <span style={{ fontSize: 26, color: 'var(--gold)' }}>→</span>
            <LitPicker label="necessary" value={b} onChange={setB} tags={tags} />
          </div>
        </div>
        <div className="card">
          <div className="label">2 · its contrapositive</div>
          <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
            <LitPicker label="sufficient" value={ca} onChange={setCa} tags={tags} />
            <span style={{ fontSize: 26, color: 'var(--gold)' }}>→</span>
            <LitPicker label="necessary" value={cb} onChange={setCb} tags={tags} />
          </div>
        </div>
      </div>
      {!checked ? (
        <button
          className="primary"
          style={{ alignSelf: 'flex-start' }}
          disabled={!mine || !mineContra}
          onClick={() => {
            setChecked(true);
            if (tOk && cExact) setScore((s) => s + 1);
          }}
        >
          Check
        </button>
      ) : (
        <div className="card fade-in">
          <div>
            Translation: {tOk ? '✓' : '✗'} <span className="mono">{symLit(it.cond.a)} → {symLit(it.cond.b)}</span> {tOk && mine && !equivalent(mine, { a: it.cond.a, b: it.cond.b }) ? '' : ''}
          </div>
          <div>
            Contrapositive: {cExact ? '✓' : '✗'} <span className="mono">{symLit(contrapositive(it.cond).a)} → {symLit(contrapositive(it.cond).b)}</span> {!cExact && cOk ? '(equivalent, but flip AND negate your own arrow)' : ''}
          </div>
          <ArrowChain chain={[it.cond.a, it.cond.b]} labels />
          <button
            className="primary"
            onClick={() => {
              setI(i + 1);
              setA(null);
              setB(null);
              setCa(null);
              setCb(null);
              setChecked(false);
              setItemStart(Date.now());
              if (i + 1 >= ROUND) onRound(score, ROUND, Date.now() - start);
            }}
          >
            Next →
          </button>
        </div>
      )}
      <Progress value={i} max={ROUND} />
    </div>
  );
}

function Chaining({ onRound }: { onRound: (c: number, n: number, ms: number) => void }) {
  const [items] = useState<ChainItem[]>(() => Array.from({ length: 5 }, () => chainItem()));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const start = useRef(Date.now());
  const it = items[i];
  if (!it) return <div className="card gilt"><h3>Round complete: {score}/{items.length}</h3></div>;
  return (
    <div className="stack">
      <div className="label">
        chain {i + 1} of {items.length} · {it.conds.length} conditionals
      </div>
      <div className="card gilt">
        <ol className="book" style={{ fontSize: 18, margin: 0 }}>
          {it.texts.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </div>
      <div className="stem">If the statements above are true, which one of the following must also be true?</div>
      <div className="choices">
        {it.options.map((o, k) => (
          <div key={k} className={`choice ${picked !== null ? (k === it.answer ? 'correct' : picked === k ? 'wrong' : '') : ''}`} onClick={() => {
            if (picked !== null) return;
            setPicked(k);
            if (k === it.answer) setScore((s) => s + 1);
          }}>
            <span className="letter">{LETTERS[k]}</span>
            <span className="ctext">{o.label}</span>
            <span />
          </div>
        ))}
      </div>
      {picked !== null && (
        <div className="card fade-in">
          <div className="label">the logic circuit — valid inferences light up gold</div>
          <LogicCircuit conds={it.conds} query={it.options[picked].cond} />
          <button className="primary" onClick={() => {
            setPicked(null);
            setI(i + 1);
            if (i + 1 >= items.length) onRound(score, items.length, Date.now() - start.current);
          }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function Quantifiers({ onRound }: { onRound: (c: number, n: number, ms: number) => void }) {
  const [items] = useState<QuantItem[]>(() => Array.from({ length: 6 }, quantItem));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const start = useRef(Date.now());
  const it = items[i];
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  if (!it) return <div className="card gilt"><h3>Round complete: {score}/{items.length}</h3></div>;
  const say = (q: QuantItem['premises'][number]) => ({ all: 'All', most: 'Most', some: 'Some', none: 'No', 'some-not': 'Some' }[q.q] + ` ${q.a} ${q.q === 'some-not' ? 'are not' : 'are'} ${q.b}.`);
  return (
    <div className="stack">
      <div className="label">
        item {i + 1} of {items.length}
      </div>
      <div className="card gilt">
        {it.premises.map((p, k) => (
          <p key={k} className="book" style={{ fontSize: 19, margin: '2px 0' }}>
            {say(p)}
          </p>
        ))}
      </div>
      <div className="stem">Which one of the following must be true?</div>
      <div className="choices">
        {it.options.map((o, k) => (
          <div key={k} className={`choice ${picked !== null ? (k === it.answer ? 'correct' : picked === k ? 'wrong' : '') : ''}`} onClick={() => {
            if (picked !== null) return;
            setPicked(k);
            if (k === it.answer) setScore((s) => s + 1);
          }}>
            <span className="letter">{LETTERS[k]}</span>
            <span className="ctext">{cap(o)}</span>
            <span />
          </div>
        ))}
      </div>
      {picked !== null && (
        <div className="card fade-in">
          <QuantVenn sets={it.sets.slice(0, 3)} statements={it.premises} size={360} />
          <p className="book">{it.conclusion ? 'Read the conclusion off the diagram: where the ✕ or shading is forced.' : 'Nothing is forced: the two premises can be drawn without the groups overlapping in any guaranteed way.'}</p>
          <button className="primary" onClick={() => {
            setPicked(null);
            setI(i + 1);
            if (i + 1 >= items.length) onRound(score, items.length, Date.now() - start.current);
          }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export default function LogicTrainer() {
  const [tab, setTab] = useState<'translate' | 'chain' | 'quant'>('translate');
  const [round, setRound] = useState(0);
  const addDrill = useStore((s) => s.addDrill);
  const drills = useStore((s) => s.drills);
  const best = useMemo(() => {
    const out: Record<string, number> = {};
    drills.filter((d) => d.conceptOrType.startsWith('cl-trainer')).forEach((d) => (out[d.conceptOrType] = Math.max(out[d.conceptOrType] ?? 0, Math.round((d.correct / d.total) * 100))));
    return out;
  }, [drills]);
  const done = (kind: string) => (c: number, n: number) => addDrill({ ts: Date.now(), conceptOrType: `cl-trainer-${kind}`, mode: 'timed', correct: c, total: n });
  return (
    <div>
      <CasebookHeader chapter="THE CONDITIONAL LOGIC TRAINER" title="Arrows, Chains & Quantifiers" subtitle="Translate fast, chain cleanly, and never reverse an arrow." />
      <MethodNote id="dual">Every item ends in a live diagram: arrow chain, logic circuit, or Venn.</MethodNote>
      <div className="tabs">
        {(
          [
            ['translate', 'Timed Translation'],
            ['chain', 'Chaining (3–5)'],
            ['quant', 'Quantifiers'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => { setTab(k); setRound((r) => r + 1); }}>
            {l} {best[`cl-trainer-${k}`] !== undefined ? <span className="chip gold" style={{ marginLeft: 6 }}>best {best[`cl-trainer-${k}`]}%</span> : null}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button className="small" onClick={() => setRound((r) => r + 1)}>
          New round
        </button>
      </div>
      <div className="page-turn" key={tab + round}>
        {tab === 'translate' && <Translate onRound={done('translate')} />}
        {tab === 'chain' && <Chaining onRound={done('chain')} />}
        {tab === 'quant' && <Quantifiers onRound={done('quant')} />}
      </div>
    </div>
  );
}
