// Requirements of docs/spec/language.md that are clearer as inline cases than as fixture files:
// text encoding, the canonical model's shape and serialisation, the source map, and the rules
// every diagnostic follows (LANG-901 to LANG-905).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CATALOGUE,
  DEFAULT_AUDIENCES,
  format,
  parse,
  serializeModel,
  severityOf,
  type DiagnosticId,
  type Model,
} from '../../../src/lines/index.ts';
import { check } from '../../../src/model/index.ts';

const ROOT = join(import.meta.dirname, '../../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const SHOP = read('docs/spec/examples/shop.aerie');
const LOTTO = read('docs/spec/examples/lotto.aerie');

function modelOf(source: string): Model {
  const result = parse(source);
  expect(result.diagnostics.filter((found) => found.severity === 'error')).toEqual([]);
  if (result.model === null) {
    throw new Error('no model');
  }
  return result.model;
}

const ids = (source: string): string[] => parse(source).diagnostics.map((found) => found.id);

describe('files and lines', () => {
  it('LANG-001 accepts a byte order mark and CRLF line endings', () => {
    const plain = 'web: Website\napi: Screen API\nweb calls api\n';
    const windows = '﻿' + plain.replace(/\n/g, '\r\n');
    expect(parse(windows)).toEqual(parse(plain));
  });

  it('LANG-004 a tab in the indent is E001, a tab inside the text is not', () => {
    expect(ids('web: Website\n\t> text\n')).toEqual(['E001']);
    expect(ids('web: Web\tsite\n')).toEqual([]);
  });

  it('LANG-012 only descriptions continue: a deeper line under an element is a statement', () => {
    expect(ids('web: Website | Shows the\n  pages to users\n')).toEqual(['E003']);
    expect(
      modelOf('web: Website\n  > Shows the\n    pages to users\n').elements[0]?.about.base,
    ).toBe('Shows the pages to users');
  });
});

describe('block rules', () => {
  it('LANG-009 a keyword cannot be an id (E006)', () => {
    expect(ids('view: A view\nweb: Website\n')).toEqual(['E006']);
    expect(ids('views: Views\nweb: Website\n')).toEqual([]);
  });

  it('LANG-305 an audience must be declared, has one @level: line per owner, and >> needs one', () => {
    expect(ids('web: Website\n  @board: Our site\n')).toEqual(['E301']);
    expect(ids('web: Website\n  @exec: Our site\n  @exec: | Our tagline\n')).toEqual(['E302']);
    expect(ids('web: Website\n  >> An added paragraph.\n')).toEqual(['E304']);
    expect(ids('web: Website\n  @exec: Our site\n  @engineer: | web/\n')).toEqual([]);
  });

  it('LANG-604 a scenario has at least one step (E601), numbered in the order written', () => {
    expect(ids('web: Website\nscenario flow: Flow\n  > Nothing yet.\n')).toEqual(['E601']);
    const model = modelOf(
      'web: Website\napi: API\nweb calls api\nscenario flow: Flow\n  web asks api\n  api answers web\n',
    );
    expect(model.scenarios[0]?.steps.map((step) => step.verb.base)).toEqual(['asks', 'answers']);
  });

  it('LANG-607 a scenario no view can hold is E604, found by the model check', () => {
    const source = [
      'a: A',
      'b: B',
      'outer: Outer',
      '  c: C',
      'a calls b',
      'b calls c',
      'view v: V',
      '  show a, b',
      'scenario flow: Flow',
      '  a calls b',
      '  b calls c',
      '',
    ].join('\n');
    expect(ids(source)).toEqual([]);
    expect(check(source).diagnostics.map((found) => found.id)).toEqual(['E604']);
    const held = source.replace('  show a, b', '  show a, b, outer');
    expect(check(held).diagnostics.map((found) => found.id)).toEqual([]);
  });

  it('LANG-707 a walkthrough has at least one step (E701)', () => {
    expect(
      ids('web: Website\nview main: Main\nwalkthrough tour: Tour\n  > Nothing yet.\n'),
    ).toEqual(['E701']);
    expect(ids('web: Website\nview main: Main\nwalkthrough tour: Tour\n  step main\n')).toEqual([]);
  });
});

describe('the canonical model', () => {
  it('LANG-801 has exactly the fields of the spec, in order, all present', () => {
    const model = modelOf(LOTTO);
    const words = ['base', 'set'];
    const prose = ['base', 'set', 'add'];
    expect(Object.keys(model)).toEqual([
      'format',
      'id',
      'title',
      'about',
      'audiences',
      'defaultAudience',
      'elements',
      'relationships',
      'views',
      'scenarios',
      'walkthroughs',
    ]);
    expect(Object.keys(model.title)).toEqual(words);
    expect(Object.keys(model.about)).toEqual(prose);
    for (const audience of model.audiences) {
      expect(Object.keys(audience)).toEqual(['id', 'name', 'code']);
    }
    for (const element of model.elements) {
      expect(Object.keys(element)).toEqual([
        'id',
        'parent',
        'name',
        'tagline',
        'tags',
        'icon',
        'about',
      ]);
      expect(element.name.base).not.toBeNull();
    }
    for (const relationship of model.relationships) {
      expect(Object.keys(relationship)).toEqual(['subject', 'verb', 'object', 'kind', 'about']);
      expect(relationship.verb.base).not.toBeNull();
    }
    for (const view of model.views) {
      expect(Object.keys(view)).toEqual(['id', 'title', 'about', 'show', 'kinds']);
    }
    for (const scenario of model.scenarios) {
      expect(Object.keys(scenario)).toEqual(['id', 'title', 'about', 'steps']);
      for (const step of scenario.steps) {
        expect(Object.keys(step)).toEqual(['subject', 'verb', 'object', 'about']);
      }
    }
    for (const walkthrough of model.walkthroughs) {
      expect(Object.keys(walkthrough)).toEqual(['id', 'title', 'about', 'steps']);
      for (const step of walkthrough.steps) {
        expect(Object.keys(step)).toEqual([
          'target',
          'focus',
          'range',
          'open',
          'close',
          'audience',
          'about',
        ]);
      }
    }
  });

  it('LANG-802 always lists the audiences and sets the default audience', () => {
    const model = modelOf('web: Website\n');
    expect(model.audiences).toEqual(DEFAULT_AUDIENCES);
    expect(model.defaultAudience).toBe('manager');
    expect(modelOf('audiences a, b\nweb: Website\n').defaultAudience).toBe('a');
  });

  it('LANG-803 lists elements depth first and one relationship per object', () => {
    const model = modelOf('a: A\n  b: B\n    c: C\n  d: D\ne: E\ne uses b, c, d\n');
    expect(model.elements.map((element) => element.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(model.relationships.map((relationship) => relationship.object)).toEqual(['b', 'c', 'd']);
  });

  it('LANG-804 writes empty Words and Prose in full', () => {
    const element = modelOf('web: Website\n').elements[0];
    expect(element?.tagline).toEqual({ base: null, set: {} });
    expect(element?.about).toEqual({ base: null, set: {}, add: {} });
  });

  it('LANG-806 serialises to the exact bytes of examples/shop.json (ACC-013)', () => {
    const model = modelOf(SHOP);
    expect(serializeModel(model)).toBe(read('docs/spec/examples/shop.json'));
    expect(serializeModel(modelOf(SHOP))).toBe(serializeModel(structuredClone(model)));
  });

  it('LANG-807 maps model locations to the lines and columns they came from', () => {
    const result = parse(SHOP);
    const map = result.sourceMap;
    // `    @developer: | Next.js app` is line 10; the tagline starts after `| `.
    expect(map['/elements/2/tagline/set/developer']).toEqual({
      line: 10,
      column: 19,
      endLine: 10,
      endColumn: 30,
    });
    expect(map['/elements/2']).toEqual({ line: 9, column: 3, endLine: 9, endColumn: 43 });
    expect(map['/relationships/1/verb']).toEqual({
      line: 14,
      column: 5,
      endLine: 14,
      endColumn: 20,
    });
    expect(map['/views/0/show/1']).toEqual({ line: 18, column: 18, endLine: 18, endColumn: 25 });
    expect(map['/walkthroughs/0/steps/0/focus/0']).toEqual({
      line: 26,
      column: 18,
      endLine: 26,
      endColumn: 21,
    });
    // Declared ids have their own spans, for diagnostics that point at the id (E604).
    expect(map['/elements/2/id']).toEqual({ line: 9, column: 3, endLine: 9, endColumn: 6 });
    expect(map['/views/0/id']).toEqual({ line: 17, column: 6, endLine: 17, endColumn: 14 });
    expect(map['/scenarios/0/id']).toEqual({ line: 20, column: 10, endLine: 20, endColumn: 15 });
    expect(map['/walkthroughs/0/id']).toEqual({ line: 25, column: 13, endLine: 25, endColumn: 18 });
    const multiLine = parse('web: Website\n  > One\n    two\n').sourceMap['/elements/0/about'];
    expect(multiLine).toEqual({ line: 2, column: 5, endLine: 3, endColumn: 8 });
  });

  it('LANG-808 a file with errors has no model but every diagnostic', () => {
    const result = parse('web: Website\nweb calls api\nview: x\n');
    expect(result.model).toBeNull();
    expect(result.sourceMap).toEqual({});
    expect(result.diagnostics.map((found) => found.id)).toEqual(['E008', 'E006']);
  });

  it('LANG-808 warnings alone still give a model', () => {
    const result = parse(LOTTO);
    expect(result.diagnostics.map((found) => found.id)).toEqual(['W601']);
    expect(result.model).not.toBeNull();
  });
});

describe('diagnostics', () => {
  it('LANG-901 spans count code points, and the end is just after the last character', () => {
    const [found] = parse('web: Website 😀 [Bad]\n').diagnostics;
    expect(found).toMatchObject({ id: 'E005', line: 1, column: 17, endLine: 1, endColumn: 20 });
    expect(found?.severity).toBe('error');
  });

  it('LANG-901 W-ids are warnings and E-ids are errors', () => {
    for (const id of Object.keys(CATALOGUE) as DiagnosticId[]) {
      expect(severityOf(id)).toBe(id.startsWith('W') ? 'warning' : 'error');
    }
  });

  it('LANG-902 reports every problem, sorted by line, column and id', () => {
    const result = parse('scenario flow: Flow\nweb: Website [x\nview Main: M\n  show nope\n');
    expect(result.diagnostics.map((found) => [found.line, found.column, found.id])).toEqual([
      [1, 1, 'E601'],
      [2, 14, 'E009'],
      [3, 6, 'E005'],
      [4, 8, 'E008'],
    ]);
  });

  it('LANG-902 skips the block of a line it cannot read, so one mistake does not cascade', () => {
    const source = '| broken\n  child: Child\n    > text\n  >> more\nweb: Website\n';
    expect(ids(source)).toEqual(['E004']);
  });

  it('LANG-903 every message is the catalogue of the spec, word for word', () => {
    const spec = read('docs/spec/language.md');
    const rows = (heading: string): string[][] => {
      const section = spec.slice(spec.indexOf(heading));
      const table = /\n(\|.*\|\n)+/.exec(section)?.[0] ?? '';
      return table
        .trim()
        .split('\n')
        .slice(2)
        .map((row) =>
          row
            .slice(1, -1)
            .split(/(?<!\\)\|/)
            .map((cell) => cell.trim().replace(/\\\|/g, '|')),
        );
    };
    const catalogue = rows('### Catalogue');
    const placeholders: Partial<Record<DiagnosticId, string[]>> = {
      E005: ['{text}'],
      E006: ['{id}'],
      E007: ['{id}', '{line}'],
      E008: ['{id}', '{suggestion}'],
      E010: ['{marker}'],
      E011: ['{id}', '{name or title}', '{example}'],
      E012: ['{text}'],
      E101: ['{line}'],
      E102: ['{line}'],
      E103: ['{id}'],
      E104: ['{first}', '{second}'],
      E105: ['{count}'],
      E106: ['{flag}'],
      E107: ['{text}'],
      E201: ['{name}', '{suggestion}', '{list}'],
      E202: ['{id}', '{line}'],
      E301: ['{id}', '{suggestion}', '{list}'],
      E302: ['{audience}', '{line}'],
      E304: ['{audience}', '{text}'],
      E401: ['{word}', '{suggestion}', '{moved}'],
      E403: ['{id}'],
      E404: ['{inner}', '{outer}'],
      E405: ['{line}'],
      E406: ['{count}'],
      E501: ['{item}', '{id}'],
      E502: ['{tag}', '{suggestion}'],
      E503: ['{kind}', '{suggestion}'],
      E601: ['{id}', '{example}'],
      E602: ['{count}'],
      E603: ['{kind}'],
      E604: ['{id}', '{element}', '{top}'],
      W601: ['{subject}', '{object}', '{verb}'],
      E701: ['{id}', '{view}'],
      E702: ['{id}', '{suggestion}'],
      E703: ['{id}', '{view}', '{container}'],
      E704: ['{view}'],
      E705: ['{scenario}'],
      E706: ['{scenario}', '{count}', '{range}'],
      E707: ['{id}'],
      E708: ['{line}'],
    };
    const render = (id: DiagnosticId): string => {
      const build = CATALOGUE[id] as (...args: string[]) => string;
      return build(...(placeholders[id] ?? []));
    };
    expect(catalogue.map((row) => row[0])).toEqual(Object.keys(CATALOGUE));
    for (const [id = '', severity, message] of catalogue) {
      const key = id as DiagnosticId;
      expect(severity, id).toBe(severityOf(key));
      if (key !== 'E003' && key !== 'E303') {
        expect(render(key), id).toBe(message);
      }
    }
    const outOfPlace = rows('E003 messages, chosen by').map((row) => row[1]);
    const e003 = CATALOGUE.E003;
    expect([
      e003({ rule: 'top-level', keyword: '{keyword}' }),
      e003({ rule: 'in-view', keyword: '{keyword}' }),
      e003({ rule: 'in-element' }),
      e003({ rule: 'in-walkthrough' }),
      e003({ rule: 'in-walk-step', keyword: '{keyword}' }),
      e003({ rule: 'element' }),
      e003({ rule: 'sentence' }),
      e003({ rule: 'description' }),
      e003({ rule: 'rewording', audience: '{audience}' }),
      e003({ rule: 'holds-nothing', line: '{kind}' }),
    ]).toEqual(outOfPlace);
    const rewording = rows('E303 messages:').map((row) => row[1]);
    const what = '{verb phrase or title}' as 'title';
    expect([
      CATALOGUE.E303({ rule: 'walk-step', audience: '{audience}' }),
      CATALOGUE.E303({ rule: 'bar', audience: '{audience}', what }),
    ]).toEqual(rewording);
  });

  it('LANG-903 no message uses the words the spec rules out', () => {
    const banned = /\b(?:token|parse|syntax|unexpected|EOF|null|undefined)\b/i;
    const all = read('docs/spec/language.md');
    const catalogue = all.slice(all.indexOf('### Catalogue'), all.indexOf('## 13.'));
    expect(catalogue).not.toMatch(banned);
    for (const source of [SHOP, LOTTO, 'web: Website\nweb calls nope\n']) {
      for (const found of parse(source).diagnostics) {
        expect(found.message).not.toMatch(banned);
      }
    }
  });

  it('LANG-904 suggests an id within two edits and closer than half its length', () => {
    const base = 'screen-api: Screen API\nweb: Website\n';
    const message = (line: string): string => parse(base + line).diagnostics[0]?.message ?? '';
    expect(message('web calls screen-ap\n')).toContain('Did you mean `screen-api`?');
    expect(message('web calls scrn-api\n')).toContain('Did you mean `screen-api`?');
    expect(message('web calls skreen-epy\n')).not.toContain('Did you mean');
    // `wbe` swaps two neighbours of `web`: one edit, and 1 is less than half of 3.
    expect(message('wbe calls screen-api\n')).toContain('Did you mean `web`?');
    // `wb` is one edit from `web`, but 1 is not less than half of 2.
    expect(message('wb calls screen-api\n')).not.toContain('Did you mean');
  });

  it('LANG-904 ties go to the id declared first', () => {
    const source = 'alpha2: Second\nalpha1: First\nalpha3 calls alpha1\n';
    expect(parse(source).diagnostics[0]?.message).toBe(
      'There is no element called `alpha3`. Did you mean `alpha2`?',
    );
  });

  it('LANG-904 a misspelt keyword is suggested, and is the only problem on its line', () => {
    const result = parse('web: Website\nveiw main: Main\n  show nope\nweb calls web\n');
    expect(result.diagnostics.map((found) => [found.line, found.id, found.message])).toEqual([
      [2, 'E008', 'There is no element called `veiw`. Did you mean `view`?'],
      [
        4,
        'E403',
        'A relationship joins two different elements, but this one starts and ends at `web`.',
      ],
    ]);
    // A declared element is never taken for a misspelt keyword.
    expect(ids('kinds: Kinds\nweb: Website\nkinds feed web\n')).toEqual([]);
  });

  it('LANG-905 lists are in backticks, comma separated, in declaration order', () => {
    const [found] = parse('audiences zed, alpha\nweb: Website\n  @beta: Beta\n').diagnostics;
    expect(found?.message).toBe(
      'There is no audience called `beta`. The audiences are `zed`, `alpha`.',
    );
  });
});

describe('the worked example', () => {
  it('ACC-013 examples/lotto.aerie has the shape section 15 of the language spec describes', () => {
    const model = modelOf(LOTTO);
    expect(model.elements).toHaveLength(18);
    expect(Math.max(...model.elements.map((element) => depthOf(model, element.id)))).toBe(3);
    expect(model.relationships).toHaveLength(18);
    expect(model.relationships.filter((relationship) => relationship.kind === 'code')).toHaveLength(
      6,
    );
    expect(model.views).toHaveLength(3);
    expect(model.scenarios.map((scenario) => scenario.steps.length)).toEqual([14, 6]);
    expect(model.walkthroughs.map((walkthrough) => walkthrough.steps.length)).toEqual([8]);
    const reworded = { exec: 0, manager: 0, engineer: 0 };
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (typeof value === 'object' && value !== null) {
        if ('set' in value) {
          const { set, add } = value as { set: object; add?: object };
          for (const id of [...Object.keys(set), ...Object.keys(add ?? {})]) {
            reworded[id as keyof typeof reworded]++;
          }
        } else {
          Object.values(value).forEach(visit);
        }
      }
    };
    visit(model);
    expect(reworded).toEqual({ exec: 11, manager: 0, engineer: 54 });
  });
});

/** How many ancestors an element has: 0 at the top level. */
function depthOf(model: Model, id: string): number {
  const parent = model.elements.find((element) => element.id === id)?.parent ?? null;
  return parent === null ? 0 : 1 + depthOf(model, parent);
}

describe('the Lotto sample', () => {
  it('ACC-011 and SCOPE-010 samples/lotto.aerie is the A11 sample: clean, formatted, and ready for every journey', () => {
    const source = read('samples/lotto.aerie');
    expect(check(source).diagnostics).toEqual([]);
    expect(format(source).text).toBe(source);
    expect(source).not.toBe(LOTTO);
    const model = modelOf(source);
    expect(model.audiences.map((audience) => audience.id)).toEqual(['exec', 'manager', 'engineer']);
    expect(model.views.map((view) => view.id)).toEqual(['big-picture', 'services', 'engineering']);
    expect(model.scenarios.map((scenario) => scenario.id)).toEqual([
      'generate-picks',
      'results-poll',
    ]);
    expect(model.walkthroughs.map((walkthrough) => walkthrough.id)).toEqual(['tour']);
  });
});
