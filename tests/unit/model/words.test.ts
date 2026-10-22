// Audience resolution (docs/spec/model.md, MODEL-101 to MODEL-106).
import { describe, expect, it } from 'vitest';
import {
  defaultPicture,
  normalisePicture,
  proseFor,
  sentence,
  wordsFor,
} from '../../../src/model/index.ts';
import { LOTTO, semanticsOf } from './helpers.ts';

const AUDIENCES = ['exec', 'manager', 'engineer'];

describe('wording for an audience', () => {
  it('MODEL-101 reads an audience replacement, else the unmarked wording, which may be null', () => {
    const words = { base: 'Analysis engine', set: { exec: 'Number engine' } };
    expect(wordsFor(words, 'exec')).toBe('Number engine');
    expect(wordsFor(words, 'manager')).toBe('Analysis engine');
    expect(wordsFor({ base: null, set: { engineer: 'x' } }, 'manager')).toBeNull();
    expect(AUDIENCES.map((a) => LOTTO.name('engine', a))).toEqual([
      'Number engine',
      'Analysis engine',
      'Analysis engine',
    ]);
    expect(AUDIENCES.map((a) => LOTTO.tagline('engine', a))).toEqual([
      'Turns past draws into suggested picks',
      'Generates and scores picks',
      'lotto-options-core-server :8002',
    ]);
  });

  it('MODEL-102 replaces the description, then adds paragraphs after a blank line', () => {
    const prose = { base: 'One.', set: { exec: 'Short.' }, add: { engineer: 'More.' } };
    expect(proseFor(prose, 'exec')).toBe('Short.');
    expect(proseFor(prose, 'manager')).toBe('One.');
    expect(proseFor(prose, 'engineer')).toBe('One.\n\nMore.');
    expect(proseFor({ base: null, set: {}, add: { engineer: 'Only.' } }, 'engineer')).toBe('Only.');
    expect(proseFor({ base: null, set: {}, add: {} }, 'engineer')).toBeNull();
    expect(LOTTO.about('engine', 'exec')).toBe(
      'Where the value is: it studies every past draw and suggests numbers to play.',
    );
    expect(LOTTO.about('engine', 'engineer')).toMatch(
      /^The brains of the suite: .*\n\nSpring Boot on port 8002/s,
    );
  });

  it('MODEL-103 has no fallback between audiences and no inheritance from a container', () => {
    const semantics = semanticsOf(
      [
        'audiences board, product (default), dev, ops',
        'outer: Outer | Holds things',
        '  @dev: Outer box | Dev wording',
        '  > Plain.',
        '  @ops >> Ops note.',
        '  inner: Inner',
      ].join('\n') + '\n',
    );
    // ops reads no `dev` wording, whatever the order of the audiences.
    expect(semantics.name('outer', 'ops')).toBe('Outer');
    expect(semantics.tagline('outer', 'ops')).toBe('Holds things');
    expect(semantics.about('outer', 'dev')).toBe('Plain.');
    expect(semantics.about('outer', 'ops')).toBe('Plain.\n\nOps note.');
    // A child never takes its container's wording.
    expect(semantics.tagline('inner', 'dev')).toBeNull();
    expect(semantics.about('inner', 'ops')).toBeNull();
    // Ids that are names of object properties still resolve as audiences only when declared.
    expect(wordsFor({ base: 'x', set: {} }, 'constructor')).toBe('x');
    expect(proseFor({ base: 'x', set: {}, add: {} }, 'toString')).toBe('x');
  });

  it('MODEL-104 makes a sentence of subject, verb phrase and object, ended with a full stop', () => {
    expect(sentence('Website', 'gets screen data from', 'Screen API')).toBe(
      'Website gets screen data from Screen API.',
    );
    const index = LOTTO.model.relationships.findIndex(
      (relationship) => relationship.subject === 'website',
    );
    expect(AUDIENCES.map((a) => LOTTO.sentence(index, a))).toEqual([
      'Website works through Website back end.',
      'Website gets screen data from Screen API.',
      'Website calls /ui/* on Screen API.',
    ]);
    const step = LOTTO.steps('generate-picks', 'engineer')[1];
    expect(step?.sentence).toBe(
      'Website POSTs /ui/dashboard/{state}/{game}/generate to Screen API.',
    );
  });

  it('MODEL-105 marks the audiences that read taglines, verbs and descriptions in monospace', () => {
    const scenes = LOTTO.model.audiences.map((a) =>
      LOTTO.scene(LOTTO.drawing('big-picture'), a.id),
    );
    expect(scenes.map((scene) => [scene.audience.id, scene.audience.code])).toEqual([
      ['exec', false],
      ['manager', false],
      ['engineer', true],
    ]);
    const custom = semanticsOf('audiences dev (code), ops (code), board\nweb: Web\n');
    expect(custom.model.audiences.map((a) => custom.audience(a.id).code)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('MODEL-106 starts the reader on the default audience unless a link names another', () => {
    expect(defaultPicture(LOTTO).audience).toBe('manager');
    expect(defaultPicture(semanticsOf('audiences board, dev\nweb: Web\n')).audience).toBe('board');
    const linked = normalisePicture(LOTTO, { ...defaultPicture(LOTTO), audience: 'engineer' });
    expect(linked.picture.audience).toBe('engineer');
  });
});
