// Shared helpers for the model semantics tests (docs/spec/model.md).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, type Id } from '../../../src/lines/index.ts';
import { Semantics, type DrawnEdge, type Zoom, type ZoomMark } from '../../../src/model/index.ts';

const ROOT = join(import.meta.dirname, '../../..');

export const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/** The semantics of a Lines source that has no errors. */
export function semanticsOf(source: string): Semantics {
  const result = parse(source);
  if (result.model === null) {
    throw new Error(result.diagnostics.map((found) => found.message).join('\n'));
  }
  return new Semantics(result.model);
}

/** The worked example of the spec (docs/spec/examples/lotto.aerie). */
export const LOTTO = semanticsOf(read('docs/spec/examples/lotto.aerie'));

/** A zoom state written as `{ id: mark }`, in the order given. */
export const zoom = (marks: Record<Id, ZoomMark> = {}): Zoom => new Map(Object.entries(marks));

/** A zoom state as a plain list, for comparing order as well as entries. */
export const entries = (state: Zoom): [Id, ZoomMark][] => [...state];

/** An edge read the way the spec's Lotto tables write it: lifted ends around the label. */
export function reading(semantics: Semantics, edge: DrawnEdge, audience: Id): string {
  const source = semantics.name(edge.source, audience);
  const target = semantics.name(edge.target, audience);
  return `${source} ${semantics.label(edge, audience)} ${target}`;
}

/**
 * The tables of model.md's worked example, by the heading above them: each row as its cells, with
 * Markdown escapes removed. The header row is left out.
 */
export function specTables(): Map<string, string[][]> {
  const tables = new Map<string, string[][]>();
  let heading = '';
  for (const line of read('docs/spec/model.md').split('\n')) {
    if (line.startsWith('#')) {
      heading = line.replace(/^#+\s*/, '');
      continue;
    }
    if (!line.startsWith('|')) continue;
    const cells = line
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim().replace(/\\(.)/g, '$1'));
    if (cells.every((cell) => /^-+$/.test(cell))) continue;
    const rows = tables.get(heading);
    if (rows === undefined) {
      tables.set(heading, []); // the first row is the header
    } else {
      rows.push(cells);
    }
  }
  return tables;
}
