/** Formal core for conditional logic graphics and the Conditional Logic Trainer. */

export interface Lit {
  v: string;
  neg?: boolean;
}
export interface Cond {
  a: Lit; // sufficient
  b: Lit; // necessary
}

export const lit = (v: string, neg = false): Lit => ({ v, neg });
export const negate = (l: Lit): Lit => ({ v: l.v, neg: !l.neg });
export const litEq = (x: Lit, y: Lit) => x.v === y.v && !!x.neg === !!y.neg;
export const showLit = (l: Lit) => (l.neg ? `not ${l.v}` : l.v);
export const symLit = (l: Lit) => (l.neg ? `¬${l.v}` : l.v);
export const contrapositive = (c: Cond): Cond => ({ a: negate(c.b), b: negate(c.a) });
export const showCond = (c: Cond) => `${symLit(c.a)} → ${symLit(c.b)}`;

const key = (l: Lit) => (l.neg ? '~' : '') + l.v;

/** All literals reachable from `start` through the conditionals and their contrapositives. */
export function reachable(conds: Cond[], start: Lit): Lit[] {
  const edges = new Map<string, Lit[]>();
  const add = (c: Cond) => {
    const k = key(c.a);
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k)!.push(c.b);
  };
  conds.forEach((c) => {
    add(c);
    add(contrapositive(c));
  });
  const seen = new Set<string>([key(start)]);
  const out: Lit[] = [];
  const stack = [start];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const nx of edges.get(key(cur)) ?? []) {
      const k = key(nx);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(nx);
        stack.push(nx);
      }
    }
  }
  return out;
}

export function follows(conds: Cond[], c: Cond): boolean {
  return reachable(conds, c.a).some((l) => litEq(l, c.b));
}

/** Every valid inference (excluding the premises themselves) from a set of conditionals. */
export function validInferences(conds: Cond[]): Cond[] {
  const lits: Lit[] = [];
  const addLit = (l: Lit) => {
    if (!lits.some((x) => litEq(x, l))) lits.push(l);
  };
  conds.forEach((c) => {
    addLit(c.a);
    addLit(c.b);
    addLit(negate(c.a));
    addLit(negate(c.b));
  });
  const out: Cond[] = [];
  for (const a of lits) {
    for (const b of reachable(conds, a)) {
      if (litEq(a, b)) continue;
      out.push({ a, b });
    }
  }
  return out;
}

/** The classic invalid moves from A → B: the reversal (B → A) and the negation (¬A → ¬B). */
export function fallacies(c: Cond): { cond: Cond; name: string }[] {
  return [
    { cond: { a: c.b, b: c.a }, name: 'Reversal (affirming the necessary)' },
    { cond: { a: negate(c.a), b: negate(c.b) }, name: 'Negation (denying the sufficient)' },
  ];
}

// ── Quantifiers ──────────────────────────────────────────────

export type Quant = 'all' | 'most' | 'some' | 'none' | 'some-not';
export interface QStatement {
  q: Quant;
  a: string;
  b: string;
}
export function showQ(s: QStatement): string {
  switch (s.q) {
    case 'all':
      return `All ${s.a} are ${s.b}.`;
    case 'most':
      return `Most ${s.a} are ${s.b}.`;
    case 'some':
      return `Some ${s.a} are ${s.b}.`;
    case 'none':
      return `No ${s.a} are ${s.b}.`;
    case 'some-not':
      return `Some ${s.a} are not ${s.b}.`;
  }
}

/**
 * Quantifier combination rules (two premises sharing a middle term).
 * Returns the strongest valid conclusion about the outer terms, or null.
 */
export function combine(p1: QStatement, p2: QStatement): QStatement | null {
  // normalize so that p1 = X ? M, p2 = M ? Y (or both start with the same term for "most + most")
  const { q: q1, a: a1, b: b1 } = p1;
  const { q: q2, a: a2, b: b2 } = p2;
  if (b1 === a2) {
    if (q1 === 'all' && q2 === 'all') return { q: 'all', a: a1, b: b2 };
    if (q1 === 'all' && q2 === 'none') return { q: 'none', a: a1, b: b2 };
    if ((q1 === 'some' || q1 === 'most') && q2 === 'all') return { q: q1, a: a1, b: b2 };
    if ((q1 === 'some' || q1 === 'most') && q2 === 'none') return { q: 'some-not', a: a1, b: b2 };
    return null; // e.g. all + some, all + most, some + some → nothing follows
  }
  if (a1 === a2 && q1 === 'most' && q2 === 'most') return { q: 'some', a: b1, b: b2 };
  if (a1 === a2 && q1 === 'all' && (q2 === 'some' || q2 === 'most')) return { q: 'some', a: b1, b: b2 };
  if (a1 === a2 && (q1 === 'some' || q1 === 'most') && q2 === 'all') return { q: 'some', a: b2, b: b1 };
  return null;
}
