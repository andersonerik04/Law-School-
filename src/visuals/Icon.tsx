/**
 * Hand-drafted line emblems — one consistent glyph per question type, flaw, and trap,
 * used everywhere in the app (map nodes, bench cards, flashcards, drills).
 * Stroke-only, drawn on a 24×24 grid, inheriting currentColor so they theme cleanly.
 */
import type { CSSProperties, ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  // ── Institution / navigation ──
  emblem: (
    <>
      <path d="M12 3v16M6 21h12M8 23h8" />
      <path d="M4 7h16" />
      <path d="M4 7l-2.5 6h5zM20 7l-2.5 6h5z" />
      <circle cx="12" cy="3" r="1" />
    </>
  ),
  docket: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  map: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="4" cy="5" r="1.6" />
      <circle cx="20" cy="5" r="1.6" />
      <circle cx="4" cy="19" r="1.6" />
      <circle cx="20" cy="19" r="1.6" />
      <path d="M10 10.5L5.3 6.2M14 10.5l4.7-4.3M10 13.5l-4.7 4.3M14 13.5l4.7 4.3" />
    </>
  ),
  book: (
    <>
      <path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z" />
      <path d="M12 6v14" />
    </>
  ),
  gavel: (
    <>
      <path d="M13 4l7 7M10 7l7 7M11.5 5.5l-3 3 7 7 3-3z" />
      <path d="M9 12l-6 6 2 2 6-6" />
      <path d="M13 21h8" />
    </>
  ),
  exam: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M8 8l1.5 1.5L12 7M8 13l1.5 1.5L12 12M14 8h2M14 13h2M8 18h8" />
    </>
  ),
  sprint: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13V8M12 13l3 2M10 2h4M12 2v3" />
    </>
  ),
  chart: (
    <>
      <path d="M3 21h18M5 21V11M10 21V6M15 21v-8M20 21V9" />
    </>
  ),
  ledger: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M8 3v18M11 8h6M11 12h6M11 16h4" />
    </>
  ),
  owl: (
    <>
      <circle cx="9" cy="10" r="2.5" />
      <circle cx="15" cy="10" r="2.5" />
      <path d="M5 6l2 2M19 6l-2 2M6 12c0 6 3 9 6 9s6-3 6-9M11 14l1 1 1-1" />
    </>
  ),
  seminar: (
    <>
      <circle cx="7" cy="8" r="2.5" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M2 19c0-3 2-5 5-5s5 2 5 5M12 19c0-3 2-5 5-5s5 2 5 5" />
    </>
  ),
  cards: (
    <>
      <rect x="3" y="6" width="13" height="15" rx="1" />
      <path d="M7 3h13a1 1 0 011 1v14" />
      <path d="M6 11h7M6 15h5" />
    </>
  ),
  notebook: (
    <>
      <rect x="5" y="3" width="15" height="18" rx="1" />
      <path d="M3 7h4M3 12h4M3 17h4M9 8h8M9 12h6" />
    </>
  ),
  admissions: (
    <>
      <path d="M3 10l9-6 9 6M5 10v9M9 10v9M15 10v9M19 10v9M3 21h18" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="1" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  logic: (
    <>
      <circle cx="4.5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19.5" cy="12" r="2" />
      <path d="M6.5 12h3.5M14 12h3.5M9 10l1 2-1 2M16.5 10l1 2-1 2" />
    </>
  ),
  quill: (
    <>
      <path d="M20 3C12 4 7 10 5 19l2 2c9-2 15-7 16-15-1 0-2 0-3-1z" />
      <path d="M5 19l8-8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </>
  ),
  handbook: (
    <>
      <path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z" />
      <path d="M5 17a3 3 0 013-3h11" />
    </>
  ),
  speaker: (
    <>
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M16 9c1.5 1.5 1.5 4.5 0 6M18.5 6.5c3 3 3 8 0 11" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="1" />,
  flag: (
    <>
      <path d="M5 21V4M5 4h12l-3 4 3 4H5" />
    </>
  ),
  check: <path d="M4 12l5 5L20 6" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrowRight: <path d="M4 12h15M14 6l6 6-6 6" />,
  arrowLeft: <path d="M20 12H5M10 6l-6 6 6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5" />
    </>
  ),
  moon: <path d="M20 14A8 8 0 1110 4a6 6 0 0010 10z" />,
  highlight: (
    <>
      <path d="M15 4l5 5-9 9H6v-5z" />
      <path d="M3 21h9" />
    </>
  ),
  laurel: (
    <>
      <path d="M12 21c-5-2-8-6-8-12M12 21c5-2 8-6 8-12" />
      <path d="M5 13c-2 0-3-1-3-2 1 0 3 0 3 2zM6 9C4 8 4 7 4 6c1 0 3 1 2 3zM19 13c2 0 3-1 3-2-1 0-3 0-3 2zM18 9c2-1 2-2 2-3-1 0-3 1-2 3z" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2M9 2h6" />
    </>
  ),
  download: <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />,
  upload: <path d="M12 21V9M7 14l5-5 5 5M4 4h16" />,
  print: (
    <>
      <path d="M6 9V3h12v6M6 17H4v-7h16v7h-2" />
      <rect x="6" y="14" width="12" height="7" />
    </>
  ),

  // ── LR question types ──
  'must-be-true': (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  'most-strongly-supported': (
    <>
      <path d="M3 20h18M7 20V12h10v8M10 12V7h4v5" />
    </>
  ),
  'cannot-be-true': (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M6.5 6.5l11 11" />
    </>
  ),
  'main-conclusion': (
    <>
      <path d="M4 18h16l-2-9-4 4-2-7-2 7-4-4z" />
    </>
  ),
  role: (
    <>
      <path d="M8 21h8M9 21V7M15 21V7M7 7h10M12 3l5 4H7z" />
    </>
  ),
  method: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2M10 14l5-5-2 5z" />
    </>
  ),
  flaw: (
    <>
      <path d="M8 21h8M9 21V5M15 21V5M7 5h10" />
      <path d="M9 11l2 1-2 2M15 9l-2 2 2 1" />
    </>
  ),
  'necessary-assumption': (
    <>
      <path d="M3 20h18M5 20v-5h4v5M15 20v-5h4v5M9 15h6v5H9z" />
      <path d="M9 15l3-4 3 4" />
    </>
  ),
  'sufficient-assumption': (
    <>
      <path d="M2 18h6M16 18h6M8 18c0-4 2-6 4-6s4 2 4 6" />
      <path d="M8 18h8" />
    </>
  ),
  strengthen: (
    <>
      <path d="M12 20V5M7 10l5-5 5 5M4 20h16" />
    </>
  ),
  weaken: (
    <>
      <path d="M12 4v15M7 14l5 5 5-5M4 4h16" />
    </>
  ),
  evaluate: (
    <>
      <path d="M12 4v16M5 7h14M5 7l-3 6h6zM19 7l-3 6h6zM9 20h6" />
    </>
  ),
  parallel: (
    <>
      <path d="M4 8h16M4 16h16M16 5l3 3-3 3M16 13l3 3-3 3" />
    </>
  ),
  'parallel-flaw': (
    <>
      <path d="M4 8h7M13 8h7M4 16h7M13 16h7M11 6l2 4M11 14l2 4" />
    </>
  ),
  'principle-identify': (
    <>
      <path d="M6 4h10a2 2 0 012 2v12a2 2 0 002 2H8a2 2 0 01-2-2z" />
      <path d="M9 9h6M9 13h6" />
    </>
  ),
  'principle-apply': (
    <>
      <path d="M9 3h6v6l3 3v2H6v-2l3-3z" />
      <path d="M5 21h14M8 17h8" />
    </>
  ),
  paradox: (
    <>
      <path d="M4 8h12M12 4l4 4-4 4M20 16H8M12 12l-4 4 4 4" />
    </>
  ),
  'point-at-issue': (
    <>
      <path d="M4 20L18 6M20 20L6 6M15 4h5v5M9 4H4v5" />
    </>
  ),
  'point-of-agreement': (
    <>
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
    </>
  ),

  // ── Flaws ──
  causation: (
    <>
      <path d="M3 12a3 3 0 013-3h3a3 3 0 010 6H8" />
      <path d="M21 12a3 3 0 01-3 3h-3a3 3 0 010-6h1" />
      <path d="M11 9l2 6" />
    </>
  ),
  sampling: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="M14.5 14.5L21 21" />
      <circle cx="8.5" cy="10" r="0.8" />
      <circle cx="11.5" cy="10" r="0.8" />
      <path d="M8 13h4" />
    </>
  ),
  'part-whole': (
    <>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M12 3v18M3 12h18" />
      <rect x="13.5" y="13.5" width="6" height="6" fill="currentColor" stroke="none" opacity="0.25" />
    </>
  ),
  equivocation: (
    <>
      <path d="M12 3c-5 0-8 4-8 9s3 9 8 9" />
      <path d="M12 3c5 0 8 4 8 9s-3 9-8 9" strokeDasharray="2 2" />
      <path d="M12 3v18" />
    </>
  ),
  'ad-hominem': (
    <>
      <circle cx="16" cy="8" r="3" />
      <path d="M11 21c0-4 2-7 5-7s5 3 5 7" />
      <path d="M2 12h6M6 9l3 3-3 3" />
    </>
  ),
  authority: (
    <>
      <path d="M6 21l2-12h8l2 12z" />
      <path d="M9 9V6a3 3 0 016 0v3" />
      <path d="M12 14v3" />
    </>
  ),
  circular: (
    <>
      <path d="M20 12a8 8 0 11-3-6.3" />
      <path d="M17 2v4h-4" />
    </>
  ),
  'false-dichotomy': (
    <>
      <path d="M12 21v-8M12 13L5 5M12 13l7-8" />
      <path d="M12 13v-7" strokeDasharray="1.5 2" />
    </>
  ),
  'suff-nec': (
    <>
      <path d="M3 8h14M13 4l4 4-4 4" />
      <path d="M21 16H7M11 12l-4 4 4 4" />
    </>
  ),
  'absence-evidence': (
    <>
      <rect x="4" y="7" width="16" height="13" rx="1" strokeDasharray="2 2" />
      <path d="M9 4h6M12 11v4M12 17v0.5" />
    </>
  ),
  'percent-number': (
    <>
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
      <path d="M19 5L5 19" />
    </>
  ),
  'possibility-certainty': (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="9" cy="9" r="1" />
      <circle cx="15" cy="15" r="1" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  'straw-man': (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <path d="M12 8v8M5 10h14M12 16l-4 5M12 16l4 5M5 10l-2 2M19 10l2 2" />
    </>
  ),
  overgeneralization: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <path d="M7 12l14-7M7 12l14 7M7 12h14" />
    </>
  ),
  'unlike-comparison': (
    <>
      <path d="M12 4v15M5 7h14M8 20h8" />
      <circle cx="5" cy="13" r="3" />
      <rect x="16" y="10" width="6" height="6" />
    </>
  ),

  // ── Traps ──
  'out-of-scope': (
    <>
      <circle cx="10" cy="12" r="7" />
      <circle cx="20" cy="5" r="1.8" />
    </>
  ),
  'too-strong': (
    <>
      <path d="M4 14h16M4 10h16M12 3v4M12 17v4" />
      <path d="M9 3h6M9 21h6" />
    </>
  ),
  reversal: (
    <>
      <path d="M4 9h13l-3-3M20 15H7l3 3" />
    </>
  ),
  'half-right': (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 010 16z" fill="currentColor" stroke="none" opacity="0.3" />
    </>
  ),
  'irrelevant-comparison': (
    <>
      <path d="M5 20V10M10 20V5M15 20v-8M20 20V8" />
      <path d="M3 4l18 18" />
    </>
  ),
  opposite: (
    <>
      <path d="M12 3v18M5 8l-2 4 2 4M19 8l2 4-2 4" />
    </>
  ),
  'shell-game': (
    <>
      <path d="M3 17c0-4 2-7 4-7s4 3 4 7zM13 17c0-4 2-7 4-7s4 3 4 7z" />
      <circle cx="12" cy="20" r="1.3" />
      <path d="M2 17h20" />
    </>
  ),
  'unsupported-inference': (
    <>
      <path d="M3 18h7M14 18h7" />
      <path d="M10 18c1-6 3-6 4 0" strokeDasharray="2 2" />
      <path d="M12 6v4M12 12v0.5" />
    </>
  ),
  'wrong-degree': (
    <>
      <path d="M4 18a8 8 0 0116 0" />
      <path d="M12 18l5-6" />
    </>
  ),
  restatement: (
    <>
      <path d="M4 7h10M4 11h10M4 15h6" />
      <path d="M16 13l2 2 3-4" />
      <path d="M14 5l2 2-2 2" />
    </>
  ),

  // ── Branches / RC / CL / AW / TS ──
  lr: (
    <>
      <path d="M4 20V8l8-5 8 5v12z" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  rc: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="M7 8h10M7 12h10M7 16h6" />
    </>
  ),
  cl: (
    <>
      <path d="M3 12h7M10 8l4 4-4 4M14 12h7" />
      <circle cx="3" cy="12" r="1" />
    </>
  ),
  aw: (
    <>
      <path d="M4 20l3-1 12-12-2-2L5 17z" />
      <path d="M14 6l2 2M4 20h16" />
    </>
  ),
  ts: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </>
  ),
  structure: (
    <>
      <rect x="9" y="3" width="6" height="4" />
      <rect x="3" y="15" width="6" height="4" />
      <rect x="15" y="15" width="6" height="4" />
      <path d="M12 7v4M6 15v-4h12v4" />
    </>
  ),
  viewpoint: (
    <>
      <circle cx="6" cy="9" r="2.5" />
      <circle cx="18" cy="9" r="2.5" />
      <circle cx="12" cy="16" r="2.5" />
      <path d="M8 10l2.5 4.5M16 10l-2.5 4.5M8.5 9h7" strokeDasharray="1.5 1.5" />
    </>
  ),
  tone: (
    <>
      <path d="M3 17a9 9 0 0118 0" />
      <path d="M12 17l4-5" />
      <path d="M3 17h2M19 17h2" />
    </>
  ),
  venn: (
    <>
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
    </>
  ),
  anatomy: (
    <>
      <rect x="7" y="3" width="10" height="5" rx="1" />
      <rect x="2" y="15" width="8" height="5" rx="1" />
      <rect x="14" y="15" width="8" height="5" rx="1" />
      <path d="M6 15v-3l6-4M18 15v-3l-6-4" />
    </>
  ),
  contrapositive: (
    <>
      <path d="M3 8h12M11 4l4 4-4 4" />
      <path d="M21 16H9M13 12l-4 4 4 4" />
      <path d="M18 5l3 3M21 5l-3 3M3 13l3 3M6 13l-3 3" />
    </>
  ),
  quantifier: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 4v4" />
    </>
  ),
  chain: (
    <>
      <rect x="2" y="9" width="6" height="6" rx="3" />
      <rect x="9" y="9" width="6" height="6" rx="3" />
      <rect x="16" y="9" width="6" height="6" rx="3" />
    </>
  ),
  timing: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4h3" />
    </>
  ),
  blind: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <path d="M4 20L20 4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
};

export const ICON_NAMES = Object.keys(P);

export function Icon({ name, size = 20, stroke = 1.5, style, className, title }: { name: string; size?: number; stroke?: number; style?: CSSProperties; className?: string; title?: string }) {
  const body = P[name] ?? P.emblem;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {body}
    </svg>
  );
}

/** The Academy monogram: scales atop a column, within a double ring. */
export function Monogram({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="The Bar & Bench emblem">
      <circle cx="32" cy="32" r="30" stroke="var(--gold-bright)" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="26.5" stroke="var(--gold-bright)" strokeWidth="0.75" />
      <g stroke="var(--gold-bright)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M32 14v30" />
        <path d="M27 44h10M25 48h14M23 51h18" />
        <path d="M29 20h6M29.5 23h5" />
        <path d="M18 22h28" />
        <path d="M18 22l-5 11h10zM46 22l-5 11h10z" />
        <path d="M13 33a5 2 0 0010 0M41 33a5 2 0 0010 0" />
        <circle cx="32" cy="13" r="1.6" />
      </g>
    </svg>
  );
}
