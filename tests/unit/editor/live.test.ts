// Live checking (docs/spec/interaction.md, INT-805 and INT-806): the text is checked 250 ms after the
// author stops typing, and while it has errors the diagram keeps the last version without them.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHECK_DELAY,
  KEPT_NOTICE,
  Live,
  errorList,
  errorText,
  type Checked,
  type Clock,
} from '../../../src/app/live.ts';
import type { Diagnostic } from '../../../src/lines/index.ts';

const LOTTO = readFileSync(join(import.meta.dirname, '../../../samples/lotto.aerie'), 'utf8');
const TYPO = LOTTO.replace(
  'website gets screen data from screen-api',
  'website gets screen data from screen-apu',
);
const GOOD = 'web: Web\napi: API\nweb calls api\n';
const RENAMED = 'web: Web shop\napi: API\nweb calls api\n';
const BROKEN = 'web: Web\napi: API\nweb calls apu\n';

/** A clock the test moves by hand. */
function fakeClock(): Clock & { now: number; tick: (ms: number) => void; waiting: () => number } {
  let next = 1;
  const timers = new Map<number, { at: number; run: () => void }>();
  const clock = {
    now: 0,
    set: (run: () => void, ms: number): number => {
      timers.set(next, { at: clock.now + ms, run });
      return next++;
    },
    clear: (handle: unknown): void => {
      timers.delete(handle as number);
    },
    tick: (ms: number): void => {
      clock.now += ms;
      for (const [handle, timer] of [...timers].sort(([, a], [, b]) => a.at - b.at)) {
        if (timer.at > clock.now) continue;
        timers.delete(handle);
        timer.run();
      }
    },
    waiting: (): number => timers.size,
  };
  return clock;
}

function live(): { live: Live; clock: ReturnType<typeof fakeClock>; seen: Checked[] } {
  const clock = fakeClock();
  const seen: Checked[] = [];
  return {
    live: new Live(
      (checked) => {
        seen.push(checked);
      },
      { clock },
    ),
    clock,
    seen,
  };
}

describe('waiting for the author to stop typing', () => {
  it('INT-805 the text is checked 250 ms after the last change, not before', () => {
    const { live: checker, clock, seen } = live();
    expect(CHECK_DELAY).toBe(250);
    checker.edit(GOOD);
    clock.tick(249);
    expect(seen).toEqual([]);
    expect(checker.pending).toBe(true);
    clock.tick(1);
    expect(seen.map((each) => each.source)).toEqual([GOOD]);
    expect(checker.pending).toBe(false);
  });

  it('INT-805 each keystroke starts the wait again, and only the last text is checked', () => {
    const { live: checker, clock, seen } = live();
    checker.edit('w');
    clock.tick(200);
    checker.edit('we');
    clock.tick(200);
    checker.edit(GOOD);
    clock.tick(249);
    expect(seen).toEqual([]);
    clock.tick(1);
    expect(seen.map((each) => each.source)).toEqual([GOOD]);
    expect(clock.waiting()).toBe(0);
  });

  it('INT-805 a change undone before its check changes nothing', () => {
    const { live: checker, clock, seen } = live();
    checker.edit(GOOD);
    clock.tick(250);
    checker.edit(RENAMED);
    clock.tick(100);
    checker.edit(GOOD);
    clock.tick(250);
    expect(seen.map((each) => each.source)).toEqual([GOOD]);
  });

  it('INT-805 flush checks a waiting change at once; cancel drops it', () => {
    const { live: checker, clock, seen } = live();
    checker.edit(GOOD);
    checker.flush();
    expect(seen.map((each) => each.source)).toEqual([GOOD]);
    checker.edit(RENAMED);
    checker.cancel();
    clock.tick(1000);
    expect(seen).toHaveLength(1);
    checker.flush();
    expect(seen).toHaveLength(1);
  });

  it('INT-805 now checks at once and always reports, dropping a waiting change', () => {
    const { live: checker, clock, seen } = live();
    checker.edit(BROKEN);
    checker.now(GOOD);
    checker.now(GOOD);
    clock.tick(1000);
    expect(seen.map((each) => each.source)).toEqual([GOOD, GOOD]);
  });
});

describe('keeping the last version without errors', () => {
  it('INT-805 text without errors has a model, and is the version shown', () => {
    const { live: checker, seen } = live();
    checker.now(GOOD);
    const [checked] = seen;
    expect(checked?.model?.elements.map((each) => each.id)).toEqual(['web', 'api']);
    expect(checked?.shown?.source).toBe(GOOD);
    expect(checker.shown?.model).toBe(checked?.model);
  });

  it('INT-806 with errors there is no model, and the shown version stays the last one without errors', () => {
    const { live: checker, clock, seen } = live();
    checker.now(GOOD);
    checker.edit(BROKEN);
    clock.tick(250);
    const checked = seen[1];
    expect(checked?.model).toBeNull();
    expect(checked?.shown?.source).toBe(GOOD);
    expect(checked?.diagnostics.map((each) => each.id)).toEqual(['E008']);
    checker.edit(RENAMED);
    clock.tick(250);
    expect(seen[2]?.shown?.source).toBe(RENAMED);
  });

  it('INT-806 with errors and nothing earlier, there is no version to show (INT-003)', () => {
    const { live: checker, seen } = live();
    checker.now(BROKEN);
    expect(seen[0]?.model).toBeNull();
    expect(seen[0]?.shown).toBeNull();
  });

  it('INT-806 warnings never stop the diagram from updating', () => {
    const { live: checker, seen } = live();
    checker.now(LOTTO);
    expect(seen[0]?.diagnostics.map((each) => each.id)).toEqual(['W601']);
    expect(seen[0]?.model).not.toBeNull();
    expect(seen[0]?.shown?.source).toBe(LOTTO);
  });

  it('INT-806 a check made elsewhere seeds the shown version and the last text', () => {
    const { live: checker, clock, seen } = live();
    const { live: other, seen: elsewhere } = live();
    other.now(GOOD);
    const first = elsewhere[0];
    if (first === undefined) throw new Error('no check');
    checker.seed(first);
    expect(checker.shown?.source).toBe(GOOD);
    checker.edit(GOOD);
    clock.tick(250);
    expect(seen).toEqual([]);
    checker.edit(BROKEN);
    clock.tick(250);
    expect(seen[0]?.shown?.source).toBe(GOOD);
  });
});

describe('the error list', () => {
  const at = (id: string, severity: 'error' | 'warning', line: number): Diagnostic => ({
    id: id as Diagnostic['id'],
    severity,
    message: `${id} message.`,
    line,
    column: 1,
    endLine: line,
    endColumn: 2,
  });

  it('INT-806 each entry reads "Line 12, column 5: " and the catalogue message', () => {
    const { live: checker, seen } = live();
    checker.now(TYPO);
    const [first] = errorList(seen[0]?.diagnostics ?? []);
    expect(first === undefined ? '' : errorText(first)).toBe(
      'Line 168, column 31: There is no element called `screen-apu`. Did you mean `screen-api`?',
    );
  });

  it('INT-806 errors come before warnings, each in the order the checker found them', () => {
    const list = [at('W601', 'warning', 1), at('E008', 'error', 5), at('E002', 'error', 9)];
    expect(errorList(list).map((each) => each.id)).toEqual(['E008', 'E002', 'W601']);
    const { live: checker, seen } = live();
    checker.now(TYPO);
    expect(
      errorList(seen[0]?.diagnostics ?? []).map((each) => `${each.id}@${String(each.line)}`),
    ).toEqual(['E008@168', 'W601@230', 'W601@264', 'W601@281']);
  });

  it('INT-806 the stage says it shows an earlier version', () => {
    expect(KEPT_NOTICE).toBe('Showing the last version without errors');
  });
});
