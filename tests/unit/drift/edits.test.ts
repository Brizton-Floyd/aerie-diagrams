// Suggested edits (docs/spec/drift.md, section 6; DRIFT-428 to DRIFT-431): hunks against the model
// file, the shape of each edit, the ignore line to add instead, and one patch for many findings.
import { describe, expect, it } from 'vitest';
import { applyHunks } from '../../../src/drift/index.ts';
import { driftOf, keys } from './drift.ts';
import { compose, maven } from './projects.ts';

const STACK = compose(
  'services:',
  '  web:',
  '    image: a',
  '    environment: { API_URL: "http://api:3000", API_HOST: api }',
  '  api:',
  '    image: b',
  '    environment: { DB_URL: "jdbc:postgresql://db/shop", QUEUE_HOST: "queue:5672" }',
  '  db:',
  '    image: c',
  '  queue:',
  '    image: d',
);

/** The source of a model and the drift on it, with the patch of every finding applied. */
function patchOf(...model: string[]): { source: string; patched: string } {
  const source = [...model, ''].join('\n');
  const drift = driftOf(STACK, ...model);
  return { source, patched: applyHunks(source, drift.patch()) };
}

describe('suggested edits', () => {
  it('DRIFT-428 an edit is hunks at the model’s line numbers: the lines removed and the lines added', () => {
    const drift = driftOf(
      STACK,
      'model m: M',
      'web: Web',
      '  code compose:web',
      'api: API',
      '  code compose:ap',
      'db: Database',
      '  code compose:db',
      'queue: Queue',
      '  code compose:queue',
      'web calls api',
      'api calls db',
      'api calls queue',
    );
    expect(keys(drift)).toEqual(['drift renamed-code:api:compose:ap>compose:api']);
    expect(drift.findings[0]?.edits).toEqual([
      { at: 5, remove: ['  code compose:ap'], add: ['  code compose:api'] },
    ]);
  });

  it('DRIFT-429 a new element is a placeholder with its code line, beside its kind, with its lines after the last of their kind', () => {
    const { patched } = patchOf(
      'model m: M',
      '',
      'shop: Shop',
      '  web: Web',
      '    code compose:web',
      '',
      '  api: API',
      '    code compose:api',
      '',
      '  db: Database',
      '    code compose:db',
      '',
      'web calls api',
      'api calls db',
      '',
      'view all: All',
    );
    expect(patched).toBe(
      [
        'model m: M',
        '',
        'shop: Shop',
        '  web: Web',
        '    code compose:web',
        '',
        '  api: API',
        '    code compose:api',
        '',
        '  db: Database',
        '    code compose:db',
        '',
        '  queue: queue [service]',
        '    code compose:queue',
        '',
        'web calls api',
        'api calls db',
        'api calls queue',
        '',
        'view all: All',
        '',
      ].join('\n'),
    );
  });

  it('DRIFT-429 a removed element takes its block, the comment above it and every line that names it', () => {
    const { patched } = patchOf(
      'model m: M',
      'web: Web',
      '  code compose:web',
      'api: API',
      '  code compose:api',
      'db: Database',
      '  code compose:db',
      'queue: Queue',
      '  code compose:queue',
      '// The search service, retired last year.',
      'search: Search',
      '  code compose:search',
      '  index: Index',
      'web calls api',
      'api calls db, queue',
      'web asks search, api',
      'index feeds web',
      '  > Nightly.',
      'view all: All',
      '  show web, search, api',
      'scenario find: Find',
      '  web asks index',
      '  web asks api',
      'walkthrough tour: Tour',
      '  step all: search',
      '  step all: web, index',
      'ignore drift web to search - being moved',
    );
    expect(patched).toBe(
      [
        'model m: M',
        'web: Web',
        '  code compose:web',
        'api: API',
        '  code compose:api',
        'db: Database',
        '  code compose:db',
        'queue: Queue',
        '  code compose:queue',
        'web calls api',
        'api calls db, queue',
        'web asks api',
        'view all: All',
        '  show web, api',
        'scenario find: Find',
        '  web asks api',
        'walkthrough tour: Tour',
        '  step all',
        '  step all: web',
        '',
      ].join('\n'),
    );
  });

  it('DRIFT-429 a rename replaces one word, a missing unit leaves the code line, a pin adds one after the icon line', () => {
    const drift = driftOf(
      STACK,
      'model m: M',
      'web: Web',
      '  icon web',
      'api: API',
      '  code compose:api compose:cache',
      'db: Database',
      '  code compose:db',
      'queue: Queue',
      '  code compose:queue',
      'web calls api',
      'api calls db',
      'api calls queue',
    );
    expect(drift.findings.map((each) => [each.key, each.edits])).toEqual([
      [
        'missing-code:api:compose:cache',
        [{ at: 5, remove: ['  code compose:api compose:cache'], add: ['  code compose:api'] }],
      ],
    ]);
    expect(drift.suggestions.map((each) => each.edits)).toEqual([
      [{ at: 4, remove: [], add: ['  code compose:web'] }],
    ]);
  });

  it('DRIFT-430 the edit instead adds an ignore line with a reason to write, after the last ignore line', () => {
    const drift = driftOf(
      STACK,
      'model m: M',
      'web: Web',
      '  code compose:web',
      'api: API',
      '  code compose:api',
      'db: Database',
      '  code compose:db',
      'api calls db',
      'ignore drift compose:queue - not ours',
    );
    expect(drift.findings.map((each) => [each.key, each.instead])).toEqual([
      [
        'undrawn-connection:web>api',
        [{ at: 10, remove: [], add: ['ignore drift web to api - why this difference is meant'] }],
      ],
    ]);
  });

  it('DRIFT-431 the edits of several findings combine into one patch, and applying it leaves nothing to report', () => {
    const files = maven({ name: 'app', deps: ['lib', 'core'] }, { name: 'lib' }, { name: 'core' });
    const model = [
      'model m: M',
      'app: App',
      '  code maven:app maven:old maven:older',
      'lib: Lib',
      '  code maven:lib',
      'core: Core',
      '  code maven:core',
      'app depends on lib, core, old-lib [code]',
      'old-lib: Old',
      'lib depends on core, app [code]',
    ];
    const drift = driftOf(files, ...model);
    expect(keys(drift)).toEqual([
      'drift missing-code:app:maven:old',
      'drift missing-code:app:maven:older',
      'drift missing-dependency:lib>app',
      'drift missing-dependency:lib>core',
    ]);
    const source = [...model, ''].join('\n');
    const patched = applyHunks(source, drift.patch());
    // Both units leave the one code line, and both objects leave the one relationship, so it goes.
    expect(patched).toBe(
      [
        'model m: M',
        'app: App',
        '  code maven:app',
        'lib: Lib',
        '  code maven:lib',
        'core: Core',
        '  code maven:core',
        'app depends on lib, core, old-lib [code]',
        'old-lib: Old',
        '',
      ].join('\n'),
    );
    expect(keys(driftOf(files, ...patched.trimEnd().split('\n')))).toEqual([]);
    expect(() => applyHunks('a\n', [{ at: 1, remove: ['b'], add: [] }])).toThrow(
      'The edit at line 1 does not match the file.',
    );
  });
});
