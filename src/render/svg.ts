// A small SVG element tree and its serialiser. The renderer builds drawings as plain data, so they
// are the same in Node and in the browser, can be compared as goldens, and are written as markup
// with every number rounded to two decimal places (LAYOUT-003) and attributes in a stable order.

/** An attribute value; numbers are rounded when written, and null or false leaves it out. */
export type Value = string | number | boolean | null | undefined;

/** One SVG element: its tag, attributes in writing order, and children or text. */
export interface SvgNode {
  tag: string;
  attrs: Record<string, Value>;
  children: (SvgNode | string)[];
}

/** Builds an element. String children are text, escaped when written. */
export function el(
  tag: string,
  attrs: Record<string, Value> = {},
  children: readonly (SvgNode | string | null | false | undefined)[] = [],
): SvgNode {
  return {
    tag,
    attrs,
    children: children.filter(
      (child): child is SvgNode | string =>
        typeof child === 'string' || (child !== null && child !== false && child !== undefined),
    ),
  };
}

/** A number with at most two decimal places, never `-0`, as written in markup and path data. */
export function num(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Cannot draw the number ${String(value)}.`);
  const rounded = Math.round(value * 100) / 100;
  return String(rounded === 0 ? 0 : rounded);
}

/** A translation transform. */
export function translate(x: number, y: number): string {
  return `translate(${num(x)} ${num(y)})`;
}

/** Path data from commands and numbers, such as `path('M', 1, 2, 'L', 3, 4)` for "M1 2L3 4". */
export function path(...parts: (string | number)[]): string {
  let out = '';
  let previous: 'command' | 'number' | null = null;
  for (const part of parts) {
    if (typeof part === 'string') {
      out += part;
      previous = 'command';
    } else {
      const written = num(part);
      if (previous === 'number' && !written.startsWith('-')) out += ' ';
      out += written;
      previous = 'number';
    }
  }
  return out;
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

/** Escapes text and attribute values for markup. */
export function escape(text: string): string {
  return text.replace(/[&<>"]/g, (char) => ESCAPES[char] ?? char);
}

function attributes(attrs: Record<string, Value>): string {
  let out = '';
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    const written = value === true ? '' : typeof value === 'number' ? num(value) : value;
    out += ` ${name}="${escape(written)}"`;
  }
  return out;
}

/**
 * Writes a tree as SVG markup. With `indent`, each element starts on its own line, indented by
 * depth, for goldens a reader can diff; elements holding text stay on one line either way.
 */
export function toMarkup(node: SvgNode, indent: string | null = null): string {
  const lines: string[] = [];
  const write = (at: SvgNode, depth: number): string => {
    const open = `<${at.tag}${attributes(at.attrs)}`;
    if (at.children.length === 0) return `${open}/>`;
    const hasText = at.children.some((child) => typeof child === 'string');
    if (indent === null || hasText) {
      const inner = at.children
        .map((child) => (typeof child === 'string' ? escape(child) : write(child, depth + 1)))
        .join('');
      return `${open}>${inner}</${at.tag}>`;
    }
    const pad = indent.repeat(depth);
    const inner = at.children
      .map(
        (child) =>
          `${pad}${indent}${typeof child === 'string' ? escape(child) : write(child, depth + 1)}`,
      )
      .join('\n');
    return `${open}>\n${inner}\n${pad}</${at.tag}>`;
  };
  lines.push(write(node, 0));
  return lines.join('\n');
}

/** Every element of a tree, depth first, the root first. */
export function* walk(node: SvgNode): Generator<SvgNode> {
  yield node;
  for (const child of node.children) if (typeof child !== 'string') yield* walk(child);
}

/** The classes of an element. */
export function classes(node: SvgNode): string[] {
  const value = node.attrs['class'];
  return typeof value === 'string' ? value.split(' ').filter((each) => each !== '') : [];
}

/** The text an element holds, its own and its descendants', joined. */
export function textOf(node: SvgNode): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
}
