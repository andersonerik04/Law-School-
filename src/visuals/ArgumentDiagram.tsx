/**
 * Argument Diagram renderer.
 * Premises are boxes; the conclusion is a gold-bordered box at the top; solid arrows
 * show support; dashed lines show counterpoints; a red "gap" marker shows where the
 * assumption lives. Question-type overlays show what each type DOES to the argument.
 *
 * `step` reveals the diagram layer by layer for animated walkthroughs:
 *   1 evidence & context · 2 conclusion(s) · 3 support arrows · 4 the gap · 5 the overlay
 */
import { useId } from 'react';
import type { LRQuestion, Segment } from '../lib/types';
import { wrap, SvgLines, ArrowDefs } from './svgText';

export type Overlay = 'strengthen' | 'weaken' | 'flaw' | 'sa' | 'na' | 'paradox' | 'none';

interface Props {
  q: Pick<LRQuestion, 'stimulus' | 'diagram' | 'type'>;
  step?: number;
  overlay?: Overlay;
  compact?: boolean;
  /** text to display inside the overlay box (e.g. the correct answer) */
  overlayText?: string;
  highlightSeg?: number;
}

const W = 760;
const BOX_W = 214;
const CHARS = 34;
const LH = 15;

function shorten(t: string, n = 150) {
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + ' …' : t;
}

export function overlayForType(type: string): Overlay {
  switch (type) {
    case 'strengthen':
    case 'principle-identify':
      return 'strengthen';
    case 'weaken':
      return 'weaken';
    case 'flaw':
    case 'parallel-flaw':
      return 'flaw';
    case 'sufficient-assumption':
      return 'sa';
    case 'necessary-assumption':
      return 'na';
    case 'paradox':
      return 'paradox';
    default:
      return 'none';
  }
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  seg: Segment;
  idx: number;
}

function layoutRow(items: { seg: Segment; idx: number }[], y: number, maxLines = 6): Box[] {
  const n = items.length;
  if (!n) return [];
  const w = Math.min(BOX_W, (W - 40 - (n - 1) * 16) / n);
  const chars = Math.max(18, Math.floor((w / BOX_W) * CHARS));
  const total = n * w + (n - 1) * 16;
  const x0 = (W - total) / 2;
  return items.map((it, i) => {
    const lines = wrap(shorten(it.seg.t), chars, maxLines);
    return { x: x0 + i * (w + 16), y, w, h: lines.length * LH + 22, lines, seg: it.seg, idx: it.idx };
  });
}

export function ArgumentDiagram({ q, step = 99, overlay, compact, overlayText, highlightSeg }: Props) {
  const rid = useId().replace(/:/g, '');
  const segs = q.stimulus;
  const ov: Overlay = overlay ?? (q.diagram.overlay as Overlay) ?? overlayForType(q.type);
  const speakers = Array.from(new Set(segs.filter((s) => s.s).map((s) => s.s!)));

  if (speakers.length >= 2) return <DialogueDiagram q={q} step={step} rid={rid} />;

  const C = segs.map((seg, idx) => ({ seg, idx })).filter((s) => s.seg.r === 'C');
  const I = segs.map((seg, idx) => ({ seg, idx })).filter((s) => s.seg.r === 'I');
  const Pm = segs.map((seg, idx) => ({ seg, idx })).filter((s) => s.seg.r === 'P');
  const K = segs.map((seg, idx) => ({ seg, idx })).filter((s) => s.seg.r === 'K');
  const X = segs.map((seg, idx) => ({ seg, idx })).filter((s) => s.seg.r === 'X');

  // Non-argument (fact set): MBT / MSS / CBT / paradox
  if (!C.length) return <FactSetDiagram q={q} step={step} rid={rid} ov={ov} highlightSeg={highlightSeg} />;

  let y = 14;
  const ctxBoxes = X.length ? layoutRow(X.slice(0, 3), y, 3) : [];
  if (ctxBoxes.length) y += Math.max(...ctxBoxes.map((b) => b.h)) + 26;
  const conclBoxes = layoutRow(C, y, 5).map((b) => ({ ...b, w: Math.max(b.w, 300), x: (W - Math.max(b.w, 300)) / 2, lines: wrap(shorten(b.seg.t, 170), 48, 5), h: wrap(shorten(b.seg.t, 170), 48, 5).length * LH + 30 }));
  const concl = conclBoxes[0];
  y += concl.h + 52;
  let interBoxes: Box[] = [];
  if (I.length) {
    interBoxes = layoutRow(I, y, 5);
    y += Math.max(...interBoxes.map((b) => b.h)) + 52;
  }
  const premBoxes = layoutRow(Pm, y);
  const premH = premBoxes.length ? Math.max(...premBoxes.map((b) => b.h)) : 0;
  y += premH + 20;
  const kBoxes = K.map((k, i) => {
    const lines = wrap(shorten(k.seg.t, 120), 26, 5);
    return { x: i % 2 === 0 ? 8 : W - 8 - 170, y: concl.y + 4 + Math.floor(i / 2) * 80, w: 170, h: lines.length * LH + 22, lines, seg: k.seg, idx: k.idx };
  });
  const overlayH = ov !== 'none' ? 70 : 0;
  const H = y + overlayH + 10;

  const supportTarget = interBoxes.length ? interBoxes : [concl];
  const conclBottom = { x: concl.x + concl.w / 2, y: concl.y + concl.h };
  const gapPt = { x: conclBottom.x, y: conclBottom.y + 26 };

  const show = (layer: number) => step >= layer;

  const boxEl = (b: Box, kind: 'P' | 'C' | 'I' | 'K' | 'X', layer: number) => {
    if (!show(layer)) return null;
    const stroke = kind === 'C' ? 'var(--gold)' : kind === 'I' ? 'var(--primary)' : kind === 'K' ? 'var(--secondary)' : kind === 'X' ? 'var(--rule)' : 'var(--rule-strong)';
    const fill = kind === 'C' ? 'var(--gold-soft)' : kind === 'X' ? 'var(--paper-sunk)' : 'var(--paper-2)';
    const label = { P: 'PREMISE', C: 'CONCLUSION', I: 'SUB-CONCLUSION', K: 'COUNTERPOINT', X: 'CONTEXT' }[kind];
    const hl = highlightSeg === b.idx;
    return (
      <g key={`${kind}${b.idx}`} className="fade-in">
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill={fill} stroke={hl ? 'var(--primary)' : stroke} strokeWidth={kind === 'C' ? 2 : hl ? 2.2 : 1.1} strokeDasharray={kind === 'K' ? '5 3' : undefined} />
        {kind === 'C' && <rect x={b.x - 4} y={b.y - 4} width={b.w + 8} height={b.h + 8} rx={6} fill="none" stroke="var(--gold)" strokeWidth={0.7} />}
        <text x={b.x + 8} y={b.y + 12} fontSize={8.5} letterSpacing="0.12em" fill={kind === 'C' ? 'var(--gold)' : 'var(--muted)'} fontFamily="var(--font-ui)" fontWeight={600}>
          {label}
        </text>
        <SvgLines x={b.x + b.w / 2} y={b.y + 27} lines={b.lines} size={kind === 'C' ? 13 : 12} lh={LH} weight={kind === 'C' ? 600 : 400} />
      </g>
    );
  };

  const arrow = (x1: number, y1: number, x2: number, y2: number, key: string, color = 'gold', dashed = false, layer = 3) =>
    show(layer) ? (
      <path
        key={key}
        d={`M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`}
        fill="none"
        stroke={color === 'gold' ? 'var(--gold)' : color === 'red' ? 'var(--danger)' : 'var(--ink-soft)'}
        strokeWidth={1.6}
        strokeDasharray={dashed ? '5 4' : undefined}
        markerEnd={`url(#${rid}-${color})`}
        className={dashed ? 'fade-in' : 'draw-line'}
      />
    ) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: compact ? 560 : 860, display: 'block', margin: '0 auto' }} role="img" aria-label="Argument diagram">
      <ArrowDefs id={rid} />
      {ctxBoxes.map((b) => boxEl(b, 'X', 1))}
      {boxEl(concl, 'C', 2)}
      {interBoxes.map((b) => boxEl(b, 'I', 2))}
      {premBoxes.map((b) => boxEl(b, 'P', 1))}
      {kBoxes.map((b) => boxEl(b, 'K', 1))}

      {/* support arrows: premises → intermediate (or conclusion) */}
      {premBoxes.map((p, i) => {
        const t = supportTarget[Math.min(i, supportTarget.length - 1)];
        const tx = t === concl ? gapPt.x + (i - (premBoxes.length - 1) / 2) * 18 : t.x + t.w / 2;
        const ty = t === concl ? gapPt.y + 6 : t.y + t.h;
        return arrow(p.x + p.w / 2, p.y, tx, ty + 2, `pa${i}`);
      })}
      {interBoxes.map((b, i) => arrow(b.x + b.w / 2, b.y, conclBottom.x + (i - (interBoxes.length - 1) / 2) * 18, gapPt.y + 6, `ia${i}`))}
      {/* trunk from gap to conclusion */}
      {show(3) && <path d={`M${gapPt.x},${gapPt.y} L${conclBottom.x},${conclBottom.y + 2}`} stroke="var(--gold)" strokeWidth={2} markerEnd={`url(#${rid}-gold)`} className="draw-line" />}
      {/* counterpoints */}
      {kBoxes.map((k, i) => arrow(k.x + (k.x < W / 2 ? k.w : 0), k.y + k.h / 2, k.x < W / 2 ? concl.x - 2 : concl.x + concl.w + 2, concl.y + concl.h / 2, `ka${i}`, 'ink', true, 3))}

      {/* gap marker */}
      {show(4) && q.diagram.gap && ov !== 'sa' && (
        <g className="fade-in">
          <circle cx={gapPt.x} cy={gapPt.y} r={9} fill="var(--paper)" stroke="var(--danger)" strokeWidth={1.6} strokeDasharray="3 2" />
          <text x={gapPt.x} y={gapPt.y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--danger)" fontFamily="var(--font-ui)">
            ?
          </text>
          <SvgLines x={gapPt.x + 16} y={gapPt.y - 2} anchor="start" lines={wrap('GAP: ' + q.diagram.gap, 46, 2)} size={10.5} lh={13} fill="var(--danger)" font="var(--font-ui)" italic />
        </g>
      )}

      {/* overlays */}
      {show(5) && ov !== 'none' && <OverlayLayer ov={ov} rid={rid} W={W} y={H - overlayH} gapPt={gapPt} concl={concl} text={overlayText} gap={q.diagram.gap} premBoxes={premBoxes} />}
    </svg>
  );
}

function OverlayLayer({ ov, rid, W, y, gapPt, concl, text, gap, premBoxes }: { ov: Overlay; rid: string; W: number; y: number; gapPt: { x: number; y: number }; concl: Box; text?: string; gap?: string; premBoxes: Box[] }) {
  const boxW = 250;
  const bx = W - boxW - 10;
  const by = y + 6;
  const body = (label: string, color: string, msg: string) => (
    <g className="fade-in">
      <rect x={bx} y={by} width={boxW} height={56} rx={4} fill="var(--paper-2)" stroke={color} strokeWidth={1.5} />
      <text x={bx + 8} y={by + 13} fontSize={8.5} letterSpacing="0.12em" fill={color} fontFamily="var(--font-ui)" fontWeight={700}>
        {label}
      </text>
      <SvgLines x={bx + boxW / 2} y={by + 28} lines={wrap(msg, 40, 2)} size={11} lh={13} />
    </g>
  );
  const short = (t?: string) => (t ? (t.length > 80 ? t.slice(0, 78) + '…' : t) : '');
  switch (ov) {
    case 'strengthen':
      return (
        <g>
          {body('STRENGTHEN — ADDS SUPPORT', 'var(--success)', short(text) || 'A new premise that makes the conclusion more likely')}
          <path d={`M${bx},${by + 20} C${gapPt.x + 120},${by} ${gapPt.x + 60},${gapPt.y + 20} ${gapPt.x + 8},${gapPt.y + 4}`} fill="none" stroke="var(--success)" strokeWidth={2} markerEnd={`url(#${rid}-gold)`} className="draw-line" />
          <text x={bx - 16} y={by + 18} fontSize={20} fill="var(--success)" fontWeight={700}>
            +
          </text>
        </g>
      );
    case 'weaken':
      return (
        <g>
          {body('WEAKEN — CUTS THE LINK', 'var(--danger)', short(text) || 'New information that breaks the support for the conclusion')}
          <path d={`M${gapPt.x - 16},${gapPt.y + 2} L${gapPt.x + 16},${gapPt.y - 14}`} stroke="var(--danger)" strokeWidth={3} className="draw-line" />
          <path d={`M${bx},${by + 20} C${gapPt.x + 120},${by} ${gapPt.x + 60},${gapPt.y + 20} ${gapPt.x + 18},${gapPt.y - 4}`} fill="none" stroke="var(--danger)" strokeWidth={1.6} strokeDasharray="4 3" markerEnd={`url(#${rid}-red)`} />
        </g>
      );
    case 'flaw':
      return (
        <g>
          {body('FLAW — THE BROKEN LINK', 'var(--danger)', short(text) || gap || 'The conclusion does not follow from the premises')}
          <path d={`M${gapPt.x - 6},${gapPt.y + 14} l6,-6 l-6,-6 l6,-6 l-6,-6`} fill="none" stroke="var(--danger)" strokeWidth={2.4} />
          {premBoxes.map((p, i) => (
            <rect key={i} x={p.x - 2} y={p.y - 2} width={p.w + 4} height={p.h + 4} rx={5} fill="none" stroke="var(--danger)" strokeWidth={0.8} strokeDasharray="2 3" />
          ))}
        </g>
      );
    case 'sa':
      return (
        <g>
          <rect x={gapPt.x - 110} y={gapPt.y - 12} width={220} height={24} rx={3} fill={`url(#${rid}-hatch)`} stroke="var(--gold)" strokeWidth={1.5} className="fade-in" />
          <rect x={gapPt.x - 110} y={gapPt.y - 12} width={220} height={24} rx={3} fill="var(--gold-soft)" opacity={0.85} stroke="var(--gold)" strokeWidth={1.5} className="fade-in" />
          <text x={gapPt.x} y={gapPt.y + 4} textAnchor="middle" fontSize={10.5} fontFamily="var(--font-ui)" fill="var(--ink)" fontWeight={600}>
            GAP FILLED — conclusion now guaranteed
          </text>
          {body('SUFFICIENT ASSUMPTION — FILLS THE GAP', 'var(--gold)', short(text) || gap || 'Premises + this = conclusion must follow')}
        </g>
      );
    case 'na':
      return (
        <g>
          <rect x={concl.x + concl.w / 2 - 38} y={concl.y + concl.h + 2} width={76} height={12} fill="var(--danger-soft)" stroke="var(--danger)" strokeWidth={1.2} className="fade-in" />
          <text x={concl.x + concl.w / 2} y={concl.y + concl.h + 11} textAnchor="middle" fontSize={8} fill="var(--danger)" fontFamily="var(--font-ui)" fontWeight={700}>
            KEY BRICK
          </text>
          {body('NECESSARY ASSUMPTION — THE BRICK', 'var(--danger)', short(text) || gap || 'Remove this and the argument collapses')}
        </g>
      );
    default:
      return null;
  }
}

function FactSetDiagram({ q, step, rid, ov, highlightSeg }: { q: Props['q']; step: number; rid: string; ov: Overlay; highlightSeg?: number }) {
  const segs = q.stimulus.map((seg, idx) => ({ seg, idx }));
  const facts = segs.filter((s) => s.seg.r !== 'K');
  const rows: Box[] = [];
  let y = 40;
  facts.forEach((f, i) => {
    const lines = wrap(shorten(f.seg.t, 220), 80, 4);
    const h = lines.length * LH + 16;
    rows.push({ x: 60, y, w: W - 120, h, lines, seg: f.seg, idx: f.idx });
    y += h + 12;
  });
  const paradox = q.type === 'paradox' && q.diagram.tension;
  const chain = q.diagram.chain;
  const H = y + (paradox ? 110 : chain ? 90 : 70);
  const label = q.type === 'cannot-be-true' ? 'WHICH CANNOT BE TRUE?' : q.type === 'paradox' ? 'APPARENT DISCREPANCY' : 'WHAT MUST FOLLOW?';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 860, display: 'block', margin: '0 auto' }} role="img" aria-label="Fact set diagram">
      <ArrowDefs id={rid} />
      <text x={W / 2} y={22} textAnchor="middle" fontSize={10} letterSpacing="0.2em" fill="var(--gold)" fontFamily="var(--font-ui)" fontWeight={700}>
        THE RECORD — FACTS TAKEN AS TRUE
      </text>
      {rows.map((r, i) =>
        step >= 1 ? (
          <g key={i} className="fade-in" style={{ animationDelay: `${i * 0.12}s` }}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={3} fill="var(--paper-2)" stroke={highlightSeg === r.idx ? 'var(--primary)' : 'var(--rule-strong)'} />
            <text x={r.x - 18} y={r.y + 18} fontSize={13} fontFamily="var(--font-display)" fill="var(--gold)" fontWeight={700} textAnchor="middle">
              {['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'][i] ?? i + 1}
            </text>
            <SvgLines x={r.x + 12} y={r.y + 19} anchor="start" lines={r.lines} size={12} lh={LH} />
          </g>
        ) : null,
      )}
      {chain && step >= 3 && <ChainInline chain={chain} y={y + 20} rid={rid} />}
      {paradox && step >= 3 && (
        <g className="fade-in">
          <rect x={60} y={y + 14} width={290} height={50} rx={4} fill="var(--paper-2)" stroke="var(--primary)" />
          <rect x={W - 350} y={y + 14} width={290} height={50} rx={4} fill="var(--paper-2)" stroke="var(--primary)" />
          <SvgLines x={205} y={y + 34} lines={wrap(q.diagram.tension![0], 42, 2)} size={11.5} lh={14} />
          <SvgLines x={W - 205} y={y + 34} lines={wrap(q.diagram.tension![1], 42, 2)} size={11.5} lh={14} />
          <path d={`M350,${y + 39} l14,-10 l8,12 l10,-14 l8,12 l10,-10 l8,10`} fill="none" stroke="var(--danger)" strokeWidth={2} transform={`translate(${(W - 760) / 2 + 14},0)`} />
          <text x={W / 2} y={y + 84} textAnchor="middle" fontSize={11} fill="var(--muted)" fontFamily="var(--font-ui)" fontStyle="italic">
            the correct answer explains how BOTH can be true
          </text>
        </g>
      )}
      {!paradox && step >= 2 && (
        <g className="fade-in">
          <path d={`M${W / 2},${y - 6} L${W / 2},${H - 44}`} stroke="var(--gold)" strokeWidth={1.5} strokeDasharray="4 3" markerEnd={`url(#${rid}-gold)`} />
          <rect x={W / 2 - 130} y={H - 40} width={260} height={30} rx={4} fill="var(--gold-soft)" stroke="var(--gold)" strokeWidth={1.6} />
          <text x={W / 2} y={H - 21} textAnchor="middle" fontSize={11} fontWeight={700} letterSpacing="0.12em" fill="var(--ink)" fontFamily="var(--font-ui)">
            {label}
          </text>
        </g>
      )}
    </svg>
  );
}

function ChainInline({ chain, y, rid }: { chain: string[]; y: number; rid: string }) {
  const n = chain.length;
  const w = Math.min(150, (W - 80 - (n - 1) * 36) / n);
  const total = n * w + (n - 1) * 36;
  const x0 = (W - total) / 2;
  return (
    <g className="fade-in">
      {chain.map((c, i) => {
        const x = x0 + i * (w + 36);
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={34} rx={17} fill="var(--paper-2)" stroke="var(--primary)" />
            <SvgLines x={x + w / 2} y={y + 15} lines={wrap(c, Math.floor(w / 6.5), 2)} size={10.5} lh={12} font="var(--font-ui)" />
            {i < n - 1 && <path d={`M${x + w + 3},${y + 17} L${x + w + 33},${y + 17}`} stroke="var(--gold)" strokeWidth={1.8} markerEnd={`url(#${rid}-gold)`} />}
          </g>
        );
      })}
    </g>
  );
}

function DialogueDiagram({ q, step, rid }: { q: Props['q']; step: number; rid: string }) {
  const speakers = Array.from(new Set(q.stimulus.filter((s) => s.s).map((s) => s.s!)));
  const colW = (W - 60) / 2;
  const cols = speakers.slice(0, 2).map((sp, ci) => {
    let y = 46;
    const boxes = q.stimulus
      .map((seg, idx) => ({ seg, idx }))
      .filter((s) => s.seg.s === sp)
      .map(({ seg, idx }) => {
        const lines = wrap(shorten(seg.t, 170), 44, 5);
        const h = lines.length * LH + 22;
        const b = { x: 20 + ci * (colW + 20), y, w: colW, h, lines, seg, idx };
        y += h + 10;
        return b;
      });
    return { sp, boxes, bottom: y };
  });
  const bottom = Math.max(...cols.map((c) => c.bottom));
  const H = bottom + 70;
  const issueLabel = q.type === 'point-of-agreement' ? 'COMMON GROUND' : 'POINT AT ISSUE';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 860, display: 'block', margin: '0 auto' }} role="img" aria-label="Dialogue diagram">
      <ArrowDefs id={rid} />
      {cols.map((c, ci) => (
        <g key={c.sp}>
          <text x={20 + ci * (colW + 20) + colW / 2} y={28} textAnchor="middle" fontFamily="var(--font-display)" fontSize={17} fontWeight={700} fill={ci === 0 ? 'var(--primary)' : 'var(--secondary)'}>
            {c.sp}
          </text>
          {c.boxes.map((b) =>
            step >= 1 ? (
              <g key={b.idx} className="fade-in">
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill={b.seg.r === 'C' ? 'var(--gold-soft)' : 'var(--paper-2)'} stroke={b.seg.r === 'C' ? 'var(--gold)' : 'var(--rule-strong)'} strokeWidth={b.seg.r === 'C' ? 1.8 : 1} />
                <text x={b.x + 8} y={b.y + 12} fontSize={8.5} letterSpacing="0.12em" fill="var(--muted)" fontFamily="var(--font-ui)" fontWeight={600}>
                  {b.seg.r === 'C' ? 'CONCLUSION' : b.seg.r === 'K' ? 'CONCEDES' : 'PREMISE'}
                </text>
                <SvgLines x={b.x + b.w / 2} y={b.y + 27} lines={b.lines} size={12} lh={LH} />
              </g>
            ) : null,
          )}
        </g>
      ))}
      {step >= 2 && (
        <g className="fade-in">
          <path d={`M${20 + colW / 2},${bottom} C${20 + colW / 2},${bottom + 30} ${W / 2},${bottom + 10} ${W / 2 - 60},${bottom + 34}`} fill="none" stroke="var(--gold)" strokeWidth={1.4} markerEnd={`url(#${rid}-gold)`} />
          <path d={`M${W - 20 - colW / 2},${bottom} C${W - 20 - colW / 2},${bottom + 30} ${W / 2},${bottom + 10} ${W / 2 + 60},${bottom + 34}`} fill="none" stroke="var(--gold)" strokeWidth={1.4} markerEnd={`url(#${rid}-gold)`} />
          <rect x={W / 2 - 60} y={bottom + 24} width={120} height={28} rx={14} fill="var(--gold-soft)" stroke="var(--gold)" />
          <text x={W / 2} y={bottom + 42} textAnchor="middle" fontSize={10} fontWeight={700} letterSpacing="0.12em" fontFamily="var(--font-ui)" fill="var(--ink)">
            {issueLabel}
          </text>
          {q.diagram.gap && (
            <text x={W / 2} y={bottom + 64} textAnchor="middle" fontSize={11} fontStyle="italic" fill="var(--muted)" fontFamily="var(--font-book)">
              {q.diagram.gap.length > 110 ? q.diagram.gap.slice(0, 108) + '…' : q.diagram.gap}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
