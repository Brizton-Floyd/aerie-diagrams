// The extractor core (docs/spec/drift.md, "The extractor core", DRIFT-001 to DRIFT-008): facts with
// their technique and evidence, the system root resolved to repos and Compose files, problems, and
// the YAML tree that keeps positions.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMPOSE_FILES,
  DEFAULT_OVERRIDE_FILES,
  TECHNIQUES,
  evidenceText,
  extract,
  factText,
  placeText,
  sortFacts,
  type Fact,
} from '../../../src/extract/index.ts';
import { normalize, resolve } from '../../../src/extract/paths.ts';
import { readYaml, type YMap } from '../../../src/extract/yaml.ts';
import { extractFrom, factLines, memoryFiles, systemOf, yaml } from './memory.ts';

const SHOP = yaml(
  'name: shop',
  'services:',
  '  api:',
  '    image: shop/api',
  '    depends_on: [db]',
  '    environment:',
  '      DB_URL: jdbc:postgresql://db:5432/shop',
  '  db:',
  '    image: postgres:16',
);

describe('facts', () => {
  it('DRIFT-001 extraction returns facts, each with its technique and its evidence', () => {
    const found = extractFrom({ '/w/compose.yaml': SHOP });
    const connection = found.facts.find(
      (fact) => fact.kind === 'connection' && fact.technique === 'env-jdbc',
    );
    expect(connection).toEqual({
      kind: 'connection',
      technique: 'env-jdbc',
      at: { repo: 'w', path: 'compose.yaml', line: 7 },
      from: { kind: 'compose', name: 'api' },
      to: { kind: 'compose', name: 'db' },
      key: 'DB_URL',
      value: 'jdbc:postgresql://db:5432/shop',
    });
    expect(new Set(found.facts.map((fact) => fact.kind))).toEqual(
      new Set(['project', 'unit', 'image', 'connection']),
    );
    expect(found.repos).toEqual([{ name: 'w', path: '/w' }]);
    expect(found.read).toEqual([{ repo: 'w', path: 'compose.yaml' }]);
    expect(found.problems).toEqual([]);
  });

  it('DRIFT-001 extraction reads only what the system root leads it to, and never writes', () => {
    const files = memoryFiles({
      '/w/compose.yaml': yaml('services:', '  api:', '    image: shop/api'),
      '/w/docker-compose.yml': yaml('services:', '  old:', '    image: shop/old'),
      '/w/src/Main.java': 'class Main {}',
    });
    extract({ system: null, modelFolder: '/w', homeRepo: '/w', files });
    expect(files.reads).toEqual([
      '/w/compose.yaml',
      '/w/compose.override.yml',
      '/w/compose.override.yaml',
      '/w/docker-compose.override.yml',
      '/w/docker-compose.override.yaml',
      '/w/.env',
      '/w/compose.yaml',
    ]);
  });

  it('DRIFT-002 a fact prints as its evidence, its technique and its detail', () => {
    expect(factLines({ '/w/compose.yaml': SHOP })).toEqual([
      'w/compose.yaml:1  Compose project: shop',
      'w/compose.yaml:3  Compose service: compose:api',
      'w/compose.yaml:4  Compose image: compose:api runs shop/api',
      'w/compose.yaml:5  Compose depends_on: compose:api to compose:db',
      'w/compose.yaml:7  Compose environment JDBC URL: compose:api to compose:db (DB_URL=jdbc:postgresql://db:5432/shop)',
      'w/compose.yaml:8  Compose service: compose:db',
      'w/compose.yaml:9  Compose image: compose:db runs postgres:16',
    ]);
    expect(evidenceText({ repo: 'shop', path: 'deploy/compose.yaml', line: 12 })).toBe(
      'shop/deploy/compose.yaml:12',
    );
    expect(placeText({ repo: 'shop', path: '.' })).toBe('shop');
    expect(placeText({ repo: null, path: '/elsewhere/app' })).toBe('/elsewhere/app');
  });

  it('DRIFT-003 every technique has a name, and only depends_on and links corroborate', () => {
    const names = Object.values(TECHNIQUES).map((each) => each.name);
    expect(new Set(names).size).toBe(names.length);
    const corroborating = Object.entries(TECHNIQUES)
      .filter(([, each]) => each.corroborates)
      .map(([id]) => id);
    expect(corroborating).toEqual(['compose-depends-on', 'compose-links']);
  });

  it('DRIFT-004 facts are sorted by repo, path and line, then by what they say, once each, the same every time', () => {
    const found = extractFrom({ '/w/compose.yaml': SHOP });
    const shuffled = [...found.facts].reverse();
    expect(sortFacts(shuffled).map((fact) => factText(fact))).toEqual(
      found.facts.map((fact) => factText(fact)),
    );
    expect(extractFrom({ '/w/compose.yaml': SHOP })).toEqual(found);
    // A value that names the same service twice gives one fact.
    const twice = factLines({
      '/w/compose.yaml': yaml(
        'services:',
        '  api:',
        '    environment:',
        '      DB_HOSTS: http://db:5432,http://db:5433',
        '  db:',
        '    image: postgres:16',
      ),
    });
    expect(twice.filter((line) => line.includes('DB_HOSTS'))).toEqual([
      'w/compose.yaml:4  Compose environment URL: compose:api to compose:db (DB_HOSTS=http://db:5432,http://db:5433)',
    ]);
    const byRepo: Fact[] = [
      {
        kind: 'project',
        technique: 'compose-project',
        at: { repo: 'b', path: 'a', line: 1 },
        name: 'x',
      },
      {
        kind: 'project',
        technique: 'compose-project',
        at: { repo: 'a', path: 'z', line: 9 },
        name: 'x',
      },
      {
        kind: 'project',
        technique: 'compose-project',
        at: { repo: 'a', path: 'z', line: 10 },
        name: 'x',
      },
    ];
    byRepo.push({
      kind: 'project',
      technique: 'compose-project',
      at: { repo: null, path: '/outside', line: 1 },
      name: 'x',
    });
    expect(sortFacts(byRepo).map((fact) => evidenceText(fact.at))).toEqual([
      'a/z:9',
      'a/z:10',
      'b/a:1',
      '/outside:1',
    ]);
  });
});

describe('problems', () => {
  it('DRIFT-005 a repo or Compose file the system root names that does not exist is an error', () => {
    const found = extractFrom(
      { '/w/app/compose.yaml': SHOP },
      'repo app',
      'repo ../gone',
      'compose app/missing.yaml',
    );
    expect(found.problems.map((each) => [each.id, each.level, each.message])).toEqual([
      [
        'missing-repo',
        'error',
        'The system root names the repo `../gone`, but there is no such folder.',
      ],
      [
        'missing-compose',
        'error',
        'The system root names the Compose file `app/missing.yaml`, but there is no such file.',
      ],
    ]);
    expect(found.facts).toEqual([]);
  });

  it('DRIFT-005 a Compose file that is not valid YAML, or not a mapping, is an error with its line', () => {
    const bad = extractFrom({
      '/w/compose.yaml': yaml('services:', '  api:', '    image: [unclosed'),
    });
    expect(bad.problems).toHaveLength(1);
    expect(bad.problems[0]).toMatchObject({ id: 'bad-yaml', level: 'error' });
    expect(bad.problems[0]?.at?.path).toBe('compose.yaml');
    expect(bad.problems[0]?.message).toMatch(/^This Compose file is not valid YAML: /);
    const list = extractFrom({ '/w/compose.yaml': yaml('- api', '- db') });
    expect(list.problems.map((each) => [each.id, each.level, each.at, each.message])).toEqual([
      [
        'bad-compose',
        'error',
        { repo: 'w', path: 'compose.yaml', line: 1 },
        'This Compose file cannot be read: it does not hold a mapping of top-level keys such as `services`.',
      ],
    ]);
  });
});

describe('the system root', () => {
  it('DRIFT-006 repos are read from the model folder, and named by their folders', () => {
    const files = {
      '/work/shop/compose.yaml': yaml('services:', '  web:', '    build: ../web'),
      '/work/web/Dockerfile': yaml('FROM nginx', 'COPY site /usr/share/nginx/html'),
    };
    const found = extract({
      system: systemOf('system', '  repo ../shop', '  repo ../web'),
      modelFolder: '/work/diagrams',
      homeRepo: '/work/diagrams',
      files: memoryFiles(files),
    });
    expect(found.repos).toEqual([
      { name: 'shop', path: '/work/shop' },
      { name: 'web', path: '/work/web' },
    ]);
    expect(found.facts.map((fact) => factText(fact))).toContain(
      'web/Dockerfile:2  Dockerfile COPY: compose:web is built from web/site',
    );
  });

  it('DRIFT-006 without a repo line the system is the repository that holds the model', () => {
    const found = extract({
      system: systemOf('system', '  compose deploy/compose.yaml'),
      modelFolder: '/repo/docs',
      homeRepo: '/repo',
      files: memoryFiles({ '/repo/docs/deploy/compose.yaml': SHOP }),
    });
    expect(found.repos).toEqual([{ name: 'repo', path: '/repo' }]);
    expect(evidenceText(found.facts[0]?.at ?? { repo: null, path: '', line: 0 })).toBe(
      'repo/docs/deploy/compose.yaml:1',
    );
  });

  it('DRIFT-006 two repos with the same folder name are named by their paths, and outside files keep theirs', () => {
    const found = extract({
      system: systemOf(
        'system',
        '  repo ../a/app',
        '  repo ../b/app',
        '  compose ../a/app/compose.yaml',
      ),
      modelFolder: '/w/model',
      homeRepo: '/w/model',
      files: memoryFiles({
        '/w/a/app/compose.yaml': yaml('services:', '  web:', '    build: /srv/web'),
        '/w/b/app/x': '',
        '/srv/web/Dockerfile': yaml('FROM nginx', 'COPY . /app'),
      }),
    });
    expect(found.repos.map((each) => each.name)).toEqual(['../a/app', '../b/app']);
    expect(found.facts.map((fact) => factText(fact))).toEqual([
      '../a/app/compose.yaml:1  Compose project folder: app',
      '../a/app/compose.yaml:2  Compose service: compose:web',
      '../a/app/compose.yaml:3  Compose build context: compose:web builds in /srv/web (/srv/web/Dockerfile)',
      '/srv/web/Dockerfile:2  Dockerfile COPY: compose:web is built from /srv/web',
    ]);
  });

  it('DRIFT-007 the compose lines are one project, merged in order, its folder the first file’s', () => {
    const lines = factLines(
      {
        '/w/deploy/base.yaml': yaml('services:', '  api:', '    image: shop/api:1'),
        '/w/deploy/.env': 'TAG=2\n',
        '/w/local/more.yaml': yaml('services:', '  api:', '    image: shop/api:${TAG}'),
      },
      'compose deploy/base.yaml',
      'compose local/more.yaml',
    );
    expect(lines).toEqual([
      'w/deploy/base.yaml:1  Compose project folder: deploy',
      'w/deploy/base.yaml:2  Compose service: compose:api',
      'w/local/more.yaml:3  Compose image: compose:api runs shop/api:2',
    ]);
  });

  it('DRIFT-007 without a compose line each repo gives the file Compose picks and its override', () => {
    expect(DEFAULT_COMPOSE_FILES).toEqual([
      'compose.yaml',
      'compose.yml',
      'docker-compose.yml',
      'docker-compose.yaml',
    ]);
    expect(DEFAULT_OVERRIDE_FILES).toEqual([
      'compose.override.yml',
      'compose.override.yaml',
      'docker-compose.override.yml',
      'docker-compose.override.yaml',
    ]);
    const image = (name: string, tag: string): string =>
      yaml('services:', `  ${name}:`, `    image: shop/${name}:${tag}`);
    const lines = factLines(
      {
        '/w/a/docker-compose.yml': image('one', 'old'),
        '/w/a/compose.yml': image('one', 'new'),
        '/w/a/docker-compose.override.yml': image('one', 'override'),
        '/w/a/docker-compose.override.yaml': image('one', 'ignored'),
        '/w/b/docker-compose.yaml': image('two', '1'),
        '/w/c/README': '',
      },
      'repo a',
      'repo b',
      'repo c',
    );
    expect(lines).toEqual([
      'a/compose.yml:1  Compose project folder: a',
      'a/compose.yml:2  Compose service: compose:one',
      'a/docker-compose.override.yml:3  Compose image: compose:one runs shop/one:override',
      'b/docker-compose.yaml:1  Compose project folder: b',
      'b/docker-compose.yaml:2  Compose service: compose:two',
      'b/docker-compose.yaml:3  Compose image: compose:two runs shop/two:1',
    ]);
  });
});

describe('YAML with positions', () => {
  it('DRIFT-008 every key and value keeps its file and line, through anchors and merge keys', () => {
    const read = readYaml(
      yaml(
        'x-base: &base',
        '  context: .',
        '  target: app',
        'x-more: &more',
        '  target: other',
        '  shm: 1',
        'build:',
        '  <<: [*base, *more]',
        '  target: own',
        'copy: *base',
      ),
      '/w/compose.yaml',
    );
    expect(read.errors).toEqual([]);
    const root = read.root as YMap;
    const build = root.entries.find((each) => each.key === 'build')?.value as YMap;
    expect(build.entries.map((each) => [each.key, each.at.line, each.value])).toEqual([
      [
        'target',
        9,
        { type: 'scalar', at: { file: '/w/compose.yaml', line: 9 }, tag: null, text: 'own' },
      ],
      [
        'context',
        2,
        { type: 'scalar', at: { file: '/w/compose.yaml', line: 2 }, tag: null, text: '.' },
      ],
      [
        'shm',
        6,
        { type: 'scalar', at: { file: '/w/compose.yaml', line: 6 }, tag: null, text: '1' },
      ],
    ]);
    const copy = root.entries.find((each) => each.key === 'copy')?.value as YMap;
    expect(copy.entries.map((each) => [each.key, each.at.line])).toEqual([
      ['context', 2],
      ['target', 3],
    ]);
  });

  it('DRIFT-008 numbers and booleans keep the text written, and tags are kept', () => {
    const read = readYaml(yaml('a: 1.10', 'b: yes', 'c: !reset []', 'd:'), '/f');
    const root = read.root as YMap;
    expect(
      root.entries.map((each) => [
        each.key,
        each.value.type,
        each.value.tag,
        'text' in each.value ? each.value.text : null,
      ]),
    ).toEqual([
      ['a', 'scalar', null, '1.10'],
      ['b', 'scalar', null, 'yes'],
      ['c', 'seq', '!reset', null],
      ['d', 'scalar', null, null],
    ]);
  });

  it('DRIFT-008 paths are absolute and forward-slashed, on any platform', () => {
    expect(normalize('/a/./b/../c//d/')).toBe('/a/c/d');
    expect(normalize('C:/work/../shop')).toBe('C:/shop');
    expect(resolve('/w/app', '../web')).toBe('/w/web');
    expect(resolve('/w/app', '/srv/x')).toBe('/srv/x');
  });
});

describe('dependencies', () => {
  const ROOT = join(import.meta.dirname, '../../..');
  const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

  it('DRIFT-009 the parsers are pinned, unpatched, and in the notices with their licences', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    const lock = JSON.parse(read('package-lock.json')) as {
      packages: Record<string, { version: string; license?: string }>;
    };
    const notices = read('THIRD_PARTY_NOTICES.md');
    for (const name of ['yaml', 'dockerfile-ast']) {
      const pinned = pkg.dependencies[name] ?? '';
      expect(pinned, name).toMatch(/^\d+\.\d+\.\d+$/);
      expect(lock.packages[`node_modules/${name}`]?.version, name).toBe(pinned);
      expect(notices, name).toContain(`\`${name}\` ${pinned}`);
    }
    for (const name of ['vscode-languageserver-types', 'vscode-languageserver-textdocument']) {
      const installed = lock.packages[`node_modules/${name}`];
      expect(installed?.license, name).toBe('MIT');
      expect(notices, name).toContain(`\`${name}\` ${installed?.version ?? '?'}`);
    }
    expect(lock.packages['node_modules/yaml']?.license).toBe('ISC');
    expect(lock.packages['node_modules/dockerfile-ast']?.license).toBe('MIT');
    expect(notices).toContain('## ISC License');
    expect(notices).toContain('## MIT License');
    expect(existsSync(join(ROOT, 'patches'))).toBe(false);
  });
});
