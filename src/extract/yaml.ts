// YAML read into a plain tree that keeps the file and line of every node (DRIFT-008), with aliases
// resolved and merge keys (`<<: *anchor`) applied, since the `yaml` package's own plain output
// loses positions. Keys and scalars are text; a YAML null is null.
import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  LineCounter,
  parseAllDocuments,
  parseDocument,
  type Document,
} from 'yaml';

/** Where a node is: an absolute path and a line counted from 1. */
export interface At {
  file: string;
  line: number;
}

export type YNode = YMap | YSeq | YScalar;

interface YBase {
  at: At;
  /** A local tag such as `!reset` or `!override`, or null. */
  tag: string | null;
}

export interface YMap extends YBase {
  type: 'map';
  entries: YEntry[];
}

export interface YEntry {
  key: string;
  /** Where the key is. */
  at: At;
  value: YNode;
}

export interface YSeq extends YBase {
  type: 'seq';
  items: YNode[];
}

export interface YScalar extends YBase {
  type: 'scalar';
  /** The value as written for numbers and booleans, the string itself for strings; null for null. */
  text: string | null;
}

export interface YamlRead {
  root: YNode | null;
  /** Syntax errors, each with its line. */
  errors: { line: number; message: string }[];
}

/** Reads one YAML document (YAML 1.2, merge keys on), as Compose does. */
export function readYaml(text: string, file: string): YamlRead {
  const lines = new LineCounter();
  const doc = parseDocument(text, { merge: true, lineCounter: lines });
  const lineOf = (offset: number): number => lines.linePos(offset).line;
  const errors = doc.errors.map((error) => ({
    line: lineOf(error.pos[0]),
    message: error.message.split('\n')[0] ?? error.message,
  }));
  if (errors.length > 0) return { root: null, errors };
  const read = new Reader(doc, file, lineOf);
  return { root: doc.contents === null ? null : read.node(doc.contents, []), errors };
}

/**
 * Reads every document of a YAML stream as Spring Boot does (DRIFT-205): YAML 1.1, as SnakeYAML
 * reads it, with merge keys on. Errors stop the whole file, since Spring would not start with it.
 */
export function readYamlDocuments(
  text: string,
  file: string,
): { roots: (YNode | null)[]; errors: YamlRead['errors'] } {
  const lines = new LineCounter();
  const docs = parseAllDocuments(text, { version: '1.1', merge: true, lineCounter: lines });
  const lineOf = (offset: number): number => lines.linePos(offset).line;
  const all = Array.isArray(docs) ? docs : [];
  const errors = all.flatMap((doc) =>
    doc.errors.map((error) => ({
      line: lineOf(error.pos[0]),
      message: error.message.split('\n')[0] ?? error.message,
    })),
  );
  if (errors.length > 0) return { roots: [], errors };
  return {
    roots: all.map((doc) =>
      doc.contents === null ? null : new Reader(doc, file, lineOf).node(doc.contents, []),
    ),
    errors,
  };
}

class Reader {
  readonly doc: Document;
  readonly file: string;
  readonly lineOf: (offset: number) => number;

  constructor(doc: Document, file: string, lineOf: (offset: number) => number) {
    this.doc = doc;
    this.file = file;
    this.lineOf = lineOf;
  }

  at(node: { range?: [number, number, number] | null | undefined }): At {
    return { file: this.file, line: node.range ? this.lineOf(node.range[0]) : 1 };
  }

  /** `seen` holds the aliases being resolved, so a cycle reads as null instead of looping. */
  node(node: unknown, seen: readonly unknown[]): YNode {
    if (isAlias(node)) {
      const target = node.resolve(this.doc);
      if (target === undefined || seen.includes(target)) {
        return { type: 'scalar', at: this.at(node), tag: null, text: null };
      }
      return this.node(target, [...seen, target]);
    }
    if (isMap(node)) {
      const explicit: YEntry[] = [];
      const merged: YEntry[] = [];
      for (const pair of node.items) {
        const key = pair.key;
        if (isScalar(key) && (typeof key.value === 'symbol' || key.source === '<<')) {
          merged.push(...this.mergeEntries(pair.value, seen));
          continue;
        }
        if (!isScalar(key)) continue;
        explicit.push({
          key: scalarText(key) ?? '',
          at: this.at(key),
          value:
            pair.value === null
              ? { type: 'scalar', at: this.at(key), tag: null, text: null }
              : this.node(pair.value, seen),
        });
      }
      // A key written in the map wins over a merged one; among merged maps, the first wins.
      const entries = [...explicit];
      for (const entry of merged) {
        if (!entries.some((each) => each.key === entry.key)) entries.push(entry);
      }
      return { type: 'map', at: this.at(node), tag: node.tag ?? null, entries };
    }
    if (isSeq(node)) {
      return {
        type: 'seq',
        at: this.at(node),
        tag: node.tag ?? null,
        items: node.items.map((item) => this.node(item, seen)),
      };
    }
    if (isScalar(node)) {
      return { type: 'scalar', at: this.at(node), tag: node.tag ?? null, text: scalarText(node) };
    }
    return { type: 'scalar', at: { file: this.file, line: 1 }, tag: null, text: null };
  }

  /** The entries a merge key brings in: from one map, or from each map of a list. */
  mergeEntries(value: unknown, seen: readonly unknown[]): YEntry[] {
    const sources = isSeq(value) ? value.items : [value];
    const entries: YEntry[] = [];
    for (const source of sources) {
      const read = this.node(source, seen);
      if (read.type !== 'map') continue;
      for (const entry of read.entries) {
        if (!entries.some((each) => each.key === entry.key)) entries.push(entry);
      }
    }
    return entries;
  }
}

function scalarText(node: { value: unknown; source?: string }): string | null {
  const value = node.value;
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return node.source ?? String(value);
  }
  return node.source ?? null;
}

/** The entry for a key, if the node is a map that has it. */
export function entry(node: YNode | undefined, key: string): YEntry | undefined {
  return node?.type === 'map' ? node.entries.find((each) => each.key === key) : undefined;
}

/** The value for a key, if the node is a map that has it. */
export function get(node: YNode | undefined, key: string): YNode | undefined {
  return entry(node, key)?.value;
}

/** A scalar's text, or undefined for anything else. */
export function text(node: YNode | undefined): string | null | undefined {
  return node?.type === 'scalar' ? node.text : undefined;
}
