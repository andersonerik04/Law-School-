import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { METHOD_BY_ID } from '../lib/pedagogy';
import { RANKS, MASTERY_VAR, masteryInk, RANK_BLURB } from '../lib/mastery';
import { Icon } from '../visuals/Icon';
import { speak, stopSpeaking, speechAvailable } from '../lib/tts';

export function MethodNote({ id, children }: { id: string; children?: ReactNode }) {
  const m = METHOD_BY_ID[id];
  if (!m) return null;
  return (
    <div className="method-note" role="note">
      <b>
        {m.letter}. {m.name}
      </b>{' '}
      — {m.what} {children}
    </div>
  );
}

export function CasebookHeader({ chapter, title, subtitle }: { chapter?: string; title: ReactNode; subtitle?: ReactNode }) {
  return (
    <header className="casebook-header page-turn">
      {chapter && <div className="chapter">{chapter}</div>}
      <h1>{title}</h1>
      {subtitle && <div className="subtitle">{subtitle}</div>}
    </header>
  );
}

export function RankBadge({ level, small }: { level: number; small?: boolean }) {
  return (
    <span
      className="rank"
      title={RANK_BLURB[RANKS[level]]}
      style={{
        background: MASTERY_VAR[level],
        color: masteryInk(level),
        borderColor: level === 5 ? 'var(--gold-bright)' : 'var(--rule-strong)',
        fontSize: small ? '0.8rem' : undefined,
        boxShadow: level === 5 ? '0 0 0 1px var(--gold-soft)' : undefined,
      }}
    >
      {RANKS[level]}
    </span>
  );
}

export function MasteryLegend() {
  return (
    <div className="row" style={{ gap: 6 }}>
      {RANKS.map((r, i) => (
        <RankBadge key={r} level={i} small />
      ))}
    </div>
  );
}

export function Section({ numeral, title, children, right }: { numeral?: string; title: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="fade-in" style={{ marginBottom: 26 }}>
      <div className="row between" style={{ borderBottom: '1px solid var(--gold)', marginBottom: 12, paddingBottom: 4 }}>
        <h2 style={{ margin: 0 }}>
          {numeral && <span style={{ color: 'var(--gold)', marginRight: 10 }}>{numeral}.</span>}
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function ReadAloud({ text, label = 'Narrate' }: { text: string; label?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  if (!speechAvailable()) return null;
  return (
    <button
      className="small ghost"
      onClick={() => {
        if (on) {
          stopSpeaking();
          setOn(false);
        } else {
          setOn(true);
          speak(text, () => setOn(false));
        }
      }}
      title="Text-to-speech narration"
    >
      <Icon name={on ? 'stop' : 'speaker'} size={15} /> {on ? 'Stop' : label}
    </button>
  );
}

export function Progress({ value, max = 100 }: { value: number; max?: number }) {
  return (
    <div className="bar" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

export function Modal({ children, onClose, title }: { children: ReactNode; onClose: () => void; title?: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return createPortal(
    <div className="modal-back" onClick={onClose}>
      <div className="modal page-turn" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="row between" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="ghost" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ── Toasts (honors & notices) ────────────────────────────────
type ToastMsg = { id: number; title: string; body?: string };
let listeners: ((t: ToastMsg[]) => void)[] = [];
let toasts: ToastMsg[] = [];
export function toast(title: string, body?: string) {
  const t = { id: Date.now() + Math.random(), title, body };
  toasts = [...toasts, t];
  listeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    listeners.forEach((l) => l(toasts));
  }, 5200);
}
export function Toasts() {
  const [list, setList] = useState<ToastMsg[]>([]);
  useEffect(() => {
    listeners.push(setList);
    return () => {
      listeners = listeners.filter((l) => l !== setList);
    };
  }, []);
  return (
    <div className="toast-wrap" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="toast">
          <div className="row" style={{ gap: 8 }}>
            <Icon name="laurel" size={22} style={{ color: 'var(--gold)' }} />
            <div>
              <div style={{ fontWeight: 700 }}>{t.title}</div>
              {t.body && <div style={{ fontSize: '0.9rem', fontFamily: 'var(--font-book)', color: 'var(--ink-soft)' }}>{t.body}</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function KeyHint({ k }: { k: string }) {
  return <span className="kbd">{k}</span>;
}
