import { useMemo, useState } from 'react';
import { useStore, type ChatThread } from '../lib/store';
import { hasKey, type ChatMsg } from '../lib/ai';
import { professorSystem, generateQuestion } from '../lib/tutor';
import { questionForPrompt } from '../lib/grading';
import { getQuestion, LR_TYPES, typeLabel, isLR, CONCEPTS } from '../lib/content';
import { masteryFor } from '../lib/mastery';
import { uid } from '../lib/util';
import { CasebookHeader, MethodNote, Section } from '../components/common';
import { Chat, NeedsKey } from '../components/Chat';
import { QuestionPlayer } from '../components/QuestionPlayer';
import { GuidedSolver } from '../components/LessonParts';
import type { LRQuestion, LRType } from '../lib/types';
import { Icon } from '../visuals/Icon';

export default function OfficeHours() {
  const allThreads = useStore((s) => s.threads);
  const threads = useMemo(() => allThreads.filter((t) => t.kind === 'office-hours'), [allThreads]);
  const saveThread = useStore((s) => s.saveThread);
  const deleteThread = useStore((s) => s.deleteThread);
  const ledger = useStore((s) => s.ledger);
  const attempts = useStore((s) => s.attempts);
  const lessons = useStore((s) => s.lessons);
  const srs = useStore((s) => s.srs);
  const addCustomQuestion = useStore((s) => s.addCustomQuestion);
  const [active, setActive] = useState<ChatThread | null>(threads[0] ?? null);
  const [genType, setGenType] = useState<LRType | ''>('');
  const [genDiff, setGenDiff] = useState(4);
  const [genTopic, setGenTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [genQ, setGenQ] = useState<LRQuestion | null>(null);
  const [offlineIdx, setOfflineIdx] = useState(0);

  const weakestType = useMemo(() => {
    const ranked = CONCEPTS.filter((c) => c.kind === 'lr-type')
      .map((c) => ({ c, m: masteryFor(c, attempts, lessons, srs) }))
      .sort((a, b) => (a.m.n ? a.m.accuracy ?? 0 : 0.5) - (b.m.n ? b.m.accuracy ?? 0 : 0.5));
    return (ranked[0]?.c.id.replace('lr-', '') ?? 'flaw') as LRType;
  }, [attempts, lessons, srs]);

  const ledgerQs = ledger.filter((l) => !l.resolved).map((l) => getQuestion(l.qid)).filter((q): q is LRQuestion => !!q && isLR(q));

  const start = (title: string, opener: string, extraSystem = '') => {
    const t: ChatThread = { id: uid('t_'), kind: 'office-hours', title, ts: Date.now(), messages: [], system: extraSystem, opener };
    saveThread(t);
    setActive(t);
  };
  const activeExtra = active?.system ?? '';
  const opener = active?.opener ?? 'Good afternoon, Professor.';

  return (
    <div>
      <CasebookHeader chapter="OFFICE HOURS" title="Professor Ashworth Will See You Now" subtitle="Socratic questioning, sequenced hints, and diagrams on the blackboard." />
      <MethodNote id="socratic" />
      {!hasKey() ? (
        <div className="stack">
          <NeedsKey what="The Socratic tutor" />
          <Section numeral="I" title="Offline office hours: a guided cold call from your Ledger">
            {ledgerQs.length ? (
              <div className="stack">
                <div className="muted">Without the Faculty online, the guided method still walks you through your own mistakes, step by step.</div>
                <GuidedSolver key={ledgerQs[offlineIdx % ledgerQs.length].id} q={ledgerQs[offlineIdx % ledgerQs.length]} userSteps={99} />
                <button style={{ alignSelf: 'flex-start' }} onClick={() => setOfflineIdx((i) => i + 1)}>
                  Next mistake →
                </button>
              </div>
            ) : (
              <div className="empty">Your Ledger is empty: no mistakes to be cold-called on yet.</div>
            )}
          </Section>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: '270px minmax(0,1fr)', alignItems: 'start' }}>
          <aside className="card stack" style={{ position: 'sticky', top: 70 }}>
            <div className="label">begin a session</div>
            <button className="primary" onClick={() => start('Cold call on my mistakes', 'I am here for office hours. Please cold-call me on my recent mistakes.', 'Begin by cold-calling the student on one of their recent mistakes listed in the record. Ask a single question.')}>
              <Icon name="ledger" size={14} /> Cold call on my mistakes
            </button>
            {ledgerQs.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const q = getQuestion(e.target.value);
                  if (q) start(`Walk-through: ${typeLabel(q.type)}`, 'I missed this question. Please help me work through it without telling me the answer.', `The student wants to work through this question Socratically. Do not reveal the answer until they have reasoned to it.\n\n${questionForPrompt(q)}`);
                }}
              >
                <option value="">Work through a missed question…</option>
                {ledgerQs.slice(0, 20).map((q) => (
                  <option key={q.id} value={q.id}>
                    {typeLabel(q.type)} · {q.id}
                  </option>
                ))}
              </select>
            )}
            <button onClick={() => start('Open discussion', 'Good afternoon, Professor. I have a question about LSAT reasoning.')}>Open discussion</button>
            <hr />
            <div className="label">past sessions</div>
            {threads.map((t) => (
              <div key={t.id} className="row" style={{ flexWrap: 'nowrap' }}>
                <button className={`small ${active?.id === t.id ? 'selected' : 'ghost'}`} style={{ flex: 1, justifyContent: 'flex-start' }} onClick={() => setActive(t)}>
                  {t.title} <span className="muted" style={{ fontSize: 10 }}>({t.messages.length})</span>
                </button>
                <button className="ghost small" onClick={() => { deleteThread(t.id); if (active?.id === t.id) setActive(null); }} aria-label="Delete session">
                  ✕
                </button>
              </div>
            ))}
          </aside>
          <div className="stack">
            {active ? (
              <Chat
                key={active.id}
                who="Professor Ashworth"
                system={professorSystem() + (activeExtra ? `\n\nSession focus:\n${activeExtra}` : '')}
                messages={active.messages}
                starter={opener}
                setMessages={(m: ChatMsg[]) => {
                  const t = { ...active, messages: m };
                  setActive(t);
                  saveThread(t);
                }}
              />
            ) : (
              <div className="empty">Choose a session on the left to begin.</div>
            )}
            <Section numeral="I" title="Commission a new question">
              <div className="card stack">
                <p className="book" style={{ margin: 0 }}>
                  The Professor drafts an original question aimed at your weakest doctrine (currently <b>{typeLabel(weakestType)}</b>). It is validated, saved to your question bank, and available in drills and exams.
                </p>
                <div className="row">
                  <select value={genType} onChange={(e) => setGenType(e.target.value as LRType)} style={{ maxWidth: 260 }}>
                    <option value="">Weakest doctrine ({typeLabel(weakestType)})</option>
                    {LR_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {typeLabel(t)}
                      </option>
                    ))}
                  </select>
                  <label className="row" style={{ fontSize: 13 }}>
                    Difficulty {genDiff}
                    <input type="range" min={2} max={5} value={genDiff} onChange={(e) => setGenDiff(+e.target.value)} style={{ width: 100 }} />
                  </label>
                  <input value={genTopic} onChange={(e) => setGenTopic(e.target.value)} placeholder="Topic (optional), e.g. sovereign debt" style={{ maxWidth: 260 }} />
                  <button
                    className="primary"
                    disabled={generating}
                    onClick={async () => {
                      setGenerating(true);
                      setGenError('');
                      setGenQ(null);
                      try {
                        const q = await generateQuestion((genType || weakestType) as LRType, genDiff, genTopic);
                        addCustomQuestion(q);
                        setGenQ(q);
                      } catch (e) {
                        setGenError((e as Error).message);
                      } finally {
                        setGenerating(false);
                      }
                    }}
                  >
                    {generating ? 'Drafting…' : 'Draft a question'}
                  </button>
                </div>
                {genError && <div className="chip danger">{genError}</div>}
              </div>
              {genQ && (
                <div className="card" style={{ marginTop: 12 }}>
                  <QuestionPlayer key={genQ.id} q={genQ} context="drill" mode="adaptive" requireWhy onNext={() => setGenQ(null)} nextLabel="Done" />
                </div>
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
