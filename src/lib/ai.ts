/**
 * Anthropic API access for the AI features (Office Hours, The Seminar, "Why?" grading,
 * Teach the Clerk, question generation, writing feedback).
 *
 * The key is pasted by the user in Settings and stored only in this browser's
 * IndexedDB. Requests go directly from the browser to the Anthropic API.
 */
import Anthropic from '@anthropic-ai/sdk';
import { useStore } from './store';

export type ChatMsg = { role: 'user' | 'assistant'; content: string };

export function hasKey(): boolean {
  return !!useStore.getState().settings.apiKey.trim();
}

function client() {
  const { apiKey } = useStore.getState().settings;
  if (!apiKey.trim()) throw new Error('No API key. Add your Anthropic API key in Settings to use AI features.');
  return new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true });
}

export interface AskOptions {
  system: string;
  messages: ChatMsg[];
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high';
  onText?: (fullTextSoFar: string) => void;
  signal?: AbortSignal;
  schema?: Record<string, unknown>;
}

function friendly(err: unknown): Error {
  if (err instanceof Anthropic.AuthenticationError) return new Error('The API key was rejected (401). Check it in Settings.');
  if (err instanceof Anthropic.PermissionDeniedError) return new Error('This API key lacks permission for that model (403).');
  if (err instanceof Anthropic.RateLimitError) return new Error('Rate limited (429). Wait a moment and try again.');
  if (err instanceof Anthropic.NotFoundError) return new Error('Model not found (404). Choose another model in Settings.');
  if (err instanceof Anthropic.APIConnectionError) return new Error('Could not reach the Anthropic API. Check your connection.');
  if (err instanceof Anthropic.APIError) return new Error(`API error ${err.status ?? ''}: ${err.message}`);
  return err instanceof Error ? err : new Error(String(err));
}

/** Streamed request; resolves with the complete text. */
export async function ask(opts: AskOptions): Promise<string> {
  const c = client();
  const { model, serverFallback } = useStore.getState().settings;
  const base = {
    model,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    messages: opts.messages,
    output_config: {
      effort: opts.effort ?? 'medium',
      ...(opts.schema ? { format: { type: 'json_schema' as const, schema: opts.schema } } : {}),
    },
  };

  const run = async (withFallback: boolean) => {
    const stream = (
      withFallback
        ? c.beta.messages.stream({ ...base, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as never, { signal: opts.signal })
        : c.messages.stream(base as never, { signal: opts.signal })
    ) as unknown as { on: (ev: 'text', cb: (d: string) => void) => void; finalMessage: () => Promise<unknown> };
    let text = '';
    stream.on('text', (delta: string) => {
      text += delta;
      opts.onText?.(text);
    });
    const final = (await stream.finalMessage()) as { stop_reason: string | null; content: { type: string; text?: string }[] };
    if (final.stop_reason === 'refusal') {
      throw new Error('The model declined this request. Try rephrasing.');
    }
    const out = final.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
    return out || text;
  };

  try {
    return await run(serverFallback);
  } catch (err) {
    // If the fallback beta is not accepted for this model/account, retry plainly once.
    if (serverFallback && err instanceof Anthropic.BadRequestError && /fallback|beta/i.test(err.message)) {
      try {
        return await run(false);
      } catch (e2) {
        throw friendly(e2);
      }
    }
    throw friendly(err);
  }
}

/** Ask for JSON and parse it (structured output when a schema is supplied). */
export async function askJSON<T>(opts: AskOptions): Promise<T> {
  const text = await ask(opts);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('The model did not return JSON.');
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export const AI_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (default — best reasoning)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (faster, lower cost)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest, cheapest)' },
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1 (most capable, premium price)' },
];
