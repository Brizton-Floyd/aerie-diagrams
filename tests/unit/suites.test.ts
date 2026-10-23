// The rules every slice keeps (docs/spec/acceptance.md, ACC-001, ACC-003 and ACC-005): one command
// runs every suite, locally and in CI; each suite holds only its own kind of test; and nothing in
// that command rewrites a golden or a screenshot, so they change only when someone asks.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: ROOT,
  encoding: 'utf8',
})
  .split('\n')
  .filter((file) => file.startsWith('tests/'));

const SUITES = ['unit', 'rules', 'golden', 'screenshots', 'journeys'] as const;
const VITEST = new Set(['unit', 'rules', 'golden']);

describe('the suites', () => {
  it('ACC-001 npm run check runs the type check, lint and all five suites, and CI runs it', () => {
    const steps = (scripts['check'] ?? '').split(' && ');
    expect(steps).toEqual([
      'npm run typecheck',
      'npm run lint',
      ...SUITES.map((suite) => `npm run test:${suite}`),
    ]);
    expect(read('.github/workflows/ci.yml')).toMatch(/^\s*- run: npm run check$/m);
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
    const vitest = read('vitest.config.ts');
    for (const suite of VITEST) {
      expect(vitest).toContain(`name: '${suite}', include: ['tests/${suite}/**/*.test.ts']`);
    }
    const playwright = read('playwright.config.ts');
    for (const suite of ['screenshots', 'journeys']) {
      expect(playwright).toContain(`name: '${suite}', testDir: 'tests/${suite}'`);
    }
    // Journeys and screenshots run against the production build.
    expect(playwright).toMatch(/command: `npm run build && npm run preview/);
  });

  it('ACC-003 no script or configuration rewrites a golden or a screenshot on its own', () => {
    for (const [name, command] of Object.entries(scripts)) {
      expect(command, name).not.toMatch(/(?:^|\s)(?:-u|--update|--update-snapshots)(?:\s|$)/);
    }
    expect(read('vitest.config.ts')).not.toMatch(/\bupdate\b/);
    expect(read('playwright.config.ts')).not.toMatch(/updateSnapshots/);
  });
});
