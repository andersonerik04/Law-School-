import { useId } from 'react';
import type { RCPassage, RCParagraph, ParaFunction } from '../lib/types';
import { ArrowDefs, SvgLines, wrap } from './svgText';

const FN_COLOR: Record<ParaFunction, string> = {
  Background: 'var(--rule-strong)',
  Thesis: 'var(--gold)',
  Counterargument: 'var(--secondary)',
  Evidence: 'var(--success)',
  Elaboration: 'var(--ink-soft)',
  Concession: 'var(--warn)',
  "Author's Conclusion": 'var(--primary)',
  Example: 'var(--success)',
  Rebuttal: 'var(--danger)',
};
export const PARA_FUNCTIONS = Object.keys(FN_COLOR) as ParaFunction[];

/** Passage Structure Map — each paragraph is a block labeled by function, with arrows. */
export function PassageMap({ paragraphs, title, step = 99, highlight }: { paragraphs: RCParagraph[]; title?: string; step?: number; highlight?: number }) {
  const rid = useId().replace(/:/g, '');
  const W = 720;
  const bw = 520;
  const x = (W - bw) / 2;
  let y = title ? 36 : 12;
  const boxes = paragraphs.map((p, i) => {
    const lines = wrap(p.gist, 66, 3);
    const h = lines.length * 15 + 34;
    const b = { x, y, w: bw, h, lines, p, i };
    y += h + 34;
    return b;
  });
  const H = y;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 720, display: 'block', margin: '0 auto' }} role="img" aria-label="Passage structure map">
      <ArrowDefs id={rid} />
      {title && (
        <text x={W / 2} y={22} textAnchor="middle" fontFamily="var(--font-display)" fontSize={17} fontWeight={700} fill="var(--ink)">
          {title}
        </text>
      )}
      {boxes.map((b, i) =>
        i < step ? (
          <g key={i} className="fade-in" style={{ animationDelay: `${i * 0.15}s` }}>
            {i > 0 && <path d={`M${W / 2},${boxes[i - 1].y + boxes[i - 1].h + 2} L${W / 2},${b.y - 4}`} stroke="var(--rule-strong)" strokeWidth={1.2} markerEnd={`url(#${rid}-ink)`} />}
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill="var(--paper-2)" stroke={highlight === i ? 'var(--primary)' : FN_COLOR[b.p.fn]} strokeWidth={highlight === i ? 2.4 : 1.6} />
            <rect x={b.x} y={b.y} width={6} height={b.h} fill={FN_COLOR[b.p.fn]} />
            <text x={b.x + 16} y={b.y + 15} fontSize={9} letterSpacing="0.14em" fontWeight={700} fill={FN_COLOR[b.p.fn]} fontFamily="var(--font-ui)">
              ¶{i + 1} · {b.p.fn.toUpperCase()}
            </text>
            <SvgLines x={b.x + 16} y={b.y + 32} anchor="start" lines={b.lines} size={12.5} lh={15} />
            {(b.p.links ?? []).map((l, k) => {
              const t = boxes[l.to];
              if (!t) return null;
              const side = k % 2 === 0 ? 1 : -1;
              const sx = side > 0 ? b.x + b.w : b.x;
              const off = side * (30 + k * 14);
              const color = l.kind === 'opposes' ? 'var(--danger)' : l.kind === 'supports' ? 'var(--success)' : 'var(--gold)';
              return (
                <g key={k}>
                  <path d={`M${sx},${b.y + b.h / 2} C${sx + off},${b.y + b.h / 2} ${sx + off},${t.y + t.h / 2} ${sx},${t.y + t.h / 2}`} fill="none" stroke={color} strokeWidth={1.3} strokeDasharray={l.kind === 'opposes' ? '5 3' : undefined} markerEnd={`url(#${rid}-gold)`} />
                  <text x={sx + off + side * 4} y={(b.y + t.y + t.h) / 2 + 4} fontSize={9} fill={color} fontFamily="var(--font-ui)" textAnchor={side > 0 ? 'start' : 'end'}>
                    {l.kind}
                  </text>
                </g>
              );
            })}
          </g>
        ) : null,
      )}
    </svg>
  );
}

/** Viewpoint Map — the cast of characters. */
export function ViewpointMap({ passage }: { passage: RCPassage }) {
  const vps = passage.viewpoints;
  const W = 720;
  const n = vps.length;
  const cx = W / 2;
  const cy = 150;
  const R = 105;
  const colors = ['var(--primary)', 'var(--secondary)', 'var(--success)', 'var(--warn)', 'var(--ink-soft)'];
  const author = vps.find((v) => v.isAuthor);
  const others = vps.filter((v) => !v.isAuthor);
  return (
    <svg viewBox={`0 0 ${W} 310`} width="100%" style={{ maxWidth: 720, display: 'block', margin: '0 auto' }} role="img" aria-label="Viewpoint map">
      {author && (
        <g>
          <circle cx={cx} cy={cy} r={46} fill="var(--gold-soft)" stroke="var(--gold)" strokeWidth={2} />
          <text x={cx} y={cy - 4} textAnchor="middle" fontFamily="var(--font-display)" fontWeight={700} fontSize={15} fill="var(--ink)">
            {author.name}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9} letterSpacing="0.14em" fill="var(--gold)" fontFamily="var(--font-ui)" fontWeight={700}>
            THE AUTHOR
          </text>
        </g>
      )}
      {others.map((v, i) => {
        const ang = (-Math.PI / 2) + (i - (others.length - 1) / 2) * (Math.PI / Math.max(2, others.length)) * 1.6 + (author ? Math.PI : 0);
        const x = cx + Math.cos(ang) * R * 2.2;
        const y = cy + Math.sin(ang) * R * 0.95;
        const color = colors[i % colors.length];
        const lines = wrap(v.stance, 30, 3);
        return (
          <g key={v.id}>
            {author && <line x1={cx} y1={cy} x2={x} y2={y} stroke={color} strokeWidth={1} strokeDasharray="3 3" />}
            <rect x={x - 105} y={y - 30} width={210} height={lines.length * 13 + 34} rx={6} fill="var(--paper-2)" stroke={color} strokeWidth={1.6} />
            <text x={x} y={y - 13} textAnchor="middle" fontFamily="var(--font-display)" fontWeight={700} fontSize={14} fill={color}>
              {v.name}
            </text>
            <SvgLines x={x} y={y + 3} lines={lines} size={11} lh={13} />
          </g>
        );
      })}
      {author && (
        <SvgLines x={cx} y={cy + 66} lines={wrap(author.stance, 60, 2)} size={11.5} lh={14} italic fill="var(--ink-soft)" />
      )}
      {n === 0 && null}
    </svg>
  );
}

/** Tone Meter — strongly negative to strongly positive. */
export function ToneMeter({ value, word, note }: { value: number; word: string; note?: string }) {
  const W = 520;
  const cx = W / 2;
  const cy = 150;
  const r = 120;
  const ang = Math.PI - ((value + 2) / 4) * Math.PI;
  const nx = cx + Math.cos(ang) * (r - 14);
  const ny = cy - Math.sin(ang) * (r - 14);
  const labels = ['Strongly negative', 'Critical', 'Neutral', 'Approving', 'Strongly positive'];
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} 190`} width="100%" style={{ maxWidth: 460, display: 'block', margin: '0 auto' }} role="img" aria-label={`Tone meter: ${word}`}>
        <defs>
          <linearGradient id="tone-g" x1="0" x2="1">
            <stop offset="0" stopColor="var(--danger)" />
            <stop offset="0.5" stopColor="var(--rule-strong)" />
            <stop offset="1" stopColor="var(--success)" />
          </linearGradient>
        </defs>
        <path d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} fill="none" stroke="url(#tone-g)" strokeWidth={16} strokeLinecap="round" opacity={0.75} />
        {labels.map((l, i) => {
          const a = Math.PI - (i / 4) * Math.PI;
          return (
            <g key={l}>
              <line x1={cx + Math.cos(a) * (r - 10)} y1={cy - Math.sin(a) * (r - 10)} x2={cx + Math.cos(a) * (r + 10)} y2={cy - Math.sin(a) * (r + 10)} stroke="var(--ink-soft)" strokeWidth={1} />
              <text x={cx + Math.cos(a) * (r + 24)} y={cy - Math.sin(a) * (r + 24) + 4} textAnchor={i < 2 ? 'end' : i > 2 ? 'start' : 'middle'} fontSize={10} fill="var(--muted)" fontFamily="var(--font-ui)">
                {l}
              </text>
            </g>
          );
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" style={{ transition: 'all .8s' }} />
        <circle cx={cx} cy={cy} r={7} fill="var(--gold)" />
        <text x={cx} y={cy + 32} textAnchor="middle" fontFamily="var(--font-display)" fontSize={20} fontWeight={700} fill="var(--primary)">
          {word}
        </text>
      </svg>
      {note && <figcaption style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', fontFamily: 'var(--font-book)', maxWidth: 520, margin: '0 auto' }}>{note}</figcaption>}
    </figure>
  );
}

/** Comparative passages: where A and B agree, disagree, and differ in scope. */
export function ComparativeVenn({ comparison, labels = ['Passage A', 'Passage B'] }: { comparison: NonNullable<RCPassage['comparison']>; labels?: [string, string] | string[] }) {
  const W = 760;
  const H = 380;
  const list = (items: string[], x: number, y: number, max: number, anchor: 'start' | 'middle' = 'middle') => {
    let yy = y;
    return items.map((t, i) => {
      const lines = wrap('• ' + t, max, 3);
      const el = <SvgLines key={i} x={x} y={yy} lines={lines} size={11.5} lh={14} anchor={anchor} />;
      yy += lines.length * 14 + 6;
      return el;
    });
  };
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 820, display: 'block', margin: '0 auto' }} role="img" aria-label="Comparative Venn diagram">
        <circle cx={270} cy={175} r={160} fill="var(--primary-soft)" fillOpacity={0.35} stroke="var(--primary)" strokeWidth={2} />
        <circle cx={490} cy={175} r={160} fill="var(--gold-soft)" fillOpacity={0.35} stroke="var(--gold)" strokeWidth={2} />
        <text x={190} y={30} textAnchor="middle" fontFamily="var(--font-display)" fontWeight={700} fontSize={17} fill="var(--primary)">
          {labels[0]} only
        </text>
        <text x={570} y={30} textAnchor="middle" fontFamily="var(--font-display)" fontWeight={700} fontSize={17} fill="var(--gold)">
          {labels[1]} only
        </text>
        <text x={380} y={58} textAnchor="middle" fontFamily="var(--font-display)" fontWeight={700} fontSize={15} fill="var(--ink)">
          Both
        </text>
        {list(comparison.onlyA, 190, 90, 26)}
        {list(comparison.onlyB, 570, 90, 26)}
        <text x={380} y={80} textAnchor="middle" fontSize={9} letterSpacing="0.14em" fill="var(--success)" fontFamily="var(--font-ui)" fontWeight={700}>
          AGREE
        </text>
        {list(comparison.agree, 380, 98, 20)}
        <text x={380} y={232} textAnchor="middle" fontSize={9} letterSpacing="0.14em" fill="var(--danger)" fontFamily="var(--font-ui)" fontWeight={700}>
          DISAGREE
        </text>
        {list(comparison.disagree, 380, 250, 20)}
      </svg>
    </figure>
  );
}
