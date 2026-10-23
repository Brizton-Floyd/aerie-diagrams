// The rules every slice keeps (docs/spec/acceptance.md, ACC-001, ACC-003 and ACC-005): one command
// runs every suite, locally and in CI; each suite holds only its own kind of test; and nothing in
// that command rewrites a golden or a screenshot, so they change only when someone asks.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import playwrightConfig from '../../playwright.config.ts';
import vitestConfig from '../../vitest.config.ts';

const ROOT = join(import.meta.dirname, '../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: ROOT,
  encoding: 'utf8',
})
  .split('\n')
  .filter((file) => file.startsWith('tests/'));

interface VitestProject {
  test?: { name?: string; include?: string[]; update?: unknown };
}
const vitestProjects = (vitestConfig.test?.projects ?? []) as VitestProject[];

const SUITES = ['unit', 'rules', 'golden', 'screenshots', 'journeys'] as const;
const VITEST = new Set(['unit', 'rules', 'golden']);

describe('the suites', () => {
  it('ACC-001 npm run check runs the type check, lint and all five suites', () => {
    const steps = (scripts['check'] ?? '').split(' && ');
    expect(steps).toEqual([
      'npm run typecheck',
      'npm run lint',
      ...SUITES.map((suite) => `npm run test:${suite}`),
    ]);
  });

  it('ACC-005 each suite holds only its own kind of test, run by its own runner', () => {
    for (const suite of SUITES) {
      const tests = files.filter(
        (file) => file.startsWith(`tests/${suite}/`) && /\.(?:test|spec)\.ts$/.test(file),
      );
      expect(tests.length, suite).toBeGreaterThan(0);
      const suffix = VITEST.has(suite) ? '.test.ts' : '.spec.ts';
      expect(
        tests.filter((file) => !file.endsWith(suffix)),
        suite,
      ).toEqual([]);
      const runner = VITEST.has(suite) ? 'vitest run' : 'playwright test';
      expect(scripts[`test:${suite}`]).toBe(`${runner} --project ${suite}`);
    }
    expect(vitestProjects.map((project) => [project.test?.name, project.test?.include])).toEqual(
      [...VITEST].map((suite) => [suite, [`tests/${suite}/**/*.test.ts`]]),
    );
    expect(
      (playwrightConfig.projects ?? []).map((project) => [project.name, project.testDir]),
    ).toEqual(['screenshots', 'journeys'].map((suite) => [suite, `tests/${suite}`]));
    // Journeys and screenshots run against the production build.
    const server = playwrightConfig.webServer;
    expect(Array.isArray(server) ? undefined : server?.command).toMatch(
      /^npm run build && npm run preview /,
    );
  });

  it('ACC-003 no script or configuration rewrites a golden or a screenshot on its own', () => {
    for (const [name, command] of Object.entries(scripts)) {
      expect(command, name).not.toMatch(/(?:^|\s)(?:-u|--update|--update-snapshots)(?:\s|$)/);
    }
    expect(vitestConfig.test?.update).toBeUndefined();
    for (const project of vitestProjects) expect(project.test?.update).toBeUndefined();
    expect(playwrightConfig.updateSnapshots).toBeUndefined();
    for (const project of playwrightConfig.projects ?? []) {
      expect(project.updateSnapshots).toBeUndefined();
    }
  });
});
