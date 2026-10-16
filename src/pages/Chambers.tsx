import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { allQuestions, CONCEPT_BY_ID, FLAW_LABEL, FLAWS, isLR, LR_TYPES, RC_TYPES, typeLabel, questionsForConcept, LR_PACE_MS, RC_SET_MS, PASSAGE_BY_ID } from '../lib/content';
import type { Attempt, Bloom, FlawId, PracticeMode, QType, Question } from '../lib/types';
import { pickAdaptive, pCorrect, ZONE } from '../lib/adaptive';
import { currentWeek, introducedConcepts, weekInfo } from '../lib/mastery';
import { shuffle, fmtTime, pct } from '../lib/util';
import { CasebookHeader, MethodNote, Section, Progress, Empty } from '../components/common';
import { QuestionPlayer } from '../components/QuestionPlayer';
import { SimpleBars } from '../components/Charts';
import { Icon } from '../visuals/Icon';

const BLOOMS: Bloom[] = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];

interface Config {
  mode: PracticeMode;
  types: QType[];
  flaws: FlawId[];
  dmin: number;
  dmax: number;
  topic: string;
  bloom: Bloom | '';
  missedOnly: boolean;
  includeRC: boolean;
  n: number;
  timed: boolean;
  diagramFirst: boolean;
  whyAlways: boolean;
  concept: string;
}

/** Keep RC questions grouped by passage so a set is never split. */
function groupRC(qs: Question[]): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  for (const q of qs) {
    if (isLR(q)) out.push(q);
    else if (!seen.has(q.passageId)) {
      seen.add(q.passageId);
      out.push(...qs.filter((x) => !isLR(x) && x.passageId === q.passageId));
    }
  }
  return out;
}

export default function Chambers() {
  const [params] = useSearchParams();
  const profile = useStore((s) => s.profile);
  const attempts = useStore((s) => s.attempts);
  const ledger = useStore((s) => s.ledger);
  const theta = useStore((s) => s.theta);
  const addDrill = useStore((s) => s.addDrill);
  const week = currentWeek(profile.startDate, profile.planWeeks);
  const info = weekInfo(week);
  const introduced = useMemo(() => introducedConcepts(week), [week]);
  const defaultMode: PracticeMode = week >= 25 ? 'adaptive' : info.blockedRatio >= 0.5 ? 'blocked' : 'interleaved';

  const [cfg, setCfg] = useState<Config>(() => ({
    mode: (params.get('mode') as PracticeMode) || defaultMode,
    types: params.get('type') ? [params.get('type') as QType] : [],
    flaws: [],
    dmin: 1,
    dmax: 5,
    topic: '',
    bloom: '',
    missedOnly: params.get('missed') === '1',
    includeRC: true,
    n: Number(params.get('n') || 12),
    timed: false,
    diagramFirst: false,
    whyAlways: false,
    concept: params.get('concept') || '',
  }));
  const [session, setSession] = useState<Question[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Attempt[]>([]);
  const [startTs, setStartTs] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session]);

  const topics = useMemo(() => Array.from(new Set(allQuestions().map((q) => q.topic))).sort(), []);
  const missedIds = useMemo(() => new Set(ledger.filter((l) => !l.resolved).map((l) => l.qid)), [ledger]);

  const pool = useMemo(() => {
    let qs = allQuestions();
    if (cfg.concept && CONCEPT_BY_ID[cfg.concept]) qs = questionsForConcept(CONCEPT_BY_ID[cfg.concept]);
    if (cfg.types.length) qs = qs.filter((q) => cfg.types.includes(q.type));
    if (cfg.flaws.length) qs = qs.filter((q) => isLR(q) && q.flaw && cfg.flaws.includes(q.flaw));
    if (!cfg.includeRC) qs = qs.filter(isLR);
    qs = qs.filter((q) => q.difficulty >= cfg.dmin && q.difficulty <= cfg.dmax);
    if (cfg.topic) qs = qs.filter((q) => q.topic === cfg.topic);
    if (cfg.bloom) qs = qs.filter((q) => q.bloom === cfg.bloom);
    if (cfg.missedOnly) qs = qs.filter((q) => missedIds.has(q.id));
    return qs;
  }, [cfg, missedIds]);

  const build = (auto = false) => {
    let qs: Question[];
    const recent = new Set(attempts.slice(-60).map((a) => a.qid));
    if (auto && !cfg.concept && !cfg.types.length) {
      // Docket set: this week's blocked share on current concepts + interleaved share across introduced doctrines
      const nBlocked = Math.round(cfg.n * info.blockedRatio);
      const current = info.concepts.flatMap((c) => (CONCEPT_BY_ID[c] ? questionsForConcept(CONCEPT_BY_ID[c]) : []));
      const introducedQs = allQuestions().filter((q) => [...introduced].some((c) => CONCEPT_BY_ID[c] && questionsForConcept(CONCEPT_BY_ID[c]).some((x) => x.id === q.id)));
      const blockedPart = shuffle(current.filter((q) => !recent.has(q.id))).slice(0, nBlocked);
      const base = introducedQs.length >= 6 ? introducedQs : allQuestions().filter(isLR);
      const rest = (week >= 25 ? pickAdaptive(base, theta, cfg.n * 2, recent) : shuffle(base)).filter((q) => !blockedPart.includes(q));
      qs = [...blockedPart.sort((a, b) => a.type.localeCompare(b.type)), ...rest.filter(isLR).slice(0, cfg.n - blockedPart.length)];
    } else if (cfg.mode === 'adaptive') {
      qs = pickAdaptive(pool, theta, cfg.n, recent);
    } else if (cfg.mode === 'blocked') {
      const fresh = [...shuffle(pool.filter((q) => !recent.has(q.id))), ...shuffle(pool.filter((q) => recent.has(q.id)))].slice(0, cfg.n);
      qs = fresh.sort((a, b) => (a.type === b.type ? a.difficulty - b.difficulty : a.type.localeCompare(b.type)));
    } else {
      qs = [...shuffle(pool.filter((q) => !recent.has(q.id))), ...shuffle(pool.filter((q) => recent.has(q.id)))].slice(0, cfg.n);
      qs = shuffle(qs);
    }
    qs = groupRC(qs);
    if (!qs.length) return;
    setSession(qs);
    setIdx(0);
    setResults([]);
    setStartTs(Date.now());
  };

  useEffect(() => {
    if (params.get('auto') === '1') build(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const budgetMs = useMemo(() => {
    if (!session) return 0;
    const lr = session.filter(isLR).length;
    const sets = new Set(session.filter((q) => !isLR(q)).map((q) => (q as { passageId: string }).passageId)).size;
    return lr * LR_PACE_MS + sets * RC_SET_MS;
  }, [session]);

  const finished = session && idx >= session.length;
  useEffect(() => {
    if (finished && results.length) {
      addDrill({ ts: Date.now(), conceptOrType: cfg.concept || cfg.types.join(',') || 'mixed', mode: cfg.mode, correct: results.filter((r) => r.correct).length, total: results.length });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  // ── In-session view ─────────────────────────────────────────
  if (session && !finished) {
    const q = session[idx];
    const elapsed = now - startTs;
    const remaining = budgetMs - elapsed;
    const passage = !isLR(q) ? PASSAGE_BY_ID[q.passageId] : undefined;
    const firstOfSet = passage && (idx === 0 || isLR(session[idx - 1]) || (session[idx - 1] as { passageId: string }).passageId !== passage.id);
    return (
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <div className="row">
            <span className="label">chambers · {cfg.mode} {cfg.timed ? '· timed' : ''}</span>
            <span className="chip">
              {idx + 1} / {session.length}
            </span>
            <span className="chip success">{results.filter((r) => r.correct).length} correct</span>
          </div>
          <div className="row">
            {cfg.timed ? (
              <span className={`chip ${remaining < 0 ? 'danger' : 'gold'}`}>
                <Icon name="timer" size={13} /> {remaining >= 0 ? fmtTime(remaining) + ' left' : fmtTime(-remaining) + ' over'}
              </span>
            ) : (
              <span className="chip">
                <Icon name="timer" size={13} /> {fmtTime(elapsed)}
              </span>
            )}
            <button className="small ghost" onClick={() => setIdx(session.length)}>
              End session
            </button>
          </div>
        </div>
        <Progress value={idx} max={session.length} />
        <div style={{ height: 12 }} />
        <QuestionPlayer
          key={q.id + idx}
          q={q}
          context="drill"
          mode={cfg.mode}
          revealType={cfg.mode === 'blocked'}
          requireWhy={cfg.whyAlways ? true : undefined}
          diagramFirst={cfg.diagramFirst && (isLR(q) || !!firstOfSet)}
          onAttempt={(a) => setResults((r) => [...r, a])}
          onNext={() => setIdx(idx + 1)}
          nextLabel={idx + 1 < session.length ? 'Next question →' : 'Close the session'}
        />
      </div>
    );
  }

  // ── Session report ──────────────────────────────────────────
  if (session && finished) {
    const correct = results.filter((r) => r.correct).length;
    const byType = Object.entries(
      results.reduce<Record<string, { c: number; n: number }>>((m, r) => {
        m[r.type] ??= { c: 0, n: 0 };
        m[r.type].n++;
        if (r.correct) m[r.type].c++;
        return m;
      }, {}),
    ).map(([t, v]) => ({ label: typeLabel(t as QType), value: (v.c / v.n) * 100 }));
    const guesses = results.filter((r) => r.correct && r.confidence === 'Guess').length;
    const lucky = results.filter((r) => r.lucky).length;
    const totalTime = results.reduce((s, r) => s + r.timeMs, 0);
    return (
      <div>
        <CasebookHeader chapter="CHAMBERS · SESSION REPORT" title={`${correct} of ${results.length} sustained`} subtitle={`${pct(correct, results.length)}% · ${fmtTime(totalTime)} total · ${fmtTime(totalTime / Math.max(1, results.length))} per question`} />
        <div className="grid cols-2">
          <div className="card">
            <h3>Accuracy by type</h3>
            <SimpleBars data={byType} domain={[0, 100]} refLine={85} />
          </div>
          <div className="card stack">
            <h3>Findings</h3>
            <div>
              {results.length - correct} miss{results.length - correct === 1 ? '' : 'es'}, {guesses} correct guess{guesses === 1 ? '' : 'es'}, and {lucky} lucky win{lucky === 1 ? '' : 's'} were logged to the Clerk’s Ledger and scheduled for spaced review.
            </div>
            <MethodNote id="deliberate">Practice in the 60–75% zone feels hard—that is the point.</MethodNote>
            <p className="book" style={{ fontSize: 16 }}>
              {pct(correct, results.length) >= 85
                ? 'Excellent discipline. Your method held up across the set—raise the difficulty or switch to adaptive mode to keep growing.'
                : pct(correct, results.length) >= 60
                  ? 'Solid, productive work in the growth zone. Brief each ledger entry while the reasoning is fresh.'
                  : 'This set was hard—good. Review the case briefs for each miss and revisit the lesson for the type that cost you most.'}
            </p>
            <div className="row">
              <button className="primary" onClick={() => build()}>
                Another set
              </button>
              <Link className="btn" to="/ledger">
                Brief my errors in the Ledger
              </Link>
              <button className="ghost" onClick={() => setSession(null)}>
                Change filters
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Configuration ───────────────────────────────────────────
  const toggleType = (t: QType) => setCfg((c) => ({ ...c, types: c.types.includes(t) ? c.types.filter((x) => x !== t) : [...c.types, t] }));
  const toggleFlaw = (f: FlawId) => setCfg((c) => ({ ...c, flaws: c.flaws.includes(f) ? c.flaws.filter((x) => x !== f) : [...c.flaws, f] }));
  const zone = pool.length ? Math.round((pool.filter((q) => { const p = pCorrect(theta, q.type, q.difficulty); return p >= ZONE[0] && p <= ZONE[1]; }).length / pool.length) * 100) : 0;

  return (
    <div>
      <CasebookHeader chapter="CHAMBERS" title="Custom Drills" subtitle="Where doctrine becomes reflex." />
      <div className="card gilt row between" style={{ marginBottom: 16 }}>
        <div>
          <div className="label">this week’s practice mix · week {week}</div>
          <div className="row" style={{ marginTop: 4 }}>
            <div style={{ width: 260 }}>
              <div className="bar">
                <div style={{ width: `${info.blockedRatio * 100}%`, background: 'var(--primary)' }} />
              </div>
            </div>
            <span className="muted" style={{ fontSize: 13 }}>
              {Math.round(info.blockedRatio * 100)}% blocked · {100 - Math.round(info.blockedRatio * 100)}% interleaved
            </span>
          </div>
          <MethodNote id="interleaving">Term I is mostly blocked; by Term III every set is fully interleaved.</MethodNote>
        </div>
        <button className="primary" onClick={() => build(true)}>
          Start today’s docket set →
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px', alignItems: 'start' }}>
        <div>
          <Section numeral="I" title="Mode">
            <div className="grid cols-3">
              {(['blocked', 'interleaved', 'adaptive'] as PracticeMode[]).map((m) => (
                <button key={m} className={`card ${cfg.mode === m ? 'gilt' : ''}`} style={{ textAlign: 'left', display: 'block', cursor: 'pointer' }} onClick={() => setCfg({ ...cfg, mode: m })}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, textTransform: 'capitalize' }}>
                    {cfg.mode === m ? '◆ ' : ''}
                    {m}
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {m === 'blocked' ? 'One type at a time, easiest first: for learning a new doctrine.' : m === 'interleaved' ? 'Types mixed at random: you must identify the type yourself.' : 'The engine serves questions you have a 60–75% chance of answering.'}
                  </div>
                </button>
              ))}
            </div>
            {cfg.mode === 'adaptive' && <MethodNote id="deliberate" />}
          </Section>

          <Section numeral="II" title="Filters">
            {cfg.concept && CONCEPT_BY_ID[cfg.concept] && (
              <div className="chip gold" style={{ marginBottom: 10 }}>
                Doctrine: {CONCEPT_BY_ID[cfg.concept].label}
                <button className="ghost small" onClick={() => setCfg({ ...cfg, concept: '' })}>
                  ✕
                </button>
              </div>
            )}
            <div className="card stack">
              <div>
                <div className="label">question types</div>
                <div className="row" style={{ gap: 5, marginTop: 4 }}>
                  {[...LR_TYPES, ...RC_TYPES].map((t) => (
                    <button key={t} className={`chip ${cfg.types.includes(t) ? 'primary' : ''}`} onClick={() => toggleType(t)}>
                      {typeLabel(t)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="label">flaw patterns</div>
                <div className="row" style={{ gap: 5, marginTop: 4 }}>
                  {FLAWS.map((f) => (
                    <button key={f} className={`chip ${cfg.flaws.includes(f) ? 'primary' : ''}`} onClick={() => toggleFlaw(f)}>
                      <Icon name={f} size={12} /> {FLAW_LABEL[f]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid cols-3">
                <label className="field">
                  Difficulty {cfg.dmin}–{cfg.dmax}
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <input type="range" min={1} max={5} value={cfg.dmin} onChange={(e) => setCfg({ ...cfg, dmin: Math.min(+e.target.value, cfg.dmax) })} />
                    <input type="range" min={1} max={5} value={cfg.dmax} onChange={(e) => setCfg({ ...cfg, dmax: Math.max(+e.target.value, cfg.dmin) })} />
                  </div>
                </label>
                <label className="field">
                  Topic
                  <select value={cfg.topic} onChange={(e) => setCfg({ ...cfg, topic: e.target.value })}>
                    <option value="">All topics</option>
                    {topics.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Bloom’s level
                  <select value={cfg.bloom} onChange={(e) => setCfg({ ...cfg, bloom: e.target.value as Bloom | '' })}>
                    <option value="">All levels</option>
                    {BLOOMS.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="row">
                <label className="row">
                  <input type="checkbox" checked={cfg.missedOnly} onChange={(e) => setCfg({ ...cfg, missedOnly: e.target.checked })} /> Previously missed only ({missedIds.size})
                </label>
                <label className="row">
                  <input type="checkbox" checked={cfg.includeRC} onChange={(e) => setCfg({ ...cfg, includeRC: e.target.checked })} /> Include RC sets
                </label>
              </div>
            </div>
          </Section>
        </div>

        <aside className="card gilt stack" style={{ position: 'sticky', top: 70 }}>
          <div className="label">the session</div>
          <div className="stat">
            <span className="v">{pool.length}</span>
            <span className="k">questions match</span>
          </div>
          {cfg.mode === 'adaptive' && <div className="muted" style={{ fontSize: 13 }}>{zone}% of the matching pool sits in your 60–75% zone.</div>}
          <label className="field">
            Set size: {cfg.n}
            <input type="range" min={3} max={40} value={cfg.n} onChange={(e) => setCfg({ ...cfg, n: +e.target.value })} />
          </label>
          <label className="row">
            <input type="checkbox" checked={cfg.timed} onChange={(e) => setCfg({ ...cfg, timed: e.target.checked })} /> Timed (~1:20 per LR question, ~8:30 per RC set)
          </label>
          <label className="row">
            <input type="checkbox" checked={cfg.diagramFirst} onChange={(e) => setCfg({ ...cfg, diagramFirst: e.target.checked })} /> Diagram First (map before choices)
          </label>
          <label className="row">
            <input type="checkbox" checked={cfg.whyAlways} onChange={(e) => setCfg({ ...cfg, whyAlways: e.target.checked })} /> Require “Why?” on every question
          </label>
          <MethodNote id="metacognition">Confidence is required before every submission.</MethodNote>
          <button className="primary" disabled={!pool.length} onClick={() => build()}>
            Convene chambers →
          </button>
          {!pool.length && <Empty>No questions match these filters.</Empty>}
        </aside>
      </div>
    </div>
  );
}
