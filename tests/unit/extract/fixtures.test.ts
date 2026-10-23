// Fixture projects with known facts (docs/spec/drift.md, section 10): each folder in fixtures/ is a
// workspace whose `.aerie` model names its system, and `<model>.facts.txt` beside the model lists
// every fact the extractor must find, one `repo/path:line  technique: detail` line each, and nothing
// more. `<model>.problems.txt` lists what it must report, when there is anything. The expected files
// were written by hand from the projects and checked against `docker compose config`; update them
// deliberately with `npx vitest run --project unit -u` and review the difference.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { modelInput, slashes } from '../../../src/cli/project.ts';
import {
  evidenceText,
  extract,
  factText,
  TECHNIQUES,
  unitText,
  type Extraction,
} from '../../../src/extract/index.ts';
import { parse } from '../../../src/lines/index.ts';
import { java } from './memory.ts';

const DIR = join(import.meta.dirname, 'fixtures');

/** Extracts the system the fixture's model names; the fixture folder is the model's repository. */
export function extractFixture(fixture: string, model: string): Extraction {
  const file = join(DIR, fixture, `${model}.aerie`);
  const parsed = parse(readFileSync(file, 'utf8'));
  if (parsed.model === null) throw new Error(`${model}.aerie does not parse`);
  return extract({
    ...modelInput(file, parsed.model.system),
    homeRepo: slashes(join(DIR, fixture)),
    java,
  });
}

/** The names of the code units of one kind the extraction found, in order. */
function units(found: Extraction, kind: string): string[] {
  return found.facts.flatMap((fact) =>
    fact.kind === 'unit' && fact.unit.kind === kind ? [fact.unit.name] : [],
  );
}

async function expectFixture(fixture: string, model: string): Promise<Extraction> {
  const found = extractFixture(fixture, model);
  const facts = found.facts.map((fact) => factText(fact)).join('\n') + '\n';
  await expect(facts).toMatchFileSnapshot(join(DIR, fixture, `${model}.facts.txt`));
  const problemsFile = join(DIR, fixture, `${model}.problems.txt`);
  if (found.problems.length === 0) {
    expect(existsSync(problemsFile)).toBe(false);
  } else {
    const problems = found.problems.map(
      (each) => `${each.level}  ${each.at === null ? '-' : evidenceText(each.at)}  ${each.message}`,
    );
    await expect(problems.join('\n') + '\n').toMatchFileSnapshot(problemsFile);
  }
  return found;
}

describe('fixture projects', () => {
  it('DRIFT-102 DRIFT-103 interpolation from the .env file: defaults, nesting, escapes, unset variables', async () => {
    await expectFixture('interpolation', 'interpolation');
  });

  it('DRIFT-104 DRIFT-105 merge keys, the default override file, !reset, !override, extends and include', async () => {
    await expectFixture('merging', 'merging');
  });

  it('DRIFT-109 to DRIFT-112 environment values that name services: URLs, JDBC URLs, bare hosts, aliases, secrets', async () => {
    await expectFixture('connections', 'connections');
  });

  it('DRIFT-106 to DRIFT-108 build contexts and the Dockerfile stage graph to the source built, across repos', async () => {
    await expectFixture('builds', 'builds');
  });

  it('DRIFT-113 ports, volumes, profiles and healthchecks, in a system with no repo line and legacy file names', async () => {
    await expectFixture('details', 'details');
  });

  it('DRIFT-201 to DRIFT-213 a Spring Boot and Maven system with one of each pattern, the traps included', async () => {
    const found = await expectFixture('spring', 'spring');
    // A Map named like a template is not a RestTemplate, and CORS origins call this module, not out.
    const lines = found.facts.map((fact) => factText(fact));
    expect(lines.filter((line) => line.includes('ticketsPerTemplate'))).toEqual([]);
    expect(lines.filter((line) => line.includes('4200'))).toEqual([]);
  });

  it('DRIFT-114 the Lotto Compose files: only the file the system root names', async () => {
    const found = await expectFixture('lotto', 'lotto');
    expect(units(found, 'compose')).toEqual(['results-service', 'core', 'bff', 'web-ui']);
    // The three service connections Compose shows on Lotto (#51): the environment URLs, which
    // `depends_on` corroborates. The fourth, the store's downloads, is in Spring configuration (D3).
    const calls = (technique: string): string[] =>
      found.facts.flatMap((fact) =>
        fact.kind === 'connection' && fact.technique === technique && !('host' in fact.to)
          ? [`${fact.from.name} > ${fact.to.name}`]
          : [],
      );
    const truth = ['core > results-service', 'bff > core', 'web-ui > bff'];
    expect(calls('env-url')).toEqual(truth);
    expect(calls('compose-depends-on')).toEqual(truth);
  });

  it('DRIFT-114 without a compose line, the Lotto repos default to every root Compose file, the stale one too', async () => {
    const found = await expectFixture('lotto', 'lotto-default');
    expect(units(found, 'compose')).toEqual([
      'lotto-options-core-service',
      'lotto-persistence-service',
      'results-service',
      'core',
      'bff',
      'web-ui',
    ]);
  });

  it('DRIFT-302 to DRIFT-309 a Node and Angular workspace: packages, projects, proxies, environments, calls and nginx', async () => {
    await expectFixture('angular', 'angular');
  });

  it('DRIFT-310 the Lotto UI: its package, its nine calls, and the website to Screen API connection by four techniques', async () => {
    const found = await expectFixture('lotto', 'lotto');
    expect(units(found, 'npm')).toEqual(['lotto-options-ui']);
    const calls = found.facts.flatMap((fact) =>
      fact.kind === 'call' && !('className' in fact) ? [`${fact.method} ${fact.url}`] : [],
    );
    expect(calls).toEqual([
      'GET /ui/dashboard/{}/{}',
      'GET /ui/dashboard/{}/{}/matrix',
      'GET /ui/dashboard/{}/{}/position-trend',
      'GET /ui/dashboard/{}/{}/pattern-edge',
      'POST /ui/dashboard/{}/{}/generate',
      'POST /ui/dashboard/{}/{}/betslip/pdf',
      'GET /ui/ping',
      'POST /ui/range-analysis',
      'GET /ui/catalog/states',
    ]);
    // Every connection the Node extractor finds runs from the website (its npm package, or the
    // web-ui service that serves it) to the Screen API's bff service, and nothing else.
    const techniques = new Map<string, Set<string>>();
    for (const fact of found.facts) {
      if (fact.kind !== 'connection' || TECHNIQUES[fact.technique].stack !== 'node') continue;
      const edge = `${unitText(fact.from)} > ${'host' in fact.to ? fact.to.host : unitText(fact.to)}`;
      techniques.set(edge, (techniques.get(edge) ?? new Set()).add(fact.technique));
    }
    expect(
      Object.fromEntries([...techniques].map(([edge, each]) => [edge, [...each].sort()])),
    ).toEqual({
      'compose:web-ui > compose:bff': ['nginx-proxy-pass'],
      'npm:lotto-options-ui > compose:bff': ['angular-proxy', 'http-dev-proxy', 'http-nginx'],
    });
  });

  it('DRIFT-214 the Lotto Spring repos: three apps, their ports, the module graph, endpoints and the calls between them', () => {
    const found = extractFixture('lotto', 'lotto');
    const unitsOf = (kind: string): string[] =>
      found.facts.flatMap((fact) =>
        fact.kind === kind && 'unit' in fact && 'className' in fact ? [fact.unit.name] : [],
      );
    expect(unitsOf('app')).toEqual([
      'lottery-result-persistence-server',
      'lotto-options-core-bff',
      'lotto-options-core-server',
    ]);
    const ports = found.facts.flatMap((fact) =>
      fact.kind === 'property' && fact.key === 'server.port'
        ? [`${fact.unit.name}:${fact.value}`]
        : [],
    );
    expect(ports).toEqual([
      'lottery-result-persistence-server:8001',
      'lotto-options-core-bff:8080',
      'lotto-options-core-server:8002',
    ]);
    // The module graph, from the raw poms: the runtime-only dependency on the legacy module too.
    const modules = found.facts.flatMap((fact) =>
      fact.kind === 'dependency' && !('artifact' in fact.to) && fact.scope !== 'test'
        ? [`${fact.from.name} > ${fact.to.name} (${fact.scope})`]
        : [],
    );
    expect(modules).toContain(
      'lotto-options-core-server > lotto-options-core-legacy-desktop (runtime)',
    );
    expect(modules).toContain(
      'lottery-result-persistence-server > lottery-result-aggregator (compile)',
    );
    // 35 endpoints: 9 in the BFF, 20 in the engine (8 of them legacy) and 6 in the store; the
    // research (#51) counted 34 before the engine's betslip endpoint was added.
    const endpoints = unitsOf('endpoint');
    expect(endpoints.length).toBe(35);
    expect(endpoints.filter((each) => each === 'lotto-options-core-bff').length).toBe(9);
    expect(endpoints.filter((each) => each === 'lottery-result-persistence-server').length).toBe(6);
    // The service connections Spring shows: two through configuration URLs that Compose
    // overrides by relaxed binding, the calls behind them, and the fourth connection, which
    // Compose cannot show: the store's downloads from the Texas lottery.
    const to = (fact: { to: unknown }): string => {
      const target = fact.to as { name?: string; host?: string } | null;
      return target === null ? '?' : (target.name ?? `host ${target.host ?? ''}`);
    };
    const configured = new Set(
      found.facts.flatMap((fact) =>
        fact.kind === 'connection' && fact.technique === 'spring-config-url'
          ? [`${fact.from.name} > ${to(fact)} (${fact.key ?? ''})`]
          : [],
      ),
    );
    expect(configured).toContain(
      'lotto-options-core-bff > lotto-options-core-server (core-api.base-url)',
    );
    expect(configured).toContain(
      'lotto-options-core-server > lottery-result-persistence-server (persistence-service.host)',
    );
    expect(
      [...configured].some((each) =>
        each.startsWith('lottery-result-persistence-server > host www.texaslottery.com'),
      ),
    ).toBe(true);
    const env = found.facts.flatMap((fact) =>
      fact.kind === 'property' && fact.key.endsWith('url') ? [fact.env] : [],
    );
    expect(env).toContain('COREAPI_BASEURL');
    const calls = new Set(
      found.facts.flatMap((fact) =>
        fact.kind === 'call' && 'className' in fact && fact.to !== null
          ? [`${fact.unit.name} > ${to(fact)}`]
          : [],
      ),
    );
    expect([...calls].sort()).toEqual([
      'lotto-options-core-bff > lotto-options-core-server',
      'lotto-options-core-server > lottery-result-persistence-server',
    ]);
    // The draw-history call builds its URL in `PersistenceServiceProperties.drawHistoryUrl()`.
    expect(
      found.facts.some(
        (fact) =>
          fact.kind === 'call' &&
          'className' in fact &&
          fact.className.endsWith('ResultsServiceDrawHistoryAdapter') &&
          fact.url === 'http://localhost:8001/api/v1/state/games',
      ),
    ).toBe(true);
    // The in-process event the store's poller announces and its catalog cache listens for.
    const events = found.facts.flatMap((fact) =>
      fact.kind === 'event' ? [`${fact.direction} ${fact.event}`] : [],
    );
    expect(new Set(events)).toEqual(
      new Set([
        'publishes com.floyd.lottoptions.agr.polling.PollCompletedEvent',
        'listens com.floyd.lottoptions.agr.polling.PollCompletedEvent',
      ]),
    );
    expect(found.problems).toEqual([]);
  });
});
