// Measuring and wrapping text (docs/spec/layout.md, LAYOUT-101 to LAYOUT-104).
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ADVANCES_FILE,
  buildAdvances,
  fontAdvances,
  serializeAdvances,
} from '../../../scripts/font-metrics.ts';
import { DRAWN_TEXT_STYLE, ROLES, faceOf, measure, wrap } from '../../../src/layout/index.ts';
import { ROOT, read } from './helpers.ts';

/** The advance widths of one bundled font file, read straight from the file. */
function fontFile(name: string): Map<number, number> {
  return fontAdvances(readFileSync(join(ROOT, 'node_modules/@fontsource', name))).advances;
}

const SANS_600 = fontFile('source-sans-3/files/source-sans-3-latin-600-normal.woff');
const SERIF_ITALIC = fontFile('source-serif-4/files/source-serif-4-latin-400-italic.woff');

/** Font units of a string from a font file's own advances. */
const units = (text: string, advances: Map<number, number>): number =>
  Array.from(text).reduce((sum, char) => sum + (advances.get(char.codePointAt(0) ?? 0) ?? NaN), 0);

/** The text of wrapped lines. */
const lines = (text: string, role: (typeof ROLES)[keyof typeof ROLES]): string[] =>
  wrap(text, role).map((line) => line.text);

describe('measuring text', () => {
  it('LAYOUT-101 measures from the glyph advance widths of the bundled font files', () => {
    // The committed table is exactly what the font files say.
    expect(serializeAdvances(buildAdvances())).toBe(read(ADVANCES_FILE));
    // The width is the sum of the advances at the font size, rounded up to a whole pixel.
    for (const name of ['Website', 'Draw history service', 'Texas Lottery website']) {
      expect(measure(name, ROLES.name)).toBe(Math.ceil((units(name, SANS_600) * 14) / 1000));
    }
    const label = 'fetches draw history from (+1 more)';
    expect(measure(label, ROLES.label)).toBe(Math.ceil((units(label, SERIF_ITALIC) * 13.5) / 1000));
    // Source Code Pro gives every character 600 units: 13.5 px x 0.6 = 8.1 px each.
    expect(measure('x'.repeat(10), ROLES.taglineCode)).toBe(81);
    expect(measure('x'.repeat(28), ROLES.taglineCode)).toBe(227);
    expect(measure('', ROLES.name)).toBe(0);
  });

  it('LAYOUT-101 counts a character the bundled face lacks as one em', () => {
    // U+4E00 is in none of the bundled subsets.
    expect(measure('一', ROLES.name)).toBe(14);
    expect(measure('一一', ROLES.tagline)).toBe(27);
  });

  it('LAYOUT-102 keeps kerning and ligatures off when measuring and when drawing', () => {
    // Pairs that kern or join in the font measure as their letters one by one.
    for (const text of ['AV', 'To', 'fi', 'ffl', 'Wa']) {
      const each = units(text, SERIF_ITALIC);
      expect(measure(text.repeat(40), ROLES.label)).toBe(Math.ceil((each * 40 * 13.5) / 1000));
    }
    expect(DRAWN_TEXT_STYLE).toEqual({ fontKerning: 'none', fontVariantLigatures: 'none' });
  });

  it('LAYOUT-103 sets the face, size and wrap width of each text role from the type scale', () => {
    expect(ROLES.name).toEqual({ face: 'sans-600', size: 14, line: 18, wrap: null });
    expect(ROLES.tagline).toEqual({ face: 'serif-400', size: 13.5, line: 17, wrap: 230 });
    expect(ROLES.taglineCode).toEqual({ face: 'code-400', size: 13.5, line: 17, wrap: 230 });
    expect(ROLES.chip).toEqual({ face: 'serif-400-italic', size: 13.5, line: 20, wrap: null });
    expect(ROLES.label).toEqual({ face: 'serif-400-italic', size: 13.5, line: 17, wrap: 240 });
    expect(ROLES.labelCode).toEqual({ face: 'code-400', size: 13.5, line: 17, wrap: 240 });
    expect(ROLES.band).toEqual({ face: 'sans-600', size: 13.5, line: 18, wrap: null });
    expect(faceOf('sans-600')).toEqual({ family: 'Source Sans 3', weight: 600, style: 'normal' });
    expect(faceOf('serif-400')).toEqual({ family: 'Source Serif 4', weight: 400, style: 'normal' });
    expect(faceOf('serif-400-italic')).toEqual({
      family: 'Source Serif 4',
      weight: 400,
      style: 'italic',
    });
    expect(faceOf('code-400')).toEqual({ family: 'Source Code Pro', weight: 400, style: 'normal' });
    // Names never wrap, however long.
    const long = 'A name far longer than any tagline would ever be allowed to run on one line';
    expect(lines(long, ROLES.name)).toEqual([long]);
    // Taglines wrap at 230 px and labels at 240 px: 28 and 29 code characters.
    expect(lines('x'.repeat(29), ROLES.taglineCode)).toEqual(['x'.repeat(28), 'x']);
    expect(lines('x'.repeat(30), ROLES.labelCode)).toEqual(['x'.repeat(29), 'x']);
  });
});

describe('wrapping text', () => {
  const code = ROLES.taglineCode; // 8.1 px a character, 28 to a line

  it('LAYOUT-104 adds words to a line while the line fits', () => {
    expect(lines('aaaa bbbb cccc', code)).toEqual(['aaaa bbbb cccc']);
    // 13 + 1 + 13 = 27 characters fit; one more word starts the next line.
    expect(lines(`${'a'.repeat(13)} ${'b'.repeat(13)} c`, code)).toEqual([
      `${'a'.repeat(13)} ${'b'.repeat(13)}`,
      'c',
    ]);
    expect(lines(`${'a'.repeat(14)} ${'b'.repeat(14)}`, code)).toEqual([
      'a'.repeat(14),
      'b'.repeat(14),
    ]);
    // Spaces between words count once; spaces around the text do not count.
    expect(lines('  aaaa   bbbb  ', code)).toEqual(['aaaa bbbb']);
    expect(wrap('', code)).toEqual([]);
    expect(wrap('   ', code)).toEqual([]);
    // Every line fits the wrap width.
    const tagline =
      'Gets the game draw history, runs the strategy the user chose, and scores tickets';
    for (const line of wrap(tagline, ROLES.tagline)) expect(line.width).toBeLessThanOrEqual(230);
    expect(wrap(tagline, ROLES.tagline).length).toBeGreaterThan(1);
  });

  it('LAYOUT-104 never breaks or rewrites a no-break space', () => {
    const text = Array.from({ length: 12 }, () => '10\u00a0ms').join(' ');
    const lines = wrap(text, ROLES.tagline);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line.text).toMatch(/^10\u00a0ms( 10\u00a0ms)*$/);
  });

  it('LAYOUT-104 splits a word that is too wide after the last / . - _ : or , that fits', () => {
    const word = `${'a'.repeat(10)}/${'b'.repeat(10)}/${'c'.repeat(10)}`;
    expect(lines(word, code)).toEqual([`${'a'.repeat(10)}/${'b'.repeat(10)}/`, 'c'.repeat(10)]);
    for (const mark of ['.', '-', '_', ':', ',']) {
      const marked = `${'a'.repeat(20)}${mark}${'b'.repeat(20)}`;
      expect(lines(marked, code)).toEqual([`${'a'.repeat(20)}${mark}`, 'b'.repeat(20)]);
    }
    // A mark past the 28th character does not fit, so an earlier one is used, and the rest is
    // split again the same way.
    expect(lines(`${'a'.repeat(5)}.${'b'.repeat(25)}.${'c'.repeat(5)}`, code)).toEqual([
      `${'a'.repeat(5)}.`,
      `${'b'.repeat(25)}.`,
      'c'.repeat(5),
    ]);
    // A mark is preferred over a case change.
    expect(lines(`aaaaBbbb-${'c'.repeat(25)}`, code)).toEqual(['aaaaBbbb-', 'c'.repeat(25)]);
  });

  it('LAYOUT-104 otherwise splits before an upper-case letter that follows a lower-case one', () => {
    expect(lines('getRandomNumberGeneratedDataFromState', code)).toEqual([
      'getRandomNumberGeneratedData',
      'FromState',
    ]);
    // Upper case after upper case is not a split point.
    expect(lines(`${'a'.repeat(20)}ABCDEFGHIJKLMNOP`, code)).toEqual([
      'a'.repeat(20),
      'ABCDEFGHIJKLMNOP',
    ]);
  });

  it('LAYOUT-104 failing those splits after the last character that fits, never cutting text short', () => {
    expect(lines('x'.repeat(60), code)).toEqual(['x'.repeat(28), 'x'.repeat(28), 'x'.repeat(4)]);
    expect(lines(`go ${'x'.repeat(30)} on`, code)).toEqual(['go', 'x'.repeat(28), 'xx on']);
    const text =
      'LotteryNumberGenerationService.getRandomNumberGeneratedData loads history through LotteryStateService';
    for (const role of [ROLES.tagline, ROLES.taglineCode, ROLES.label, ROLES.labelCode]) {
      const wrapped = wrap(text, role);
      expect(
        wrapped
          .map((line) => line.text)
          .join('')
          .replace(/ /g, ''),
      ).toBe(text.replace(/ /g, ''));
      expect(wrapped.some((line) => line.text.includes('…'))).toBe(false);
      for (const line of wrapped) expect(line.width).toBeLessThanOrEqual(role.wrap);
    }
  });
});
