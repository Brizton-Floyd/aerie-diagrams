// Walkthroughs (docs/spec/model.md, MODEL-501 to MODEL-506), with the worked example's `tour`.
import { describe, expect, it } from 'vitest';
import {
  check,
  defaultPicture,
  present,
  presentBack,
  presentForward,
  presentStep,
  switchAudience,
  type Picture,
  type Semantics,
  type WalkPicture,
} from '../../../src/model/index.ts';
import { LOTTO, entries, read, semanticsOf } from './helpers.ts';

/** A walkthrough picture as plain data, with the zoom state as a list. */
const plain = (picture: WalkPicture | undefined): unknown =>
  picture === undefined ? undefined : { ...picture, zoom: entries(picture.zoom) };

const SMALL = semanticsOf(
  [
    'a: A',
    '  a1: A1',
    '    a2: A2',
    'b: B',
    '  b1: B1',
    'a1 calls b1',
    'view v: V',
    '  show a, b',
    'view w: W',
    '  show a +1',
    'scenario s: S',
    '  a1 calls b1',
    '  b1 answers a1',
    'walkthrough t: T',
    '  step v: a',
    '    > Start here.',
    '    @engineer >> Detail.',
    '  step v: a1',
    '    open a',
    '  step v: a2',
    '    open a1',
    '  step v',
    '    close a',
    '  step w',
    '    for engineer',
    '  step s: 2',
    '  step v',
    '    open a',
    '    close a',
    '',
  ].join('\n'),
);

describe('walkthrough pictures', () => {
  it('MODEL-501 works out step k from the first view by applying steps 1 to k', () => {
    expect(SMALL.walkPictures('t').map(plain)).toEqual([
      { view: 'v', zoom: [], focus: ['a'], scenario: null, audience: null },
      { view: 'v', zoom: [['a', 'open']], focus: ['a1'], scenario: null, audience: null },
      {
        view: 'v',
        zoom: [
          ['a', 'open'],
          ['a1', 'open'],
        ],
        focus: ['a2'],
        scenario: null,
        audience: null,
      },
      { view: 'v', zoom: [], focus: [], scenario: null, audience: null },
      { view: 'w', zoom: [], focus: [], scenario: null, audience: 'engineer' },
      { view: 'v', zoom: [], focus: [], scenario: { id: 's', from: 2, to: 2 }, audience: null },
      { view: 'v', zoom: [['a', 'open']], focus: [], scenario: null, audience: null },
    ]);
  });

  it('MODEL-502 a view step keeps the zoom state on the same view, then closes and opens', () => {
    const pictures = SMALL.walkPictures('t');
    // Step 3 stays on v, so a stays open; step 7 closes a, then opens it.
    expect(entries(pictures[2]?.zoom ?? new Map())).toContainEqual(['a', 'open']);
    expect(entries(pictures[6]?.zoom ?? new Map())).toEqual([['a', 'open']]);
  });

  it('MODEL-503 a scenario step plays its range on its stage view, with no focus', () => {
    // From w, which cannot hold b1, the scenario moves to v with an empty zoom state.
    expect(plain(SMALL.walkPictures('t')[5])).toEqual({
      view: 'v',
      zoom: [],
      focus: [],
      scenario: { id: 's', from: 2, to: 2 },
      audience: null,
    });
  });

  it('MODEL-501 the tour of the worked example', () => {
    expect(LOTTO.walkPictures('tour').map(plain)).toEqual([
      { view: 'big-picture', zoom: [], focus: ['website'], scenario: null, audience: null },
      { view: 'big-picture', zoom: [], focus: ['screen-api'], scenario: null, audience: null },
      { view: 'big-picture', zoom: [], focus: ['engine'], scenario: null, audience: null },
      {
        view: 'services',
        zoom: [['engine-service', 'open']],
        focus: ['pick-generation'],
        scenario: null,
        audience: null,
      },
      { view: 'big-picture', zoom: [], focus: ['store'], scenario: null, audience: null },
      { view: 'services', zoom: [], focus: ['store'], scenario: null, audience: null },
      {
        view: 'services',
        zoom: [],
        focus: [],
        scenario: { id: 'generate-picks', from: 1, to: 14 },
        audience: null,
      },
      { view: 'big-picture', zoom: [], focus: [], scenario: null, audience: null },
    ]);
  });
});

/** Where a presentation is, written short: `step` or `step.scenarioStep`, and the audience. */
function at(picture: Picture): string {
  const activity = picture.activity;
  if (activity.kind !== 'presenting') return activity.kind;
  const inner = activity.scenarioStep === null ? '' : `.${String(activity.scenarioStep)}`;
  return `${String(activity.step)}${inner} ${picture.audience}`;
}

function walk(semantics: Semantics, start: Picture, moves: string): string[] {
  const seen = [at(start)];
  let picture = start;
  for (const move of moves) {
    picture = move === '>' ? presentForward(semantics, picture) : presentBack(semantics, picture);
    seen.push(at(picture));
  }
  return seen;
}

describe('presenting', () => {
  it('MODEL-504 moves through a scenario step range, then on to the next walkthrough step', () => {
    const start = presentStep(LOTTO, present(LOTTO, defaultPicture(LOTTO), 'tour'), 6);
    const forward = walk(LOTTO, start, '>'.repeat(16));
    expect(forward.slice(0, 3)).toEqual(['6 manager', '7.1 manager', '7.2 manager']);
    expect(forward.slice(-3)).toEqual(['7.14 manager', '8 manager', '8 manager']);
    const back = walk(LOTTO, presentStep(LOTTO, start, 8), '<<<');
    expect(back).toEqual(['8 manager', '7.14 manager', '7.13 manager', '7.12 manager']);
    expect(walk(LOTTO, presentStep(LOTTO, start, 7), '<')).toEqual(['7.1 manager', '6 manager']);
    // On the first step, back does nothing.
    expect(walk(LOTTO, present(LOTTO, defaultPicture(LOTTO), 'tour'), '<')).toEqual([
      '1 manager',
      '1 manager',
    ]);
    // A range plays only its own steps.
    expect(
      walk(SMALL, presentStep(SMALL, present(SMALL, defaultPicture(SMALL), 't'), 5), '>>><'),
    ).toEqual(['5 engineer', '6.2 engineer', '7 engineer', '7 engineer', '6.2 engineer']);
  });

  it('MODEL-505 changes the audience only on entering a step with `for`, either way', () => {
    let picture = present(SMALL, defaultPicture(SMALL), 't');
    expect(at(picture)).toBe('1 manager');
    picture = presentStep(SMALL, picture, 4);
    expect(at(picture)).toBe('4 manager');
    picture = presentForward(SMALL, picture);
    expect(at(picture)).toBe('5 engineer');
    picture = switchAudience(SMALL, picture, 'exec');
    picture = presentForward(SMALL, picture);
    expect(at(picture)).toBe('6.2 exec');
    picture = presentBack(SMALL, picture);
    expect(at(picture)).toBe('5 engineer');
    picture = presentBack(SMALL, picture);
    expect(at(picture)).toBe('4 engineer');
  });

  it('MODEL-506 narrates each step in the current audience', () => {
    expect(SMALL.narration('t', 1, 'manager')).toBe('Start here.');
    expect(SMALL.narration('t', 1, 'engineer')).toBe('Start here.\n\nDetail.');
    expect(SMALL.narration('t', 2, 'manager')).toBeNull();
    expect(LOTTO.narration('tour', 3, 'exec')).toBe(
      'The **engine** is where the value is: it turns past draws into suggested picks.',
    );
  });

  it('MODEL-506 a focus element not drawn in the step picture is E703, at the id', () => {
    const source = [
      'box: Box',
      '  inner: Inner',
      '    x: X',
      'y: Y',
      'x calls y',
      'view v: V',
      '  show box, y',
      'view only-y: Only y',
      '  show y',
      'walkthrough w: W',
      '  step v: y, x',
      '  step v: x',
      '    open box',
      '  step only-y: box',
      '',
    ].join('\n');
    const result = check(source);
    expect(result.model).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        id: 'E703',
        severity: 'error',
        line: 11,
        column: 14,
        endLine: 11,
        endColumn: 15,
        message:
          "`x` is not visible in this step's picture of `v`, so the step cannot focus on it. Open its container with `open box`, or choose a view that shows it.",
      },
      {
        id: 'E703',
        severity: 'error',
        line: 12,
        column: 11,
        endLine: 12,
        endColumn: 12,
        message:
          "`x` is not visible in this step's picture of `v`, so the step cannot focus on it. Open its container with `open inner`, or choose a view that shows it.",
      },
      {
        id: 'E703',
        severity: 'error',
        line: 14,
        column: 16,
        endLine: 14,
        endColumn: 19,
        message:
          "`box` is not visible in this step's picture of `only-y`, so the step cannot focus on it. Open its container with `open box`, or choose a view that shows it.",
      },
    ]);
    // The worked example's tour focuses only on drawn elements.
    expect(
      check(read('docs/spec/examples/lotto.aerie')).diagnostics.map((found) => found.id),
    ).toEqual(['W601']);
  });
});
