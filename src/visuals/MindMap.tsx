import { memo, useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  ConnectionMode,
  type Edge,
  type Node,
  type NodeProps,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { radialLayout, horizontalLayout, flatten, edgesOf, type TreeNode } from './mindLayout';
import { Icon } from './Icon';
import { MASTERY_VAR, masteryInk } from '../lib/mastery';
import { shuffle, tokens, stem } from '../lib/util';

export interface ScholarData extends Record<string, unknown> {
  label: string;
  depth?: number;
  level?: number; // mastery 0–5
  icon?: string;
  status?: 'correct' | 'wrong' | 'missing' | 'placed';
  blank?: boolean;
  editable?: boolean;
  kind?: string;
  noteCount?: number;
  dim?: boolean;
  big?: boolean;
  onDropTerm?: (nodeId: string, term: string) => void;
  onRename?: (nodeId: string, label: string) => void;
}

const handleStyle = { width: 8, height: 8 };

export const ScholarNode = memo(function ScholarNode({ id, data, selected }: NodeProps<Node<ScholarData>>) {
  const d = data;
  const depth = d.depth ?? 2;
  const level = d.level;
  const bg = level !== undefined ? MASTERY_VAR[level] : depth === 0 ? 'var(--primary)' : depth === 1 ? 'var(--primary-soft)' : 'var(--paper-2)';
  const ink = level !== undefined ? masteryInk(level) : depth === 0 ? 'var(--on-primary)' : 'var(--ink)';
  const border =
    d.status === 'correct'
      ? 'var(--success)'
      : d.status === 'wrong'
        ? 'var(--danger)'
        : d.status === 'missing'
          ? 'var(--danger)'
          : level === 5
            ? 'var(--gold-bright)'
            : depth <= 1
              ? 'var(--gold)'
              : 'var(--rule-strong)';
  const [editing, setEditing] = useState(false);
  const [txt, setTxt] = useState(d.label);
  useEffect(() => setTxt(d.label), [d.label]);
  const [over, setOver] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const term = e.dataTransfer.getData('text/plain');
    if (term && d.onDropTerm) d.onDropTerm(id, term);
  };

  return (
    <div
      onDragOver={(e) => {
        if (d.onDropTerm) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onDoubleClick={() => d.editable && setEditing(true)}
      style={{
        background: over ? 'var(--gold-soft)' : bg,
        color: ink,
        border: `${level === 5 || depth === 0 ? 2.5 : 1.5}px ${d.blank && !d.label ? 'dashed' : 'solid'} ${selected ? 'var(--gold-bright)' : border}`,
        outline: level === 5 ? '1px solid var(--gold-soft)' : undefined,
        outlineOffset: 2,
        borderRadius: depth === 0 ? 40 : 6,
        padding: d.big ? (depth === 0 ? '26px 44px' : '14px 22px') : depth === 0 ? '14px 22px' : depth === 1 ? '9px 14px' : '6px 10px',
        minWidth: d.blank ? 120 : depth === 0 ? 150 : 70,
        minHeight: d.blank ? 30 : undefined,
        maxWidth: d.big ? 420 : 210,
        textAlign: 'center',
        fontFamily: depth <= 1 ? 'var(--font-display)' : 'var(--font-ui)',
        fontWeight: depth <= 1 ? 700 : 500,
        fontSize: (depth === 0 ? 20 : depth === 1 ? 16 : 12.5) * (d.big ? 2.1 : 1),
        letterSpacing: depth === 0 ? '0.08em' : undefined,
        boxShadow: depth <= 1 ? 'var(--shadow)' : undefined,
        opacity: d.dim ? 0.35 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        justifyContent: 'center',
        lineHeight: 1.2,
        transition: 'opacity .3s, background .3s',
      }}
    >
      {(['top', 'right', 'bottom', 'left'] as const).map((p) => (
        <Handle key={p} type="source" id={p} position={p === 'top' ? Position.Top : p === 'right' ? Position.Right : p === 'bottom' ? Position.Bottom : Position.Left} style={handleStyle} />
      ))}
      {d.icon && <Icon name={d.icon} size={(depth <= 1 ? 18 : 14) * (d.big ? 2 : 1)} />}
      {editing ? (
        <input
          autoFocus
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onBlur={() => {
            setEditing(false);
            d.onRename?.(id, txt);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          style={{ fontSize: 12, padding: 2, width: 140 }}
          className="nodrag"
        />
      ) : (
        <span>{d.label || (d.blank ? '· · ·' : '')}</span>
      )}
      {!!d.noteCount && (
        <span title="Notebook notes attached" style={{ fontSize: 10, background: 'var(--gold)', color: 'var(--on-primary)', borderRadius: 8, padding: '0 5px' }}>
          ✎{d.noteCount}
        </span>
      )}
    </div>
  );
});

export const nodeTypes = { scholar: ScholarNode };

export function treeToFlow(tree: TreeNode, layout: 'radial' | 'horizontal' = 'radial', opts: { ring?: number; first?: number } = {}) {
  const placed = layout === 'radial' ? radialLayout(tree, opts.ring ?? 210, opts.first ?? 230) : horizontalLayout(tree);
  const nodes: Node<ScholarData>[] = placed.map((p) => ({
    id: p.id,
    type: 'scholar',
    position: { x: p.x, y: p.y },
    data: { label: p.label, depth: p.depth, ...(p.data ?? {}) } as ScholarData,
    origin: [0.5, 0.5],
  }));
  const edges: Edge[] = edgesOf(tree).map(([s, t]) => ({
    id: `${s}-${t}`,
    source: s,
    target: t,
    type: layout === 'radial' ? 'straight' : 'smoothstep',
    style: { stroke: 'var(--gold)', strokeWidth: 1.4 },
    ...(layout === 'radial' ? {} : { sourceHandle: 'right', targetHandle: 'left' }),
  }));
  return { nodes, edges };
}

/** Fix radial edges to connect the nearest handles. */
export function pickHandles(nodes: Node[], edges: Edge[]): Edge[] {
  const pos = new Map(nodes.map((n) => [n.id, n.position]));
  return edges.map((e) => {
    if (e.sourceHandle && e.targetHandle) return e;
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) return e;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const horiz = Math.abs(dx) > Math.abs(dy) * 1.2;
    return {
      ...e,
      sourceHandle: horiz ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'bottom' : 'top',
      targetHandle: horiz ? (dx > 0 ? 'left' : 'right') : dy > 0 ? 'top' : 'bottom',
    };
  });
}

/** Static concept mind map (lesson "big picture"), pannable & zoomable, drawing itself in. */
export function ConceptMindMap({ tree, height = 420, layout = 'radial' }: { tree: TreeNode; height?: number; layout?: 'radial' | 'horizontal' }) {
  const { nodes: n0, edges: e0 } = useMemo(() => treeToFlow(tree, layout, { ring: 150, first: 170 }), [tree, layout]);
  const [shown, setShown] = useState(1);
  useEffect(() => {
    setShown(1);
    const total = n0.length;
    const t = setInterval(() => setShown((s) => (s >= total ? s : s + 1)), 120);
    return () => clearInterval(t);
  }, [n0]);
  const order = useMemo(() => {
    const depth = new Map(n0.map((n) => [n.id, (n.data as ScholarData).depth ?? 0]));
    return n0.slice().sort((a, b) => (depth.get(a.id)! - depth.get(b.id)!));
  }, [n0]);
  const visible = new Set(order.slice(0, shown).map((n) => n.id));
  const nodes = n0.map((n) => ({ ...n, draggable: false, style: { opacity: visible.has(n.id) ? 1 : 0, transition: 'opacity .45s ease-out' } }));
  const edges = pickHandles(n0, e0).map((e) => ({ ...e, style: { ...e.style, opacity: visible.has(e.source) && visible.has(e.target) ? 1 : 0, transition: 'opacity .45s' } }));
  return (
    <div style={{ height, border: '1px solid var(--rule)', borderRadius: 8, background: 'var(--paper)' }} className="hide-handles">
      <ReactFlowProvider>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} connectionMode={ConnectionMode.Loose} fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.2} maxZoom={2} nodesConnectable={false} proOptions={{ hideAttribution: true }}>
          <Background variant={BackgroundVariant.Lines} gap={28} color="var(--texture-line)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}

// ── Grading helpers ─────────────────────────────────────────

export function labelSimilarity(a: string, b: string): number {
  const ta = new Set(tokens(a).map(stem));
  const tb = new Set(tokens(b).map(stem));
  if (!ta.size || !tb.size) return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
  let inter = 0;
  ta.forEach((t) => tb.has(t) && inter++);
  return inter / Math.max(ta.size, tb.size);
}

export interface MapGrade {
  score: number; // 0–100
  placements: { correct: number; total: number };
  links: { correct: number; total: number; missing: [string, string][]; extra: [string, string][] };
  missingLabels: string[];
}

/**
 * Build-a-Map: blank nodes at the master positions + a term bank.
 * The learner drags (or taps) terms into nodes and draws connections.
 */
export function BuildAMap({ tree, height = 460, onGraded, blankCanvas = false }: { tree: TreeNode; height?: number; onGraded?: (g: MapGrade) => void; blankCanvas?: boolean }) {
  return (
    <ReactFlowProvider>
      {blankCanvas ? <BlankCanvasInner tree={tree} height={height} onGraded={onGraded} /> : <BuildInner tree={tree} height={height} onGraded={onGraded} />}
    </ReactFlowProvider>
  );
}

function BuildInner({ tree, height, onGraded }: { tree: TreeNode; height: number; onGraded?: (g: MapGrade) => void }) {
  const master = useMemo(() => flatten(tree), [tree]);
  const masterLabel = useMemo(() => new Map(master.map((n) => [n.id, n.label])), [master]);
  const masterEdges = useMemo(() => edgesOf(tree), [tree]);
  const { nodes: base } = useMemo(() => treeToFlow(tree, 'radial', { ring: 160, first: 180 }), [tree]);
  const [assign, setAssign] = useState<Record<string, string>>({ [tree.id]: tree.label });
  const [bank, setBank] = useState<string[]>(() => shuffle(master.filter((n) => n.id !== tree.id).map((n) => n.label)));
  const [picked, setPicked] = useState<string | null>(null);
  const [graded, setGraded] = useState<MapGrade | null>(null);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const place = useCallback(
    (nodeId: string, term: string) => {
      if (nodeId === tree.id) return;
      setAssign((a) => {
        const next = { ...a };
        // return displaced term to bank
        const prev = next[nodeId];
        // remove term from any other node
        for (const k of Object.keys(next)) if (next[k] === term && k !== tree.id) delete next[k];
        next[nodeId] = term;
        setBank((b) => {
          let nb = b.filter((t) => t !== term);
          if (prev && prev !== term) nb = [...nb, prev];
          return nb;
        });
        return next;
      });
      setPicked(null);
      setGraded(null);
    },
    [tree.id],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ScholarData>>(base);
  useEffect(() => {
    setNodes((ns) =>
      ns.map((n) => {
        const label = assign[n.id] ?? '';
        let status: ScholarData['status'];
        if (graded && n.id !== tree.id) status = label && label === masterLabel.get(n.id) ? 'correct' : 'wrong';
        return { ...n, data: { ...n.data, label, blank: n.id !== tree.id, onDropTerm: place, status } };
      }),
    );
  }, [assign, graded, place, setNodes, masterLabel, tree.id]);

  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge({ ...c, type: 'straight', style: { stroke: 'var(--ink-soft)', strokeWidth: 1.6 } }, es)), [setEdges]);

  const grade = () => {
    const total = master.length - 1;
    let correct = 0;
    for (const n of master) if (n.id !== tree.id && assign[n.id] === n.label) correct++;
    // links compared by LABEL pairs (undirected)
    const lab = (id: string) => assign[id] ?? '';
    const userPairs = edges.map((e) => [lab(e.source), lab(e.target)] as [string, string]).filter(([a, b]) => a && b);
    const masterPairs = masterEdges.map(([s, t]) => [masterLabel.get(s)!, masterLabel.get(t)!] as [string, string]);
    const same = (p: [string, string], q: [string, string]) => (p[0] === q[0] && p[1] === q[1]) || (p[0] === q[1] && p[1] === q[0]);
    const okLinks = masterPairs.filter((m) => userPairs.some((u) => same(u, m)));
    const missing = masterPairs.filter((m) => !userPairs.some((u) => same(u, m)));
    const extra = userPairs.filter((u) => !masterPairs.some((m) => same(u, m)));
    const score = Math.round(((correct + okLinks.length) / (total + masterPairs.length)) * 100 - extra.length * 2);
    const g: MapGrade = { score: Math.max(0, score), placements: { correct, total }, links: { correct: okLinks.length, total: masterPairs.length, missing, extra }, missingLabels: master.filter((n) => assign[n.id] !== n.label && n.id !== tree.id).map((n) => n.label) };
    setGraded(g);
    // style edges
    setEdges((es) =>
      es.map((e) => {
        const p: [string, string] = [lab(e.source), lab(e.target)];
        const ok = masterPairs.some((m) => same(p, m));
        return { ...e, style: { stroke: ok ? 'var(--success)' : 'var(--danger)', strokeWidth: 2 } };
      }),
    );
    onGraded?.(g);
  };

  const reveal = () => {
    const full: Record<string, string> = {};
    master.forEach((n) => (full[n.id] = n.label));
    setAssign(full);
    setBank([]);
    setEdges(
      pickHandles(
        nodes,
        masterEdges.map(([s, t]) => ({ id: `m${s}-${t}`, source: s, target: t, type: 'straight', style: { stroke: 'var(--gold)', strokeWidth: 1.6, strokeDasharray: '5 3' } })),
      ),
    );
  };

  return (
    <div className="stack">
      <div className="card sunk" style={{ padding: 10 }}>
        <div className="row" style={{ gap: 6 }}>
          <span className="label" style={{ marginRight: 6 }}>
            term bank
          </span>
          {bank.map((t) => (
            <button
              key={t}
              className={`chip draggable ${picked === t ? 'picked' : ''}`}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', t)}
              onClick={() => setPicked(picked === t ? null : t)}
              title="Drag onto a blank node — or tap, then tap a node"
            >
              {t}
            </button>
          ))}
          {!bank.length && <span className="muted">All terms placed.</span>}
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Drag each term onto a blank node (or tap a term, then tap a node). Then draw connections by dragging from one node's edge-dot to another's.
        </div>
      </div>
      <div style={{ height, border: '1px solid var(--rule)', borderRadius: 8, background: 'var(--paper)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          onNodeClick={(_, n) => picked && place(n.id, picked)}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          deleteKeyCode={['Backspace', 'Delete']}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Lines} gap={28} color="var(--texture-line)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="row">
        <button className="primary" onClick={grade}>
          Grade my map
        </button>
        <button onClick={reveal}>Reveal master map</button>
        {graded && (
          <span className="chip gold">
            Score {graded.score}% · placements {graded.placements.correct}/{graded.placements.total} · links {graded.links.correct}/{graded.links.total}
            {graded.links.extra.length ? ` · ${graded.links.extra.length} extra` : ''}
          </span>
        )}
      </div>
      {graded && graded.links.missing.length > 0 && (
        <div className="muted" style={{ fontSize: 13 }}>
          <b>Missing connections:</b> {graded.links.missing.map(([a, b]) => `${a} — ${b}`).join(' · ')}
        </div>
      )}
    </div>
  );
}

function BlankCanvasInner({ tree, height, onGraded }: { tree: TreeNode; height: number; onGraded?: (g: MapGrade) => void }) {
  const master = useMemo(() => flatten(tree), [tree]);
  const masterEdges = useMemo(() => edgesOf(tree), [tree]);
  const [graded, setGraded] = useState<MapGrade | null>(null);
  return (
    <div className="stack">
      <FreeCanvasInner
        height={height}
        initial={{ nodes: [{ id: 'c0', label: tree.label, x: 0, y: 0 }], edges: [] }}
        onChange={() => setGraded(null)}
        footer={(state) => (
          <div className="row">
            <button
              className="primary"
              onClick={() => {
                // match each master label to the most similar user node label
                const matchOf = new Map<string, string>();
                for (const m of master) {
                  let best: { id: string; s: number } | null = null;
                  for (const u of state.nodes) {
                    const s = labelSimilarity(m.label, u.label);
                    if (s >= 0.5 && (!best || s > best.s)) best = { id: u.id, s };
                  }
                  if (best) matchOf.set(m.id, best.id);
                }
                const placements = { correct: matchOf.size, total: master.length };
                const ok = masterEdges.filter(([s, t]) => {
                  const a = matchOf.get(s);
                  const b = matchOf.get(t);
                  return a && b && state.edges.some((e) => (e.source === a && e.target === b) || (e.source === b && e.target === a));
                });
                const missingLabels = master.filter((m) => !matchOf.has(m.id)).map((m) => m.label);
                const g: MapGrade = {
                  score: Math.round(((placements.correct + ok.length) / (placements.total + masterEdges.length)) * 100),
                  placements,
                  links: { correct: ok.length, total: masterEdges.length, missing: [], extra: [] },
                  missingLabels,
                };
                setGraded(g);
                onGraded?.(g);
              }}
            >
              Compare with the master map
            </button>
            {graded && (
              <span className="chip gold">
                Coverage {graded.placements.correct}/{graded.placements.total} concepts · {graded.links.correct}/{graded.links.total} connections · {graded.score}%
              </span>
            )}
          </div>
        )}
      />
      {graded && graded.missingLabels.length > 0 && (
        <div className="card sunk" style={{ fontSize: 14 }}>
          <b>Not yet on your map:</b> {graded.missingLabels.join(' · ')}
        </div>
      )}
    </div>
  );
}

// ── Free canvas (Blank Canvas, My Notebook, writing pre-write) ──

export interface FreeMapState {
  nodes: { id: string; label: string; x: number; y: number; kind?: string }[];
  edges: { id: string; source: string; target: string }[];
}

export function FreeCanvas(props: { initial: FreeMapState; onChange?: (s: FreeMapState) => void; height?: number; kinds?: { id: string; label: string; color: string }[] }) {
  return (
    <ReactFlowProvider>
      <FreeCanvasInner {...props} height={props.height ?? 460} />
    </ReactFlowProvider>
  );
}

function FreeCanvasInner({ initial, onChange, height, footer, kinds }: { initial: FreeMapState; onChange?: (s: FreeMapState) => void; height: number; footer?: (s: FreeMapState) => React.ReactNode; kinds?: { id: string; label: string; color: string }[] }) {
  const toFlow = (s: FreeMapState) =>
    s.nodes.map(
      (n, i): Node<ScholarData> => ({
        id: n.id,
        type: 'scholar',
        position: { x: n.x, y: n.y },
        data: { label: n.label, depth: i === 0 ? 1 : 2, editable: true, kind: n.kind },
        style: n.kind && kinds ? { ['--kind' as string]: kinds.find((k) => k.id === n.kind)?.color } : undefined,
      }),
    );
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ScholarData>>(toFlow(initial));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges.map((e) => ({ ...e, type: 'straight', style: { stroke: 'var(--gold)', strokeWidth: 1.5 } })));
  const [newLabel, setNewLabel] = useState('');
  const [kind, setKind] = useState(kinds?.[0]?.id ?? '');

  const state = (): FreeMapState => ({
    nodes: nodes.map((n) => ({ id: n.id, label: (n.data as ScholarData).label, x: n.position.x, y: n.position.y, kind: (n.data as ScholarData).kind })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  });
  useEffect(() => {
    onChange?.(state());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const rename = useCallback(
    (id: string, label: string) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n))),
    [setNodes],
  );
  useEffect(() => {
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, onRename: rename, editable: true } })));
  }, [rename, setNodes]);

  const add = () => {
    const label = newLabel.trim() || 'New idea';
    const id = 'u' + Math.random().toString(36).slice(2, 8);
    const angle = Math.random() * Math.PI * 2;
    const kindColor = kinds?.find((k) => k.id === kind);
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: 'scholar',
        position: { x: Math.cos(angle) * 220 + (Math.random() - 0.5) * 60, y: Math.sin(angle) * 160 },
        data: { label: kindColor ? `${label}` : label, depth: 2, editable: true, onRename: rename, kind: kind || undefined, icon: undefined },
      },
    ]);
    setNewLabel('');
  };
  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge({ ...c, type: 'straight', style: { stroke: 'var(--gold)', strokeWidth: 1.5 } }, es)), [setEdges]);

  return (
    <div className="stack">
      <div className="row">
        <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Add a node…" style={{ maxWidth: 280 }} onKeyDown={(e) => e.key === 'Enter' && add()} />
        {kinds && (
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ maxWidth: 200 }}>
            {kinds.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        )}
        <button onClick={add}>
          <Icon name="plus" size={14} /> Add node
        </button>
        <span className="muted" style={{ fontSize: 12 }}>
          Double-click a node to rename · drag between dots to connect · select + Delete to remove
        </span>
      </div>
      <div style={{ height, border: '1px solid var(--rule)', borderRadius: 8, background: 'var(--paper)' }}>
        <ReactFlow
          nodes={nodes.map((n) => {
            const k = kinds?.find((x) => x.id === (n.data as ScholarData).kind);
            return k ? { ...n, data: { ...n.data, label: (n.data as ScholarData).label }, style: { borderRadius: 8, boxShadow: `0 0 0 3px ${k.color}` } } : n;
          })}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.4, maxZoom: 1.1 }}
          deleteKeyCode={['Backspace', 'Delete']}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Lines} gap={28} color="var(--texture-line)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {footer?.(state())}
    </div>
  );
}
