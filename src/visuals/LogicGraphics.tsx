import { useEffect, useId, useState } from 'react';
import type { Lit, Cond, QStatement } from '../lib/logic';
import { negate, symLit, validInferences, litEq, fallacies, showQ } from '../lib/logic';
import { ArrowDefs, SvgLines, wrap } from './svgText';

/* ─────────────────────────────────────────────────────────────
   Arrow chain with animated contrapositive ("flip and negate").
   ───────────────────────────────────────────────────────────── */
export function ArrowChain({ chain, contra: contraProp, interactive = true, labels }: { chain: Lit[]; contra?: boolean; interactive?: boolean; labels?: boolean }) {
  const rid = useId().replace(/:/g, '');
  const [contra, setContra] = useState(!!contraProp);
  const [phase, setPhase] = useState(0); // 0 original, 1 flipped, 2 negated
  useEffect(() => {
    if (!contra) {
      setPhase(0);
      return;
    }
    setPhase(1);
    const t = setTimeout(() => setPhase(2), 650);
    return () => clearTimeout(t);
  }, [contra]);
  useEffect(() => setContra(!!contraProp), [contraProp]);

  const n = chain.length;
  const W = Math.max(420, n * 170);
  const nodeW = 130;
  const gap = (W - n * nodeW) / (n + 1);
  const xs = chain.map((_, i) => gap + i * (nodeW + gap));
  // position of item i in flipped order
  const order = phase === 0 ? chain.map((_, i) => i) : chain.map((_, i) => n - 1 - i);
  const shown = (l: Lit) => (phase === 2 ? negate(l) : l);

  return (
    <div>
      <svg viewBox={`0 0 ${W} 96`} width="100%" style={{ maxWidth: W, display: 'block', margin: '0 auto' }} role="img" aria-label="Conditional arrow chain">
        <ArrowDefs id={rid} />
        {chain.slice(0, -1).map((_, i) => (
          <path key={'a' + i} d={`M${xs[i] + nodeW + 4},48 L${xs[i + 1] - 6},48`} stroke={phase === 2 ? 'var(--primary)' : 'var(--gold)'} strokeWidth={2} markerEnd={`url(#${rid}-${phase === 2 ? 'primary' : 'gold'})`} />
        ))}
        {chain.map((l, i) => {
          const slot = order[i];
          const s = shown(l);
          return (
            <g key={i} style={{ transform: `translateX(${xs[slot] - xs[i]}px)`, transition: 'transform 0.6s cubic-bezier(.6,.05,.3,1)' }}>
              <rect x={xs[i]} y={28} width={nodeW} height={40} rx={20} fill={s.neg ? 'var(--primary-soft)' : 'var(--paper-2)'} stroke={s.neg ? 'var(--primary)' : 'var(--gold)'} strokeWidth={1.6} style={{ transition: 'fill .3s' }} />
              <SvgLines x={xs[i] + nodeW / 2} y={s.v.length > 16 ? 45 : 52} lines={wrap(symLit(s), 17, 2)} size={13} lh={14} font="var(--font-ui)" weight={600} />
            </g>
          );
        })}
        {labels && (
          <>
            <text x={xs[0] + nodeW / 2} y={20} textAnchor="middle" fontSize={9} letterSpacing="0.14em" fill="var(--muted)" fontFamily="var(--font-ui)">
              SUFFICIENT
            </text>
            <text x={xs[n - 1] + nodeW / 2} y={20} textAnchor="middle" fontSize={9} letterSpacing="0.14em" fill="var(--muted)" fontFamily="var(--font-ui)">
              NECESSARY
            </text>
          </>
        )}
      </svg>
      {interactive && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 6 }}>
          <button className="small gold" onClick={() => setContra((c) => !c)}>
            {contra ? '↺ Show original' : '⇄ Flip & negate (contrapositive)'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Venn diagrams for quantifiers (2 or 3 sets).
   Shaded regions are EMPTY; ✕ marks mean "at least one here".
   ───────────────────────────────────────────────────────────── */
type Region = string; // e.g. "A", "AB", "B", "ABC", "AC" — letters present = sets the region is inside

export interface VennSpec {
  sets: string[]; // 2 or 3 labels
  empty?: Region[];
  some?: { region: Region | Region[]; label?: string }[];
}

/** Build a Venn spec from quantified statements over the given set labels. */
export function vennFromStatements(sets: string[], statements: QStatement[]): VennSpec {
  const letters = ['A', 'B', 'C'].slice(0, sets.length);
  const letterOf = (name: string) => letters[sets.indexOf(name)];
  const all: Region[] = [];
  const n = sets.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    all.push(letters.filter((_, i) => mask & (1 << i)).join(''));
  }
  const empty = new Set<Region>();
  const some: VennSpec['some'] = [];
  for (const s of statements) {
    const a = letterOf(s.a);
    const b = letterOf(s.b);
    if (!a || !b) continue;
    if (s.q === 'all') all.filter((r) => r.includes(a) && !r.includes(b)).forEach((r) => empty.add(r));
    if (s.q === 'none') all.filter((r) => r.includes(a) && r.includes(b)).forEach((r) => empty.add(r));
  }
  for (const s of statements) {
    const a = letterOf(s.a);
    const b = letterOf(s.b);
    if (!a || !b) continue;
    if (s.q === 'some' || s.q === 'most') {
      const regs = all.filter((r) => r.includes(a) && r.includes(b) && !empty.has(r));
      some.push({ region: regs, label: s.q === 'most' ? 'most' : undefined });
    }
    if (s.q === 'some-not') {
      const regs = all.filter((r) => r.includes(a) && !r.includes(b) && !empty.has(r));
      some.push({ region: regs });
    }
  }
  return { sets, empty: [...empty], some };
}

export function Venn({ spec, size = 320, caption }: { spec: VennSpec; size?: number; caption?: string }) {
  const rid = useId().replace(/:/g, '');
  const three = spec.sets.length === 3;
  const r = three ? 78 : 88;
  const centers: Record<string, [number, number]> = three
    ? { A: [130, 110], B: [210, 110], C: [170, 180] }
    : { A: [125, 125], B: [215, 125] };
  const letters = Object.keys(centers);
  const H = three ? 280 : 250;
  const W = 340;

  // centroid helper for placing ✕ marks
  const regionPoint = (reg: Region): [number, number] => {
    if (!three) {
      if (reg === 'A') return [85, 125];
      if (reg === 'B') return [255, 125];
      return [170, 125];
    }
    const pts: Record<string, [number, number]> = {
      A: [100, 92],
      B: [240, 92],
      C: [170, 222],
      AB: [170, 82],
      AC: [128, 165],
      BC: [212, 165],
      ABC: [170, 135],
    };
    return pts[reg] ?? [170, 135];
  };
  const regionShape = (reg: Region, fill: string, k: string) => {
    const inside = reg.split('');
    const outside = letters.filter((l) => !inside.includes(l));
    // nested clipping for intersection; mask for subtraction
    let el = (
      <rect x={0} y={0} width={W} height={H} fill={fill} mask={outside.length ? `url(#${rid}-out-${outside.join('')})` : undefined} />
    );
    for (const l of inside) {
      el = <g clipPath={`url(#${rid}-clip-${l})`}>{el}</g>;
    }
    return <g key={k}>{el}</g>;
  };
  const outsideCombos = new Set<string>();
  for (const reg of [...(spec.empty ?? []), ...(spec.some ?? []).flatMap((s) => (Array.isArray(s.region) ? s.region : [s.region]))]) {
    const outside = letters.filter((l) => !reg.includes(l));
    if (outside.length) outsideCombos.add(outside.join(''));
  }

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: size, display: 'block', margin: '0 auto' }} role="img" aria-label="Venn diagram">
        <defs>
          {letters.map((l) => (
            <clipPath key={l} id={`${rid}-clip-${l}`}>
              <circle cx={centers[l][0]} cy={centers[l][1]} r={r} />
            </clipPath>
          ))}
          {[...outsideCombos].map((combo) => (
            <mask key={combo} id={`${rid}-out-${combo}`}>
              <rect x={0} y={0} width={W} height={H} fill="white" />
              {combo.split('').map((l) => (
                <circle key={l} cx={centers[l][0]} cy={centers[l][1]} r={r} fill="black" />
              ))}
            </mask>
          ))}
          <pattern id={`${rid}-shade`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="var(--paper-sunk)" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--primary)" strokeWidth="2" opacity="0.55" />
          </pattern>
        </defs>
        {(spec.empty ?? []).map((reg, i) => regionShape(reg, `url(#${rid}-shade)`, 'e' + i))}
        {letters.map((l, i) => (
          <circle key={l} cx={centers[l][0]} cy={centers[l][1]} r={r} fill="none" stroke={i === 0 ? 'var(--primary)' : i === 1 ? 'var(--gold)' : 'var(--secondary)'} strokeWidth={2} />
        ))}
        {letters.map((l, i) => {
          const [cx, cy] = centers[l];
          const lx = three ? (l === 'A' ? cx - 70 : l === 'B' ? cx + 70 : cx) : l === 'A' ? cx - 52 : cx + 52;
          const ly = three ? (l === 'C' ? cy + r + 18 : cy - r + 4) : cy - r - 8;
          return (
            <text key={l} x={lx} y={ly} textAnchor="middle" fontFamily="var(--font-display)" fontWeight={700} fontSize={16} fill="var(--ink)">
              {spec.sets[i]}
            </text>
          );
        })}
        {(spec.some ?? []).map((s, i) => {
          const regs = Array.isArray(s.region) ? s.region : [s.region];
          if (!regs.length) return null;
          if (regs.length === 1) {
            const [x, y] = regionPoint(regs[0]);
            return (
              <g key={'x' + i}>
                <text x={x} y={y + 7} textAnchor="middle" fontSize={22} fontWeight={700} fill="var(--danger)" fontFamily="var(--font-ui)">
                  ✕
                </text>
                {s.label && (
                  <text x={x} y={y + 22} textAnchor="middle" fontSize={10} fill="var(--danger)" fontFamily="var(--font-ui)" fontStyle="italic">
                    {s.label}
                  </text>
                )}
              </g>
            );
          }
          // ✕ on the boundary between candidate regions (we know one of them is occupied, not which)
          const pts = regs.map(regionPoint);
          const x = pts.reduce((a, p) => a + p[0], 0) / pts.length;
          const y = pts.reduce((a, p) => a + p[1], 0) / pts.length;
          return (
            <g key={'x' + i}>
              <path d={`M${pts[0][0]},${pts[0][1]} ${pts.slice(1).map((p) => `L${p[0]},${p[1]}`).join(' ')}`} stroke="var(--danger)" strokeWidth={1} strokeDasharray="2 2" fill="none" />
              <text x={x} y={y + 7} textAnchor="middle" fontSize={20} fontWeight={700} fill="var(--danger)" fontFamily="var(--font-ui)">
                ✕
              </text>
              <text x={x} y={y + 21} textAnchor="middle" fontSize={9} fill="var(--danger)" fontFamily="var(--font-ui)" fontStyle="italic">
                {s.label ? s.label + ' · ' : ''}on the line
              </text>
            </g>
          );
        })}
      </svg>
      {caption && <figcaption style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', fontFamily: 'var(--font-book)' }}>{caption}</figcaption>}
      <div className="row" style={{ justifyContent: 'center', gap: 14, fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
        <span>
          <svg width="14" height="10">
            <rect width="14" height="10" fill="var(--primary-soft)" stroke="var(--primary)" />
          </svg>{' '}
          shaded = empty
        </span>
        <span style={{ color: 'var(--danger)' }}>✕ = at least one</span>
      </div>
    </figure>
  );
}

/** Convenience: a Venn of quantified statements with captions. */
export function QuantVenn({ sets, statements, size }: { sets: string[]; statements: QStatement[]; size?: number }) {
  return <Venn spec={vennFromStatements(sets, statements)} size={size} caption={statements.map(showQ).join('  ·  ')} />;
}

/* ─────────────────────────────────────────────────────────────
   Logic circuit — 3–5 chained conditionals. Valid inferences light
   up gold; tempting invalid inferences are shown as broken red arcs.
   ───────────────────────────────────────────────────────────── */
export function LogicCircuit({ conds, query, showInvalid = true }: { conds: Cond[]; query?: Cond | null; showInvalid?: boolean }) {
  const rid = useId().replace(/:/g, '');
  // order literals along the chain (topological from the first sufficient condition)
  const order: Lit[] = [];
  const pushL = (l: Lit) => {
    if (!order.some((x) => litEq(x, l))) order.push(l);
  };
  // build a linear-ish order by following links
  const remaining = conds.slice();
  let cur: Lit | undefined = remaining.find((c) => !remaining.some((d) => litEq(d.b, c.a)))?.a ?? remaining[0]?.a;
  while (cur) {
    pushL(cur);
    const nextIdx: number = remaining.findIndex((c) => litEq(c.a, cur!));
    if (nextIdx < 0) break;
    const nx: Cond = remaining.splice(nextIdx, 1)[0];
    cur = nx.b;
  }
  remaining.forEach((c) => {
    pushL(c.a);
    pushL(c.b);
  });
  const n = order.length;
  const W = Math.max(520, n * 140);
  const step = W / (n + 1);
  const xs = order.map((_, i) => step * (i + 1));
  const y1 = 70;
  const y2 = 200;
  const idx = (l: Lit) => order.findIndex((x) => litEq(x, l));
  const valid = validInferences(conds).filter((v) => idx(v.a) >= 0 && idx(v.b) >= 0 && !conds.some((c) => litEq(c.a, v.a) && litEq(c.b, v.b)));
  const qValid = query ? validInferences(conds).some((v) => litEq(v.a, query.a) && litEq(v.b, query.b)) : null;

  return (
    <svg viewBox={`0 0 ${W} 260`} width="100%" style={{ maxWidth: W, display: 'block', margin: '0 auto' }} role="img" aria-label="Logic circuit">
      <ArrowDefs id={rid} />
      <text x={12} y={y1 + 4} fontSize={9} fill="var(--muted)" fontFamily="var(--font-ui)" letterSpacing="0.12em">
        CHAIN
      </text>
      <text x={12} y={y2 + 4} fontSize={9} fill="var(--muted)" fontFamily="var(--font-ui)" letterSpacing="0.12em">
        CONTRA
      </text>
      {/* premises */}
      {conds.map((c, i) => {
        const a = idx(c.a);
        const b = idx(c.b);
        if (a < 0 || b < 0) return null;
        return <path key={'p' + i} d={`M${xs[a] + 36},${y1} L${xs[b] - 40},${y1}`} stroke="var(--ink-soft)" strokeWidth={1.8} markerEnd={`url(#${rid}-ink)`} />;
      })}
      {/* contrapositive wires (reversed, negated) */}
      {conds.map((c, i) => {
        const a = idx(c.a);
        const b = idx(c.b);
        if (a < 0 || b < 0) return null;
        return <path key={'c' + i} d={`M${xs[b] - 36},${y2} L${xs[a] + 40},${y2}`} stroke="var(--primary)" strokeWidth={1.6} markerEnd={`url(#${rid}-primary)`} opacity={0.8} />;
      })}
      {/* valid inference arcs (gold) */}
      {valid
        .filter((v) => !v.a.neg === !order[idx(v.a)]?.neg && idx(v.b) - idx(v.a) > 1)
        .map((v, i) => {
          const a = idx(v.a);
          const b = idx(v.b);
          const lit = query && litEq(query.a, v.a) && litEq(query.b, v.b);
          const h = 22 + (b - a) * 10;
          return <path key={'v' + i} d={`M${xs[a]},${y1 - 30} Q${(xs[a] + xs[b]) / 2},${y1 - 30 - h} ${xs[b]},${y1 - 30}`} fill="none" stroke="var(--gold)" strokeWidth={lit ? 3.2 : 1.4} opacity={lit ? 1 : 0.55} markerEnd={`url(#${rid}-gold)`} className="draw-line" />;
        })}
      {/* invalid tempting moves (red, broken) */}
      {showInvalid &&
        conds.slice(0, 1).flatMap((c) =>
          fallacies(c).slice(0, 1).map((f, i) => {
            const a = idx(c.b);
            const b = idx(c.a);
            if (a < 0 || b < 0) return null;
            return (
              <g key={'f' + i}>
                <path d={`M${xs[a]},${y1 + 30} Q${(xs[a] + xs[b]) / 2},${y1 + 58} ${xs[b]},${y1 + 30}`} fill="none" stroke="var(--danger)" strokeWidth={1.3} strokeDasharray="4 4" markerEnd={`url(#${rid}-red)`} />
                <text x={(xs[a] + xs[b]) / 2} y={y1 + 52} textAnchor="middle" fontSize={9.5} fill="var(--danger)" fontFamily="var(--font-ui)">
                  ✕ reversal — invalid
                </text>
              </g>
            );
          }),
        )}
      {order.map((l, i) => (
        <g key={'n' + i}>
          <circle cx={xs[i]} cy={y1} r={33} fill={query && (litEq(query.a, l) || litEq(query.b, l)) ? 'var(--gold-soft)' : 'var(--paper-2)'} stroke="var(--gold)" strokeWidth={1.6} />
          <SvgLines x={xs[i]} y={y1 + (symLit(l).length > 10 ? -2 : 4)} lines={wrap(symLit(l), 10, 2)} size={10} lh={11} font="var(--font-ui)" weight={600} />
          <circle cx={xs[i]} cy={y2} r={33} fill={query && (litEq(query.a, negate(l)) || litEq(query.b, negate(l))) ? 'var(--gold-soft)' : 'var(--primary-soft)'} stroke="var(--primary)" strokeWidth={1.4} />
          <SvgLines x={xs[i]} y={y2 + (symLit(negate(l)).length > 10 ? -2 : 4)} lines={wrap(symLit(negate(l)), 10, 2)} size={10} lh={11} font="var(--font-ui)" weight={600} />
        </g>
      ))}
      {query && (
        <text x={W / 2} y={250} textAnchor="middle" fontSize={12} fontFamily="var(--font-ui)" fontWeight={700} fill={qValid ? 'var(--gold)' : 'var(--danger)'}>
          {symLit(query.a)} → {symLit(query.b)} : {qValid ? 'VALID — the circuit closes' : 'INVALID — no path through the circuit'}
        </text>
      )}
    </svg>
  );
}
