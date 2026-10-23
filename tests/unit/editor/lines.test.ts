// What the split editor knows about Lines (docs/spec/interaction.md, INT-802 to INT-804): colours by
// line kind, the indent after Enter, and completion lists.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ICON_NAMES,
  KEYWORDS,
  completionsAt,
  highlight,
  newLineIndent,
  type TokenKind,
} from '../../../src/lines/index.ts';

const ROOT = join(import.meta.dirname, '../../..');
const LOTTO = readFileSync(join(ROOT, 'samples/lotto.aerie'), 'utf8');
const SHOP = readFileSync(join(ROOT, 'docs/spec/examples/shop.aerie'), 'utf8');

/** The coloured words of one line, as `[text, kind]` pairs. */
function coloured(source: string, line: number): [string, TokenKind][] {
  const raw = source.split('\n')[line - 1] ?? '';
  return highlight(source)
    .filter((token) => token.line === line)
    .map((token) => [raw.slice(token.from, token.to), token.kind]);
}

describe('highlighting', () => {
  const FILE = [
    '// The shop.',
    'model shop: Corner shop',
    'audiences owner "Owner" (default), developer "Developer" (code)',
    '',
    'customer: Customer [person]',
    'shop: Shop | Sells things online [system]',
    '  web: Storefront | Where customers browse',
    '    icon web',
    '    @developer: | Next.js app',
    '    > Where customers browse',
    '      and pay.',
    '    @developer >> Built with Next.js.',
    '  orders: Orders store [store]',
    'customer buys from web',
    'web saves orders in orders [data]',
    'web depends on customer, orders [code]',
    'view overview: Overview',
    '  show customer, shop +1, [store]',
    '  kind runtime, code',
    'scenario buy: Buying',
    '  customer buys from web',
    'walkthrough tour: A tour',
    '  step overview: web, orders',
    '    open shop',
    '    close shop',
    '    for developer',
    '  step buy: 1-2',
  ].join('\n');

  it('INT-802 colours keywords, ids, rewordings, descriptions, comments, tags and kinds', () => {
    expect(coloured(FILE, 1)).toEqual([['// The shop.', 'comment']]);
    expect(coloured(FILE, 2)).toEqual([
      ['model', 'keyword'],
      ['shop', 'id'],
    ]);
    expect(coloured(FILE, 3)).toEqual([
      ['audiences', 'keyword'],
      ['owner', 'id'],
      ['default', 'tag'],
      ['developer', 'id'],
      ['code', 'tag'],
    ]);
    expect(coloured(FILE, 4)).toEqual([]);
    expect(coloured(FILE, 5)).toEqual([
      ['customer', 'id'],
      ['[person]', 'tag'],
    ]);
    expect(coloured(FILE, 7)).toEqual([['web', 'id']]);
    expect(coloured(FILE, 8)).toEqual([
      ['icon', 'keyword'],
      ['web', 'id'],
    ]);
    expect(coloured(FILE, 9)).toEqual([['@developer:', 'rewording']]);
    expect(coloured(FILE, 10)).toEqual([['> Where customers browse', 'description']]);
    expect(coloured(FILE, 12)).toEqual([
      ['@developer >>', 'rewording'],
      ['Built with Next.js.', 'description'],
    ]);
  });

  it('INT-802 a description continued over deeper lines is coloured as a description throughout', () => {
    expect(coloured(FILE, 11)).toEqual([['and pay.', 'description']]);
  });

  it('INT-802 a sentence colours its subject and objects as ids and its kind as a kind', () => {
    expect(coloured(FILE, 14)).toEqual([
      ['customer', 'id'],
      ['web', 'id'],
    ]);
    expect(coloured(FILE, 15)).toEqual([
      ['web', 'id'],
      ['orders', 'id'],
      ['[data]', 'kind'],
    ]);
    // LANG-013: a run of words ending in a comma before the last word are further objects.
    expect(coloured(FILE, 16)).toEqual([
      ['web', 'id'],
      ['customer', 'id'],
      ['orders', 'id'],
      ['[code]', 'kind'],
    ]);
    expect(coloured(FILE, 21)).toEqual([
      ['customer', 'id'],
      ['web', 'id'],
    ]);
  });

  it('INT-802 views, show and kind lists, walkthrough steps, open, close and for', () => {
    expect(coloured(FILE, 18)).toEqual([
      ['show', 'keyword'],
      ['customer', 'id'],
      ['shop', 'id'],
      ['[store]', 'tag'],
    ]);
    expect(coloured(FILE, 19)).toEqual([
      ['kind', 'keyword'],
      ['runtime', 'kind'],
      ['code', 'kind'],
    ]);
    expect(coloured(FILE, 23)).toEqual([
      ['step', 'keyword'],
      ['overview', 'id'],
      ['web', 'id'],
      ['orders', 'id'],
    ]);
    expect(coloured(FILE, 24)).toEqual([
      ['open', 'keyword'],
      ['shop', 'id'],
    ]);
    expect(coloured(FILE, 25)).toEqual([
      ['close', 'keyword'],
      ['shop', 'id'],
    ]);
    expect(coloured(FILE, 26)).toEqual([
      ['for', 'keyword'],
      ['developer', 'id'],
    ]);
    expect(coloured(FILE, 27)).toEqual([
      ['step', 'keyword'],
      ['buy', 'id'],
    ]);
  });

  it('INT-802 lines the parser cannot read, and the blocks under them, are still coloured', () => {
    const broken = ['\tweb: Storefront', '  > Still a description', '+ not a line'].join('\n');
    expect(coloured(broken, 1)).toEqual([['web', 'id']]);
    expect(coloured(broken, 2)).toEqual([['> Still a description', 'description']]);
    expect(coloured(broken, 3)).toEqual([]);
  });

  it('INT-802 offsets after a byte order mark point at the characters of the editor line', () => {
    const source = '﻿model shop: Shop';
    expect(highlight(source).map((token) => [token.from, token.to])).toEqual([
      [1, 6],
      [7, 11],
    ]);
  });

  it('INT-802 every line of the samples is coloured within the line, left to right', () => {
    for (const source of [LOTTO, SHOP]) {
      const lines = source.split('\n');
      let last = { line: 0, to: 0 };
      for (const token of highlight(source)) {
        expect(token.to).toBeGreaterThan(token.from);
        expect(token.to).toBeLessThanOrEqual(lines[token.line - 1]?.length ?? 0);
        if (token.line === last.line) expect(token.from).toBeGreaterThanOrEqual(last.to);
        last = token;
      }
    }
  });
});

describe('indenting on Enter', () => {
  const FILE = [
    'model shop: Corner shop',
    'shop: Shop',
    '  web: Storefront',
    '    > A long description',
    '      view of the storefront',
    'customer buys from web',
    'view overview: Overview',
    '  show shop',
    'scenario buy: Buying',
    '  customer buys from web',
    'walkthrough tour: A tour',
    '  step overview',
    '    open shop',
    '// a comment: here',
    '',
  ].join('\n');
  const after = (line: number, column = Infinity): string => newLineIndent(FILE, line, column);

  it('INT-803 Enter adds two spaces after a model, element, view, scenario, walkthrough or step line', () => {
    expect(after(1)).toBe('  ');
    expect(after(2)).toBe('  ');
    expect(after(3)).toBe('    ');
    expect(after(7)).toBe('  ');
    expect(after(9)).toBe('  ');
    expect(after(11)).toBe('  ');
    expect(after(12)).toBe('    ');
  });

  it('INT-803 Enter keeps the indent after every other line', () => {
    expect(after(4)).toBe('    ');
    expect(after(6)).toBe('');
    expect(after(8)).toBe('  ');
    expect(after(10)).toBe('  ');
    expect(after(13)).toBe('    ');
    expect(after(14)).toBe('');
    expect(after(15)).toBe('');
  });

  it('INT-803 a description continuing over lines does not open a block, whatever its words', () => {
    expect(after(5)).toBe('      ');
  });

  it('INT-803 only the text before the cursor decides: Enter in the indent keeps it', () => {
    expect(after(3, 2)).toBe('  ');
    expect(after(3, 5)).toBe('  ');
    expect(after(3, 6)).toBe('    ');
  });
});

describe('completion', () => {
  /** The labels offered at the end of `prefix`, typed as a new line after the Lotto sample. */
  function offered(prefix: string, source = LOTTO): string[] {
    const text = `${source}${prefix}`;
    const lines = text.split('\n');
    const line = lines.length;
    return (
      completionsAt(text, line, (lines[line - 1] ?? '').length)?.options.map(
        (option) => option.label,
      ) ?? []
    );
  }
  const ELEMENTS = [...LOTTO.matchAll(/^ *([a-z][a-z0-9-]*):/gm)].map((match) => match[1]);

  it('INT-804 keywords and element ids at the start of a line', () => {
    expect(offered('')).toEqual([...KEYWORDS, ...ELEMENTS]);
    expect(offered('  scr').slice(0, KEYWORDS.length)).toEqual([...KEYWORDS]);
  });

  it('INT-804 element ids at the end of a sentence, with their names', () => {
    expect(offered('website gets screen data from ')).toEqual(ELEMENTS);
    const last = LOTTO.split('\n').length;
    const options = completionsAt(`${LOTTO}website gets data from scr`, last, 26);
    expect(options?.from).toBe(23);
    expect(options?.options.find((option) => option.label === 'screen-api')).toEqual({
      label: 'screen-api',
      kind: 'element',
      detail: 'Screen API',
    });
  });

  it('INT-804 element ids in show, open, close and focus lists; tags after [ in show', () => {
    expect(offered('  show ')).toEqual(ELEMENTS);
    expect(offered('  show user, suite +2, ')).toEqual(ELEMENTS);
    expect(offered('  show [')).toEqual([
      'person',
      'system',
      'service',
      'module',
      'part',
      'legacy',
      'store',
      'external',
    ]);
    expect(offered('  show user, [')).toEqual(offered('  show ['));
    expect(offered('    open ')).toEqual(ELEMENTS);
    expect(offered('    close engine-service, ')).toEqual(ELEMENTS);
    expect(offered('  step services: ')).toEqual(ELEMENTS);
    expect(offered('  step services: pick-generation, ')).toEqual(ELEMENTS);
  });

  it('INT-804 no element ids after a scenario step target, which takes step numbers', () => {
    expect(offered('  step generate-picks: ')).toEqual([]);
  });

  it('INT-804 views and scenarios after step', () => {
    expect(offered('  step ')).toEqual([
      'big-picture',
      'services',
      'engineering',
      'generate-picks',
      'results-poll',
    ]);
  });

  it('INT-804 audiences after @ and after for, declared or the defaults', () => {
    expect(offered('  @')).toEqual(['exec', 'manager', 'engineer']);
    expect(offered('    for ')).toEqual(['exec', 'manager', 'engineer']);
    expect(offered('  @', 'model x: X\naudiences board "Board", dev\n')).toEqual(['board', 'dev']);
    expect(offered('  @', 'web: Web\n')).toEqual(['exec', 'manager', 'engineer']);
  });

  it('INT-804 icon names after icon, and the kinds relationships have after kind', () => {
    expect(offered('  icon ')).toEqual([...ICON_NAMES]);
    expect(offered('  kind ')).toEqual(['runtime', 'code']);
    expect(offered('  kind runtime, ')).toEqual(['runtime', 'code']);
  });

  it('INT-804 nothing in names, titles, descriptions, rewordings and comments', () => {
    expect(offered('web: Web')).toEqual([]);
    expect(offered('view x: Some title')).toEqual([]);
    expect(offered('  > A description about web')).toEqual([]);
    expect(offered('  @exec: Number engine')).toEqual([]);
    expect(offered('// a comment about web')).toEqual([]);
    expect(offered('web gets data from screen-api [')).toEqual([]);
  });
});
