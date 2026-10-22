// Live checking for the split editor and watch mode (docs/spec/interaction.md, INT-805, INT-806 and
// INT-852): the text is checked a moment after the author stops typing, and the diagram keeps the
// last version without errors while the text has errors. Pure logic, with the clock passed in.
import type { Diagnostic, Model } from '../lines/index.ts';
import { check } from '../model/index.ts';

/** INT-805: how long after the last keystroke the text is checked. */
export const CHECK_DELAY = 250;

/** A version of the text that has a model: no errors, perhaps warnings. */
export interface Version {
  source: string;
  model: Model;
}

/** The result of one check. */
export interface Checked {
  source: string;
  /** Every diagnostic, in the checker's order (LANG-902). */
  diagnostics: Diagnostic[];
  /** This text's model, or null when it has errors (LANG-808). */
  model: Model | null;
  /** The last version without errors: this one when it has none, else an earlier one or null. */
  shown: Version | null;
}

/** The clock: `setTimeout` and `clearTimeout` in the page, a fake one in tests. */
export interface Clock {
  set: (run: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const realClock: Clock = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

/** Checks text as it changes and keeps the last version without errors. */
export class Live {
  private readonly report: (checked: Checked) => void;
  private readonly delay: number;
  private readonly clock: Clock;
  private timer: unknown = null;
  private waiting: string | null = null;
  private last: string | null = null;
  private good: Version | null = null;

  constructor(
    report: (checked: Checked) => void,
    options: { delay?: number; clock?: Clock; shown?: Version | null } = {},
  ) {
    this.report = report;
    this.delay = options.delay ?? CHECK_DELAY;
    this.clock = options.clock ?? realClock;
    this.good = options.shown ?? null;
  }

  /** The last version without errors, which the diagram shows. */
  get shown(): Version | null {
    return this.good;
  }

  /** True while an edit waits for its check. */
  get pending(): boolean {
    return this.timer !== null;
  }

  /** The text changed: check it once the author has stopped typing for the delay (INT-805). */
  edit(source: string): void {
    this.cancel();
    this.waiting = source;
    this.timer = this.clock.set(() => {
      this.timer = null;
      this.waiting = null;
      this.run(source);
    }, this.delay);
  }

  /** Checks a waiting edit now, if there is one. */
  flush(): void {
    const source = this.waiting;
    this.cancel();
    if (source !== null) this.run(source);
  }

  /**
   * Checks text now and always reports it, dropping any waiting edit: a saved file (INT-852), a
   * formatted text (INT-807) or a discarded copy (INT-808).
   */
  now(source: string): void {
    this.cancel();
    this.last = null;
    this.run(source);
  }

  /** Takes a check made elsewhere, such as the page opening the model, as the latest one. */
  seed(checked: Checked): void {
    this.cancel();
    this.last = checked.source;
    if (checked.model !== null) this.good = { source: checked.source, model: checked.model };
  }

  /** Drops a waiting edit without checking it. */
  cancel(): void {
    if (this.timer !== null) this.clock.clear(this.timer);
    this.timer = null;
    this.waiting = null;
  }

  private run(source: string): void {
    // The same text again (an edit undone before its check) changes nothing.
    if (source === this.last) return;
    this.last = source;
    const result = check(source);
    if (result.model !== null) this.good = { source, model: result.model };
    this.report({
      source,
      diagnostics: result.diagnostics,
      model: result.model,
      shown: this.good,
    });
  }
}

/** INT-806: one entry of the error list, as in "Line 12, column 5: " and the message. */
export function errorText(found: Diagnostic): string {
  return `Line ${String(found.line)}, column ${String(found.column)}: ${found.message}`;
}

/** INT-806: the error list's order: errors before warnings, each in the checker's order. */
export function errorList(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return [
    ...diagnostics.filter((found) => found.severity === 'error'),
    ...diagnostics.filter((found) => found.severity !== 'error'),
  ];
}

/** INT-806: the words at the top of the stage while the diagram is an earlier version. */
export const KEPT_NOTICE = 'Showing the last version without errors';
