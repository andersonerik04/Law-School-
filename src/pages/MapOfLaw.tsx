import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, ConnectionMode, useReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore } from '../lib/store';
import { CONCEPTS, CONCEPT_BY_ID } from '../lib/content';
import { allMastery, currentWeek, introducedConcepts, RANKS } from '../lib/mastery';
import { radialLayout, type TreeNode } from '../visuals/mindLayout';
import { nodeTypes, pickHandles, type ScholarData } from '../visuals/MindMap';
import { MasteryLegend, MethodNote, RankBadge } from '../components/common';
import { Icon } from '../visuals/Icon';
import type { Concept } from '../lib/types';

function buildTree(collapsed: Set<string>): TreeNode {
  const kids = (id: string): TreeNode[] =>
    collapsed.has(id)
      ? []
      : CONCEPTS.filter((c) => c.parent === id).map((c) => ({ id: c.id, label: c.label, children: kids(c.id), data: { icon: c.icon, kind: c.kind } }));
  return { id: 'lsat', label: 'THE LSAT', children: kids('lsat'), data: { icon: 'emblem', kind: 'root' } };
}

function MapInner() {
  const nav = useNavigate();
  const attempts = useStore((s) => s.attempts);
  const lessons = useStore((s) => s.lessons);
  const srs = useStore((s) => s.srs);
  const notebook = useStore((s) => s.notebook);
  const profile = useStore((s) => s.profile);
  const homeView = useStore((s) => s.settings.homeView);
  const setSettings = useStore((s) => s.setSettings);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(CONCEPTS.filter((c) => c.kind === 'group').map((c) => c.id)));
  const [showLinks, setShowLinks] = useState(true);
  const [syllabus, setSyllabus] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const mastery = useMemo(() => allMastery(attempts, lessons, srs), [attempts, lessons, srs]);
  const rf = useReactFlow();
  useEffect(() => {
    const t = setTimeout(() => rf.fitView({ padding: 0.08, duration: 500 }), 60);
    return () => clearTimeout(t);
  }, [collapsed, rf]);
  const week = currentWeek(profile.startDate, profile.planWeeks);
  const introduced = useMemo(() => introducedConcepts(week), [week]);

  const { nodes, edges } = useMemo(() => {
    const tree = buildTree(collapsed);
    const countLeaves = (t: TreeNode): number => (t.children?.length ? t.children.reduce((a, c) => a + countLeaves(c), 0) : 1);
    const L = countLeaves(tree);
    const outer = Math.max(900, (L * 300) / (2 * Math.PI * 1.3));
    const depthOf = (t: TreeNode, d = 0): number => (t.children?.length ? Math.max(...t.children.map((c) => depthOf(c, d + 1))) : d);
    const md = Math.max(1, depthOf(tree));
    const first = md === 1 ? outer : outer * 0.42;
    const placed = radialLayout(tree, md > 1 ? (outer - first) / (md - 1) : 0, first, { outerLeaves: true, sx: 1.3, sy: 0.92 });
    const notes = (id: string) => notebook.filter((n) => n.nodeId === id).length;
    const ns: Node<ScholarData>[] = placed.map((p) => {
      const c = CONCEPT_BY_ID[p.id];
      const lvl = mastery[p.id]?.level ?? 0;
      const hasKids = CONCEPTS.some((x) => x.parent === p.id);
      return {
        id: p.id,
        type: 'scholar',
        position: { x: p.x, y: p.y },
        origin: [0.5, 0.5],
        draggable: true,
        data: {
          label: (collapsed.has(p.id) && hasKids ? '⊕ ' : '') + p.label,
          depth: p.depth,
          level: p.depth >= 1 ? lvl : undefined,
          icon: c?.icon,
          noteCount: notes(p.id),
          big: true,
          dim: syllabus && p.depth >= 2 && !introduced.has(p.id) && !['group', 'branch'].includes(c?.kind ?? ''),
        },
      };
    });
    let es: Edge[] = placed
      .filter((p) => p.parent)
      .map((p) => ({ id: `t-${p.parent}-${p.id}`, source: p.parent!, target: p.id, type: 'straight', style: { stroke: 'var(--gold)', strokeWidth: p.depth <= 1 ? 2.2 : 1.2 } }));
    if (showLinks) {
      const ids = new Set(placed.map((p) => p.id));
      const seen = new Set<string>();
      for (const c of CONCEPTS) {
        for (const l of c.links ?? []) {
          if (!ids.has(c.id) || !ids.has(l)) continue;
          const k = [c.id, l].sort().join('|');
          if (seen.has(k) || CONCEPT_BY_ID[l]?.parent === c.id || c.parent === l) continue;
          seen.add(k);
          es.push({ id: `x-${k}`, source: c.id, target: l, type: 'default', style: { stroke: 'var(--gold)', strokeWidth: 1, strokeDasharray: '3 5', opacity: 0.55 } });
        }
      }
    }
    es = pickHandles(ns, es);
    return { nodes: ns, edges: es };
  }, [collapsed, mastery, showLinks, syllabus, introduced, notebook]);

  const sel: Concept | undefined = selected ? CONCEPT_BY_ID[selected] : undefined;
  const m = selected ? mastery[selected] : undefined;
  const toggle = (id: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const groups = CONCEPTS.filter((c) => c.kind === 'group' || c.kind === 'branch').map((c) => c.id);
  const counts = RANKS.map((_, i) => Object.entries(mastery).filter(([id, x]) => x.level === i && !['group', 'branch', 'root'].includes(CONCEPT_BY_ID[id]?.kind ?? '')).length);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: sel ? '1fr 340px' : '1fr', gap: 14, height: 'calc(100vh - 110px)' }}>
      <div className="card flat" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
        <div className="row" style={{ position: 'absolute', zIndex: 5, top: 10, left: 12, right: 12, justifyContent: 'space-between', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', background: 'color-mix(in srgb, var(--paper) 88%, transparent)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--rule)' }}>
            <div className="label">the map of the law</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Week {week} · {counts.slice(1).reduce((a, b) => a + b, 0)} of {counts.reduce((a, b) => a + b, 0)} doctrines briefed · {counts[5]} certified
            </div>
          </div>
          <div className="row" style={{ pointerEvents: 'auto', background: 'color-mix(in srgb, var(--paper) 88%, transparent)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--rule)' }}>
            <label className="row" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={showLinks} onChange={(e) => setShowLinks(e.target.checked)} /> Cross-links
            </label>
            <label className="row" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={syllabus} onChange={(e) => setSyllabus(e.target.checked)} /> Syllabus to date
            </label>
            <button className="small" onClick={() => setCollapsed(new Set(groups.filter((g) => CONCEPT_BY_ID[g].kind === 'group')))}>
              Collapse
            </button>
            <button className="small" onClick={() => setCollapsed(new Set())}>
              Expand
            </button>
            <button className="small gold" onClick={() => setSettings({ homeView: homeView === 'map' ? 'docket' : 'map' })} title="Choose the home screen">
              {homeView === 'map' ? '★ Home view' : '☆ Make home'}
            </button>
          </div>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          nodesConnectable={false}
          onNodeClick={(_, n) => {
            setSelected(n.id);
            if (collapsed.has(n.id)) toggle(n.id);
          }}
          onNodeDoubleClick={(_, n) => toggle(n.id)}
          fitView
          fitViewOptions={{ padding: 0.08 }}
          minZoom={0.08}
          maxZoom={2.2}
          proOptions={{ hideAttribution: true }}
          className="hide-handles"
        >
          <Background variant={BackgroundVariant.Lines} gap={34} color="var(--texture-line)" />
          <Controls showInteractive={false} />
        </ReactFlow>
        <div style={{ position: 'absolute', bottom: 10, left: 60, zIndex: 5, background: 'color-mix(in srgb, var(--paper) 90%, transparent)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--rule)' }}>
          <MasteryLegend />
          <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
            Click a node for its record · double-click to fold/unfold · dotted gold = related doctrines
          </div>
        </div>
      </div>
      {sel && (
        <aside className="card page-turn" style={{ overflow: 'auto' }}>
          <div className="row between">
            <div className="row">
              <Icon name={sel.icon} size={26} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0 }}>{sel.label}</h3>
            </div>
            <button className="ghost small" onClick={() => setSelected(null)} aria-label="Close">
              <Icon name="x" size={14} />
            </button>
          </div>
          {sel.chapter && <div className="label" style={{ marginTop: 4 }}>{sel.chapter}</div>}
          <p className="book" style={{ fontSize: 15.5 }}>
            {sel.oneLiner}
          </p>
          {m && (
            <div className="card sunk stack tight" style={{ padding: 10 }}>
              <div className="row between">
                <RankBadge level={m.level} />
                {m.decayed > 0 && <span className="chip danger">−{m.decayed} for neglect · review!</span>}
              </div>
              <div style={{ fontSize: 13 }}>
                Attempts: <b>{m.n}</b> · Recent accuracy: <b>{m.accuracy === null ? '—' : Math.round(m.accuracy * 100) + '%'}</b>
              </div>
              <div style={{ fontSize: 13 }}>
                Certification: {m.qualified}/20 qualifying · {m.qualifiedAcc === null ? '—' : Math.round(m.qualifiedAcc * 100) + '%'} (need 85%)
              </div>
            </div>
          )}
          <div className="stack tight" style={{ marginTop: 12 }}>
            {sel.lesson && (
              <button className="primary" onClick={() => nav(`/casebook/${sel.id}`)}>
                <Icon name="book" size={15} /> Open the lesson
              </button>
            )}
            {sel.match && (
              <button onClick={() => nav(`/chambers?concept=${sel.id}`)}>
                <Icon name="gavel" size={15} /> Drill this doctrine
              </button>
            )}
            {sel.card && (
              <button onClick={() => nav(`/bench-cards?c=${sel.id}`)}>
                <Icon name="cards" size={15} /> Bench card
              </button>
            )}
            <button className="ghost" onClick={() => nav(`/notebook?node=${sel.id}`)}>
              <Icon name="notebook" size={15} /> Notes on this node ({notebook.filter((n) => n.nodeId === sel.id).length})
            </button>
            {CONCEPTS.some((c) => c.parent === sel.id) && (
              <button className="ghost" onClick={() => toggle(sel.id)}>
                {collapsed.has(sel.id) ? 'Unfold branch' : 'Fold branch'}
              </button>
            )}
          </div>
          {(sel.links?.length ?? 0) > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="label">related doctrines</div>
              <div className="row" style={{ gap: 6, marginTop: 4 }}>
                {sel.links!.map((l) => (
                  <button key={l} className="chip" onClick={() => setSelected(l)}>
                    {CONCEPT_BY_ID[l]?.label ?? l}
                  </button>
                ))}
              </div>
            </div>
          )}
          <MethodNote id="visual" />
        </aside>
      )}
    </div>
  );
}

export default function MapOfLaw() {
  return (
    <ReactFlowProvider>
      <MapInner />
    </ReactFlowProvider>
  );
}
