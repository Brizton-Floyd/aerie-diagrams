// Measuring and wrapping text (docs/spec/layout.md, LAYOUT-101 to LAYOUT-104). Widths come from the
// glyph advance widths of Aerie's bundled font files (advances.json, written from the fonts by
// scripts/font-metrics.ts), never from the browser, so a layout is the same everywhere.
import advances from './advances.json' with { type: 'json' };

/** The faces the diagram draws, as keyed in advances.json. */
export type FaceName = keyof typeof advances.faces;

/** One drawn text role of the type scale (docs/spec/look.md, type scale). */
export interface TextRole {
  face: FaceName;
  /** CSS pixels at camera scale 1. */
  size: number;
  /** The height of one line. */
  line: number;
  /** The wrap width, or null for text that never wraps. */
  wrap: number | null;
}

/** LAYOUT-103: the text roles the layout measures, from the type scale in look.md. */
export const ROLES = {
  name: { face: 'sans-600', size: 14, line: 18, wrap: null },
  tagline: { face: 'serif-400', size: 13.5, line: 17, wrap: 230 },
  taglineCode: { face: 'code-400', size: 13.5, line: 17, wrap: 230 },
  chip: { face: 'serif-400-italic', size: 13.5, line: 20, wrap: null },
  label: { face: 'serif-400-italic', size: 13.5, line: 17, wrap: 240 },
  labelCode: { face: 'code-400', size: 13.5, line: 17, wrap: 240 },
  band: { face: 'sans-600', size: 13.5, line: 18, wrap: null },
} as const satisfies Record<string, TextRole>;

export type RoleName = keyof typeof ROLES;

/**
 * LAYOUT-102: kerning and ligatures are off when measuring (advances are summed one by one) and
 * must be off when drawing, so drawn text is as wide as measured text. As CSS properties.
 */
export const DRAWN_TEXT_STYLE = { fontKerning: 'none', fontVariantLigatures: 'none' } as const;

/** A face's font family, weight and style, for drawing it. */
export function faceOf(name: FaceName): { family: string; weight: number; style: string } {
  const { family, weight, style } = advances.faces[name];
  return { family, weight, style };
}

interface Metrics {
  unitsPerEm: number;
  widths: Map<number, number>;
}

const metrics = new Map<FaceName, Metrics>();

function metricsOf(face: FaceName): Metrics {
  let found = metrics.get(face);
  if (found === undefined) {
    const table = advances.faces[face];
    const widths = new Map<number, number>();
    for (const [start = 0, ...run] of table.runs) {
      run.forEach((width, index) => widths.set(start + index, width));
    }
    found = { unitsPerEm: table.unitsPerEm, widths };
    metrics.set(face, found);
  }
  return found;
}

/**
 * The advance widths of a string's code points in font units, summed. A code point the bundled
 * face lacks counts one em, more than any glyph it has, so the reserve never comes up short.
 */
function units(text: string, face: Metrics): number {
  let sum = 0;
  for (const char of text) {
    sum += face.widths.get(char.codePointAt(0) ?? 0) ?? face.unitsPerEm;
  }
  return sum;
}

/** LAYOUT-101: the sum of the advance widths at the font size, rounded up to a whole pixel. */
export function measure(text: string, role: TextRole): number {
  const face = metricsOf(role.face);
  // Sizes are multiples of 0.5 px, so the exact width is a multiple of 1/2000 px: the small
  // allowance only absorbs binary rounding and never hides a real fraction.
  return Math.max(0, Math.ceil((units(text, face) * role.size) / face.unitsPerEm - 1e-9));
}

/** One line of measured text. */
export interface TextLine {
  text: string;
  width: number;
}

const BREAK_AFTER = new Set(['/', '.', '-', '_', ':', ',']);
const UPPER = /^\p{Lu}$/u;
const LOWER = /^\p{Ll}$/u;

/**
 * LAYOUT-104: where to split a word wider than the wrap width, as a count of code points: after
 * the last `/ . - _ : ,` that fits, else before the last upper-case letter that follows a
 * lower-case one and fits, else after the last character that fits (always at least one).
 */
function splitPoint(chars: readonly string[], role: TextRole, wrap: number): number {
  let fits = 1;
  while (fits < chars.length && measure(chars.slice(0, fits + 1).join(''), role) <= wrap) {
    fits += 1;
  }
  for (let at = Math.min(fits, chars.length - 1); at >= 1; at--) {
    if (BREAK_AFTER.has(chars[at - 1] ?? '')) return at;
  }
  for (let at = Math.min(fits, chars.length - 1); at >= 1; at--) {
    if (UPPER.test(chars[at] ?? '') && LOWER.test(chars[at - 1] ?? '')) return at;
  }
  return fits;
}

/**
 * LAYOUT-104: greedy wrapping. Words are added to a line while it fits the role's wrap width; a
 * word wider than the wrap width on its own starts a line and is split (see `splitPoint`). Text is
 * never cut short. Text that never wraps, or fits, is one line; empty text is no lines.
 */
export function wrap(text: string, role: TextRole): TextLine[] {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '');
  if (words.length === 0) return [];
  const width = role.wrap;
  if (width === null) {
    const whole = words.join(' ');
    return [{ text: whole, width: measure(whole, role) }];
  }
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const joined = current === '' ? word : `${current} ${word}`;
    if (measure(joined, role) <= width) {
      current = joined;
      continue;
    }
    if (current !== '') lines.push(current);
    // Code points, as the fonts map them to glyphs; the same in every engine.
    let rest = Array.from(word);
    while (measure(rest.join(''), role) > width) {
      const at = splitPoint(rest, role, width);
      lines.push(rest.slice(0, at).join(''));
      rest = rest.slice(at);
    }
    current = rest.join('');
  }
  lines.push(current);
  return lines.map((line) => ({ text: line, width: measure(line, role) }));
}
