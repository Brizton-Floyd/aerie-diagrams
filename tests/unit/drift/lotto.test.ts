// The Lotto benchmark (docs/spec/drift.md, section 10; DRIFT-433): lotto/lotto.aerie is the sample
// with code lines pinning it to the copies of the Lotto repos, and lotto/truth.txt labels every
// finding by hand. Precision, recall, the precision of drift-level findings, the lines confirmed
// and the planted drifts found are kept in lotto/benchmark.json and may never get worse. A better
// score passes and asks for the baseline to be updated in the same change:
//
//   AERIE_UPDATE_DRIFT=1 npx vitest run --project unit tests/unit/drift/lotto.test.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyHunks } from '../../../src/drift/index.ts';
import { compareText, extractFor, keys, report } from './drift.ts';

const LOTTO = join(import.meta.dirname, 'lotto');
const MODEL = join(LOTTO, 'lotto.aerie');
const BASELINE = join(LOTTO, 'benchmark.json');
const UPDATE = process.env['AERIE_UPDATE_DRIFT'] === '1';

const source = readFileSync(MODEL, 'utf8');
const extraction = extractFor(MODEL, LOTTO);
const drift = compareText(source, extraction);

interface Benchmark {
  findings: number;
  precision: number;
  recall: number;
  driftPrecision: number;
  confirmedLines: number;
  planted: { found: number; of: number; invented: number };
}

/** The labels of truth.txt, by finding key. */
function truth(): Map<string, 'real' | 'false' | 'missed'> {
  const out = new Map<string, 'real' | 'false' | 'missed'>();
  for (const line of readFileSync(join(LOTTO, 'truth.txt'), 'utf8').split('\n')) {
    const match = /^(real|false|missed)\s+(\S+)/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      out.set(match[2], match[1] as 'real' | 'false' | 'missed');
    }
  }
  return out;
}

/** Prints a line of the suite's report. Vitest keeps console output of passing tests to itself. */
function say(text: string): void {
  process.stdout.write(`${text}\n`);
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * The four planted drifts of #54, each a change to the model: what the model then reports that it
 * did not, and what it no longer reports, since the change takes lines away. The undrawn module is
 * taken out with every line naming it, as its own removal edit would.
 */
const PLANTS = [
  {
    name: 'a removed relationship',
    change: (text: string) =>
      text.replace(
        'website gets screen data from screen-api\n  @exec: works through\n  @engineer: calls /ui/* on\n',
        '',
      ),
    adds: ['drift undrawn-connection:website>screen-api'],
    removes: [],
  },
  {
    name: 'an extra service',
    change: (text: string) =>
      text.replace(
        '  store: Results store',
        '  mailer: Mailer | Sends the weekly results [service]\n    code compose:mailer\n\n  store: Results store',
      ),
    adds: ['drift missing-code:mailer:compose:mailer'],
    removes: [],
  },
  {
    name: 'an undrawn module',
    change: (text: string) =>
      text
        .replace(/\n {4}formats: Shared data formats[^]*?\n(?=\n {4}\/\/ Unsure: the desktop)/, '')
        .replace(
          'engine-service depends on strategies, formats [code]',
          'engine-service depends on strategies [code]',
        )
        .replace('strategies depends on formats [code]\n', '')
        .replace('legacy depends on formats [code]\n', '')
        .replace('screen-api uses the shapes in formats [code]\n  @engineer: depends on\n', ''),
    adds: ['drift undrawn-code:maven:lotto-options-core-model'],
    removes: [
      'drift missing-dependency:screen-api>formats',
      'drift missing-dependency:strategies>formats',
    ].sort(),
  },
  {
    name: 'a renamed service',
    change: (text: string) => text.replace('code compose:web-ui npm:', 'code compose:web npm:'),
    adds: ['drift renamed-code:website:compose:web>compose:web-ui'],
    removes: [],
  },
];

function plant(change: (text: string) => string): { adds: string[]; removes: string[] } {
  const changed = change(source);
  expect(changed).not.toBe(source);
  const before = new Set(keys(drift));
  const after = new Set(keys(compareText(changed, extraction)));
  return {
    adds: [...after].filter((key) => !before.has(key)).sort(),
    removes: [...before].filter((key) => !after.has(key)).sort(),
  };
}

describe('the Lotto benchmark', () => {
  it('DRIFT-433 every finding on the Lotto copies is as the hand-checked truth says', async () => {
    await expect(report(drift)).toMatchFileSnapshot(join(LOTTO, 'lotto.findings.txt'));
    const labels = truth();
    const unlabelled = drift.findings
      .filter((each) => !labels.has(each.key))
      .map((each) => each.key);
    expect(unlabelled, 'label every finding in truth.txt').toEqual([]);
    const found = new Set(drift.findings.map((each) => each.key));
    const nowFound = [...labels].filter(([key, label]) => label === 'missed' && found.has(key));
    expect(nowFound, 'a missed difference is found now: label it real').toEqual([]);
    const gone = [...labels].filter(([key, label]) => label !== 'missed' && !found.has(key));
    expect(gone, 'a labelled finding is no longer reported: drop or relabel it').toEqual([]);
  });

  it('DRIFT-433 precision, recall, drift precision, lines confirmed and planted drifts are no worse than the baseline', () => {
    const labels = truth();
    const real = drift.findings.filter((each) => labels.get(each.key) === 'real');
    const drifts = drift.findings.filter((each) => each.level === 'drift');
    const all = [...labels.values()].filter((label) => label !== 'false').length;
    let found = 0;
    let invented = 0;
    for (const each of PLANTS) {
      const result = plant(each.change);
      if (each.adds.every((key) => result.adds.includes(key))) found++;
      invented += result.adds.filter((key) => !each.adds.includes(key)).length;
      invented += result.removes.filter((key) => !each.removes.includes(key)).length;
    }
    const now: Benchmark = {
      findings: drift.findings.length,
      precision: round(real.length / drift.findings.length),
      recall: round(real.length / all),
      driftPrecision: round(
        drifts.filter((each) => labels.get(each.key) === 'real').length / drifts.length,
      ),
      confirmedLines: drift.confirmed.filter((each) => 'relationship' in each.subject).length,
      planted: { found, of: PLANTS.length, invented },
    };
    say(`Lotto benchmark: ${JSON.stringify(now)}`);
    if (UPDATE) {
      writeFileSync(BASELINE, `${JSON.stringify(now, null, 2)}\n`);
      return;
    }
    const before = JSON.parse(readFileSync(BASELINE, 'utf8')) as Benchmark;
    const worse: string[] = [];
    const better: string[] = [];
    const compare = (name: string, value: number, base: number, higher = true): void => {
      if (higher ? value < base : value > base)
        worse.push(`${name}: ${String(base)} to ${String(value)}`);
      if (higher ? value > base : value < base) better.push(name);
    };
    compare('precision', now.precision, before.precision);
    compare('recall', now.recall, before.recall);
    compare('driftPrecision', now.driftPrecision, before.driftPrecision);
    compare('confirmedLines', now.confirmedLines, before.confirmedLines);
    compare('planted.found', now.planted.found, before.planted.found);
    compare('planted.invented', now.planted.invented, before.planted.invented, false);
    if (better.length > 0) {
      say(
        `The Lotto benchmark improved (${better.join(', ')}); update benchmark.json in this change.`,
      );
    }
    expect(worse).toEqual([]);
  });

  it.each(PLANTS)(
    'DRIFT-433 a planted drift on Lotto, $name, is found as drift and nothing else changes',
    (each) => {
      expect(plant(each.change)).toEqual({ adds: each.adds, removes: each.removes });
    },
  );

  it('DRIFT-433 all four planted drifts together give exactly their findings', () => {
    const all = (text: string): string => PLANTS.reduce((at, each) => each.change(at), text);
    const result = plant(all);
    expect(result.adds).toEqual(PLANTS.flatMap((each) => each.adds).sort());
    expect(result.removes).toEqual(PLANTS.flatMap((each) => each.removes).sort());
  });

  it('DRIFT-431 the patch of every suggested edit parses, and drift on the patched model finds no drift', () => {
    const next = applyHunks(source, drift.patch());
    const again = compareText(next, extraction);
    expect(again.findings.filter((each) => each.level === 'drift').map((each) => each.key)).toEqual(
      [],
    );
  });
});
