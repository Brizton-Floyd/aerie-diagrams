// The language fixtures of ACC-012: each `<id>-<what>.aerie` file in examples/ has its expected
// canonical model (`.json`) and its expected diagnostics (`.diagnostics.json`) beside it. Update
// them deliberately with `npx vitest run --project unit -u` and review the difference.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CATALOGUE,
  format,
  parse,
  print,
  serializeModel,
  type Diagnostic,
} from '../../../src/lines/index.ts';

const DIR = join(import.meta.dirname, 'examples');
const FIXTURES = readdirSync(DIR)
  .filter((file) => file.endsWith('.aerie'))
  .sort();
const NAME = /^((?:LANG-\d{3})|(?:[EW]\d{3}))-([a-z0-9-]+)\.aerie$/;

function titleOf(file: string): string {
  const match = NAME.exec(file);
  if (match === null) {
    throw new Error(`${file} is not named <id>-<what>.aerie`);
  }
  return `${match[1] ?? ''} ${(match[2] ?? '').replace(/-/g, ' ')}`;
}

const source = (file: string): string => readFileSync(join(DIR, file), 'utf8');
const expected = (file: string, suffix: string): string =>
  join(DIR, file.replace(/\.aerie$/, suffix));

/** Diagnostics without their positions, for comparing a file with its formatted version. */
const withoutPositions = (diagnostics: Diagnostic[]): string[] =>
  diagnostics.map(
    (found) => `${found.id} ${found.severity} ${found.message.replace(/line \d+/g, 'line N')}`,
  );

describe('language fixtures', () => {
  it.each(FIXTURES.map((file) => [titleOf(file), file]))('%s', async (_title, file) => {
    const result = parse(source(file));
    const modelFile = expected(file, '.json');
    const diagnosticsFile = expected(file, '.diagnostics.json');
    if (result.model === null) {
      expect(existsSync(modelFile)).toBe(false);
    } else {
      await expect(serializeModel(result.model)).toMatchFileSnapshot(modelFile);
    }
    if (result.diagnostics.length === 0) {
      expect(existsSync(diagnosticsFile)).toBe(false);
    } else {
      const text = JSON.stringify(result.diagnostics, null, 2) + '\n';
      await expect(text).toMatchFileSnapshot(diagnosticsFile);
    }
  });

  it('ACC-012 each diagnostic fixture produces the diagnostic it is named after', () => {
    for (const file of FIXTURES.filter((name) => /^[EW]\d{3}-/.test(name))) {
      const id = file.slice(0, 4);
      const ids = parse(source(file)).diagnostics.map((found) => found.id);
      expect(ids, file).toContain(id);
    }
  });

  it('ACC-012 every catalogue entry has a fixture, apart from the model-stage E604 and E703', () => {
    const covered = new Set(
      FIXTURES.flatMap((file) => parse(source(file)).diagnostics.map((found) => found.id)),
    );
    const missing = Object.keys(CATALOGUE).filter(
      (id) => !covered.has(id as keyof typeof CATALOGUE) && id !== 'E604' && id !== 'E703',
    );
    expect(missing).toEqual([]);
  });
});

describe('the formatter and printer over every fixture', () => {
  const formattable = FIXTURES.filter((file) => format(source(file)).diagnostics.length === 0);

  it('LANG-931 changes only spacing: every line keeps its characters, in order', () => {
    const characters = (text: string): string[] =>
      text
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '')
        .map((line) => line.replace(/\s+/g, ''));
    for (const file of formattable) {
      expect(characters(format(source(file)).text), file).toEqual(characters(source(file)));
    }
  });

  it('LANG-938 formatting a formatted file changes nothing', () => {
    for (const file of formattable) {
      const once = format(source(file)).text;
      expect(format(once).text, file).toBe(once);
      expect(format(once).changed, file).toBe(false);
    }
  });

  it('LANG-939 a file and its formatted version have equal models and the same diagnostics', () => {
    for (const file of formattable) {
      const before = parse(source(file));
      const after = parse(format(source(file)).text);
      expect(after.model, file).toEqual(before.model);
      expect(withoutPositions(after.diagnostics), file).toEqual(
        withoutPositions(before.diagnostics),
      );
    }
  });

  it('LANG-936 a file with E001, E002 or E004 is left unchanged, with those diagnostics', () => {
    const refused = FIXTURES.filter((file) => !formattable.includes(file));
    expect(refused.length).toBeGreaterThan(0);
    for (const file of refused) {
      const result = format(source(file));
      expect(result.text, file).toBe(source(file));
      expect(result.changed, file).toBe(false);
      const blocking = parse(source(file)).diagnostics.filter((found) =>
        ['E001', 'E002', 'E004'].includes(found.id),
      );
      expect(result.diagnostics, file).toEqual(blocking);
    }
  });

  it('LANG-941 printing every valid model and parsing it again gives an equal model', () => {
    let printed = 0;
    for (const file of FIXTURES) {
      const model = parse(source(file)).model;
      if (model === null) continue;
      const text = print(model);
      const again = parse(text);
      expect(again.model, `${file}\n${text}`).toEqual(model);
      expect(format(text).text, file).toBe(text);
      printed++;
    }
    expect(printed).toBeGreaterThan(50);
  });
});

describe('the formatter over broken files', () => {
  /** A small deterministic random sequence, so failures can be replayed. */
  function random(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
  }
  const PIECES = [
    ' ',
    '  ',
    ',',
    '[',
    ']',
    '|',
    '\\',
    ':',
    '>',
    '@exec',
    '//',
    '+1',
    '"',
    '(',
    '\n  ',
    'step ',
    '😀',
  ];

  it('LANG-939 keeps models and messages through formatting, over 500 mangled copies of a sample', () => {
    const base = readFileSync(join(import.meta.dirname, '../../../samples/lotto.aerie'), 'utf8');
    const next = random(7);
    for (let round = 0; round < 500; round++) {
      let text = base;
      for (let edit = 0; edit < 1 + Math.floor(next() * 5); edit++) {
        const at = Math.floor(next() * text.length);
        text =
          next() < 0.5
            ? text.slice(0, at) +
              (PIECES[Math.floor(next() * PIECES.length)] ?? '') +
              text.slice(at)
            : text.slice(0, at) + text.slice(at + 1 + Math.floor(next() * 4));
      }
      const before = parse(text);
      const once = format(text);
      if (once.diagnostics.length > 0) continue;
      const after = parse(once.text);
      expect(format(once.text).text, `round ${String(round)}`).toBe(once.text);
      expect(after.model, `round ${String(round)}`).toEqual(before.model);
      expect(withoutPositions(after.diagnostics), `round ${String(round)}`).toEqual(
        withoutPositions(before.diagnostics),
      );
      if (before.model !== null) {
        expect(parse(print(before.model)).model, `round ${String(round)}`).toEqual(before.model);
      }
    }
  });
});
