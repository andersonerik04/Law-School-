import { useState, type DragEvent } from 'react';
import type { LRQuestion, RCPassage, SegRole, ParaFunction } from '../lib/types';
import { ArgumentDiagram } from '../visuals/ArgumentDiagram';
import { PassageMap, PARA_FUNCTIONS } from '../visuals/RCVisuals';
import { MethodNote } from './common';

const ZONES: { r: SegRole; label: string; hint: string }[] = [
  { r: 'C', label: 'Main Conclusion', hint: 'What the author wants you to believe' },
  { r: 'I', label: 'Sub-conclusion', hint: 'Supported, and supports' },
  { r: 'P', label: 'Premise / Evidence', hint: 'Reasons offered' },
  { r: 'K', label: 'Counterpoint / Concession', hint: 'Opposing view or granted point' },
  { r: 'X', label: 'Context / Fact', hint: 'Background or a fact in the record' },
];

/** Interactive argument diagramming: drag (or tap) each sentence into its role. */
export function DiagramBuilder({ q, onDone }: { q: LRQuestion; onDone: (score: number) => void }) {
  const [assign, setAssign] = useState<Record<number, SegRole>>({});
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [over, setOver] = useState<SegRole | null>(null);
  const segs = q.stimulus;
  const unplaced = segs.map((_, i) => i).filter((i) => assign[i] === undefined);

  const place = (i: number, r: SegRole) => {
    setAssign((a) => ({ ...a, [i]: r }));
    setPicked(null);
  };
  const onDrop = (e: DragEvent, r: SegRole) => {
    e.preventDefault();
    setOver(null);
    const i = Number(e.dataTransfer.getData('text/plain'));
    if (!Number.isNaN(i)) place(i, r);
  };
  // Fact-set stimuli: P and X are both acceptable for "X" items; I and C are interchangeable only when exact
  const isRight = (i: number) => {
    const truth = segs[i].r;
    const mine = assign[i];
    if (mine === truth) return true;
    if (truth === 'X' && mine === 'P') return !segs.some((s) => s.r === 'C');
    return false;
  };
  const score = segs.length ? Math.round((segs.filter((_, i) => isRight(i)).length / segs.length) * 100) : 0;

  const chip = (i: number) => (
    <div
      key={i}
      className={`chip draggable ${picked === i ? 'picked' : ''} ${checked ? (isRight(i) ? 'success' : 'danger') : ''}`}
      draggable={!checked}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i))}
      onClick={() => !checked && setPicked(picked === i ? null : i)}
      style={{ whiteSpace: 'normal', fontFamily: 'var(--font-book)', fontSize: 14, padding: '6px 10px', borderRadius: 6, maxWidth: '100%', textAlign: 'left' }}
      title="Drag into a role — or tap, then tap a role"
    >
      {segs[i].s ? <b>{segs[i].s}: </b> : null}
      {segs[i].t}
      {checked && !isRight(i) && <em style={{ marginLeft: 6, color: 'var(--danger)' }}>→ {ZONES.find((z) => z.r === segs[i].r)?.label}</em>}
    </div>
  );

  return (
    <div className="stack">
      <MethodNote id="visual">Map the argument before you see the answer choices.</MethodNote>
      <div className="card sunk" style={{ padding: 10 }}>
        <div className="label">the stimulus — sentences to place</div>
        <div className="stack tight" style={{ marginTop: 6 }}>
          {unplaced.map(chip)}
          {!unplaced.length && <span className="muted">All sentences placed.</span>}
        </div>
      </div>
      <div className="grid cols-2">
        {ZONES.map((z) => (
          <div
            key={z.r}
            className={`dropzone ${over === z.r ? 'over' : ''} ${z.r === 'C' ? 'conclusion' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(z.r);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => onDrop(e, z.r)}
            onClick={() => picked !== null && place(picked, z.r)}
          >
            <div className="row between">
              <b style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{z.label}</b>
              <span className="muted" style={{ fontSize: 12 }}>
                {z.hint}
              </span>
            </div>
            <div className="stack tight" style={{ marginTop: 6 }}>
              {segs.map((_, i) => i).filter((i) => assign[i] === z.r).map(chip)}
            </div>
          </div>
        ))}
      </div>
      <div className="row">
        {!checked ? (
          <button className="primary" disabled={unplaced.length > 0} onClick={() => setChecked(true)}>
            Check my diagram
          </button>
        ) : (
          <>
            <span className="chip gold">Diagram accuracy {score}%</span>
            <button className="primary" onClick={() => onDone(score)}>
              Show the answer choices →
            </button>
          </>
        )}
        {!checked && (
          <button className="ghost" onClick={() => setAssign({})}>
            Reset
          </button>
        )}
      </div>
      {checked && (
        <div className="card flat fade-in">
          <div className="label">the model diagram</div>
          <ArgumentDiagram q={q} overlay="none" step={4} />
        </div>
      )}
    </div>
  );
}

/** RC: label each paragraph's function before seeing the questions. */
export function PassageMapBuilder({ passage, onDone }: { passage: RCPassage; onDone: (score: number) => void }) {
  const paras = passage.passages.flatMap((p) => p.paragraphs);
  const [mine, setMine] = useState<(ParaFunction | '')[]>(paras.map(() => ''));
  const [gists, setGists] = useState<string[]>(paras.map(() => ''));
  const [checked, setChecked] = useState(false);
  const compatible = (a: string, b: string) => a === b || (['Evidence', 'Example', 'Elaboration'].includes(a) && ['Evidence', 'Example', 'Elaboration'].includes(b)) || (['Counterargument', 'Rebuttal'].includes(a) && ['Counterargument', 'Rebuttal'].includes(b));
  const score = Math.round((paras.filter((p, i) => compatible(mine[i], p.fn)).length / paras.length) * 100);
  return (
    <div className="stack">
      <MethodNote id="visual">Build the structure map yourself, then compare it with the model.</MethodNote>
      {paras.map((p, i) => (
        <div key={i} className="card flat" style={{ padding: 10 }}>
          <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <b style={{ fontFamily: 'var(--font-display)', minWidth: 30 }}>¶{i + 1}</b>
            <div style={{ flex: 1 }} className="stack tight">
              <select value={mine[i]} onChange={(e) => setMine((m) => m.map((x, j) => (j === i ? (e.target.value as ParaFunction) : x)))} disabled={checked} style={{ maxWidth: 260 }}>
                <option value="">— function —</option>
                {PARA_FUNCTIONS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
              <input placeholder="Five-word gist of this paragraph…" value={gists[i]} onChange={(e) => setGists((g) => g.map((x, j) => (j === i ? e.target.value : x)))} disabled={checked} />
              {checked && (
                <div style={{ fontSize: 13 }} className={compatible(mine[i], p.fn) ? '' : 'muted'}>
                  {compatible(mine[i], p.fn) ? '✓' : '✗'} Model: <b>{p.fn}</b> — {p.gist}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      <div className="row">
        {!checked ? (
          <button className="primary" disabled={mine.some((m) => !m)} onClick={() => setChecked(true)}>
            Compare with the model map
          </button>
        ) : (
          <>
            <span className="chip gold">Structure accuracy {score}%</span>
            <button className="primary" onClick={() => onDone(score)}>
              Continue to the questions →
            </button>
          </>
        )}
      </div>
      {checked && <PassageMap paragraphs={paras} title={passage.title} />}
    </div>
  );
}
