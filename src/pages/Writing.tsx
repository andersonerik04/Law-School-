import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { WRITING_PROMPTS, type WritingPrompt } from '../lib/content';
import type { Essay } from '../lib/types';
import { hasKey, ask } from '../lib/ai';
import { uid, fmtTime, mentions } from '../lib/util';
import { CasebookHeader, MethodNote, Section, Empty } from '../components/common';
import { FreeCanvas, type FreeMapState } from '../visuals/MindMap';
import { RichText } from '../components/Chat';

const PREWRITE_MS = 15 * 60_000;
const WRITE_MS = 35 * 60_000;
const RUBRIC = [
  { id: 'thesis', label: 'Thesis', desc: 'A clear, specific, arguable position stated early' },
  { id: 'engagement', label: 'Engagement with perspectives', desc: 'Fairly represents and responds to at least one perspective' },
  { id: 'organization', label: 'Organization', desc: 'Logical paragraphing; reasons build toward the conclusion' },
  { id: 'precision', label: 'Precision', desc: 'Exact word choice, controlled sentences, few errors' },
];
const KINDS = [
  { id: 'position', label: 'My position', color: 'var(--primary)' },
  { id: 'perspective', label: 'Perspective', color: 'var(--secondary)' },
  { id: 'support', label: 'Support', color: 'var(--success)' },
  { id: 'objection', label: 'Objection', color: 'var(--danger)' },
];

export default function Writing() {
  const essays = useStore((s) => s.essays);
  const saveEssay = useStore((s) => s.saveEssay);
  const [prompt, setPrompt] = useState<WritingPrompt | null>(null);
  const [phase, setPhase] = useState<'choose' | 'prewrite' | 'write' | 'feedback'>('choose');
  const [essay, setEssay] = useState<Essay | null>(null);
  const [phaseStart, setPhaseStart] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [self, setSelf] = useState<Record<string, number>>({});

  useEffect(() => {
    if (phase !== 'prewrite' && phase !== 'write') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [phase]);
  const left = (phase === 'prewrite' ? PREWRITE_MS : WRITE_MS) - (now - phaseStart);
  useEffect(() => {
    if (phase === 'prewrite' && left <= 0) {
      setPhase('write');
      setPhaseStart(Date.now());
    }
  }, [left, phase]);

  const begin = (p: WritingPrompt) => {
    const e: Essay = {
      id: uid('e_'),
      promptId: p.id,
      ts: Date.now(),
      prewrite: { nodes: [{ id: 'pos', label: 'My position', x: 0, y: 0, kind: 'position' }, ...p.perspectives.map((pp, i) => ({ id: 'p' + i, label: pp.label, x: Math.cos((i / p.perspectives.length) * Math.PI * 2) * 260, y: Math.sin((i / p.perspectives.length) * Math.PI * 2) * 180, kind: 'perspective' }))], edges: p.perspectives.map((_, i) => ({ id: 'e' + i, source: 'pos', target: 'p' + i })) },
      text: '',
      minutes: 0,
    };
    setPrompt(p);
    setEssay(e);
    setPhase('prewrite');
    setPhaseStart(Date.now());
    setFeedback('');
    setSelf({});
  };

  const stats = useMemo(() => {
    if (!essay || !prompt) return null;
    const words = essay.text.trim() ? essay.text.trim().split(/\s+/).length : 0;
    const paras = essay.text.split(/\n\s*\n/).filter((p) => p.trim()).length;
    const engaged = prompt.perspectives.filter((p) => mentions(essay.text, p.label) || p.text.split(/\W+/).filter((w) => w.length > 7).slice(0, 4).some((w) => mentions(essay.text, w))).length;
    const counter = /\b(however|although|critics|opponents|admittedly|granted|on the other hand|to be sure)\b/i.test(essay.text);
    return { words, paras, engaged, counter };
  }, [essay, prompt]);

  const submit = async () => {
    if (!essay || !prompt) return;
    const done: Essay = { ...essay, minutes: Math.round((Date.now() - phaseStart) / 60000) };
    saveEssay(done);
    setEssay(done);
    setPhase('feedback');
    if (!hasKey()) return;
    setBusy(true);
    try {
      const text = await ask({
        system:
          'You are an experienced law school admissions reader and writing instructor evaluating an LSAT Argumentative Writing essay. Score each dimension 1–6 with a one-sentence justification: THESIS, ENGAGEMENT WITH PERSPECTIVES, ORGANIZATION, PRECISION. Then give: STRENGTHS (2 bullets), REVISIONS (3 specific, actionable bullets quoting the essay where useful), and an OVERALL impression of how an admissions committee would read it. Praise process and craft; be candid.',
        messages: [{ role: 'user', content: `ISSUE: ${prompt.issue}\n${prompt.perspectives.map((p) => `${p.label}: ${p.text}`).join('\n')}\nTASK: ${prompt.task}\n\nPREWRITE MAP NODES: ${done.prewrite.nodes.map((n) => `[${n.kind ?? 'node'}] ${n.label}`).join('; ')}\n\nESSAY:\n${done.text}` }],
        maxTokens: 4000,
        effort: 'medium',
        onText: setFeedback,
      });
      setFeedback(text);
      saveEssay({ ...done, feedback: text });
    } catch (e) {
      setFeedback('Feedback unavailable: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const issueCard = prompt && (
    <div className="card gilt">
      <div className="label">the issue · {prompt.topic}</div>
      <h3 style={{ margin: '4px 0' }}>{prompt.title}</h3>
      <p className="book" style={{ fontSize: 16 }}>
        {prompt.issue}
      </p>
      <div className="grid cols-3">
        {prompt.perspectives.map((p) => (
          <div key={p.label} className="card flat" style={{ padding: 10 }}>
            <div className="label">{p.label}</div>
            <div className="book" style={{ fontSize: 14.5 }}>
              {p.text}
            </div>
          </div>
        ))}
      </div>
      <p className="book" style={{ fontSize: 15, marginTop: 10 }}>
        <b>Task.</b> {prompt.task}
      </p>
    </div>
  );

  return (
    <div>
      <CasebookHeader chapter="ARGUMENTATIVE WRITING" title="The Writing Chamber" subtitle="Fifteen minutes to think in pictures, thirty-five to argue in prose." />
      {phase === 'choose' && (
        <>
          <MethodNote id="visual">Map your position and the perspectives before writing a word.</MethodNote>
          <div className="grid cols-2">
            {WRITING_PROMPTS.map((p) => (
              <div key={p.id} className="card stack">
                <div className="label">{p.topic}</div>
                <h3 style={{ margin: 0 }}>{p.title}</h3>
                <p className="book muted" style={{ fontSize: 15, margin: 0 }}>
                  {p.issue.slice(0, 180)}…
                </p>
                <button className="primary" style={{ alignSelf: 'flex-start' }} onClick={() => begin(p)}>
                  Begin (15 + 35 min)
                </button>
              </div>
            ))}
          </div>
          <Section numeral="I" title="Your essays">
            {essays.length ? (
              <table className="ledger">
                <tbody>
                  {essays.map((e) => (
                    <tr key={e.id}>
                      <td>{new Date(e.ts).toLocaleDateString()}</td>
                      <td>{WRITING_PROMPTS.find((p) => p.id === e.promptId)?.title}</td>
                      <td>{e.text.split(/\s+/).filter(Boolean).length} words</td>
                      <td>{e.feedback ? 'Feedback on file' : '—'}</td>
                      <td>
                        <button
                          className="small"
                          onClick={() => {
                            setPrompt(WRITING_PROMPTS.find((p) => p.id === e.promptId) ?? null);
                            setEssay(e);
                            setFeedback(e.feedback ?? '');
                            setPhase('feedback');
                          }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>No essays yet.</Empty>
            )}
          </Section>
        </>
      )}

      {(phase === 'prewrite' || phase === 'write') && essay && prompt && (
        <div className="stack">
          <div className="row between">
            <span className="chip gold">{phase === 'prewrite' ? 'Prewriting analysis' : 'Writing'}</span>
            <span className={`chip ${left < 5 * 60_000 ? 'danger' : ''}`}>{fmtTime(Math.max(0, left))} remaining</span>
          </div>
          {issueCard}
          {phase === 'prewrite' ? (
            <div className="card stack">
              <div className="label">visual prewrite — position at the center; connect supports and objections</div>
              <FreeCanvas initial={essay.prewrite as FreeMapState} kinds={KINDS} height={460} onChange={(m) => setEssay((e) => (e ? { ...e, prewrite: m } : e))} />
              <button className="primary" style={{ alignSelf: 'flex-start' }} onClick={() => { setPhase('write'); setPhaseStart(Date.now()); }}>
                Begin writing →
              </button>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 260px', alignItems: 'start' }}>
              <div className="stack">
                <textarea value={essay.text} onChange={(e) => setEssay({ ...essay, text: e.target.value })} rows={22} style={{ fontSize: 17, lineHeight: 1.7 }} placeholder="Begin with your thesis…" spellCheck />
                <div className="row">
                  <button className="primary" onClick={submit} disabled={(stats?.words ?? 0) < 50}>
                    Submit essay
                  </button>
                  <span className="muted">{stats?.words} words · {stats?.paras} paragraphs</span>
                </div>
              </div>
              <aside className="card stack tight">
                <div className="label">your prewrite</div>
                {essay.prewrite.nodes.map((n) => (
                  <div key={n.id} style={{ fontSize: 13, borderLeft: `3px solid ${KINDS.find((k) => k.id === n.kind)?.color ?? 'var(--rule)'}`, paddingLeft: 6 }}>
                    {n.label}
                  </div>
                ))}
              </aside>
            </div>
          )}
        </div>
      )}

      {phase === 'feedback' && essay && prompt && (
        <div className="stack">
          {issueCard}
          <div className="grid cols-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <div className="label">your essay</div>
              <div className="book" style={{ whiteSpace: 'pre-wrap', fontSize: 16 }}>
                {essay.text}
              </div>
            </div>
            <div className="stack">
              {stats && (
                <div className="card">
                  <div className="label">the clerk’s count</div>
                  <div className="row">
                    <span className="chip">{stats.words} words</span>
                    <span className="chip">{stats.paras} paragraphs</span>
                    <span className={`chip ${stats.engaged ? 'success' : 'danger'}`}>{stats.engaged} perspective(s) engaged</span>
                    <span className={`chip ${stats.counter ? 'success' : 'danger'}`}>{stats.counter ? 'Counterargument addressed' : 'No counterargument signal'}</span>
                  </div>
                </div>
              )}
              {hasKey() ? (
                <div className="card gilt">
                  <div className="label">the reader’s rubric</div>
                  {busy && !feedback ? <div className="muted">Reading…</div> : <RichText text={feedback} />}
                </div>
              ) : (
                <div className="card gilt stack">
                  <div className="label">self-assessment rubric (add an API key for a reader’s evaluation)</div>
                  {RUBRIC.map((r) => (
                    <label key={r.id} className="field">
                      <span>
                        <b>{r.label}</b> — {r.desc}: {self[r.id] ?? '—'}/6
                      </span>
                      <input type="range" min={1} max={6} value={self[r.id] ?? 3} onChange={(e) => { const s = { ...self, [r.id]: +e.target.value }; setSelf(s); saveEssay({ ...essay, selfRubric: s }); }} />
                    </label>
                  ))}
                </div>
              )}
              <button onClick={() => setPhase('choose')}>Back to the prompts</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
