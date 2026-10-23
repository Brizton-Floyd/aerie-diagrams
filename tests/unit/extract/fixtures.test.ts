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
import { evidenceText, extract, factText, type Extraction } from '../../../src/extract/index.ts';
import { parse } from '../../../src/lines/index.ts';

const DIR = join(import.meta.dirname, 'fixtures');

/** Extracts the system the fixture's model names; the fixture folder is the model's repository. */
export function extractFixture(fixture: string, model: string): Extraction {
  const file = join(DIR, fixture, `${model}.aerie`);
  const parsed = parse(readFileSync(file, 'utf8'));
  if (parsed.model === null) throw new Error(`${model}.aerie does not parse`);
  return extract({
    ...modelInput(file, parsed.model.system),
    homeRepo: slashes(join(DIR, fixture)),
  });
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

  it('DRIFT-114 the Lotto Compose files: only the file the system root names', async () => {
    const found = await expectFixture('lotto', 'lotto');
    const services = found.facts.flatMap((fact) => (fact.kind === 'unit' ? [fact.unit.name] : []));
    expect(services).toEqual(['results-service', 'core', 'bff', 'web-ui']);
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
    const services = found.facts.flatMap((fact) => (fact.kind === 'unit' ? [fact.unit.name] : []));
    expect(services).toEqual([
      'lotto-options-core-service',
      'lotto-persistence-service',
      'results-service',
      'core',
      'bff',
      'web-ui',
    ]);
  });
});
