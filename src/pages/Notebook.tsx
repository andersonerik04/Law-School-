import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import type { NotebookEntry } from '../lib/types';
import { CONCEPTS, CONCEPT_BY_ID } from '../lib/content';
import { uid } from '../lib/util';
import { CasebookHeader, Empty, MethodNote } from '../components/common';
import { FreeCanvas, type FreeMapState } from '../visuals/MindMap';
import { Icon } from '../visuals/Icon';

/** Freehand sketch pad (pointer events: mouse, pen, touch). Saves as a PNG data URL. */
function SketchPad({ initial, onSave }: { initial?: string; onSave: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState('ink');
  const [width, setWidth] = useState(2.5);
  const [erase, setErase] = useState(false);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const saveT = useRef<number>();

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    if (initial) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = initial;
    }
  }, [initial]);

  const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#333';
  const pt = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * ref.current!.width, y: ((e.clientY - r.top) / r.height) * ref.current!.height };
  };
  const down = (e: React.PointerEvent) => {
    drawing.current = true;
    last.current = pt(e);
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const ctx = ref.current!.getContext('2d')!;
    const p = pt(e);
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = css(color === 'ink' ? '--ink' : color === 'primary' ? '--primary' : color === 'gold' ? '--gold' : '--secondary');
    ctx.lineWidth = erase ? 18 : width * (e.pressure && e.pointerType === 'pen' ? 0.5 + e.pressure : 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const up = () => {
    drawing.current = false;
    last.current = null;
    window.clearTimeout(saveT.current);
    saveT.current = window.setTimeout(() => onSave(ref.current!.toDataURL('image/png')), 300);
  };
  return (
    <div className="stack">
      <div className="row">
        {['ink', 'primary', 'gold', 'secondary'].map((c) => (
          <button key={c} className={`small ${color === c && !erase ? 'selected' : ''}`} onClick={() => { setColor(c); setErase(false); }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 7, background: `var(--${c})` }} /> {c === 'ink' ? 'Ink' : c === 'primary' ? 'House' : c === 'gold' ? 'Gold' : 'Navy'}
          </button>
        ))}
        <label className="row" style={{ fontSize: 13 }}>
          Width <input type="range" min={1} max={8} step={0.5} value={width} onChange={(e) => setWidth(+e.target.value)} style={{ width: 100 }} />
        </label>
        <button className={`small ${erase ? 'selected' : ''}`} onClick={() => setErase((x) => !x)}>
          Eraser
        </button>
        <button
          className="small danger"
          onClick={() => {
            const c = ref.current!;
            c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
            onSave(c.toDataURL('image/png'));
          }}
        >
          Clear
        </button>
      </div>
      <canvas
        ref={ref}
        width={1400}
        height={800}
        className="paper-texture"
        style={{ width: '100%', aspectRatio: '1400 / 800', border: '1px solid var(--rule)', borderRadius: 8, touchAction: 'none', cursor: erase ? 'cell' : 'crosshair' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
      />
    </div>
  );
}

const attachable = CONCEPTS.filter((c) => c.kind !== 'root');

export default function Notebook() {
  const [params] = useSearchParams();
  const nodeParam = params.get('node') ?? '';
  const notebook = useStore((s) => s.notebook);
  const upsert = useStore((s) => s.upsertNote);
  const del = useStore((s) => s.deleteNote);
  const [filter, setFilter] = useState(nodeParam);
  const [sel, setSel] = useState<string | null>(null);
  const list = notebook.filter((n) => !filter || n.nodeId === filter);
  const entry = notebook.find((n) => n.id === sel) ?? null;

  const create = (kind: NotebookEntry['kind']) => {
    const n: NotebookEntry = {
      id: uid('n_'),
      kind,
      title: kind === 'map' ? 'Untitled map' : kind === 'sketch' ? 'Untitled sketch' : 'Untitled note',
      nodeId: filter || undefined,
      created: Date.now(),
      updated: Date.now(),
      text: '',
      map: kind === 'map' ? { nodes: [{ id: 'c0', label: filter ? CONCEPT_BY_ID[filter]?.label ?? 'Central idea' : 'Central idea', x: 0, y: 0 }], edges: [] } : undefined,
    };
    upsert(n);
    setSel(n.id);
  };
  const patch = (p: Partial<NotebookEntry>) => entry && upsert({ ...entry, ...p, updated: Date.now() });

  return (
    <div>
      <CasebookHeader chapter="MY NOTEBOOK" title="The Scholar’s Notebook" subtitle="Your own maps, sketches, and annotations, pinned to the Map of the Law." />
      <MethodNote id="visual">Rebuild what you learn in your own hand; rebuilding is retrieval.</MethodNote>
      <div className="grid" style={{ gridTemplateColumns: '280px minmax(0,1fr)', alignItems: 'start' }}>
        <aside className="card stack" style={{ position: 'sticky', top: 70 }}>
          <div className="row">
            <button className="small primary" onClick={() => create('map')}>
              <Icon name="map" size={13} /> Map
            </button>
            <button className="small primary" onClick={() => create('sketch')}>
              <Icon name="quill" size={13} /> Sketch
            </button>
            <button className="small primary" onClick={() => create('note')}>
              <Icon name="notebook" size={13} /> Note
            </button>
          </div>
          <label className="field">
            Show notes on
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All nodes</option>
              {attachable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div className="stack tight">
            {list.map((n) => (
              <button key={n.id} className={`small ${sel === n.id ? 'selected' : ''}`} style={{ justifyContent: 'flex-start' }} onClick={() => setSel(n.id)}>
                <Icon name={n.kind === 'map' ? 'map' : n.kind === 'sketch' ? 'quill' : 'notebook'} size={13} />
                <span style={{ flex: 1, textAlign: 'left' }}>{n.title}</span>
                {n.nodeId && <span className="chip" style={{ fontSize: 10 }}>{CONCEPT_BY_ID[n.nodeId]?.label}</span>}
              </button>
            ))}
            {!list.length && <span className="muted">No entries yet.</span>}
          </div>
        </aside>
        <div>
          {!entry ? (
            <Empty>Select an entry, or create a map, sketch, or note.</Empty>
          ) : (
            <div className="card stack page-turn" key={entry.id}>
              <div className="row">
                <input value={entry.title} onChange={(e) => patch({ title: e.target.value })} style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, flex: 1 }} />
                <select value={entry.nodeId ?? ''} onChange={(e) => patch({ nodeId: e.target.value || undefined })} style={{ maxWidth: 260 }} aria-label="Attach to node">
                  <option value="">Not attached to a node</option>
                  {attachable.map((c) => (
                    <option key={c.id} value={c.id}>
                      📌 {c.label}
                    </option>
                  ))}
                </select>
                <button
                  className="danger small"
                  onClick={() => {
                    if (confirm('Delete this entry?')) {
                      del(entry.id);
                      setSel(null);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
              {entry.nodeId && (
                <div className="muted" style={{ fontSize: 13 }}>
                  Pinned to <Link to="/map">{CONCEPT_BY_ID[entry.nodeId]?.label}</Link> on the Map of the Law.
                </div>
              )}
              {entry.kind === 'map' && <FreeCanvas initial={entry.map as FreeMapState} height={520} onChange={(m) => patch({ map: m })} />}
              {entry.kind === 'sketch' && <SketchPad initial={entry.sketch} onSave={(d) => patch({ sketch: d })} />}
              <label className="field">
                {entry.kind === 'note' ? 'Note' : 'Annotations'}
                <textarea rows={entry.kind === 'note' ? 14 : 4} value={entry.text ?? ''} onChange={(e) => patch({ text: e.target.value })} placeholder="Write in your own words…" />
              </label>
              <div className="muted" style={{ fontSize: 12 }}>
                Saved automatically · last edited {new Date(entry.updated).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
