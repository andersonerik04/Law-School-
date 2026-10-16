import { useCallback, useEffect, useRef, type CSSProperties } from 'react';

export interface Highlight {
  start: number;
  end: number;
  color: 1 | 2 | 3;
}

/**
 * Text that can be highlighted (LawHub-style). Select text, then press H (or use a
 * highlighter button) — offsets are computed against the plain text content.
 */
export function Highlightable({
  text,
  highlights,
  onChange,
  color = 1,
  className,
  style,
  registerApply,
}: {
  text: string;
  highlights: Highlight[];
  onChange: (h: Highlight[]) => void;
  color?: 1 | 2 | 3;
  className?: string;
  style?: CSSProperties;
  /** parent receives a function that applies a highlight to the current selection */
  registerApply?: (fn: (c?: 1 | 2 | 3) => boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const apply = useCallback(
    (c?: 1 | 2 | 3) => {
      const sel = window.getSelection();
      const el = ref.current;
      if (!sel || sel.isCollapsed || !el || !sel.rangeCount) return false;
      const r = sel.getRangeAt(0);
      if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return false;
      const pre = document.createRange();
      pre.selectNodeContents(el);
      pre.setEnd(r.startContainer, r.startOffset);
      const start = pre.toString().length;
      const end = start + r.toString().length;
      if (end <= start) return false;
      const col = c ?? color;
      // toggle off if an identical highlight exists; otherwise merge-replace overlaps
      const existing = highlights.find((h) => h.start === start && h.end === end);
      const next = existing ? highlights.filter((h) => h !== existing) : [...highlights.filter((h) => h.end <= start || h.start >= end), { start, end, color: col }];
      onChange(next.sort((a, b) => a.start - b.start));
      sel.removeAllRanges();
      return true;
    },
    [highlights, onChange, color],
  );

  useEffect(() => {
    registerApply?.(apply);
  }, [apply, registerApply]);

  // build segments
  const pts = new Set<number>([0, text.length]);
  highlights.forEach((h) => {
    pts.add(Math.max(0, Math.min(text.length, h.start)));
    pts.add(Math.max(0, Math.min(text.length, h.end)));
  });
  const sorted = [...pts].sort((a, b) => a - b);
  const segs: { s: string; c?: number }[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const h = highlights.find((x) => x.start <= a && x.end >= b);
    segs.push({ s: text.slice(a, b), c: h?.color });
  }
  return (
    <div ref={ref} className={className} style={{ whiteSpace: 'pre-wrap', ...style }}>
      {segs.map((sg, i) =>
        sg.c ? (
          <mark key={i} className={`hl-${sg.c}`}>
            {sg.s}
          </mark>
        ) : (
          <span key={i}>{sg.s}</span>
        ),
      )}
    </div>
  );
}
