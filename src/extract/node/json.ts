// JSON with comments read into a tree that keeps where every value is (DRIFT-301): package.json,
// angular.json, tsconfig files and dev-server proxy files, parsed with `jsonc-parser`, which is what
// the Angular CLI reads its JSON files with.
import { parseTree, printParseErrorCode, type Node, type ParseError } from 'jsonc-parser';

/** A JSON file: its tree, and the line of any offset in it. */
export interface Json {
  file: string;
  root: Node;
  /** The line of an offset, counted from 1. */
  line(offset: number): number;
}

/** Reads a file's text as JSON with comments and trailing commas; an error says why it cannot. */
export function readJson(file: string, text: string): { json: Json } | { error: string } {
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, { allowTrailingComma: true, disallowComments: false });
  const starts = [0];
  for (let at = text.indexOf('\n'); at >= 0; at = text.indexOf('\n', at + 1)) starts.push(at + 1);
  const line = (offset: number): number => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if ((starts[middle] ?? 0) <= offset) low = middle;
      else high = middle - 1;
    }
    return low + 1;
  };
  const first = errors[0];
  if (first !== undefined) {
    return { error: `${printParseErrorCode(first.error)} at line ${String(line(first.offset))}` };
  }
  if (root === undefined) return { error: 'the file is empty' };
  return { json: { file, root, line } };
}

/** The value of an object's property, or undefined. */
export function member(node: Node | undefined, key: string): Node | undefined {
  if (node?.type !== 'object') return undefined;
  for (const property of node.children ?? []) {
    const [name, value] = property.children ?? [];
    if (name?.value === key) return value;
  }
  return undefined;
}

/** The value at a path of keys, or undefined. */
export function at(node: Node | undefined, ...keys: string[]): Node | undefined {
  let here = node;
  for (const key of keys) here = member(here, key);
  return here;
}

/** An object's properties in order: each key, the node of its key and its value. */
export function members(node: Node | undefined): { key: string; keyNode: Node; value: Node }[] {
  if (node?.type !== 'object') return [];
  return (node.children ?? []).flatMap((property) => {
    const [name, value] = property.children ?? [];
    return name !== undefined && value !== undefined && typeof name.value === 'string'
      ? [{ key: name.value, keyNode: name, value }]
      : [];
  });
}

/** An array's items, or an empty list. */
export function items(node: Node | undefined): Node[] {
  return node?.type === 'array' ? (node.children ?? []) : [];
}

/** A string value, or undefined. */
export function text(node: Node | undefined): string | undefined {
  return node?.type === 'string' && typeof node.value === 'string' ? node.value : undefined;
}
