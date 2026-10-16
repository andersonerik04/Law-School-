/**
 * Content loader. Every JSON file dropped into these folders is picked up
 * automatically at build/dev time — no app code changes needed:
 *
 *   src/data/lr/*.json        → arrays of LRQuestion
 *   src/data/rc/*.json        → arrays of RCPassage (each with its questions)
 *   src/data/concepts/*.json  → arrays of Concept (the Map of the Law)
 *   src/data/curriculum.json  → { terms, weeks }
 *   src/data/writing.json     → Argumentative Writing prompts
 *   src/data/indicators.json  → conditional-indicator flashcards
 */
import type { Concept, CurriculumWeek, LRQuestion, Question, RCPassage, RCQuestion, Term, QType, LRType, RCType, FlawId, TrapId } from './types';
import curriculumJson from '../data/curriculum.json';
import writingJson from '../data/writing.json';
import indicatorsJson from '../data/indicators.json';

const lrFiles = import.meta.glob('../data/lr/*.json', { eager: true, import: 'default' }) as Record<string, LRQuestion[]>;
const rcFiles = import.meta.glob('../data/rc/*.json', { eager: true, import: 'default' }) as Record<string, RCPassage[]>;
const conceptFiles = import.meta.glob('../data/concepts/*.json', { eager: true, import: 'default' }) as Record<string, Concept[]>;

export const LR_QUESTIONS: LRQuestion[] = Object.keys(lrFiles)
  .sort()
  .flatMap((k) => lrFiles[k]);
export const RC_PASSAGES: RCPassage[] = Object.keys(rcFiles)
  .sort()
  .flatMap((k) => rcFiles[k]);
export const RC_QUESTIONS: RCQuestion[] = RC_PASSAGES.flatMap((p) => p.questions.map((q) => ({ ...q, passageId: p.id, topic: q.topic ?? p.topic })));
export const CONCEPTS: Concept[] = Object.keys(conceptFiles)
  .sort()
  .flatMap((k) => conceptFiles[k]);

export const CONCEPT_BY_ID: Record<string, Concept> = Object.fromEntries(CONCEPTS.map((c) => [c.id, c]));
export const PASSAGE_BY_ID: Record<string, RCPassage> = Object.fromEntries(RC_PASSAGES.map((p) => [p.id, p]));

let customQuestions: LRQuestion[] = [];
let questionIndex: Record<string, Question> = {};
function rebuildIndex() {
  questionIndex = {};
  for (const q of LR_QUESTIONS) questionIndex[q.id] = q;
  for (const q of customQuestions) questionIndex[q.id] = q;
  for (const q of RC_QUESTIONS) questionIndex[q.id] = q;
}
rebuildIndex();

/** AI-generated / user-drafted questions saved in the store are merged here. */
export function setCustomQuestions(qs: LRQuestion[]) {
  customQuestions = qs.map((q) => ({ ...q, custom: true }));
  rebuildIndex();
}
export function allLR(): LRQuestion[] {
  return [...LR_QUESTIONS, ...customQuestions];
}
export function allQuestions(): Question[] {
  return [...allLR(), ...RC_QUESTIONS];
}
export function getQuestion(id: string): Question | undefined {
  return questionIndex[id];
}

export const TERMS: Term[] = (curriculumJson as unknown as { terms: Term[] }).terms;
export const WEEKS: CurriculumWeek[] = (curriculumJson as unknown as { weeks: CurriculumWeek[] }).weeks;

export interface WritingPrompt {
  id: string;
  title: string;
  topic: string;
  issue: string;
  perspectives: { label: string; text: string }[];
  task: string;
}
export const WRITING_PROMPTS: WritingPrompt[] = writingJson as WritingPrompt[];

export interface Indicator {
  id: string;
  phrase: string;
  example: string;
  translation: string;
  rule: string;
  keywords: string[];
}
export const INDICATORS: Indicator[] = indicatorsJson as Indicator[];

// ── Human-readable labels ────────────────────────────────────

export const LR_TYPE_LABEL: Record<LRType, string> = {
  'must-be-true': 'Must Be True',
  'most-strongly-supported': 'Most Strongly Supported',
  'cannot-be-true': 'Cannot Be True',
  'main-conclusion': 'Main Conclusion',
  role: 'Role of a Statement',
  method: 'Method of Reasoning',
  flaw: 'Flaw',
  'necessary-assumption': 'Necessary Assumption',
  'sufficient-assumption': 'Sufficient Assumption',
  strengthen: 'Strengthen',
  weaken: 'Weaken',
  evaluate: 'Evaluate',
  parallel: 'Parallel Reasoning',
  'parallel-flaw': 'Parallel Flaw',
  'principle-identify': 'Principle — Identify',
  'principle-apply': 'Principle — Apply',
  paradox: 'Resolve the Paradox',
  'point-at-issue': 'Point at Issue',
  'point-of-agreement': 'Point of Agreement',
};
export const RC_TYPE_LABEL: Record<RCType, string> = {
  'rc-main-point': 'Main Point',
  'rc-primary-purpose': 'Primary Purpose',
  'rc-attitude': "Author's Attitude",
  'rc-detail': 'Detail',
  'rc-inference': 'Inference',
  'rc-function': 'Function',
  'rc-analogy': 'Analogy',
  'rc-structure': 'Structure',
  'rc-strengthen-weaken': 'Strengthen / Weaken',
  'rc-comparative': 'Comparative Relationship',
};
export function typeLabel(t: QType): string {
  return (LR_TYPE_LABEL as Record<string, string>)[t] ?? (RC_TYPE_LABEL as Record<string, string>)[t] ?? t;
}
export const LR_TYPES = Object.keys(LR_TYPE_LABEL) as LRType[];
export const RC_TYPES = Object.keys(RC_TYPE_LABEL) as RCType[];

export const FLAW_LABEL: Record<FlawId, string> = {
  causation: 'Causation from Correlation',
  sampling: 'Unrepresentative Sample',
  'part-whole': 'Part-to-Whole / Whole-to-Part',
  equivocation: 'Equivocation',
  'ad-hominem': 'Ad Hominem',
  authority: 'Appeal to Authority',
  circular: 'Circular Reasoning',
  'false-dichotomy': 'False Dichotomy',
  'suff-nec': 'Sufficient / Necessary Confusion',
  'absence-evidence': 'Absence of Evidence',
  'percent-number': 'Percentage vs. Number',
  'possibility-certainty': 'Possibility vs. Certainty',
  'straw-man': 'Straw Man',
  overgeneralization: 'Overgeneralization',
  'unlike-comparison': 'Comparison of Unlike Things',
};
export const FLAWS = Object.keys(FLAW_LABEL) as FlawId[];

export const TRAP_LABEL: Record<TrapId, string> = {
  'out-of-scope': 'Out of Scope',
  'too-strong': 'Too Strong',
  reversal: 'Reversal',
  'half-right': 'Half-Right / Half-Wrong',
  'irrelevant-comparison': 'Irrelevant Comparison',
  opposite: 'Opposite',
  'shell-game': 'Shell Game',
  'unsupported-inference': 'Unsupported Inference',
  'wrong-degree': 'Wrong Degree',
  restatement: 'Restatement of Premise',
};

/** Pace targets */
export const LR_PACE_MS = 80_000; // ~1:20 per LR question
export const RC_SET_MS = 510_000; // ~8:30 per RC set

export function isLR(q: Question): q is LRQuestion {
  return q.section === 'LR';
}

/** Plain-text stimulus. */
export function stimulusText(q: LRQuestion): string {
  return q.stimulus
    .map((s, i) => {
      const prev = q.stimulus[i - 1];
      if (s.s && (!prev || prev.s !== s.s)) return (i ? '\n\n' : '') + `${s.s}: ${s.t}`;
      return s.t;
    })
    .join(' ')
    .replace(/ \n\n/g, '\n\n');
}

/** Which concepts does this question exercise? */
export function conceptsForQuestion(q: Question): string[] {
  const out: string[] = [];
  for (const c of CONCEPTS) {
    const m = c.match;
    if (!m) continue;
    if (m.types?.includes(q.type)) out.push(c.id);
    else if (isLR(q) && q.flaw && m.flaws?.includes(q.flaw)) out.push(c.id);
    else if (isLR(q) && m.patterns?.includes(q.pattern)) out.push(c.id);
  }
  return out;
}

export function questionsForConcept(c: Concept): Question[] {
  const m = c.match;
  if (!m) return [];
  return allQuestions().filter(
    (q) => m.types?.includes(q.type) || (isLR(q) && q.flaw && m.flaws?.includes(q.flaw)) || (isLR(q) && m.patterns?.includes(q.pattern)),
  );
}
