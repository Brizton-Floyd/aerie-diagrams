// Scenarios (docs/spec/model.md, MODEL-401 to MODEL-406), with the worked example's scenario facts.
import { describe, expect, it } from 'vitest';
import { parse } from '../../../src/lines/index.ts';
import { DEFAULT_ZOOM, check, participants, type TrailStep } from '../../../src/model/index.ts';
import { LOTTO, read, semanticsOf } from './helpers.ts';

/** Trail steps written short: `4@engine` for a loop, `6:engine>store` for a line. */
const short = (steps: TrailStep[]): string[] =>
  steps.map((step) =>
    step.kind === 'loop'
      ? `${String(step.number)}@${step.on}`
      : `${String(step.number)}:${step.from}>${step.to}`,
  );

const numbers = (scenario: string, test: (role: string, backed: boolean) => boolean): number[] =>
  LOTTO.steps(scenario, 'manager')
    .filter((step) => test(step.role, step.backed))
    .map((step) => step.number);

describe('scenarios', () => {
  it('MODEL-401 recognises replies from the model: only the opposite relationship exists', () => {
    expect(LOTTO.steps('generate-picks', 'manager')).toHaveLength(14);
    expect(numbers('generate-picks', (role) => role === 'reply')).toEqual([
      7, 8, 10, 11, 12, 13, 14,
    ]);
    expect(numbers('results-poll', (role) => role === 'reply')).toEqual([2, 4]);
    const seventh = LOTTO.steps('generate-picks', 'manager')[6];
    expect(seventh?.sentence).toBe(
      'Draw history service returns the full history to Draw history lookup.',
    );
    // A relationship both ways makes every step between the two a call.
    const both = semanticsOf('a: A\nb: B\na asks b\nb tells a\nscenario s: S\n  b answers a\n');
    expect(both.steps('s', 'manager')[0]?.role).toBe('call');
    // Any kind counts, but only between exactly these two elements.
    const kinds = semanticsOf(
      'a: A\n  a1: A1\nb: B\nb uses a [code]\nb calls a1\nscenario s: S\n  a returns to b\n  a1 answers b\n',
    );
    expect(kinds.steps('s', 'manager').map((step) => step.role)).toEqual(['reply', 'reply']);
    const nested = semanticsOf('a: A\n  a1: A1\nb: B\nb calls a1\nscenario s: S\n  a answers b\n');
    expect(nested.steps('s', 'manager')[0]?.role).toBe('call');
  });

  it('MODEL-402 marks a step no relationship backs, which gets W601', () => {
    expect(numbers('results-poll', (_role, backed) => !backed)).toEqual([5]);
    expect(numbers('generate-picks', (_role, backed) => !backed)).toEqual([]);
    const result = parse(read('docs/spec/examples/lotto.aerie'));
    expect(result.diagnostics.map((found) => [found.id, found.line])).toEqual([['W601', 281]]);
  });

  it('MODEL-403 lists the participants: the elements the steps name, in order', () => {
    expect(participants(LOTTO.scenario('results-poll'))).toEqual([
      'updater',
      'texas',
      'reader',
      'saved-draws',
      'history-service',
    ]);
  });

  it('MODEL-404 plays on the current view if it can, otherwise the first view that can', () => {
    // The user has no lift in Engineering; the Big picture is the first view with every one.
    expect(LOTTO.stage('generate-picks', 'engineering')).toBe('big-picture');
    expect(LOTTO.stage('generate-picks', 'services')).toBe('services');
    expect(LOTTO.stage('generate-picks', null)).toBe('big-picture');
    expect(LOTTO.stage('results-poll', 'engineering')).toBe('big-picture');
  });

  it('MODEL-405 draws a step between lifts, folded onto the inner one when they meet', () => {
    const steps = LOTTO.trail('generate-picks', 'big-picture', DEFAULT_ZOOM, 14).steps;
    expect(steps.filter((step) => step.kind === 'loop').map((step) => step.number)).toEqual([
      4, 5, 8, 9, 10, 11,
    ]);
    expect(short(steps).slice(3, 7)).toEqual([
      '4@engine',
      '5@engine',
      '6:engine>store',
      '7:store>engine',
    ]);
    expect(steps.map((step) => step.role)).toEqual(
      LOTTO.steps('generate-picks', 'manager').map((step) => step.role),
    );
  });

  it('MODEL-405 lifts again when the reader opens or closes something during playback', () => {
    const scope = LOTTO.scope('big-picture');
    const open = scope.open(DEFAULT_ZOOM, 'engine');
    expect(short(LOTTO.trail('generate-picks', 'big-picture', open, 6).steps)).toEqual([
      '1:user>website',
      '2:website>screen-api',
      '3:screen-api>engine-service',
      '4@engine-service',
      '5@engine-service',
      '6:engine-service>store',
    ]);
    const closed = scope.close(DEFAULT_ZOOM, 'suite');
    expect(short(LOTTO.trail('generate-picks', 'big-picture', closed, 3).steps)).toEqual([
      '1:user>suite',
      '2@suite',
      '3@suite',
    ]);
    // A step between a container and its own child folds onto the child while both are drawn.
    const semantics = semanticsOf('p: P\n  q: Q\nr: R\nr uses q\nscenario s: S\n  p checks q\n');
    const opened = semantics.scope('overview').open(DEFAULT_ZOOM, 'p');
    expect(short(semantics.trail('s', 'overview', opened, 1).steps)).toEqual(['1@q']);
    expect(short(semantics.trail('s', 'overview', DEFAULT_ZOOM, 1).steps)).toEqual(['1@p']);
  });

  it('MODEL-406 marks the lifts of steps 1 to k as visited and step k as current', () => {
    const at = LOTTO.trail('generate-picks', 'big-picture', DEFAULT_ZOOM, 3);
    expect(at.visited).toEqual(['user', 'website', 'screen-api', 'engine']);
    expect(at.current).toEqual(['screen-api', 'engine']);
    const folded = LOTTO.trail('generate-picks', 'big-picture', DEFAULT_ZOOM, 4);
    expect(folded.current).toEqual(['engine']);
    expect(LOTTO.trail('generate-picks', 'big-picture', DEFAULT_ZOOM, 0)).toEqual({
      steps: [],
      visited: [],
      current: [],
    });
  });

  it('MODEL-404 a scenario no view can hold is E604, at the scenario id', () => {
    const source = [
      'a: A',
      'b: B',
      'outer: Outer',
      '  c: C',
      'a calls b',
      'b calls c',
      'view v: V',
      '  show a, b',
      'scenario flow: Flow',
      '  a calls b',
      '  b calls c',
    ].join('\n');
    const result = check(source + '\n');
    expect(result.model).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        id: 'E604',
        severity: 'error',
        line: 9,
        column: 10,
        endLine: 9,
        endColumn: 14,
        message:
          "No view can show every step of `flow`, because none shows `c` or anything around it. Add `outer` to a view's `show` line.",
      },
    ]);
  });

  it('MODEL-404 E604 names a participant missing from the fullest view when each fits some view', () => {
    const source = [
      'a: A',
      'b: B',
      'c: C',
      'a calls b',
      'b calls c',
      'view one: One',
      '  show c',
      'view two: Two',
      '  show a, b',
      'scenario flow: Flow',
      '  a calls b',
      '  b calls c',
      '',
    ].join('\n');
    expect(check(source).diagnostics.map((found) => found.message)).toEqual([
      "No view can show every step of `flow`, because none shows `c` or anything around it. Add `c` to a view's `show` line.",
    ]);
  });
});
