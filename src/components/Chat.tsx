import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ask, hasKey, type ChatMsg } from '../lib/ai';
import { ArgumentDiagram } from '../visuals/ArgumentDiagram';
import { ArrowChain } from '../visuals/LogicGraphics';
import { lit } from '../lib/logic';
import type { Segment } from '../lib/types';
import { Link } from 'react-router-dom';

/** Light markdown: **bold**, *italic*, bullet lines. */
function inline(text: string, key: number): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <span key={key}>
      {parts.map((p, i) => (p.startsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith('*') && p.length > 2 ? <i key={i}>{p.slice(1, -1)}</i> : p))}
    </span>
  );
}

/** Render assistant text, turning ```diagram and ```chain blocks into live visuals. */
export function RichText({ text }: { text: string }) {
  const blocks = text.split(/```(diagram|chain)\s*\n([\s\S]*?)```/g);
  const out: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i] === 'diagram' && blocks[i + 1] !== undefined) {
      try {
        const d = JSON.parse(blocks[i + 1]);
        const stimulus: Segment[] = [...(d.counter ? [{ t: d.counter, r: 'K' as const }] : []), ...(d.premises ?? []).map((p: string) => ({ t: p, r: 'P' as const })), { t: d.conclusion ?? '', r: 'C' as const }];
        out.push(
          <div key={i} className="card flat" style={{ background: 'var(--paper)', margin: '8px 0', whiteSpace: 'normal' }}>
            <ArgumentDiagram q={{ stimulus, diagram: { gap: d.gap, overlay: 'none' }, type: 'flaw' }} overlay="none" compact />
          </div>,
        );
      } catch {
        out.push(<pre key={i}>{blocks[i + 1]}</pre>);
      }
      i++;
    } else if (blocks[i] === 'chain' && blocks[i + 1] !== undefined) {
      const terms = blocks[i + 1].split(/->|→/).map((s) => s.trim()).filter(Boolean);
      out.push(
        <div key={i} className="card flat" style={{ background: 'var(--paper)', margin: '8px 0', whiteSpace: 'normal' }}>
          <ArrowChain chain={terms.map((t) => (t.startsWith('¬') || t.toLowerCase().startsWith('not ') ? lit(t.replace(/^(¬|not )/i, ''), true) : lit(t)))} />
        </div>,
      );
      i++;
    } else if (blocks[i]) {
      out.push(
        <span key={i}>
          {blocks[i].split('\n').map((line, k, arr) => (
            <span key={k}>
              {inline(line.replace(/^\s*[-*]\s+/, '• ').replace(/^#+\s*/, ''), k)}
              {k < arr.length - 1 ? '\n' : ''}
            </span>
          ))}
        </span>,
      );
    }
  }
  return <>{out}</>;
}

export function NeedsKey({ what }: { what: string }) {
  return (
    <div className="card gilt">
      <h3>The Faculty requires your key</h3>
      <p className="book">
        {what} uses the Anthropic API. Add your API key in <Link to="/settings">Settings → The Faculty</Link>; it is stored only in this browser. Every other part of the Academy works without it.
      </p>
    </div>
  );
}

/**
 * A chat transcript with a persona. `messages` are owned by the parent so they can be saved.
 */
export function Chat({
  system,
  messages,
  setMessages,
  who,
  placeholder = 'Your answer…',
  starter,
  height = 520,
  onTurn,
}: {
  system: string;
  messages: ChatMsg[];
  setMessages: (m: ChatMsg[]) => void;
  who: string;
  placeholder?: string;
  starter?: string;
  height?: number;
  onTurn?: (m: ChatMsg[]) => void;
}) {
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, streaming]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string, base = messages) => {
    if (!text.trim() || busy) return;
    const next: ChatMsg[] = [...base, { role: 'user', content: text.trim() }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError('');
    setStreaming('');
    abortRef.current = new AbortController();
    try {
      const reply = await ask({ system, messages: next, maxTokens: 4000, effort: 'medium', onText: setStreaming, signal: abortRef.current.signal });
      const done: ChatMsg[] = [...next, { role: 'assistant', content: reply }];
      setMessages(done);
      onTurn?.(done);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStreaming('');
    }
  };

  if (!hasKey()) return <NeedsKey what={`Conversation with ${who}`} />;

  return (
    <div className="stack">
      <div className="card paper-texture" style={{ height, overflow: 'auto' }}>
        <div className="chat">
          {messages.length === 0 && starter && (
            <div className="empty" style={{ padding: 10 }}>
              <button className="primary" onClick={() => send(starter, [])}>
                Begin
              </button>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <span className="who">{m.role === 'user' ? 'You' : who}</span>
              {m.role === 'assistant' ? <RichText text={m.content} /> : m.content}
            </div>
          ))}
          {busy && (
            <div className="msg assistant">
              <span className="who">{who}</span>
              {streaming ? <RichText text={streaming} /> : <span className="muted">…</span>}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
      {error && <div className="chip danger">{error}</div>}
      <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <button className="primary" disabled={busy || !input.trim()} onClick={() => send(input)}>
          Send
        </button>
        {busy && (
          <button className="ghost" onClick={() => abortRef.current?.abort()}>
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
