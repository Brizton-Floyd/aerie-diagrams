import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkCoverage,
  citedRequirements,
  slicesOf,
  slicesWithoutReadLog,
  testTitles,
} from '../../scripts/check-coverage.ts';

// Ids are assembled at run time so this file does not itself cite them.
const id = (prefix: string, number: string): string => `${prefix}-${number}`;
const [A, B, C, D] = ['001', '002', '003', '004'].map((each) => id('LANG', each));
const SPEC = `- **${A ?? ''}** One.\n- **${B ?? ''}** Two.\n- **${C ?? ''}** Three.\n- **${D ?? ''}** Four.\n`;

describe('testTitles', () => {
  it('reads the titles of it, test and describe, with each, skip and template literals', () => {
    const source = [
      "describe('group', () => {",
      "  it('plain', () => {});",
      '  it.each([[1], [2]])(`each %s`, () => {});',
      "  test.describe('nested', () => {});",
      '  test(`made for ${theme}, with ${mode}`, async () => {});',
      "  it.skip('skipped', () => {});",
      "  expect('not a title').toBe('x');",
      '});',
    ].join('\n');
    expect(testTitles('x.test.ts', source)).toEqual([
      'group',
      'plain',
      'each %s',
      'nested',
      'made for  , with  ',
      'skipped',
    ]);
  });
});

describe('citedRequirements', () => {
  it('counts ids anywhere in a title and every defined id inside a range', () => {
    const defined = [A, B, C, D].map((each) => each ?? '');
    const cited = citedRequirements(
      [`${A ?? ''} and something`, `see ${B ?? ''} to ${D ?? ''}`],
      defined,
    );
    expect([...cited].sort()).toEqual(defined);
  });

  it('ignores ids the spec does not define and ranges across prefixes', () => {
    const cited = citedRequirements([`${id('MODEL', '001')} to ${id('LANG', '009')}`], [D ?? '']);
    expect([...cited]).toEqual([]);
  });
});

describe('read logs', () => {
  it('reads the slices from the plan and finds the ones with no read log', () => {
    const plan =
      '| Slice | What |\n| ----- | ---- |\n| A0 | Boot |\n| A12 | Skill |\n| A3 | Model |\n';
    expect(slicesOf(plan)).toEqual(['A0', 'A12', 'A3']);
    expect(slicesWithoutReadLog(['A0', 'A12', 'A3'], ['a0-bootstrap.md', 'a1-spec.md'])).toEqual([
      'A12',
      'A3',
    ]);
  });
});

describe('checkCoverage', () => {
  it('ACC-101 and ACC-002 lists every defined id that no test title cites', () => {
    const result = checkCoverage({
      markdown: new Map([
        ['docs/spec/a.md', SPEC],
        ['docs/slice-plan.md', '| A0 | Boot |\n'],
        ['docs/clean-room/read-log/a0-boot.md', '# a0'],
      ]),
      tests: new Map([['tests/unit/a.test.ts', `it('${A ?? ''} does one thing', () => {});`]]),
      titledFiles: [`tests/unit/lines/examples/${C ?? ''}-three.aerie`],
    });
    expect(result).toEqual({ uncited: [B, D], noReadLog: [] });
  });

  it('ACC-102 lists every slice with no read log', () => {
    const result = checkCoverage({
      markdown: new Map([['docs/slice-plan.md', '| A0 | Boot |\n| A11 | Lotto |\n']]),
      tests: new Map(),
      titledFiles: [],
    });
    expect(result.noReadLog).toEqual(['A0', 'A11']);
  });

  it('ACC-101 and ACC-102 every requirement of the spec is cited by a test title, and every slice has its read log', () => {
    const root = join(import.meta.dirname, '../..');
    const run = spawnSync(process.execPath, ['scripts/check-coverage.ts'], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
  });
});
