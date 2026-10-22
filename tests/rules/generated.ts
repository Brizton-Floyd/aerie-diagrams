// Generated models for the rule checks: the samples show what Aerie is for, and these, from a fixed
// seed, reach the corners a hand-written sample never does: rim elements inside containers and
// joined to each other, deep nesting, narrow children under long headers, long code-voice words,
// tag views and scenarios across every level. The same seed always gives the same models.
import { parse } from '../../src/lines/index.ts';
import { Semantics } from '../../src/model/index.ts';

const WORDS = [
  'alpha',
  'beta',
  'store',
  'queue',
  'api',
  'web',
  'cache',
  'worker',
  'billing',
  'search',
  'index',
  'gateway',
  'auth',
  'ledger',
  'report',
  'export',
  'import',
  'scheduler',
  'payments',
  'catalog',
];
const VERBS = [
  'calls',
  'sends',
  'reads',
  'writes',
  'asks',
  'tells',
  'the',
  'data',
  'to',
  'from',
  'every',
  'hour',
];
const TAGS = ['person', 'external', 'service', 'store', 'module'];

/** A small deterministic random number generator (mulberry32). */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The Lines source of one generated model. */
export function generate(seed: number): string {
  const next = random(seed);
  const int = (low: number, high: number): number => low + Math.floor(next() * (high - low + 1));
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)] as T;
  const words = (low: number, high: number, from: readonly string[] = WORDS): string =>
    Array.from({ length: int(low, high) }, () => pick(from)).join(' ');
  const title = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

  const count = int(3, 18);
  const parent = new Map<string, string | null>();
  const depth = new Map<string, number>();
  const tags = new Map<string, string[]>();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = `e${String(i)}`;
    const holders = ids.filter((each) => (depth.get(each) ?? 0) < 3);
    const above = holders.length > 0 && next() < 0.55 ? pick(holders) : null;
    parent.set(id, above);
    depth.set(id, above === null ? 0 : (depth.get(above) ?? 0) + 1);
    tags.set(id, next() < 0.35 ? [pick(TAGS)] : []);
    ids.push(id);
  }
  const lines = ['model g: Generated', 'audiences a "A" (default), b "B", c "C" (code)', ''];
  const element = (id: string, indent: string): void => {
    const tagline = next() < 0.6 ? ` | ${words(1, 12)}` : '';
    const tagged = tags.get(id) ?? [];
    lines.push(
      `${indent}${id}: ${title(words(1, 3))}${tagline}${tagged.length > 0 ? ` [${tagged.join(' ')}]` : ''}`,
    );
    if (next() < 0.3) lines.push(`${indent}  @b: ${title(words(2, 5))}`);
    if (next() < 0.5) {
      const code = `${pick(WORDS)}.${pick(WORDS)}/${pick(WORDS)}_${words(3, 7).replace(/ /g, '')}`;
      lines.push(`${indent}  @c: | ${code}`);
    }
    for (const child of ids.filter((each) => parent.get(each) === id))
      element(child, `${indent}  `);
  };
  for (const id of ids.filter((each) => parent.get(each) === null)) element(id, '');

  const ancestors = (id: string): string[] => {
    const out: string[] = [];
    for (let at = parent.get(id) ?? null; at !== null; at = parent.get(at) ?? null) out.push(at);
    return out;
  };
  const apart = (a: string, b: string): boolean =>
    a !== b && !ancestors(a).includes(b) && !ancestors(b).includes(a);
  lines.push('');
  const said = new Set<string>();
  let code = false;
  for (let k = int(0, 2 * count); k > 0; k--) {
    const subject = pick(ids);
    const object = pick(ids);
    const verb = words(1, 6, VERBS);
    const kind = next() < 0.15 ? ' [code]' : '';
    const key = `${subject} ${verb} ${object}${kind}`;
    if (!apart(subject, object) || said.has(key)) continue;
    said.add(key);
    code ||= kind !== '';
    lines.push(key);
    if (next() < 0.3) lines.push(`  @b: ${verb} ${words(2, 5)}`);
    if (next() < 0.3) lines.push(`  @c: ${words(1, 2)}/${words(2, 4).replace(/ /g, '_')} to`);
  }

  lines.push('', 'view whole: Whole');
  const shown = Array.from({ length: int(1, 3) }, () => `${pick(ids)} +${String(int(0, 3))}`);
  lines.push('view part: Part', `  show ${[...new Set(shown)].join(', ')}`);
  const tagged = TAGS.filter((tag) => ids.some((id) => tags.get(id)?.includes(tag)));
  if (tagged.length > 0) {
    lines.push('view tagged: Tagged', `  show [${pick(tagged)}]`);
    if (code) lines.push('  kind runtime, code');
  }

  for (let s = int(0, 2); s > 0; s--) {
    const steps: string[] = [];
    for (let k = int(2, 9); k > 0; k--) {
      const subject = pick(ids);
      const object = pick(ids);
      if (apart(subject, object)) steps.push(`  ${subject} ${words(1, 5, VERBS)} ${object}`);
    }
    if (steps.length > 0) lines.push('', `scenario s${String(s)}: Scenario ${String(s)}`, ...steps);
  }
  return `${lines.join('\n')}\n`;
}

/** `count` generated models that parse, from consecutive seeds starting at `first`. */
export function generatedModels(
  first: number,
  count: number,
): { seed: number; semantics: Semantics }[] {
  const out: { seed: number; semantics: Semantics }[] = [];
  for (let seed = first; out.length < count; seed++) {
    const result = parse(generate(seed));
    if (result.model !== null) out.push({ seed, semantics: new Semantics(result.model) });
  }
  return out;
}
