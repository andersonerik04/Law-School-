import type { LRQuestion, LRType, Concept } from './types';
import { useStore } from './store';
import { CONCEPTS, getQuestion, typeLabel, LR_TYPES, TRAP_LABEL, CONCEPT_BY_ID } from './content';
import { masteryFor, currentWeek, weekInfo } from './mastery';
import { askJSON } from './ai';
import { uid } from './util';

/** A compact profile of the learner for the faculty's context. */
export function learnerContext(): string {
  const s = useStore.getState();
  const week = currentWeek(s.profile.startDate, s.profile.planWeeks);
  const info = weekInfo(week);
  const weak = CONCEPTS.filter((c) => c.kind === 'lr-type' || c.kind === 'flaw')
    .map((c) => ({ c, m: masteryFor(c, s.attempts, s.lessons, s.srs) }))
    .filter((x) => x.m.n >= 2)
    .sort((a, b) => (a.m.accuracy ?? 0) - (b.m.accuracy ?? 0))
    .slice(0, 4)
    .map((x) => `${x.c.label} (${Math.round((x.m.accuracy ?? 0) * 100)}% over ${x.m.n})`);
  const misses = s.ledger
    .filter((l) => !l.resolved)
    .slice(0, 6)
    .map((l) => {
      const q = getQuestion(l.qid);
      if (!q) return '';
      const trap = q.brief.analysis.wrong.find((w) => w.choice === l.chosen);
      return `- ${l.qid} (${typeLabel(q.type)}): chose a ${trap ? TRAP_LABEL[trap.label] : 'wrong'} answer. Holding: ${q.brief.holding}${l.rule ? ` Student's rule: ${l.rule}` : ''}`;
    })
    .filter(Boolean);
  return [
    `Student: ${s.profile.name || 'the student'}; goal 179 on the LSAT (test ${s.profile.testDate}); Finance/International Finance undergraduate; speaks Hungarian and Russian; aiming for corporate/international law.`,
    `Curriculum: Week ${week} of 40 — ${info.title}.`,
    weak.length ? `Weakest doctrines: ${weak.join('; ')}.` : 'Not enough data yet on weaknesses.',
    misses.length ? `Recent unresolved mistakes:\n${misses.join('\n')}` : 'No recent mistakes on record.',
  ].join('\n');
}

export const DIAGRAM_INSTRUCTIONS = `You can draw for the student. To draw an argument diagram, output a fenced block exactly like:
\`\`\`diagram
{"premises": ["premise text", "..."], "conclusion": "conclusion text", "gap": "the unstated assumption", "counter": "optional opposing view"}
\`\`\`
To draw a conditional chain (with its contrapositive available), output:
\`\`\`chain
Ratified -> Binding -> Enforceable
\`\`\`
Use diagrams when they genuinely clarify structure. Keep everything else in plain prose (light **bold** is fine).`;

export function professorSystem(): string {
  return `You are Professor Ashworth, a demanding but fair LSAT professor at an elite law school, holding office hours. You teach by the Socratic method.

Rules of your office hours:
- Ask ONE probing question at a time, sequenced to lead the student toward the reasoning. Do not lecture.
- Never simply hand over an answer. Escalate hints only after the student has genuinely struggled (roughly three unsuccessful tries): first a nudge toward where to look, then the relevant rule, then a worked partial step. Only then confirm the answer, and make the student restate why.
- Cold-call the student on past mistakes from their record when it serves the lesson.
- Praise process and strategy, never innate talent. Be concise: usually 2–5 sentences per turn.
- When asked, write ORIGINAL LSAT-style material; never reproduce real LSAC PrepTest questions.
- Where natural, draw examples from international law, finance, economics, and comparative legal systems.

${DIAGRAM_INSTRUCTIONS}

The student's record:
${learnerContext()}`;
}

export function clerkSystem(c: Concept): string {
  return `You are "the Clerk": an earnest, slightly confused first-year law student. The student (your senior) is teaching you the LSAT concept "${c.label}" using the Feynman technique.

Your role:
- Ask genuine follow-up questions a confused but smart 1L would ask: request plain-language restatements, concrete examples, and edge cases ("but what if…?").
- Probe gaps: if the explanation skips a step, uses jargon without defining it, or would mislead on a tricky case, ask about exactly that.
- Never lecture or reveal the full answer; you are the learner. 1–3 sentences per turn.
- When the student says they are done, or when asked for a gap analysis, step out of character and give a "GAP ANALYSIS": list what was explained well, what was missing or wrong (compare to the key points below), and a verdict: AIRTIGHT, NEARLY THERE, or NEEDS WORK.

Key points a complete explanation covers: ${(c.keyPoints ?? []).map((k) => k.point).join('; ')}.
Definition for your reference: ${c.definition ?? c.oneLiner}`;
}

// ── Question generation ─────────────────────────────────────

const SEG_ROLE = { type: 'string', enum: ['C', 'I', 'P', 'K', 'X'] };
const TRAPS = Object.keys(TRAP_LABEL);
export const QUESTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'difficulty', 'topic', 'pattern', 'stimulus', 'stem', 'choices', 'answer', 'gap', 'brief', 'reasoningKeys'],
  properties: {
    type: { type: 'string', enum: LR_TYPES },
    difficulty: { type: 'integer' },
    topic: { type: 'string' },
    pattern: { type: 'string' },
    stimulus: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['t', 'r'], properties: { t: { type: 'string' }, r: SEG_ROLE } } },
    stem: { type: 'string' },
    choices: { type: 'array', items: { type: 'string' } },
    answer: { type: 'integer' },
    gap: { type: 'string' },
    brief: {
      type: 'object',
      additionalProperties: false,
      required: ['facts', 'issue', 'rule', 'correct', 'wrong', 'holding'],
      properties: {
        facts: { type: 'string' },
        issue: { type: 'string' },
        rule: { type: 'string' },
        correct: { type: 'string' },
        wrong: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['choice', 'label', 'why'], properties: { choice: { type: 'integer' }, label: { type: 'string', enum: TRAPS }, why: { type: 'string' } } } },
        holding: { type: 'string' },
      },
    },
    reasoningKeys: { type: 'array', items: { type: 'string' } },
  },
};

interface GenQ {
  type: LRType;
  difficulty: number;
  topic: string;
  pattern: string;
  stimulus: { t: string; r: 'C' | 'I' | 'P' | 'K' | 'X' }[];
  stem: string;
  choices: string[];
  answer: number;
  gap: string;
  brief: { facts: string; issue: string; rule: string; correct: string; wrong: { choice: number; label: string; why: string }[]; holding: string };
  reasoningKeys: string[];
}

/** Ask the Faculty for an ORIGINAL question targeting a doctrine; validates before accepting. */
export async function generateQuestion(type: LRType, difficulty: number, topicHint?: string): Promise<LRQuestion> {
  const c = CONCEPT_BY_ID[`lr-${type}`];
  const g = await askJSON<GenQ>({
    system:
      'You are a senior LSAT item writer. Write ORIGINAL Logical Reasoning questions indistinguishable in style and rigor from real LSAT questions, never copying LSAC material. The correct answer must be unambiguously best; each wrong answer must be wrong for a nameable reason. Label each stimulus segment with its role: C (main conclusion), I (sub-conclusion), P (premise), K (counterpoint/concession), X (context or fact). Return only JSON matching the schema.',
    messages: [
      {
        role: 'user',
        content: `Write one ${typeLabel(type)} question at difficulty ${difficulty} (1–5). Topic: ${topicHint || 'international law, finance, economics, jurisprudence, or comparative law'}. Method reminder: ${c?.definition ?? ''}\nRequirements: exactly 5 choices; "answer" is the 0-based index of the correct choice; "brief.wrong" covers the other four choices with a trap label each; "brief.correct" begins with the correct letter in parentheses, e.g. "(C) …"; "gap" names the assumption/gap (or the key inference for fact sets); reasoningKeys = 3–4 short phrases a sound justification would mention.`,
      },
    ],
    maxTokens: 8000,
    effort: 'medium',
    schema: QUESTION_SCHEMA,
  });
  // validation
  if (!Array.isArray(g.choices) || g.choices.length !== 5) throw new Error('Generated question did not have exactly five choices.');
  if (!(g.answer >= 0 && g.answer <= 4)) throw new Error('Generated question had an invalid answer key.');
  const wrong = g.brief.wrong.filter((w) => w.choice !== g.answer && w.choice >= 0 && w.choice <= 4);
  if (new Set(wrong.map((w) => w.choice)).size !== 4) throw new Error('Generated explanation did not cover all four wrong answers.');
  if (!g.stimulus?.length) throw new Error('Generated question had no stimulus.');
  const overlay = type === 'strengthen' || type === 'principle-identify' ? 'strengthen' : type === 'weaken' ? 'weaken' : type === 'flaw' || type === 'parallel-flaw' ? 'flaw' : type === 'sufficient-assumption' ? 'sa' : type === 'necessary-assumption' ? 'na' : 'none';
  return {
    id: uid('ai-'),
    section: 'LR',
    type,
    difficulty: Math.max(1, Math.min(5, Math.round(g.difficulty || difficulty))) as LRQuestion['difficulty'],
    pattern: g.pattern || 'generated',
    topic: g.topic || topicHint || 'general',
    bloom: 'Apply',
    stimulus: g.stimulus,
    stem: g.stem,
    choices: g.choices as LRQuestion['choices'],
    answer: g.answer,
    diagram: { gap: g.gap, overlay },
    brief: { facts: g.brief.facts, issue: g.brief.issue, rule: g.brief.rule, analysis: { correct: g.brief.correct, wrong: wrong.map((w) => ({ choice: w.choice, label: w.label as never, why: w.why })) }, holding: g.brief.holding },
    reasoningKeys: g.reasoningKeys?.slice(0, 5),
    custom: true,
  };
}
