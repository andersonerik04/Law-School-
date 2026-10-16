import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CasebookHeader, MethodNote, Section, Progress } from '../components/common';
import { QuestionPlayer } from '../components/QuestionPlayer';
import { SkillRadar } from '../components/Charts';
import { useStore } from '../lib/store';
import { LR_QUESTIONS, LR_TYPES, RC_PASSAGES, RC_QUESTIONS, typeLabel } from '../lib/content';
import type { Attempt, Question } from '../lib/types';
import { scaledScore, percentile } from '../lib/scoring';
import { planWeeksFor } from '../lib/mastery';
import { dateKey, fmtTime } from '../lib/util';
import { Monogram } from '../visuals/Icon';

/** One question of every LR type (difficulty nearest 3–4) plus one full RC set. */
function buildDiagnostic(): Question[] {
  const lr = LR_TYPES.map((t) => {
    const pool = LR_QUESTIONS.filter((q) => q.type === t).sort((a, b) => Math.abs(a.difficulty - 3.6) - Math.abs(b.difficulty - 3.6));
    return pool[0];
  }).filter(Boolean);
  const rcSet = RC_PASSAGES[0];
  const rc = RC_QUESTIONS.filter((q) => q.passageId === rcSet.id);
  return [...lr, ...rc];
}

const TIMES = ['Early morning', 'Morning', 'Midday', 'Afternoon', 'Evening', 'Late night', 'Weekends'];

export default function Matriculation() {
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const ensureCard = useStore((s) => s.ensureCard);
  const nav = useNavigate();
  const [step, setStep] = useState<'welcome' | 'survey' | 'diagnostic' | 'results'>(profile.matriculated ? 'results' : 'welcome');
  const [form, setForm] = useState({
    name: profile.name,
    testDate: profile.testDate,
    startDate: profile.startDate || dateKey(),
    hoursPerWeek: profile.hoursPerWeek,
    preferredTimes: profile.preferredTimes,
  });
  const questions = useMemo(buildDiagnostic, []);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Attempt[]>([]);
  const [startTs] = useState(Date.now());
  const attempts = useStore((s) => s.attempts);
  const diagAttempts = results.length ? results : attempts.filter((a) => a.context === 'diagnostic');

  const finish = (all: Attempt[]) => {
    const correct = all.filter((a) => a.correct).length;
    const score = scaledScore(correct, all.length);
    const planWeeks = planWeeksFor(form.startDate, form.testDate);
    setProfile({ ...form, matriculated: true, diagnosticScore: score, diagnosticTs: Date.now(), planWeeks });
    ensureCard('concept:anatomy', 'concept', 'anatomy');
    ensureCard('concept:ts-stem-id', 'concept', 'ts-stem-id');
    setStep('results');
  };

  if (step === 'welcome') {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <Monogram size={92} />
        </div>
        <CasebookHeader chapter="MATRICULATION" title="The Bar & Bench LSAT Academy" subtitle="Veritas in Ratione — truth in reasoning." />
        <div className="card gilt book" style={{ fontSize: 17 }}>
          <p>
            Welcome to the reading room. Over the coming terms you will move from first principles to full simulations, following a 40-week curriculum in five Terms: <b>Foundations</b>, <b>Accuracy</b>, <b>Speed</b>, <b>Mastery</b>, and <b>The Bar</b>.
          </p>
          <p>Matriculation has two parts: a brief survey of your schedule and goals, then a diagnostic examination: one question of every Logical Reasoning type and one full Reading Comprehension set. There is no feedback until the end. Answer as you would on test day.</p>
          <MethodNote id="formative" />
          <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
            <button className="primary" onClick={() => setStep('survey')}>
              Begin matriculation →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'survey') {
    const pw = planWeeksFor(form.startDate, form.testDate);
    return (
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <CasebookHeader chapter="MATRICULATION · PART ONE" title="The Admissions Questionnaire" />
        <div className="card stack">
          <label className="field">
            Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
          </label>
          <div className="grid cols-3">
            <label className="field">
              Test date
              <input type="date" value={form.testDate} onChange={(e) => setForm({ ...form, testDate: e.target.value })} />
            </label>
            <label className="field">
              Plan start date
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </label>
            <label className="field">
              Hours available per week
              <input type="number" min={2} max={60} value={form.hoursPerWeek} onChange={(e) => setForm({ ...form, hoursPerWeek: +e.target.value })} />
            </label>
          </div>
          <div>
            <div className="label">preferred study times</div>
            <div className="row" style={{ marginTop: 4 }}>
              {TIMES.map((t) => (
                <label key={t} className="chip" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.preferredTimes.includes(t)}
                    onChange={(e) => setForm({ ...form, preferredTimes: e.target.checked ? [...form.preferredTimes, t] : form.preferredTimes.filter((x) => x !== t) })}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>
          <div className="card sunk">
            {pw >= 40 ? (
              <span>
                You have at least 40 weeks before your test. The full 40-week curriculum fits; your plan begins on {form.startDate}.
              </span>
            ) : (
              <span>
                You have about <b>{pw} weeks</b> before your test date, so the 40-week curriculum will be <b>compressed</b> proportionally (each curriculum week ≈ {((pw * 7) / 40).toFixed(1)} days). You can change dates any time in Settings.
              </span>
            )}
          </div>
          <div className="row">
            <button className="primary" onClick={() => setStep('diagnostic')}>
              Proceed to the diagnostic →
            </button>
            <button className="ghost" onClick={() => setStep('welcome')}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'diagnostic') {
    const q = questions[idx];
    return (
      <div>
        <CasebookHeader chapter="MATRICULATION · PART TWO" title="The Diagnostic Examination" subtitle={`Question ${idx + 1} of ${questions.length} · elapsed ${fmtTime(Date.now() - startTs)}`} />
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <Progress value={idx} max={questions.length} />
          <div style={{ height: 14 }} />
          <QuestionPlayer
            key={q.id}
            q={q}
            context="diagnostic"
            mode="interleaved"
            feedback="none"
            requireWhy={false}
            nextLabel="Next"
            onAttempt={(a) => {
              const all = [...results, a];
              setResults(all);
              if (idx + 1 >= questions.length) finish(all);
            }}
            onNext={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}
          />
        </div>
      </div>
    );
  }

  // results
  const correct = diagAttempts.filter((a) => a.correct).length;
  const score = profile.diagnosticScore ?? scaledScore(correct, Math.max(1, diagAttempts.length));
  const radar = LR_TYPES.map((t) => {
    const as = diagAttempts.filter((a) => a.type === t);
    return { label: typeLabel(t).replace('Principle — ', 'Princ. ').replace('Most Strongly Supported', 'MSS'), value: as.length ? (as.filter((a) => a.correct).length / as.length) * 100 : 0 };
  });
  const rcAs = diagAttempts.filter((a) => a.type.startsWith('rc-'));
  return (
    <div>
      <CasebookHeader chapter="MATRICULATION · OPINION" title="Opinion of the Admissions Examiner" subtitle={`In re ${profile.name || 'the Matriculant'}`} />
      <div className="grid cols-3">
        <div className="card gilt opinion" style={{ textAlign: 'center' }}>
          <div className="caption label">holding</div>
          <div className="score-seal" style={{ margin: '10px auto' }}>
            <span className="n">{score}</span>
            <span className="muted" style={{ fontSize: 12 }}>
              baseline (est.)
            </span>
          </div>
          <div className="muted">≈ {percentile(score)}th percentile · {correct}/{diagAttempts.length} correct</div>
          <p className="book" style={{ fontSize: 15, marginTop: 10 }}>
            A baseline, not a verdict. Every point between here and 179 is earned through method, and method can be taught.
          </p>
        </div>
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-title">
            <h3>Findings — accuracy by question type</h3>
            <span className="chip">RC set: {rcAs.filter((a) => a.correct).length}/{rcAs.length}</span>
          </div>
          <SkillRadar data={radar} height={320} />
        </div>
      </div>
      <Section numeral="I" title="Remedies — your personalized plan">
        <div className="card book" style={{ fontSize: 16 }}>
          <p>
            Your curriculum begins on <b>{profile.startDate}</b> and runs to your test date (<b>{profile.testDate}</b>) across{' '}
            <b>{profile.planWeeks ?? 40} calendar weeks</b>
            {(profile.planWeeks ?? 40) < 40 ? ' (compressed from 40)' : ''}. With {profile.hoursPerWeek} hours per week, expect roughly {Math.round(profile.hoursPerWeek / 5)} focused sessions of about an hour each.
          </p>
          <p>
            Your diagnostic answers now color the Map of the Law. Types you attempted are lit at <b>1L</b>; they will deepen as you master them. Begin with Term I, Week 1: <i>Anatomy of an Argument</i>.
          </p>
          <div className="row">
            <button className="primary" onClick={() => nav('/')}>
              Enter the Docket →
            </button>
            <button onClick={() => nav('/map')}>View the Map of the Law</button>
            <button className="ghost" onClick={() => nav('/planner')}>
              See the 40-week plan
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}
