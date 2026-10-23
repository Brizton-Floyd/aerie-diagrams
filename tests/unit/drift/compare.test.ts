// The comparison, its levels, ignore lines and the finding model (docs/spec/drift.md, sections 5
// and 6; DRIFT-414 to DRIFT-427).
import { describe, expect, it } from 'vitest';
import type { Drift } from '../../../src/drift/index.ts';
import { driftOf, keys } from './drift.ts';
import { compose, javaClass, maven } from './projects.ts';

function confirmedLines(drift: Drift): string[] {
  return drift.confirmed.flatMap((each) => ('relationship' in each.subject ? [each.text] : []));
}

function notChecked(drift: Drift): string[] {
  return drift.notChecked.map((each) => `${each.reason}: ${each.text}`);
}

/** web names api by URL and host name; api names db by a JDBC URL; worker starts after api. */
const STACK = compose(
  'services:',
  '  web:',
  '    image: a',
  '    environment:',
  '      API_URL: http://api:3000',
  '      API_HOST: api',
  '  api:',
  '    image: b',
  '    environment:',
  '      DB: jdbc:postgresql://db:5432/shop',
  '  db:',
  '    image: c',
  '  worker:',
  '    image: d',
  '    depends_on: [api]',
);

const ELEMENTS = [
  'model m: M',
  'web: Web',
  '  code compose:web',
  'api: API',
  '  code compose:api',
  'db: Database',
  '  code compose:db',
  'worker: Worker',
  '  code compose:worker',
];

/** Modules: app depends on lib, lib on core; each module has a class of its own. */
const MODULES = maven(
  {
    name: 'app',
    deps: ['lib'],
    java: {
      'a/App.java': javaClass('a', ['l.Lib'], 'public class App { Lib lib; Helper helper; }'),
      'a/Helper.java': javaClass('a', [], 'public class Helper { Store store; }'),
      'a/Store.java': javaClass('a', [], 'public class Store {}'),
    },
  },
  {
    name: 'lib',
    deps: ['core'],
    java: { 'l/Lib.java': javaClass('l', [], 'public class Lib {}') },
  },
  { name: 'core', java: { 'c/Core.java': javaClass('c', [], 'public class Core {}') } },
);

describe('the comparison', () => {
  it('DRIFT-414 a runtime line is confirmed by any link around its anchors, whatever its verb; a [code] line by a dependency', () => {
    const drift = driftOf(
      STACK,
      ...ELEMENTS,
      'web reads the weather from api',
      'api keeps orders in db',
      'web depends on api [code]',
    );
    expect(confirmedLines(drift)).toEqual([
      'The line “Web reads the weather from API” is in the code.',
      'The line “API keeps orders in Database” is in the code.',
    ]);
    expect(notChecked(drift)).toContain(
      'not-maven: The line “Web depends on API” is not checked: build dependencies are read only from Maven poms, and an end stands for no Maven module.',
    );
  });

  it('DRIFT-415 a runtime line nothing shows is likely missing; a [code] line no pom shows is drift', () => {
    const runtime = driftOf(STACK, ...ELEMENTS, 'web calls api', 'api calls db', 'db calls web');
    expect(keys(runtime)).toEqual(['likely missing-connection:db>web:calls']);
    const build = driftOf(
      MODULES,
      'model m: M',
      'app: App',
      '  code maven:app',
      'lib: Lib',
      '  code maven:lib',
      'core: Core',
      '  code maven:core',
      'app depends on lib [code]',
      'lib depends on core [code]',
      'app depends on core [code]',
    );
    expect(keys(build)).toEqual(['drift missing-dependency:app>core']);
  });

  it('DRIFT-416 an undrawn connection is reported once, at the finest grain, and a [code] line explains a type reference', () => {
    const drift = driftOf(
      MODULES,
      'model m: M',
      'app: App',
      '  code maven:app',
      '  entry: Entry',
      '    code class:a.App',
      '  helper: Helper',
      '    code class:a.Helper',
      '  store: Store',
      '    code class:a.Store',
      'lib: Lib',
      '  code maven:lib',
      'core: Core',
      '  code maven:core',
      'helper keeps things in store',
      'app depends on lib [code]',
      'lib depends on core [code]',
    );
    // `App` uses `Helper` in one module: reported. It uses `Lib` across modules: the poms show it.
    expect(keys(drift)).toEqual(['likely undrawn-connection:entry>helper']);
    expect(drift.findings[0]?.title).toBe(
      'Entry uses the code of Helper in the code, but no line in the diagram joins them.',
    );
  });

  it('DRIFT-417 a dependency no [code] line shows is drift, and with no [code] lines at all none is checked', () => {
    const lines = [
      'model m: M',
      'app: App',
      '  code maven:app',
      'lib: Lib',
      '  code maven:lib',
      'core: Core',
      '  code maven:core',
    ];
    expect(keys(driftOf(MODULES, ...lines, 'app depends on lib [code]'))).toEqual([
      'drift undrawn-dependency:lib>core',
    ]);
    const none = driftOf(MODULES, ...lines);
    expect(keys(none)).toEqual([]);
    expect(notChecked(none)).toContain(
      'no-code-lines: The diagram has no `[code]` lines, so the build dependencies between its modules are not checked.',
    );
  });

  it('DRIFT-418 a code line naming code the system lacks is drift', () => {
    const drift = driftOf(
      STACK,
      ...ELEMENTS,
      'web calls api',
      'api calls db',
      'search: Search',
      '  code compose:search maven:search',
    );
    expect(keys(drift)).toEqual([
      'drift missing-code:search:compose:search',
      'drift missing-code:search:maven:search',
    ]);
    expect(drift.findings[0]?.detail).toBe(
      'An exact check: the code has no Compose service of that name.',
    );
  });

  it('DRIFT-419 a unit no element stands for is undrawn, exactly when a drawn module needs it, of each kind the diagram draws', () => {
    const drift = driftOf(
      {
        ...MODULES,
        ...maven(
          { name: 'app', deps: ['lib', ['kit', 'test']] },
          { name: 'lib', deps: ['core'] },
          { name: 'core' },
          { name: 'kit' },
          { name: 'tool' },
        ),
      },
      'model m: M',
      'app: App',
      '  code maven:app',
    );
    expect(keys(drift)).toEqual([
      'drift undrawn-code:maven:core',
      'drift undrawn-code:maven:lib',
      'likely undrawn-code:maven:tool',
    ]);
    expect(drift.findings.map((each) => each.title)).toEqual([
      'App depends on the Maven module `maven:core`, but no element stands for it.',
      'App depends on the Maven module `maven:lib`, but no element stands for it.',
      'The code has the Maven module `maven:tool`, but no element stands for it.',
    ]);
    expect(notChecked(drift)).toContain(
      'test-support: The Maven module `maven:kit` is used only by tests, so it is not checked.',
    );
    // A diagram drawn above its modules is never asked for them.
    const above = driftOf({ ...MODULES, ...STACK }, ...ELEMENTS, 'web calls api', 'api calls db');
    expect(keys(above)).toEqual([]);
    expect(notChecked(above)).toContain(
      'kind-not-drawn: The diagram names no Maven modules, so the 3 in the code (`maven:app`, `maven:core` and `maven:lib`) are not checked.',
    );
  });

  it('DRIFT-420 DRIFT-421 levels: two techniques make drift, one likely, a corroborating one alone nothing', () => {
    const drift = driftOf(STACK, ...ELEMENTS);
    expect(keys(drift)).toEqual([
      'drift undrawn-connection:web>api',
      'likely undrawn-connection:api>db',
    ]);
    expect(drift.findings.map((each) => each.detail)).toEqual([
      '2 techniques found it: Compose environment URL and Compose environment host name.',
      'One technique found it: Compose environment JDBC URL.',
    ]);
  });

  it('DRIFT-422 an ignore line excuses the findings about its subject, the first that matches, and lists them', () => {
    const drift = driftOf(
      STACK,
      'model m: M',
      'shop: Shop',
      '  web: Web',
      '    code compose:web',
      '  api: API',
      '    code compose:api compose:old',
      'db: Database',
      '  code compose:db',
      'worker: Worker',
      '  code compose:worker',
      'ignore drift shop to compose:api - drawn later',
      'ignore drift web to api - also drawn later',
      'ignore drift compose:old - retired',
      'ignore drift api to compose:db - in the next release',
    );
    expect(
      drift.ignored.map(
        (each) => `${each.subject} - ${each.reason}: ${each.findings.map((f) => f.key).join(', ')}`,
      ),
    ).toEqual([
      'shop to compose:api - drawn later: undrawn-connection:web>api',
      'compose:old - retired: missing-code:api:compose:old',
      'api to compose:db - in the next release: undrawn-connection:api>db',
    ]);
    expect(keys(drift)).toEqual(['likely unused-ignore:web to api']);
  });

  it('DRIFT-423 an ignore line that excuses nothing is likely, and its edit removes it', () => {
    const drift = driftOf(
      STACK,
      ...ELEMENTS,
      'web calls api',
      'api calls db',
      'ignore drift web to db - gone',
    );
    expect(keys(drift)).toEqual(['likely unused-ignore:web to db']);
    expect(drift.findings[0]?.edits).toEqual([
      { at: 12, remove: ['ignore drift web to db - gone'], add: [] },
    ]);
    expect(drift.findings[0]?.instead).toEqual([]);
  });

  it('DRIFT-424 what is not checked: people, elements with no code, lines to them, scenarios and the wording', () => {
    const drift = driftOf(
      STACK,
      ...ELEMENTS,
      'buyer: Buyer [person]',
      'weather: Weather service',
      'buyer uses web',
      'web calls api',
      'api calls db',
      'api asks weather',
      'scenario buy: Buy',
      '  buyer orders on web',
    );
    expect(notChecked(drift)).toEqual([
      'end: The line “Buyer uses Web” is not checked: Buyer stands for no code drift can read.',
      'end: The line “API asks Weather service” is not checked: Weather service stands for no code drift can read.',
      'person: Buyer is a person, which code cannot show.',
      'no-code: Weather service has no code line, and its name matches no code drift reads.',
      'scenario: Scenario `buy` is not checked: scenarios are checked against real call paths in phase 2.',
      'wording: The wording (names, taglines and descriptions) is not checked: wrong details are checked in phase 2.',
    ]);
  });

  it('DRIFT-425 what is confirmed: each element with what it stands for, each line with the anchors it was checked as', () => {
    const drift = driftOf(
      STACK,
      'model m: M',
      'web: Web',
      '  code compose:web',
      '  page: Page',
      'api: API',
      '  code compose:api',
      'page calls api',
    );
    expect(drift.confirmed.map((each) => `${each.text} [${each.techniques.join(', ')}]`)).toEqual([
      'The line “Page calls API” is in the code (checked as Web to API). [env-url, env-host]',
      'Web stands for `compose:web`, which the code has. [compose-service]',
      'API stands for `compose:api`, which the code has. [compose-service]',
    ]);
  });

  it('DRIFT-426 a finding has an id in report order, a stable key, its line, techniques, evidence and edits', () => {
    const drift = driftOf(
      STACK,
      ...ELEMENTS,
      'db calls worker',
      'search: Search',
      '  code compose:search',
    );
    expect(
      drift.findings.map((each) => [each.id, each.level, each.kind, each.key, each.diagram]),
    ).toEqual([
      ['D01', 'drift', 'missing-code', 'missing-code:search:compose:search', 12],
      ['D02', 'drift', 'undrawn-connection', 'undrawn-connection:web>api', null],
      ['L01', 'likely', 'missing-connection', 'missing-connection:db>worker:calls', 10],
      ['L02', 'likely', 'undrawn-connection', 'undrawn-connection:api>db', null],
    ]);
    const connection = drift.findings[1];
    expect(connection?.elements).toEqual(['web', 'api']);
    expect(connection?.techniques).toEqual(['env-url', 'env-host']);
    expect(
      connection?.evidence.map(
        (each) => `${each.at.path}:${String(each.at.line)} ${each.technique}`,
      ),
    ).toEqual(['compose.yaml:5 env-url', 'compose.yaml:6 env-host']);
    expect(connection?.edits).toEqual([{ at: 11, remove: [], add: ['web calls api'] }]);
    expect(connection?.instead).toEqual([
      { at: 13, remove: [], add: ['', 'ignore drift web to api - why this difference is meant'] },
    ]);
    // The same difference has the same key from one run to the next.
    expect(
      keys(
        driftOf(STACK, ...ELEMENTS, 'search: Search', '  code compose:search', 'db calls worker'),
      ),
    ).toEqual(
      expect.arrayContaining([
        'drift undrawn-connection:web>api',
        'likely missing-connection:db>worker:calls',
      ]),
    );
  });

  it('DRIFT-427 a suggestion names the element and the unit, why, its evidence and the code line it adds', () => {
    const drift = driftOf(
      STACK,
      'model m: M',
      'web: Web',
      '  icon web',
      'api: API',
      '  code compose:api',
      'db: Database',
      '  code compose:db',
      'worker: Worker',
      '  code compose:worker',
    );
    expect(drift.suggestions).toEqual([
      {
        id: 'S01',
        key: 'suggestion:web:compose:web',
        element: 'web',
        unit: { kind: 'compose', name: 'web' },
        title: 'Web may stand for `compose:web`: add `code compose:web`?',
        detail:
          'Its name matches, so drift compares it as standing for that unit already; a code line makes it certain.',
        used: true,
        evidence: [
          expect.objectContaining({ technique: 'compose-service', detail: 'compose:web' }),
        ],
        edits: [{ at: 4, remove: [], add: ['  code compose:web'] }],
      },
    ]);
  });
});
