export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export function dateKey(ts = Date.now()): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function shuffle<T>(arr: T[], seed?: number): T[] {
  const a = arr.slice();
  let r = seed ?? Math.random() * 1e9;
  const rand = () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor((seed === undefined ? Math.random() : rand()) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function toRoman(n: number): string {
  const map: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of map) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

export function pct(n: number, d: number): number {
  return d ? Math.round((n / d) * 100) : 0;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function daysBetween(a: number, b: number): number {
  return Math.round((b - a) / 86_400_000);
}

const STOP = new Set('the a an of to and or in on is are be that this it for as by with not from at its was were which but if then than so do does any all some most no can could would should may might must'.split(' '));

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** crude stem so that "causes", "caused", "causation" match "caus" */
export function stem(w: string): string {
  return w.toLowerCase().replace(/(ations?|ions?|ing|ed|es|s|ly|ity|al)$/, '').slice(0, 7);
}

/** Does `text` mention a keyword phrase (stem-tolerant, all words of the phrase present)? */
export function mentions(text: string, phrase: string): boolean {
  const have = new Set(tokens(text).map(stem));
  const lower = text.toLowerCase();
  if (lower.includes(phrase.toLowerCase())) return true;
  const need = tokens(phrase).map(stem);
  return need.length > 0 && need.every((w) => have.has(w));
}

export function download(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
