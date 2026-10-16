/** Radial tidy-tree layout for mind maps. */
export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  data?: Record<string, unknown>;
}
export interface Placed {
  id: string;
  label: string;
  x: number;
  y: number;
  depth: number;
  parent: string | null;
  angle: number;
  data?: Record<string, unknown>;
}

function leaves(n: TreeNode): number {
  return n.children && n.children.length ? n.children.reduce((s, c) => s + leaves(c), 0) : 1;
}

export function radialLayout(root: TreeNode, ringGap = 230, firstRing = 260): Placed[] {
  const out: Placed[] = [];
  const total = leaves(root);
  const visit = (n: TreeNode, depth: number, a0: number, a1: number, parent: string | null) => {
    const mid = (a0 + a1) / 2;
    const r = depth === 0 ? 0 : firstRing + (depth - 1) * ringGap;
    out.push({ id: n.id, label: n.label, x: Math.cos(mid) * r, y: Math.sin(mid) * r * 0.82, depth, parent, angle: mid, data: n.data });
    if (!n.children) return;
    let a = a0;
    const span = a1 - a0;
    const tot = n.children.reduce((s, c) => s + leaves(c), 0);
    for (const c of n.children) {
      const share = (leaves(c) / tot) * span;
      visit(c, depth + 1, a, a + share, n.id);
      a += share;
    }
  };
  visit(root, 0, -Math.PI / 2, (3 * Math.PI) / 2, null);
  void total;
  return out;
}

/** Horizontal (left→right) tidy tree — used for compact lesson maps. */
export function horizontalLayout(root: TreeNode, colGap = 250, rowGap = 64): Placed[] {
  const out: Placed[] = [];
  let row = 0;
  const visit = (n: TreeNode, depth: number, parent: string | null): number => {
    let y: number;
    if (!n.children || !n.children.length) {
      y = row * rowGap;
      row++;
    } else {
      const ys = n.children.map((c) => visit(c, depth + 1, n.id));
      y = (ys[0] + ys[ys.length - 1]) / 2;
    }
    out.push({ id: n.id, label: n.label, x: depth * colGap, y, depth, parent, angle: 0, data: n.data });
    return y;
  };
  visit(root, 0, null);
  return out;
}

/** Convert a label-only MapNode tree into TreeNodes with stable ids. */
export function idTree(node: { label: string; children?: { label: string; children?: unknown[] }[] }, prefix = 'n'): TreeNode {
  let i = 0;
  const go = (n: { label: string; children?: unknown[] }): TreeNode => ({
    id: `${prefix}${i++}`,
    label: n.label,
    children: (n.children as { label: string; children?: unknown[] }[] | undefined)?.map(go),
  });
  return go(node);
}

export function flatten(t: TreeNode): TreeNode[] {
  return [t, ...(t.children ?? []).flatMap(flatten)];
}
export function edgesOf(t: TreeNode): [string, string][] {
  return (t.children ?? []).flatMap((c) => [[t.id, c.id] as [string, string], ...edgesOf(c)]);
}
