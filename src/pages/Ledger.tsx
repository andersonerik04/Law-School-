import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import type { LedgerEntry, RootCause, QType } from '../lib/types';
import { getQuestion, isLR, typeLabel, TRAP_LABEL, PASSAGE_BY_ID, stimulusText } from '../lib/content';
import { LETTERS, download, dateKey } from '../lib/util';
import { CasebookHeader, MethodNote, Empty, Section } from '../components/common';
import { ROOT_CAUSES } from '../components/QuestionPlayer';
import { ArgumentDiagram, overlayForType } from '../visuals/ArgumentDiagram';
import { PassageMap } from '../visuals/RCVisuals';
import { SimpleBars } from '../components/Charts';
import { rootCauses } from '../lib/analytics';

const KIND_LABEL = { miss: 'Miss', guess: 'Correct guess', lucky: 'Lucky win' };

function EntryEditor({ e }: { e: LedgerEntry }) {
  const update = useStore((s) => s.updateLedger);
  const del = useStore((s) => s.deleteLedger);
  const removeCard = useStore((s) => s.removeCard);
  const srs = useStore((s) => s.srs);
  const q = getQuestion(e.qid);
  if (!q) return <Empty>Question no longer in the bank.</Empty>;
  const trap = q.brief.analysis.wrong.find((w) => w.choice === e.chosen);
  const card = srs[`q:${e.qid}`];
  const field = (k: 'whyWrong' | 'shouldHaveSeen' | 'rule', label: string, ph: string) => (
    <label className="field">
      {label}
      <textarea rows={2} value={e[k]} placeholder={ph} onChange={(ev) => update(e.id, { [k]: ev.target.value })} />
    </label>
  );
  return (
    <div className="grid cols-2 fade-in" style={{ alignItems: 'start', marginTop: 10 }}>
      <div className="stack">
        {isLR(q) ? (
          <div className="stimulus" style={{ fontSize: 15, whiteSpace: 'pre-wrap' }}>
            {stimulusText(q)}
          </div>
        ) : (
          <div className="muted">Passage: {PASSAGE_BY_ID[q.passageId]?.title}</div>
        )}
        <div className="stem" style={{ fontSize: 15 }}>
          {q.stem}
        </div>
        <div style={{ fontSize: 14 }}>
          <div style={{ color: 'var(--danger)' }}>
            You chose {e.chosen === null ? '—' : `(${LETTERS[e.chosen]}) ${q.choices[e.chosen]}`}
            {trap && <span className="chip danger" style={{ marginLeft: 6 }}>{TRAP_LABEL[trap.label]}</span>}
          </div>
          <div style={{ color: 'var(--success)', marginTop: 4 }}>
            Correct: ({LETTERS[q.answer]}) {q.choices[q.answer]}
          </div>
        </div>
        <div className="card flat" style={{ background: 'var(--paper)' }}>
          {isLR(q) ? <ArgumentDiagram q={q} overlay={overlayForType(q.type)} overlayText={q.choices[q.answer]} compact /> : <PassageMap paragraphs={PASSAGE_BY_ID[q.passageId]?.passages.flatMap((p) => p.paragraphs) ?? []} />}
        </div>
        <div className="holding" style={{ fontStyle: 'italic', background: 'var(--gold-soft)', border: '1px solid var(--gold)', padding: 8, borderRadius: 4 }}>
          Holding: {q.brief.holding}
        </div>
      </div>
      <div className="stack">
        {field('whyWrong', 'Why I chose wrong', 'What made the wrong answer attractive?')}
        {field('shouldHaveSeen', 'What I should have seen', 'The signal in the stimulus or stem I missed…')}
        {field('rule', 'Rule to remember', 'A one-line rule I can apply next time…')}
        <div>
          <div className="label">root cause</div>
          <div className="row" style={{ marginTop: 4 }}>
            {ROOT_CAUSES.map((r) => (
              <button key={r.id} className={`small ${e.rootCause === r.id ? 'selected' : ''}`} title={r.blurb} onClick={() => update(e.id, { rootCause: r.id })}>
                {r.id}
              </button>
            ))}
          </div>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          {card ? `Spaced review: next due ${new Date(card.due).toLocaleDateString()} (step ${Math.max(0, card.step) + 1})` : 'Not in the review queue.'}
        </div>
        <div className="row">
          <Link className="btn primary" to={`/q/${q.id}`}>
            Re-attempt
          </Link>
          <button onClick={() => update(e.id, { resolved: !e.resolved })}>{e.resolved ? 'Reopen' : 'Mark resolved'}</button>
          <button
            className="danger small"
            onClick={() => {
              if (confirm('Delete this ledger entry?')) {
                del(e.id);
                removeCard(`q:${e.qid}`);
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Ledger() {
  const ledger = useStore((s) => s.ledger);
  const [kind, setKind] = useState<'all' | LedgerEntry['kind']>('all');
  const [cause, setCause] = useState<'all' | RootCause>('all');
  const [type, setType] = useState('');
  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open');
  const [sort, setSort] = useState<'new' | 'old' | 'type'>('new');
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    let r = ledger.filter((e) => (kind === 'all' || e.kind === kind) && (cause === 'all' || e.rootCause === cause) && (status === 'all' || (status === 'open' ? !e.resolved : e.resolved)));
    if (type) r = r.filter((e) => getQuestion(e.qid)?.type === type);
    if (search) r = r.filter((e) => JSON.stringify(e).toLowerCase().includes(search.toLowerCase()) || getQuestion(e.qid)?.stem.toLowerCase().includes(search.toLowerCase()));
    return r.sort((a, b) => (sort === 'new' ? b.ts - a.ts : sort === 'old' ? a.ts - b.ts : (getQuestion(a.qid)?.type ?? '').localeCompare(getQuestion(b.qid)?.type ?? '')));
  }, [ledger, kind, cause, status, type, sort, search]);

  const types = Array.from(new Set(ledger.map((e) => getQuestion(e.qid)?.type).filter(Boolean))) as QType[];
  const briefed = ledger.filter((e) => e.whyWrong && e.rule && e.rootCause !== 'Unclassified').length;

  const exportCsv = () => {
    const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
    const lines = ['date,question,type,kind,chosen,correct,root_cause,why_wrong,should_have_seen,rule,resolved'];
    ledger.forEach((e) => {
      const q = getQuestion(e.qid);
      lines.push([new Date(e.ts).toISOString(), e.qid, q ? typeLabel(q.type) : '', e.kind, e.chosen === null ? '' : LETTERS[e.chosen], q ? LETTERS[q.answer] : '', e.rootCause, esc(e.whyWrong), esc(e.shouldHaveSeen), esc(e.rule), e.resolved ? 'yes' : 'no'].join(','));
    });
    download(`clerks-ledger-${dateKey()}.csv`, lines.join('\n'), 'text/csv');
  };

  return (
    <div>
      <CasebookHeader chapter="THE CLERK’S LEDGER" title="The Record of Errors" subtitle={`${ledger.length} entries · ${briefed} fully briefed · ${ledger.filter((e) => !e.resolved).length} open`} />
      <MethodNote id="errors">Every miss, correct guess, and lucky win is logged here automatically and enters spaced review.</MethodNote>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 320px', alignItems: 'start' }}>
        <div>
          <div className="card row" style={{ marginBottom: 12 }}>
            <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 180 }} />
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} style={{ width: 'auto' }}>
              <option value="all">All kinds</option>
              <option value="miss">Misses</option>
              <option value="guess">Correct guesses</option>
              <option value="lucky">Lucky wins</option>
            </select>
            <select value={cause} onChange={(e) => setCause(e.target.value as typeof cause)} style={{ width: 'auto' }}>
              <option value="all">All root causes</option>
              {[...ROOT_CAUSES.map((r) => r.id), 'Unclassified'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: 'auto' }}>
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} style={{ width: 'auto' }}>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={{ width: 'auto' }}>
              <option value="new">Newest</option>
              <option value="old">Oldest</option>
              <option value="type">By type</option>
            </select>
          </div>
          {!rows.length && <Empty>No entries match. Errors you make in drills, lessons, and exams appear here.</Empty>}
          <div className="stack tight">
            {rows.map((e) => {
              const q = getQuestion(e.qid);
              const complete = e.whyWrong && e.shouldHaveSeen && e.rule && e.rootCause !== 'Unclassified';
              return (
                <div key={e.id} className="card" style={{ padding: '10px 14px', opacity: e.resolved ? 0.65 : 1 }}>
                  <div className="row between" style={{ cursor: 'pointer' }} onClick={() => setOpen(open === e.id ? null : e.id)}>
                    <div className="row">
                      <span className={`chip ${e.kind === 'miss' ? 'danger' : 'gold'}`}>{KIND_LABEL[e.kind]}</span>
                      <b style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>{q ? typeLabel(q.type) : e.qid}</b>
                      <span className="muted" style={{ fontSize: 13 }}>
                        {new Date(e.ts).toLocaleDateString()} · {e.qid}
                      </span>
                    </div>
                    <div className="row">
                      <span className="chip">{e.rootCause}</span>
                      <span className={`chip ${complete ? 'success' : ''}`}>{complete ? 'Briefed' : 'Needs reflection'}</span>
                      <span>{open === e.id ? '▾' : '▸'}</span>
                    </div>
                  </div>
                  {open === e.id && <EntryEditor e={e} />}
                </div>
              );
            })}
          </div>
        </div>
        <aside className="stack" style={{ position: 'sticky', top: 70 }}>
          <div className="card">
            <h3>Root causes</h3>
            <SimpleBars data={rootCauses(ledger).map((c) => ({ label: c.cause, value: c.n }))} unit="" height={220} color="var(--secondary)" />
          </div>
          <Section title="Export">
            <div className="row">
              <button onClick={exportCsv}>Export CSV</button>
              <button onClick={() => download(`clerks-ledger-${dateKey()}.json`, JSON.stringify(ledger, null, 1))}>Export JSON</button>
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}
