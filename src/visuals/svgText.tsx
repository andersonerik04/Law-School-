/** Word-wrap text into lines of at most `max` characters (for SVG). */
export function wrap(text: string, max: number, maxLines = 6): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = cut[maxLines - 1].replace(/\s*\S*$/, '') + ' …';
    return cut;
  }
  return lines;
}

export function SvgLines({ x, y, lines, size = 12.5, lh = 16, anchor = 'middle', fill = 'var(--ink)', font = 'var(--font-book)', weight = 400, italic = false }: {
  x: number;
  y: number;
  lines: string[];
  size?: number;
  lh?: number;
  anchor?: 'start' | 'middle' | 'end';
  fill?: string;
  font?: string;
  weight?: number;
  italic?: boolean;
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={fill} fontFamily={font} fontWeight={weight} fontStyle={italic ? 'italic' : 'normal'}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lh}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

export function ArrowDefs({ id = 'ah' }: { id?: string }) {
  return (
    <defs>
      <marker id={`${id}-gold`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10z" fill="var(--gold)" />
      </marker>
      <marker id={`${id}-ink`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10z" fill="var(--ink-soft)" />
      </marker>
      <marker id={`${id}-red`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10z" fill="var(--danger)" />
      </marker>
      <marker id={`${id}-primary`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10z" fill="var(--primary)" />
      </marker>
      <pattern id={`${id}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--gold)" strokeWidth="1" opacity="0.5" />
      </pattern>
    </defs>
  );
}
