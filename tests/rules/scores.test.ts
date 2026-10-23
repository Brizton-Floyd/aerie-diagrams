// Readability scores and timings (docs/spec/layout.md, SCORE-001 to SCORE-003 and LAYOUT-901). The
// scores of every tested picture are kept in scores.json. A score worse than its baseline fails; a
// better one passes and asks for the baseline to be updated in the same change (ACC-004):
//
//   AERIE_UPDATE_SCORES=1 npx vitest run --project rules tests/rules/scores.test.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from '../../src/lines/index.ts';
import { Semantics } from '../../src/model/index.ts';
import { inProcessEngine } from '../../src/layout/elk/in-process.ts';
import { Layouter, better, scores, worse, type Scores } from '../../src/layout/index.ts';
import { SOURCES, pictures } from './pictures.ts';

const BASELINE = join(import.meta.dirname, 'scores.json');
const UPDATE = process.env['AERIE_UPDATE_SCORES'] === '1';

type Baseline = Record<string, Record<string, Scores>>;

/** Prints a line of the suite's report. Vitest keeps console output of passing tests to itself. */
function report(text: string): void {
  process.stdout.write(`${text}\n`);
}

it('SCORE-001 to SCORE-003 and ACC-004 edge crossings, bends and fit scale are no worse than the baseline', async () => {
  const now: Baseline = {};
  for (const source of SOURCES) {
    const scored: Record<string, Scores> = {};
    for (const { view, state } of pictures(source)) {
      const { result } = await source.layouter.structure(view, state.zoom);
      scored[`${view}, ${state.name}`] = scores(result);
    }
    now[source.path] = scored;
  }
  if (UPDATE) {
    writeFileSync(BASELINE, `${JSON.stringify(now, null, 2)}\n`);
    return;
  }
  const before = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline;
  const problems: string[] = [];
  const improved: string[] = [];
  for (const [path, scored] of Object.entries(now)) {
    for (const [picture, score] of Object.entries(scored)) {
      const base = before[path]?.[picture];
      if (base === undefined) {
        problems.push(`${path}: ${picture} has no baseline`);
        continue;
      }
      for (const name of worse(score, base)) {
        problems.push(
          `${path}: ${picture}: ${name} got worse, ${String(base[name])} to ${String(score[name])}`,
        );
      }
      for (const name of better(score, base)) improved.push(`${path}: ${picture}: ${name}`);
    }
  }
  for (const [path, scored] of Object.entries(before)) {
    for (const picture of Object.keys(scored)) {
      if (now[path]?.[picture] === undefined)
        problems.push(`${path}: ${picture} is no longer tested`);
    }
  }
  if (improved.length > 0) {
    report(
      `Scores improved; update scores.json in this change (AERIE_UPDATE_SCORES=1):\n${improved.join('\n')}`,
    );
  }
  expect(problems).toEqual([]);
});

/** The middle of five timed runs, in milliseconds. */
async function timed(run: () => Promise<unknown>): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await run();
    times.push(performance.now() - start);
  }
  return times.sort((a, b) => a - b)[2] ?? 0;
}

/** A picture of 100 boxes: ten open containers of nine parts each, the parts in one long chain. */
function hundredBoxes(): Semantics {
  const lines = ['model big: Big'];
  const parts: string[] = [];
  for (let c = 0; c < 10; c++) {
    lines.push(`c${String(c)}: Container ${String(c)} | Holds nine parts [system]`);
    for (let p = 0; p < 9; p++) {
      const id = `p${String(c)}x${String(p)}`;
      parts.push(id);
      lines.push(`  ${id}: Part ${String(c)}.${String(p)} | Does one thing`);
    }
  }
  for (let i = 0; i + 1 < parts.length; i++) {
    lines.push(`${parts[i] ?? ''} hands work to ${parts[i + 1] ?? ''}`);
  }
  lines.push(
    'view all: All',
    `  show ${Array.from({ length: 10 }, (_, c) => `c${String(c)} +1`).join(', ')}`,
  );
  const result = parse(`${lines.join('\n')}\n`);
  if (result.model === null)
    throw new Error(result.diagnostics.map((each) => each.message).join('\n'));
  return new Semantics(result.model);
}

it('LAYOUT-901 reports layout times against their targets', async () => {
  const engine = inProcessEngine();
  const lotto = SOURCES.find((source) => source.path === 'samples/lotto.aerie');
  if (lotto === undefined) throw new Error('samples/lotto.aerie is missing');
  let slowest = { ms: 0, picture: '' };
  for (const { view, state } of pictures(lotto)) {
    const { graph } = await lotto.layouter.structure(view, state.zoom);
    const ms = await timed(() => engine.layout(graph));
    if (ms > slowest.ms) slowest = { ms, picture: `${view}, ${state.name}` };
  }
  const big = hundredBoxes();
  const graph = new Layouter(big, engine).graph(big.drawing('all'));
  expect(graph.nodes).toHaveLength(100);
  const hundred = await timed(() => engine.layout(graph));
  report(
    [
      `LAYOUT-901 slowest Lotto picture: ${slowest.ms.toFixed(1)} ms (${slowest.picture}); target under 50 ms`,
      `LAYOUT-901 a picture of 100 boxes: ${hundred.toFixed(1)} ms; target under 150 ms`,
    ].join('\n'),
  );
});
