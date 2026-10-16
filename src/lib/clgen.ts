/** Item generators for the Conditional Logic Trainer. */
import { type Cond, type Lit, type QStatement, lit, negate, litEq, contrapositive, validInferences, combine, showQ, fallacies, symLit } from './logic';
import { shuffle } from './util';

export interface Prop {
  tag: string; // short arrow label
  yes: string; // affirmative clause
  no: string; // negative clause
}

export const PROPS: Prop[] = [
  { tag: 'Ratified', yes: 'the treaty is ratified', no: 'the treaty is not ratified' },
  { tag: 'Binding', yes: 'the treaty is binding', no: 'the treaty is not binding' },
  { tag: 'Enforced', yes: 'the award is enforced', no: 'the award is not enforced' },
  { tag: 'Recognized', yes: 'the court recognizes the award', no: 'the court does not recognize the award' },
  { tag: 'Investment grade', yes: 'the bond is rated investment grade', no: 'the bond is not rated investment grade' },
  { tag: 'Audited', yes: 'the fund is audited', no: 'the fund is not audited' },
  { tag: 'Listed', yes: 'the company lists on the premium tier', no: 'the company does not list on the premium tier' },
  { tag: 'Approved', yes: 'the regulator approves the merger', no: 'the regulator does not approve the merger' },
  { tag: 'Closes', yes: 'the merger closes', no: 'the merger does not close' },
  { tag: 'Consents', yes: 'the state consents', no: 'the state does not consent' },
  { tag: 'Jurisdiction', yes: 'the tribunal has jurisdiction', no: 'the tribunal lacks jurisdiction' },
  { tag: 'Published', yes: 'the ruling is published', no: 'the ruling is not published' },
  { tag: 'Precedent', yes: 'the ruling serves as precedent', no: 'the ruling does not serve as precedent' },
  { tag: 'Devalues', yes: 'the central bank devalues the currency', no: 'the central bank does not devalue the currency' },
  { tag: 'Rates rise', yes: 'interest rates rise', no: 'interest rates do not rise' },
  { tag: 'Disclosed', yes: 'the commission is disclosed', no: 'the commission is not disclosed' },
  { tag: 'Votes', yes: 'the shareholder votes', no: 'the shareholder does not vote' },
  { tag: 'Registered', yes: 'the shareholder is registered', no: 'the shareholder is not registered' },
];
const PROP_BY_TAG = Object.fromEntries(PROPS.map((p) => [p.tag, p]));
const clause = (l: Lit) => (l.neg ? PROP_BY_TAG[l.v].no : PROP_BY_TAG[l.v].yes);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Render a conditional A → B in varied English (the meaning is always A → B). */
export function english(c: Cond, form?: number): { text: string; indicator: string } {
  const A = c.a;
  const B = c.b;
  const forms = [
    () => ({ text: `If ${clause(A)}, then ${clause(B)}.`, indicator: 'if' }),
    () => ({ text: `${cap(clause(A))} only if ${clause(B)}.`, indicator: 'only if' }),
    () => ({ text: `${cap(clause(B))} if ${clause(A)}.`, indicator: 'if (in the middle)' }),
    () => ({ text: `Whenever ${clause(A)}, ${clause(B)}.`, indicator: 'whenever' }),
    () => ({ text: `In every case in which ${clause(A)}, ${clause(B)}.`, indicator: 'every case' }),
    // unless: "A → B" ≡ "¬B → ¬A" ≡ "¬A unless B" — expressed as: "Unless B, ¬A"
    () => ({ text: `Unless ${clause(B)}, ${clause(negate(A))}.`, indicator: 'unless' }),
    () => ({ text: `${cap(clause(negate(A)))} unless ${clause(B)}.`, indicator: 'unless (in the middle)' }),
  ];
  const f = forms[form ?? Math.floor(Math.random() * forms.length)];
  return f();
}

export interface TranslateItem {
  cond: Cond;
  text: string;
  indicator: string;
}
export function translateItem(): TranslateItem {
  const [p, q] = shuffle(PROPS).slice(0, 2);
  const cond: Cond = { a: lit(p.tag, Math.random() < 0.2), b: lit(q.tag, Math.random() < 0.25) };
  const e = english(cond);
  return { cond, ...e };
}
export function sameCond(x: Cond, y: Cond) {
  return litEq(x.a, y.a) && litEq(x.b, y.b);
}
export function equivalent(x: Cond, y: Cond) {
  return sameCond(x, y) || sameCond(contrapositive(x), y);
}

export interface ChainItem {
  conds: Cond[];
  texts: string[];
  options: { cond: Cond; label: string; valid: boolean }[];
  answer: number;
}
/** 3–5 linked conditionals in shuffled order; one valid multi-step inference among invalid ones. */
export function chainItem(n = 3 + Math.floor(Math.random() * 3)): ChainItem {
  const props = shuffle(PROPS).slice(0, n + 1);
  const lits = props.map((p) => lit(p.tag, Math.random() < 0.2));
  const conds: Cond[] = [];
  for (let i = 0; i < n; i++) {
    const c = { a: lits[i], b: lits[i + 1] };
    // sometimes state a link as its contrapositive to force recognition
    conds.push(Math.random() < 0.3 ? contrapositive(c) : c);
  }
  const order = shuffle(conds);
  const valid = validInferences(conds).filter((v) => {
    const ai = lits.findIndex((l) => litEq(l, v.a) || litEq(negate(l), v.a));
    const bi = lits.findIndex((l) => litEq(l, v.b) || litEq(negate(l), v.b));
    return Math.abs(ai - bi) >= 2;
  });
  const correct = shuffle(valid)[0] ?? { a: lits[0], b: lits[n] };
  const invalid: Cond[] = [];
  const base = { a: lits[0], b: lits[n] };
  for (const f of fallacies(base)) invalid.push(f.cond);
  invalid.push({ a: negate(lits[0]), b: negate(lits[Math.min(2, n)]) });
  invalid.push({ a: lits[Math.min(2, n)], b: lits[0] });
  invalid.push({ a: lits[n], b: lits[1] });
  const isValid = (c: Cond) => validInferences(conds).some((v) => sameCond(v, c));
  const wrong = shuffle(invalid.filter((c) => !isValid(c) && !litEq(c.a, c.b))).filter((c, i, arr) => arr.findIndex((d) => sameCond(c, d)) === i).slice(0, 4);
  const opts = shuffle([{ cond: correct, valid: true }, ...wrong.map((c) => ({ cond: c, valid: false }))]).map((o) => ({ ...o, label: `If ${clause(o.cond.a)}, then ${clause(o.cond.b)}.` }));
  return { conds, texts: order.map((c) => english(c).text), options: opts, answer: opts.findIndex((o) => o.valid) };
}

const GROUPS = ['arbitrators', 'judges on the panel', 'treaty negotiators', 'senior partners', 'fund managers', 'central bankers', 'members of the committee', 'delegates', 'analysts', 'scholars'];
const PREDS = ['fluent in Russian', 'trained in civil law', 'former diplomats', 'certified auditors', 'published authors', 'members of the bar', 'Hungarian speakers', 'economists', 'supporters of the reform', 'litigators'];

export interface QuantItem {
  premises: QStatement[];
  options: string[];
  answer: number;
  sets: string[];
  conclusion: QStatement | null;
}
export function quantItem(): QuantItem {
  const [A] = shuffle(GROUPS);
  const [M, C] = shuffle(PREDS);
  const patterns: [QStatement, QStatement][] = [
    [{ q: 'all', a: A, b: M }, { q: 'all', a: M, b: C }],
    [{ q: 'most', a: A, b: M }, { q: 'all', a: M, b: C }],
    [{ q: 'some', a: A, b: M }, { q: 'all', a: M, b: C }],
    [{ q: 'all', a: A, b: M }, { q: 'none', a: M, b: C }],
    [{ q: 'most', a: A, b: M }, { q: 'none', a: M, b: C }],
    [{ q: 'most', a: A, b: M }, { q: 'most', a: A, b: C }],
    [{ q: 'all', a: A, b: M }, { q: 'some', a: A, b: C }],
    [{ q: 'some', a: A, b: M }, { q: 'some', a: M, b: C }],
    [{ q: 'all', a: A, b: M }, { q: 'most', a: M, b: C }],
    [{ q: 'most', a: A, b: M }, { q: 'most', a: M, b: C }],
  ];
  const [p1, p2] = patterns[Math.floor(Math.random() * patterns.length)];
  const concl = combine(p1, p2);
  const correct = concl ? showQ(concl) : 'Nothing about the relationship between the other two groups follows.';
  const distractors = [
    showQ({ q: 'all', a: p1.a, b: p2.b === p1.a ? p1.b : p2.b }),
    showQ({ q: 'most', a: p2.b, b: p1.a }),
    showQ({ q: 'none', a: p1.a, b: p2.b }),
    'Nothing about the relationship between the other two groups follows.',
  ].filter((d) => d !== correct);
  const options = shuffle([correct, ...shuffle(Array.from(new Set(distractors))).slice(0, 3)]);
  const sets = Array.from(new Set([p1.a, p1.b, p2.a, p2.b]));
  return { premises: [p1, p2], options, answer: options.indexOf(correct), sets, conclusion: concl };
}

export { symLit, contrapositive };
