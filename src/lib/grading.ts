import type { Question, WhyGrade } from './types';
import { askJSON, hasKey } from './ai';
import { isLR, stimulusText, typeLabel, PASSAGE_BY_ID, TRAP_LABEL } from './content';
import { LETTERS, mentions } from './util';

/** Plain-text rendering of a question for prompts. */
export function questionForPrompt(q: Question): string {
  const head = isLR(q)
    ? `STIMULUS:\n${stimulusText(q)}`
    : (() => {
        const p = PASSAGE_BY_ID[q.passageId];
        return `PASSAGE (${p?.title}):\n${p?.passages.map((x) => `${x.label}\n${x.paragraphs.map((pp) => pp.text).join('\n\n')}`).join('\n\n')}`;
      })();
  return `${head}\n\nQUESTION TYPE: ${typeLabel(q.type)}\nSTEM: ${q.stem}\n${q.choices.map((c, i) => `(${LETTERS[i]}) ${c}`).join('\n')}\nCORRECT ANSWER: (${LETTERS[q.answer]})\nOFFICIAL ANALYSIS: ${q.brief.analysis.correct}\nWRONG ANSWERS: ${q.brief.analysis.wrong.map((w) => `(${LETTERS[w.choice]}) ${TRAP_LABEL[w.label]} — ${w.why}`).join(' | ')}\nHOLDING: ${q.brief.holding}`;
}

const WHY_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['sound', 'partial', 'flawed'] },
    score: { type: 'integer', minimum: 0, maximum: 3 },
    feedback: { type: 'string' },
  },
  required: ['verdict', 'score', 'feedback'],
  additionalProperties: false,
};

/** AI grading of the learner's justification — grades the REASONING, not the letter. */
export async function gradeWhyAI(q: Question, choice: number | null, why: string): Promise<WhyGrade> {
  const r = await askJSON<{ verdict: WhyGrade['verdict']; score: number; feedback: string }>({
    system:
      'You are a demanding but fair LSAT professor grading a student\'s written justification. Grade the quality of the REASONING, not merely whether the chosen letter is correct. "sound" = identifies the decisive logical feature (e.g., the gap, the flaw, the contrapositive, why the trap fails). "partial" = on the right track but vague or incomplete. "flawed" = the reasoning is wrong, irrelevant, or would not reliably produce the right answer—even if the letter happens to be correct (a lucky win). Feedback: 2–3 sentences, specific and actionable, praising process when deserved. Address the student as "you".',
    messages: [
      {
        role: 'user',
        content: `${questionForPrompt(q)}\n\nSTUDENT CHOSE: ${choice === null ? '(no answer)' : `(${LETTERS[choice]})`} — ${choice === q.answer ? 'correct' : 'incorrect'}\nSTUDENT'S JUSTIFICATION: """${why}"""\n\nReturn JSON with verdict, score (0–3), feedback.`,
      },
    ],
    maxTokens: 2000,
    effort: 'low',
    schema: WHY_SCHEMA,
  });
  return { verdict: r.verdict, score: Math.max(0, Math.min(3, r.score)), feedback: r.feedback, source: 'ai' };
}

/** Offline heuristic: does the justification touch the key reasoning ideas? */
export function gradeWhyHeuristic(q: Question, why: string): WhyGrade {
  const keys = q.reasoningKeys ?? [];
  if (!why.trim()) return { verdict: 'flawed', score: 0, feedback: 'No justification was given.', source: 'heuristic' };
  const hit = keys.filter((k) => mentions(why, k));
  const ratio = keys.length ? hit.length / keys.length : 0.5;
  const verdict: WhyGrade['verdict'] = ratio >= 0.5 ? 'sound' : ratio > 0 ? 'partial' : 'flawed';
  return {
    verdict,
    score: verdict === 'sound' ? 3 : verdict === 'partial' ? 2 : 1,
    feedback: keys.length
      ? `Your justification touched ${hit.length} of ${keys.length} key ideas${hit.length ? ` (${hit.join(', ')})` : ''}. Compare it with the Holding and self-assess below.`
      : 'Compare your reasoning with the Holding and self-assess below.',
    source: 'heuristic',
  };
}

export async function gradeWhy(q: Question, choice: number | null, why: string): Promise<WhyGrade> {
  if (hasKey()) {
    try {
      return await gradeWhyAI(q, choice, why);
    } catch (e) {
      const h = gradeWhyHeuristic(q, why);
      return { ...h, feedback: `(AI grading unavailable: ${(e as Error).message}) ${h.feedback}` };
    }
  }
  return gradeWhyHeuristic(q, why);
}

/** Should this question require a "Why?" (deterministic ~50% when 'often'). */
export function needsWhy(setting: 'always' | 'often' | 'never', qid: string): boolean {
  if (setting === 'always') return true;
  if (setting === 'never') return false;
  let h = 0;
  const s = qid + new Date().toDateString();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 2 === 0;
}
