// The formatter and the printer (docs/spec/language.md, section 14). Idempotence, meaning kept and
// round trips are also checked over every fixture in examples.test.ts.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { format, parse, print, type Model } from '../../../src/lines/index.ts';
import { specBlocks } from './spec-blocks.ts';

const ROOT = join(import.meta.dirname, '../../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

function modelOf(source: string): Model {
  const model = parse(source).model;
  if (model === null) {
    throw new Error(JSON.stringify(parse(source).diagnostics, null, 2));
  }
  return model;
}

/** Every committed sample and every example file of the spec. */
const SAMPLES = [
  ...readdirSync(join(ROOT, 'samples')).map((file) => `samples/${file}`),
  ...readdirSync(join(ROOT, 'docs/spec/examples')).map((file) => `docs/spec/examples/${file}`),
].filter((file) => file.endsWith('.aerie'));

describe('the formatter', () => {
  it('LANG-932 indents two spaces per level and keeps the line breaks of a description', () => {
    const source = [
      'suite: Suite',
      '    web: Website',
      '        > A long description',
      '               that continues',
      '            on a second line.',
      '    api: Screen API',
      '',
    ].join('\n');
    expect(format(source).text).toBe(
      [
        'suite: Suite',
        '  web: Website',
        '    > A long description',
        '      that continues',
        '      on a second line.',
        '  api: Screen API',
        '',
      ].join('\n'),
    );
  });

  it.each([
    ['web:Website|tagline[a  b]', 'web: Website | tagline [a b]'],
    ['web:   Website  |  The   site', 'web: Website | The site'],
    ['web: Website   \\|  not a tagline', 'web: Website \\| not a tagline'],
    ['>   text   with   gaps   ', '> text   with   gaps'],
    ['@exec:Name|Tag', '@exec: Name | Tag'],
    ['@exec:   |   Tag', '@exec: | Tag'],
    ['@exec  >text  as  written', '@exec > text  as  written'],
    ['@exec>>text', '@exec >> text'],
    ['web   calls  api,   db   [ code ]', 'web calls api, db [code]'],
    ['show a,b  +2,[ tag ]', 'show a, b +2, [tag]'],
    ['kind a ,b', 'kind a, b'],
    ['step target :  a ,b', 'step target: a, b'],
    ['step target: 3 - 6', 'step target: 3-6'],
    ['open a,b', 'open a, b'],
    [
      'audiences a  "A  name"  ( default ,code ),b "B"',
      'audiences a "A  name" (default, code), b "B"',
    ],
    ['view   v :   Title   here', 'view v: Title here'],
    ['for   exec', 'for exec'],
  ])('LANG-933 writes %j as %j', (source, expected) => {
    expect(format(`${source}\n`).text).toBe(`${expected}\n`);
  });

  it('LANG-934 indents a comment like the next statement, and not at all at the end', () => {
    const source = 'web: Website\n// about the API\n      api: Screen API\n    // the end\n';
    expect(format(source).text).toBe(
      'web: Website\n  // about the API\n  api: Screen API\n// the end\n',
    );
  });

  it('LANG-934 keeps the text after // as written', () => {
    expect(format('  //   spaced   out  \nweb: Website\n').text).toBe(
      '//   spaced   out\nweb: Website\n',
    );
  });

  it('LANG-935 collapses blank lines and writes LF, no byte order mark and one final newline', () => {
    const source = '﻿\r\n\r\nweb: Website   \r\n\r\n\r\n\r\napi: Screen API\r\n\r\n';
    expect(format(source).text).toBe('web: Website\n\napi: Screen API\n');
    expect(format('web: Website').text).toBe('web: Website\n');
    expect(format('').text).toBe('');
    expect(format('\n\n').text).toBe('');
  });

  it('LANG-936 formats a file with other errors', () => {
    const result = format('web:   Website\nweb   calls   nobody\n');
    expect(result.text).toBe('web: Website\nweb calls nobody\n');
    expect(result.diagnostics).toEqual([]);
  });

  it('LANG-936 leaves a file with E001, E002 or E004 unchanged and reports why', () => {
    for (const [source, id] of [
      ['web:  Website\n\tapi: Screen API\n', 'E001'],
      ['web:  Website\n    api: Api\n  db: Db\n', 'E002'],
      ['web:  Website\n| stray\n', 'E004'],
    ] as const) {
      const result = format(source);
      expect(result.text).toBe(source);
      expect(result.changed).toBe(false);
      expect(result.diagnostics.map((found) => found.id)).toEqual([id]);
    }
  });

  it.each(SAMPLES)('LANG-940 %s is already formatted', (file) => {
    const source = read(file);
    expect(format(source).text).toBe(source);
  });

  it.each(specBlocks().map((block) => [block.name, block.source]))(
    'LANG-940 the spec example %s is already formatted',
    (_name, source) => {
      expect(format(source).text).toBe(source);
    },
  );
});

describe('the printer', () => {
  it('LANG-937 prints the parts of a model in order, blocks apart', () => {
    expect(print(modelOf(read('docs/spec/examples/shop.aerie')))).toBe(
      [
        'model shop: Corner shop',
        '',
        'audiences owner "Owner" (default), developer "Developer" (code)',
        '',
        'customer: Customer [person]',
        '',
        'shop: Shop | Sells things online [system]',
        '  web: Storefront | Where customers browse',
        '    @developer: | Next.js app',
        '  orders: Orders store [store]',
        '',
        'customer buys from web',
        'web saves orders in orders',
        '  @developer: INSERTs rows into',
        '',
        'view overview: Overview',
        '  show customer, shop +1',
        '',
        'scenario order: Placing an order',
        '  customer buys from web',
        '  web saves orders in orders',
        '    > The order is stored.',
        '',
        'walkthrough intro: Introduction',
        '  step overview: web',
        '    > This is the storefront.',
        '',
      ].join('\n'),
    );
  });

  it('LANG-937 prints kinds, depths, ranges, step lines and every kind of wording', () => {
    const source = [
      'web: Website \\| main | Shows \\[things\\] [service]',
      '  icon web',
      '  > About.',
      '  @engineer >> More.',
      '  @exec: Our site',
      '  @exec > Replaced.',
      '  page: Page',
      'api: Screen API',
      'web uses the shapes in api [code]',
      'api reads web, page',
      'view build: Build',
      '  show web +1, [service]',
      '  kind code, runtime',
      'scenario flow: Flow',
      '  web calls api',
      '  api answers web',
      'walkthrough tour: Tour',
      '  step flow: 2',
      '  step flow: 1-2',
      '  step build: page',
      '    close web',
      '    open web',
      '    for engineer',
      '',
    ].join('\n');
    expect(print(modelOf(source))).toBe(
      [
        'audiences exec "Executive", manager "Manager" (default), engineer "Engineer" (code)',
        '',
        'web: Website \\| main | Shows \\[things\\] [service]',
        '  icon web',
        '  > About.',
        '  @exec: Our site',
        '  @exec > Replaced.',
        '  @engineer >> More.',
        '  page: Page',
        '',
        'api: Screen API',
        '',
        'web uses the shapes in api [code]',
        'api reads web',
        'api reads page',
        '',
        'view build: Build',
        '  show web +1, [service]',
        '  kind code, runtime',
        '',
        'scenario flow: Flow',
        '  web calls api',
        '  api answers web',
        '',
        'walkthrough tour: Tour',
        '  step flow: 2',
        '  step flow: 1-2',
        '  step build: page',
        '    open web',
        '    close web',
        '    for engineer',
        '',
      ].join('\n'),
    );
  });

  it('LANG-937 prints the system block after the audiences, code lines after the icon, ignores last', () => {
    const source = [
      'ignore drift web to api - only in development',
      'web: Website',
      '  > About.',
      '  code npm:web',
      '  icon web',
      '  code compose:web',
      'api: Screen API',
      'web calls api',
      'system',
      '  compose ../web/compose.yaml',
      '  repo ../web',
      'ignore drift maven:legacy - retiring',
      '',
    ].join('\n');
    expect(print(modelOf(source))).toBe(
      [
        'audiences exec "Executive", manager "Manager" (default), engineer "Engineer" (code)',
        '',
        'system',
        '  repo ../web',
        '  compose ../web/compose.yaml',
        '',
        'web: Website',
        '  icon web',
        '  code npm:web compose:web',
        '  > About.',
        '',
        'api: Screen API',
        '',
        'web calls api',
        '',
        'ignore drift web to api - only in development',
        'ignore drift maven:legacy - retiring',
        '',
      ].join('\n'),
    );
  });

  it.each(SAMPLES)('LANG-941 printing %s round-trips', (file) => {
    const model = modelOf(read(file));
    const printed = print(model);
    expect(parse(printed).model).toEqual(model);
    expect(format(printed).text).toBe(printed);
  });
});
