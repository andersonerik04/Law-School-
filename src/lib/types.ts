// ─────────────────────────────────────────────────────────────
// Data schema for The Bar & Bench LSAT Academy.
// Content (questions, passages, concepts, curriculum) lives in JSON files under
// src/data/ and conforms to these interfaces; user progress lives in the store.
// ─────────────────────────────────────────────────────────────

export type LRType =
  | 'must-be-true'
  | 'most-strongly-supported'
  | 'cannot-be-true'
  | 'main-conclusion'
  | 'role'
  | 'method'
  | 'flaw'
  | 'necessary-assumption'
  | 'sufficient-assumption'
  | 'strengthen'
  | 'weaken'
  | 'evaluate'
  | 'parallel'
  | 'parallel-flaw'
  | 'principle-identify'
  | 'principle-apply'
  | 'paradox'
  | 'point-at-issue'
  | 'point-of-agreement';

export type RCType =
  | 'rc-main-point'
  | 'rc-primary-purpose'
  | 'rc-attitude'
  | 'rc-detail'
  | 'rc-inference'
  | 'rc-function'
  | 'rc-analogy'
  | 'rc-structure'
  | 'rc-strengthen-weaken'
  | 'rc-comparative';

export type QType = LRType | RCType;

export type FlawId =
  | 'causation'
  | 'sampling'
  | 'part-whole'
  | 'equivocation'
  | 'ad-hominem'
  | 'authority'
  | 'circular'
  | 'false-dichotomy'
  | 'suff-nec'
  | 'absence-evidence'
  | 'percent-number'
  | 'possibility-certainty'
  | 'straw-man'
  | 'overgeneralization'
  | 'unlike-comparison';

export type TrapId =
  | 'out-of-scope'
  | 'too-strong'
  | 'reversal'
  | 'half-right'
  | 'irrelevant-comparison'
  | 'opposite'
  | 'shell-game'
  | 'unsupported-inference'
  | 'wrong-degree'
  | 'restatement';

export type Bloom = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';

/** Role of one sentence/clause in an LR stimulus. */
export type SegRole =
  | 'C' // main conclusion
  | 'I' // intermediate (sub-)conclusion
  | 'P' // premise / evidence
  | 'K' // counterpoint / opposing view
  | 'X'; // context / background (also used for fact-sets in MBT/paradox)

export interface Segment {
  t: string;
  r: SegRole;
  /** speaker label for dialogue stimuli (Point at Issue / Agreement) */
  s?: string;
}

export interface WrongAnalysis {
  choice: number; // 0–4
  label: TrapId;
  why: string;
}

export interface CaseBrief {
  facts: string;
  issue: string;
  rule: string;
  analysis: {
    correct: string;
    wrong: WrongAnalysis[];
  };
  holding: string;
}

export interface DiagramData {
  /** short paraphrase of the gap / assumption (where the red gap marker lives) */
  gap?: string;
  /** conditional chain, if the stimulus is conditional: e.g. ["ratified", "binding", "enforceable"] */
  chain?: string[];
  /** which overlay the question type applies to the diagram */
  overlay?: 'strengthen' | 'weaken' | 'flaw' | 'sa' | 'na' | 'paradox' | 'none';
  /** for paradox questions: the two facts in tension */
  tension?: [string, string];
}

export interface LRQuestion {
  id: string;
  section: 'LR';
  type: LRType;
  difficulty: 1 | 2 | 3 | 4 | 5;
  flaw?: FlawId;
  pattern: string; // reasoning pattern label, e.g. "causal", "conditional", "analogy"
  topic: string; // e.g. "international law", "finance"
  bloom: Bloom;
  stimulus: Segment[];
  stem: string;
  choices: [string, string, string, string, string];
  answer: number;
  diagram: DiagramData;
  brief: CaseBrief;
  /** keywords a sound justification should touch (used offline for "Why?" heuristics) */
  reasoningKeys?: string[];
  custom?: boolean;
}

export type ParaFunction =
  | 'Background'
  | 'Thesis'
  | 'Counterargument'
  | 'Evidence'
  | 'Elaboration'
  | 'Concession'
  | "Author's Conclusion"
  | 'Example'
  | 'Rebuttal';

export interface RCParagraph {
  text: string;
  fn: ParaFunction;
  gist: string;
  /** index of the paragraph this one responds to / supports */
  links?: { to: number; kind: 'supports' | 'opposes' | 'elaborates' | 'responds' }[];
}

export interface Viewpoint {
  id: string;
  name: string;
  stance: string;
  isAuthor?: boolean;
}

export interface RCQuestion {
  id: string;
  section: 'RC';
  type: RCType;
  difficulty: 1 | 2 | 3 | 4 | 5;
  bloom: Bloom;
  stem: string;
  choices: [string, string, string, string, string];
  answer: number;
  brief: CaseBrief;
  passageId: string;
  reasoningKeys?: string[];
  topic: string;
}

export interface RCPassage {
  id: string;
  title: string;
  topic: string;
  comparative: boolean;
  /** For comparative sets, passage A then passage B. */
  passages: { label: string; paragraphs: RCParagraph[] }[];
  viewpoints: Viewpoint[];
  /** −2 (strongly negative) … +2 (strongly positive) */
  tone: { value: number; word: string; note: string };
  comparison?: { agree: string[]; disagree: string[]; onlyA: string[]; onlyB: string[] };
  questions: RCQuestion[];
}

export type Question = LRQuestion | RCQuestion;

// ── Concept library (the Map of the Law) ─────────────────────

export type Branch = 'LR' | 'RC' | 'CL' | 'AW' | 'TS';
export type ConceptKind =
  | 'root'
  | 'branch'
  | 'group'
  | 'foundation'
  | 'lr-type'
  | 'flaw'
  | 'trap'
  | 'rc-structure'
  | 'rc-type'
  | 'cl'
  | 'writing'
  | 'strategy';

export interface ConceptExample {
  domain: 'Everyday' | 'Law' | 'Business & Finance' | 'International';
  text: string;
}

export interface MapNode {
  label: string;
  children?: MapNode[];
}

export interface Concept {
  id: string;
  label: string;
  branch: Branch;
  parent: string | null;
  kind: ConceptKind;
  icon: string;
  chapter?: string; // e.g. "CHAPTER III — FLAW"
  oneLiner: string;
  definition?: string;
  objectives?: string[];
  examples?: ConceptExample[];
  attack?: string[];
  correctLooksLike?: string;
  traps?: string[];
  commonError?: string;
  keyPoints?: { point: string; keywords: string[] }[];
  mindMap?: MapNode;
  links?: string[]; // cross-links (dotted gold lines)
  stemCues?: string[]; // stem phrasing that signals this type
  card?: { front: string; back: string; keywords: string[] };
  /** which questions belong to this skill */
  match?: { types?: QType[]; flaws?: FlawId[]; patterns?: string[] };
  week?: number; // week of the curriculum in which it is introduced
  lesson?: boolean; // has a full Casebook lesson
}

// ── Curriculum ───────────────────────────────────────────────

export interface CurriculumWeek {
  week: number;
  term: 1 | 2 | 3 | 4 | 5;
  title: string;
  objectives: string[];
  concepts: string[]; // concept ids introduced
  tasks: { id: string; text: string; kind: 'lesson' | 'drill' | 'review' | 'exam' | 'writing' | 'reflection' | 'sprint'; ref?: string }[];
  blockedRatio: number; // 0–1 share of practice that is blocked
  exams: number; // full exams scheduled that week
}

export interface Term {
  n: 1 | 2 | 3 | 4 | 5;
  numeral: string;
  name: string;
  motto: string;
  weeks: [number, number];
  focus: string;
}

// ── User state ───────────────────────────────────────────────

export type Confidence = 'Certain' | 'Likely' | 'Guess';
export type RootCause = 'Comprehension' | 'Conceptual' | 'Process' | 'Timing' | 'Trap' | 'Unclassified';
export type PracticeMode = 'blocked' | 'interleaved' | 'adaptive';
export type AttemptContext = 'diagnostic' | 'lesson' | 'drill' | 'exam' | 'blind' | 'sprint' | 'review' | 'tutor';

export interface WhyGrade {
  verdict: 'sound' | 'partial' | 'flawed';
  score: number; // 0–3
  feedback: string;
  source: 'ai' | 'self' | 'heuristic';
}

export interface Attempt {
  id: string;
  qid: string;
  ts: number;
  choice: number | null;
  correct: boolean;
  confidence?: Confidence;
  why?: string;
  whyGrade?: WhyGrade;
  timeMs: number;
  context: AttemptContext;
  mode?: PracticeMode;
  type: QType;
  difficulty: number;
  lucky?: boolean;
  examId?: string;
  sectionPos?: number;
  posInSection?: number;
}

export interface SrsCard {
  id: string; // e.g. "concept:flaw-causation" or "q:lr-012"
  kind: 'concept' | 'question' | 'map' | 'indicator' | 'ledger';
  ref: string;
  step: number; // index into ladder
  ease: number; // SM-2 ease factor
  interval: number; // days
  due: number; // timestamp
  reps: number;
  lapses: number;
  last?: number;
  history?: { ts: number; rating: SrsRating }[];
}
export type SrsRating = 'again' | 'hard' | 'good' | 'easy';

export interface LedgerEntry {
  id: string;
  qid: string;
  attemptId: string;
  ts: number;
  kind: 'miss' | 'guess' | 'lucky';
  chosen: number | null;
  whyWrong: string;
  shouldHaveSeen: string;
  rule: string;
  rootCause: RootCause;
  resolved?: boolean;
}

export interface ExamSectionRecord {
  kind: 'LR' | 'RC';
  experimental: boolean;
  qids: string[];
  answers: (number | null)[];
  times: number[]; // ms per question
  flags: boolean[];
  confidence: (Confidence | null)[];
  elapsedMs: number;
}

export interface ExamRecord {
  id: string;
  title: string;
  ts: number;
  sections: ExamSectionRecord[];
  blind?: Record<string, { choice: number | null; why: string }>;
  scaled?: number;
  blindScaled?: number;
  raw?: number;
  rawMax?: number;
  completed: boolean;
  /** in-progress state */
  phase?: 'section' | 'intermission' | 'blind' | 'done';
  current?: number;
  sectionStart?: number;
  intermissionStart?: number;
  kind?: 'full' | 'term' | 'diagnostic';
}

export interface LessonProgress {
  completed: boolean;
  stage: number;
  ts: number;
  brainDump?: { text: string; hit: number; total: number };
  mapScore?: number;
  exitScore?: number;
  pfQid?: string; // productive failure question
}

export interface NotebookEntry {
  id: string;
  title: string;
  kind: 'map' | 'sketch' | 'note';
  nodeId?: string; // attached Map-of-the-Law node
  created: number;
  updated: number;
  text?: string;
  map?: { nodes: { id: string; label: string; x: number; y: number }[]; edges: { id: string; source: string; target: string }[] };
  sketch?: string; // dataURL
}

export interface School {
  id: string;
  name: string;
  lsat25: number | null;
  lsatMedian: number | null;
  lsat75: number | null;
  gpaMedian: number | null;
  deadline: string;
  notes: string;
  tier: 'reach' | 'target' | 'safety' | '';
}

export interface Reflection {
  id: string;
  week: number;
  ts: number;
  worked: string;
  didnt: string;
  change: string;
}

export interface Essay {
  id: string;
  promptId: string;
  ts: number;
  prewrite: { nodes: { id: string; label: string; x: number; y: number; kind?: string }[]; edges: { id: string; source: string; target: string }[] };
  text: string;
  minutes: number;
  feedback?: string;
  selfRubric?: Record<string, number>;
}

export interface Settings {
  theme: 'crimson' | 'federal';
  mode: 'light' | 'dark';
  passageSize: number;
  apiKey: string;
  model: string;
  homeView: 'docket' | 'map';
  ttsRate: number;
  ttsVoice: string;
  reduceMotion: boolean;
  requireWhy: 'always' | 'often' | 'never';
  serverFallback: boolean;
}

export interface Profile {
  matriculated: boolean;
  name: string;
  startDate: string; // ISO date the 40-week plan begins
  testDate: string; // ISO date
  hoursPerWeek: number;
  preferredTimes: string[];
  diagnosticScore?: number;
  diagnosticTs?: number;
  /** calendar weeks over which the 40-week curriculum is spread (compressed if < 40) */
  planWeeks?: number;
}
