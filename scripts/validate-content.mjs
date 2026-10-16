// Validates question-bank JSON: schema essentials, answer keys, brief coverage, and the difficulty mix.
// Run: npm run validate-content
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../src/data/', import.meta.url).pathname;
const errs = [];
const ids = new Set();
const LR_TYPES = ['must-be-true','most-strongly-supported','cannot-be-true','main-conclusion','role','method','flaw','necessary-assumption','sufficient-assumption','strengthen','weaken','evaluate','parallel','parallel-flaw','principle-identify','principle-apply','paradox','point-at-issue','point-of-agreement'];
const TRAPS = ['out-of-scope','too-strong','reversal','half-right','irrelevant-comparison','opposite','shell-game','unsupported-inference','wrong-degree','restatement'];
function checkQ(q, where) {
  if (ids.has(q.id)) errs.push(`${where}: duplicate id ${q.id}`);
  ids.add(q.id);
  if (!Array.isArray(q.choices) || q.choices.length !== 5) errs.push(`${q.id}: needs 5 choices`);
  if (!(q.answer >= 0 && q.answer <= 4)) errs.push(`${q.id}: bad answer`);
  if (!(q.difficulty >= 1 && q.difficulty <= 5)) errs.push(`${q.id}: bad difficulty`);
  const b = q.brief;
  if (!b || !b.facts || !b.issue || !b.rule || !b.holding || !b.analysis?.correct) errs.push(`${q.id}: incomplete brief`);
  const wrong = (b?.analysis?.wrong ?? []).map((w) => w.choice).sort();
  const expect = [0,1,2,3,4].filter((i) => i !== q.answer);
  if (JSON.stringify(wrong) !== JSON.stringify(expect)) errs.push(`${q.id}: wrong-answer analysis covers ${wrong} (expected ${expect})`);
  for (const w of b?.analysis?.wrong ?? []) if (!TRAPS.includes(w.label)) errs.push(`${q.id}: unknown trap label ${w.label}`);
  const letter = 'ABCDE'[q.answer];
  if (b?.analysis?.correct && !b.analysis.correct.startsWith(`(${letter})`)) errs.push(`${q.id}: correct analysis should start with (${letter})`);
}
const lr = readdirSync(join(root, 'lr')).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(join(root, 'lr', f), 'utf8')).map((q) => ({ ...q, _f: f })));
lr.forEach((q) => { checkQ(q, q._f); if (!LR_TYPES.includes(q.type)) errs.push(`${q.id}: unknown type ${q.type}`); if (!q.stimulus?.length) errs.push(`${q.id}: no stimulus`); });
let rc = [];
try { rc = readdirSync(join(root, 'rc')).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(join(root, 'rc', f), 'utf8'))); } catch {}
let rcq = 0;
for (const p of rc) {
  const words = p.passages.flatMap((x) => x.paragraphs).map((x) => x.text).join(' ').split(/\s+/).length;
  console.log(`RC ${p.id} ${p.comparative ? '(comparative)' : ''} — ${words} words, ${p.questions.length} questions`);
  for (const q of p.questions) { checkQ(q, p.id); rcq++; if (q.passageId !== p.id) errs.push(`${q.id}: passageId mismatch`); }
}
const byType = {}; const byDiff = {};
lr.forEach((q) => { byType[q.type] = (byType[q.type] ?? 0) + 1; byDiff[q.difficulty] = (byDiff[q.difficulty] ?? 0) + 1; });
const hard = lr.filter((q) => q.difficulty >= 4).length;
console.log(`LR questions: ${lr.length}; difficulty 4–5: ${hard} (${Math.round((hard / lr.length) * 100)}%)`, byDiff);
const missing = LR_TYPES.filter((t) => !byType[t]);
console.log('LR types covered:', Object.keys(byType).length, '/', LR_TYPES.length, missing.length ? `missing: ${missing}` : '');
const answers = {}; lr.forEach((q) => (answers['ABCDE'[q.answer]] = (answers['ABCDE'[q.answer]] ?? 0) + 1));
console.log('LR answer-key distribution:', answers);
console.log(`RC sets: ${rc.length} (${rc.filter((p) => p.comparative).length} comparative), ${rcq} questions`);
if (errs.length) { console.error('\nERRORS:\n' + errs.join('\n')); process.exit(1); } else console.log('\n✓ Content valid');
