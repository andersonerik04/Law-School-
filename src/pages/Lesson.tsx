import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CONCEPT_BY_ID, questionsForConcept, isLR, PASSAGE_BY_ID, typeLabel } from '../lib/content';
import type { Concept, LRQuestion, Question, RCQuestion } from '../lib/types';
import { useStore } from '../lib/store';
import { CasebookHeader, MethodNote, ReadAloud, Empty, RankBadge } from '../components/common';
import { QuestionPlayer } from '../components/QuestionPlayer';
import { PassageMapBuilder } from '../components/DiagramBuilder';
import { WorkedExample, GuidedSolver, ConceptWalkthrough, NameTheFlaw, TranslateGuided, StemIdGuided, BrainDump, ColdCall, LessonMap, CLVisual } from '../components/LessonParts';
import { BuildAMap, FreeCanvas } from '../visuals/MindMap';
import { idTree } from '../visuals/mindLayout';
import { PassageMap, ViewpointMap, ToneMeter, ComparativeVenn } from '../visuals/RCVisuals';
import { masteryFor } from '../lib/mastery';
import { toRoman, mentions } from '../lib/util';

type StageId = 'cold' | 'pf' | 'objective' | 'examples' | 'ido' | 'wedo' | 'youdo' | 'rebuild' | 'dump' | 'exit';
const STAGE_LABEL: Record<StageId, string> = {
  cold: 'Cold Call',
  pf: 'Attempt First',
  objective: 'Objective & Map',
  examples: 'Concrete Examples',
  ido: 'I Do',
  wedo: 'We Do',
  youdo: 'You Do',
  rebuild: 'Rebuild the Map',
  dump: 'Brain Dump',
  exit: 'Exit Ticket',
};

const INDICATOR_SETS: Record<string, string[]> = {
  'cl-suff-nec': ['if', 'only-if', 'requires', 'only', 'sufficient', 'must'],
  'cl-contrapositive': ['if', 'all', 'no', 'whenever'],
  'cl-unless': ['unless', 'until', 'no-unless', 'without'],
  'cl-quantifiers': ['all', 'no', 'only', 'the-only'],
  'cl-chaining': ['if', 'requires', 'all', 'unless'],
};

function allocate(c: Concept, typeAttempts: number) {
  const pool = questionsForConcept(c);
  const lr = pool.filter(isLR).sort((a, b) => a.difficulty - b.difficulty) as LRQuestion[];
  const rc = pool.filter((q) => !isLR(q)) as RCQuestion[];
  const ido = lr[0];
  const wedo = lr.slice(1, lr.length >= 5 ? 3 : 2);
  const rest = lr.slice(1 + wedo.length);
  const pf = c.kind === 'lr-type' && typeAttempts === 0 && rest.length >= 1 ? rest[rest.length - 1] : undefined;
  let youdo: Question[] = rest.filter((q) => q !== pf).slice(0, 3);
  if (!youdo.length && rc.length) youdo = rc.slice(0, 4);
  if (!youdo.length) {
    // borrow from related doctrines so independent practice always exists
    const used = new Set([ido, ...wedo, pf].filter(Boolean).map((q) => q!.id));
    const related = (c.links ?? []).flatMap((l) => (CONCEPT_BY_ID[l] ? questionsForConcept(CONCEPT_BY_ID[l]) : [])).filter((q) => !used.has(q.id));
    youdo = related.slice(0, 2);
  }
  const exitQs: Question[] = [];
  if (pf) exitQs.push(pf);
  const usedIds = new Set([ido, ...wedo, ...youdo, pf].filter(Boolean).map((q) => q!.id));
  const spare = [...lr, ...rc].find((q) => !usedIds.has(q.id));
  if (spare) exitQs.push(spare);
  return { lr, rc, ido, wedo, pf, youdo, exitQs };
}

export default function Lesson() {
  const { id = '' } = useParams();
  const c = CONCEPT_BY_ID[id];
  const nav = useNavigate();
  const lessons = useStore((s) => s.lessons);
  const setLesson = useStore((s) => s.setLesson);
  const ensureCard = useStore((s) => s.ensureCard);
  const attempts = useStore((s) => s.attempts);
  const srs = useStore((s) => s.srs);
  const progress = lessons[id];
  const typeAttempts = useMemo(() => (c?.kind === 'lr-type' ? attempts.filter((a) => `lr-${a.type}` === c.id && a.context !== 'diagnostic').length : 1), [c, attempts]);
  // allocate once per visit so the plan doesn't shift mid-lesson
  const alloc = useMemo(() => (c ? allocate(c, typeAttempts) : null), [c?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const stages: StageId[] = useMemo(() => {
    const s: StageId[] = ['cold'];
    if (alloc?.pf) s.push('pf');
    s.push('objective', 'examples', 'ido', 'wedo', 'youdo', 'rebuild', 'dump', 'exit');
    return s;
  }, [alloc]);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    setStage(progress && !progress.completed ? Math.min(progress.stage, stages.length - 1) : 0);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [youIdx, setYouIdx] = useState(0);
  const [weIdx, setWeIdx] = useState(0);
  const [exitIdx, setExitIdx] = useState(0);
  const [exitCorrect, setExitCorrect] = useState(0);
  const [recall, setRecall] = useState('');
  const [recallShown, setRecallShown] = useState(false);
  const [pfDone, setPfDone] = useState(false);

  if (!c || !alloc) return <Empty>No such lesson in the Casebook.</Empty>;
  const sid = stages[stage];
  const go = (n: number) => {
    const s = Math.max(0, Math.min(stages.length - 1, n));
    setStage(s);
    setLesson(c.id, { stage: s });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const next = () => go(stage + 1);
  const m = masteryFor(c, attempts, lessons, srs);
  const tree = c.mindMap ? idTree(c.mindMap, c.id + '-m-') : null;
  const passage = alloc.rc[0] ? PASSAGE_BY_ID[alloc.rc[0].passageId] : undefined;

  const complete = (exitScore: number) => {
    setLesson(c.id, { completed: true, exitScore, stage: stages.length - 1 });
    ensureCard(`concept:${c.id}`, 'concept', c.id);
    if (c.mindMap) ensureCard(`map:${c.id}`, 'map', c.id);
    if (c.branch === 'CL') (INDICATOR_SETS[c.id] ?? []).forEach((ind) => ensureCard(`ind:${ind}`, 'indicator', ind));
  };

  const NextBtn = ({ label = 'Continue →', disabled }: { label?: string; disabled?: boolean }) => (
    <div className="row" style={{ marginTop: 14 }}>
      <button className="primary" onClick={next} disabled={disabled}>
        {label}
      </button>
      {stage > 0 && (
        <button className="ghost" onClick={() => go(stage - 1)}>
          ← Previous
        </button>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <CasebookHeader chapter={c.chapter ?? 'THE CASEBOOK'} title={<>§ {c.label}</>} subtitle={c.oneLiner} />
      <div className="row between no-print" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 4 }}>
          {stages.map((s, i) => (
            <button key={s} className={`small ${i === stage ? 'selected' : 'ghost'}`} onClick={() => go(i)} title={STAGE_LABEL[s]} style={{ opacity: i > stage && !progress?.completed ? 0.6 : 1 }}>
              <span style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)' }}>{toRoman(i + 1)}</span> {STAGE_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="row">
          <RankBadge level={m.level} />
          <span className="chip">≈ 10–12 min</span>
        </div>
      </div>

      <div className="page-turn" key={sid}>
        {sid === 'cold' && <ColdCall c={c} onDone={next} />}

        {sid === 'pf' && alloc.pf && (
          <div>
            <MethodNote id="errors">Productive failure: try this new type before being taught. Struggle now, clarity later. You will revisit this exact question in the Exit Ticket.</MethodNote>
            <QuestionPlayer q={alloc.pf} context="lesson" mode="blocked" feedback="none" requireWhy requireConfidence onNext={() => setPfDone(true)} />
            {pfDone && <NextBtn label="Now learn the method →" />}
          </div>
        )}

        {sid === 'objective' && (
          <div className="stack">
            <div className="card gilt">
              <div className="label">objective</div>
              <p className="book" style={{ fontSize: 18, margin: '4px 0' }}>
                By the end of this §, you will be able to:
              </p>
              <ul className="book" style={{ fontSize: 17 }}>
                {(c.objectives ?? [c.oneLiner]).map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
              <MethodNote id="load" />
            </div>
            <div className="card">
              <div className="row between">
                <div className="label">the big picture — concept map</div>
                <ReadAloud text={`${c.label}. ${c.definition ?? c.oneLiner}`} />
              </div>
              <MethodNote id="dual" />
              {tree && <LessonMap c={c} />}
              <p className="book" style={{ fontSize: 17, marginTop: 12 }}>
                {c.definition}
              </p>
              {c.stemCues && c.stemCues.length > 0 && (
                <div className="row">
                  <span className="label">stem cues</span>
                  {c.stemCues.map((s) => (
                    <span key={s} className="chip">
                      “{s}”
                    </span>
                  ))}
                </div>
              )}
              {c.branch === 'CL' && <div style={{ marginTop: 12 }}><CLVisual c={c} /></div>}
              {c.branch === 'RC' && passage && (
                <div className="grid cols-2" style={{ marginTop: 12 }}>
                  {c.id === 'rcs-tone' || c.id === 'rct-attitude' ? <ToneMeter value={passage.tone.value} word={passage.tone.word} note={passage.tone.note} /> : null}
                  {c.id === 'rcs-viewpoints' ? <ViewpointMap passage={passage} /> : null}
                  {c.id === 'rcs-comparative' || c.id === 'rct-comparative' ? (PASSAGE_BY_ID['rc-05']?.comparison ? <ComparativeVenn comparison={PASSAGE_BY_ID['rc-05'].comparison!} /> : null) : null}
                </div>
              )}
            </div>
            <NextBtn />
          </div>
        )}

        {sid === 'examples' && (
          <div className="stack">
            <MethodNote id="examples" />
            <div className="grid cols-3">
              {(c.examples ?? []).map((e, i) => (
                <div key={i} className="card">
                  <div className="label">{e.domain}</div>
                  <p className="book" style={{ fontSize: 16 }}>
                    {e.text}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid cols-2">
              {c.correctLooksLike && (
                <div className="card">
                  <div className="label">what the right answer looks like</div>
                  <p className="book" style={{ fontSize: 16 }}>
                    {c.correctLooksLike}
                  </p>
                </div>
              )}
              {(c.traps?.length ?? 0) > 0 && (
                <div className="card">
                  <div className="label">the usual traps</div>
                  <ul className="book" style={{ fontSize: 16 }}>
                    {c.traps!.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <NextBtn />
          </div>
        )}

        {sid === 'ido' && (
          <div>
            <h2>I Do — the worked example</h2>
            {alloc.ido ? (
              <WorkedExample q={alloc.ido} />
            ) : c.branch === 'RC' && passage ? (
              <div className="stack">
                <MethodNote id="release">Watch the passage map build itself, paragraph by paragraph.</MethodNote>
                <AnimatedPassage passageId={passage.id} />
              </div>
            ) : (
              <ConceptWalkthrough c={c} />
            )}
            <NextBtn label="Your turn, with help →" />
          </div>
        )}

        {sid === 'wedo' && (
          <div>
            <h2>We Do — guided practice</h2>
            <MethodNote id="faded" />
            {alloc.wedo.length > 0 ? (
              <div className="stack">
                <div className="row">
                  {alloc.wedo.map((q, i) => (
                    <button key={q.id} className={`small ${weIdx === i ? 'selected' : ''}`} onClick={() => setWeIdx(i)}>
                      Example {i + 1} · {i === 0 ? 'final steps are yours' : 'every step is yours'}
                    </button>
                  ))}
                </div>
                <GuidedSolver key={alloc.wedo[weIdx].id + weIdx} q={alloc.wedo[weIdx] as LRQuestion} userSteps={weIdx === 0 ? 2 : 99} onDone={() => weIdx < alloc.wedo.length - 1 && setTimeout(() => setWeIdx(weIdx + 1), 900)} />
              </div>
            ) : c.kind === 'flaw' ? (
              <NameTheFlaw focus={c.id.replace('flaw-', '')} />
            ) : c.branch === 'CL' ? (
              <TranslateGuided ids={INDICATOR_SETS[c.id]} />
            ) : c.branch === 'RC' && passage ? (
              <PassageMapBuilder passage={passage} onDone={() => undefined} />
            ) : c.id === 'ts-stem-id' ? (
              <StemIdGuided />
            ) : c.branch === 'AW' ? (
              <div className="stack">
                <p className="book">Sketch a quick pre-write map for this question: “Should international tribunals publish dissenting opinions?”</p>
                <FreeCanvas initial={{ nodes: [{ id: 'c', label: 'My position', x: 0, y: 0 }], edges: [] }} height={360} />
              </div>
            ) : (
              <GenericReflect c={c} />
            )}
            {c.kind === 'flaw' && alloc.wedo.length === 0 && null}
            <NextBtn label="On your own →" />
          </div>
        )}

        {sid === 'youdo' && (
          <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 280px', alignItems: 'start' }}>
            <div>
              <h2>You Do — independent practice</h2>
              <MethodNote id="release">No hints now.</MethodNote>
              {alloc.youdo.length > 0 && youIdx < alloc.youdo.length ? (
                <>
                  <div className="muted" style={{ marginBottom: 6 }}>
                    Question {youIdx + 1} of {alloc.youdo.length}
                  </div>
                  <QuestionPlayer key={alloc.youdo[youIdx].id} q={alloc.youdo[youIdx]} context="lesson" mode="blocked" revealType onNext={() => setYouIdx(youIdx + 1)} nextLabel={youIdx + 1 < alloc.youdo.length ? 'Next question →' : 'Finish practice'} />
                </>
              ) : alloc.youdo.length > 0 ? (
                <div className="card">
                  <p>Independent practice complete.</p>
                  <NextBtn label="Rebuild the map →" />
                </div>
              ) : (
                <div className="stack">
                  {c.kind === 'flaw' ? <NameTheFlaw n={5} /> : c.id === 'ts-stem-id' ? <StemIdGuided n={8} /> : c.branch === 'AW' ? <Link className="btn primary" to="/writing">Write a timed essay in the Writing module →</Link> : c.id === 'ts-timing' ? <Link className="btn primary" to="/moot">Run a timed sprint in Moot Court →</Link> : <GenericReflect c={c} />}
                  <NextBtn label="Rebuild the map →" />
                </div>
              )}
            </div>
            <aside className="card gilt" style={{ position: 'sticky', top: 70 }}>
              <div className="label">sidebar · the common error</div>
              <p className="book" style={{ fontSize: 15.5 }}>
                {c.commonError ?? 'Rushing past the method.'}
              </p>
              {(c.traps ?? []).length > 0 && (
                <>
                  <div className="label">traps</div>
                  <ul style={{ fontSize: 14, paddingLeft: 18 }}>
                    {c.traps!.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </>
              )}
            </aside>
          </div>
        )}

        {sid === 'rebuild' && (
          <div className="stack">
            <h2>Rebuild the Map from Memory</h2>
            <MethodNote id="visual" />
            {tree ? (
              <BuildAMap
                tree={tree}
                onGraded={(g) => {
                  setLesson(c.id, { mapScore: g.score });
                }}
              />
            ) : (
              <Empty>This doctrine has no map to rebuild.</Empty>
            )}
            <NextBtn />
          </div>
        )}

        {sid === 'dump' && (
          <div>
            <h2>Brain Dump</h2>
            <BrainDump
              c={c}
              onDone={(hit, total, text) => {
                setLesson(c.id, { brainDump: { hit, total, text } });
                next();
              }}
            />
          </div>
        )}

        {sid === 'exit' && (
          <div className="stack">
            <h2>Exit Ticket</h2>
            <MethodNote id="formative">Three quick checks. Low stakes; high information.</MethodNote>
            {progress?.completed && <div className="chip success">Lesson complete · exit ticket {progress.exitScore ?? 0}%</div>}
            {c.card && (
              <div className="card">
                <div className="label">check i · recall</div>
                <p className="book" style={{ fontSize: 17 }}>
                  {c.card.front}
                </p>
                <input value={recall} onChange={(e) => setRecall(e.target.value)} placeholder="Type your answer…" disabled={recallShown} />
                {!recallShown ? (
                  <button className="small primary" style={{ marginTop: 6 }} disabled={!recall.trim()} onClick={() => setRecallShown(true)}>
                    Check
                  </button>
                ) : (
                  <div style={{ marginTop: 6 }}>
                    <b>Model:</b> {c.card.back} <span className="chip">{c.card.keywords.filter((k) => mentions(recall, k)).length}/{c.card.keywords.length} keywords</span>
                  </div>
                )}
              </div>
            )}
            {alloc.exitQs.length > 0 && exitIdx < alloc.exitQs.length && recallShown ? (
              <div>
                <div className="label">
                  check {toRoman(exitIdx + 2).toLowerCase()} · {alloc.exitQs[exitIdx] === alloc.pf ? 'revisit the question you attempted first' : typeLabel(alloc.exitQs[exitIdx].type)}
                </div>
                <QuestionPlayer
                  key={'exit' + alloc.exitQs[exitIdx].id}
                  q={alloc.exitQs[exitIdx]}
                  context="lesson"
                  mode="blocked"
                  revealType
                  requireWhy
                  onAttempt={(a) => a.correct && setExitCorrect((x) => x + 1)}
                  onNext={() => setExitIdx(exitIdx + 1)}
                  nextLabel="Next check →"
                />
              </div>
            ) : null}
            {recallShown && exitIdx >= alloc.exitQs.length && (
              <div className="card gilt">
                <h3>Exit ticket filed.</h3>
                <p className="book">
                  {alloc.exitQs.length ? `${exitCorrect} of ${alloc.exitQs.length} questions correct. ` : ''}This doctrine now enters your spaced-repetition schedule (1 → 3 → 7 → 14 → 30 → 60 days), and its node on the Map of the Law will deepen as you practice.
                </p>
                <div className="row">
                  <button
                    className="primary"
                    onClick={() => {
                      complete(alloc.exitQs.length ? Math.round((exitCorrect / alloc.exitQs.length) * 100) : 100);
                      nav('/casebook');
                    }}
                  >
                    Complete the lesson
                  </button>
                  <button
                    onClick={() => {
                      complete(alloc.exitQs.length ? Math.round((exitCorrect / alloc.exitQs.length) * 100) : 100);
                      nav(`/chambers?concept=${c.id}`);
                    }}
                  >
                    Complete & drill in Chambers
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AnimatedPassage({ passageId }: { passageId: string }) {
  const p = PASSAGE_BY_ID[passageId];
  const paras = p.passages.flatMap((x) => x.paragraphs);
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
    const t = setInterval(() => setStep((s) => (s >= paras.length ? s : s + 1)), 1400);
    return () => clearInterval(t);
  }, [passageId, paras.length]);
  return (
    <div className="grid cols-2" style={{ alignItems: 'start' }}>
      <div className="card flat" style={{ maxHeight: 520, overflow: 'auto' }}>
        {paras.map((pp, i) => (
          <p key={i} className="stimulus" style={{ opacity: i < step ? 1 : 0.35, transition: 'opacity .5s', fontSize: 15 }}>
            {pp.text}
          </p>
        ))}
      </div>
      <div className="card flat">
        <PassageMap paragraphs={paras} title={p.title} step={step} />
        <div className="row">
          <button className="small" onClick={() => setStep(0)}>
            ↺ Replay
          </button>
          <ReadAloud text={paras.map((pp, i) => `Paragraph ${i + 1}, ${pp.fn}: ${pp.gist}`).join(' ')} label="Narrate map" />
        </div>
      </div>
    </div>
  );
}

function GenericReflect({ c }: { c: Concept }) {
  const [t, setT] = useState('');
  return (
    <div className="card">
      <div className="label">apply it</div>
      <p className="book">In two or three sentences, describe how you will apply “{c.label}” in your next practice session. Be concrete: what will you do differently?</p>
      <textarea rows={3} value={t} onChange={(e) => setT(e.target.value)} />
      {t.trim().split(/\s+/).length > 10 && (
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Compare with the method: {(c.attack ?? []).join(' → ')}
        </div>
      )}
    </div>
  );
}

