// The picture (docs/spec/model.md, MODEL-601 to MODEL-604).
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ZOOM,
  closeContainer,
  defaultPicture,
  normalisePicture,
  openContainer,
  play,
  present,
  reveal,
  select,
  stop,
  type Picture,
} from '../../../src/model/index.ts';
import { LOTTO, entries, semanticsOf, zoom } from './helpers.ts';

const START = defaultPicture(LOTTO);
const on = (view: string, changes: Partial<Picture> = {}): Picture => ({
  ...START,
  view,
  ...changes,
});

describe('the picture', () => {
  it('MODEL-601 holds a view, an audience, a zoom state and at most one activity', () => {
    expect(Object.keys(START)).toEqual(['view', 'audience', 'zoom', 'activity']);
    const selected = select(LOTTO, START, 'website');
    expect(selected.activity).toEqual({ kind: 'selected', element: 'website' });
    const playing = play(LOTTO, selected, 'generate-picks');
    expect(playing.activity).toEqual({
      kind: 'playing',
      scenario: 'generate-picks',
      step: 1,
      lanes: false,
    });
    const presenting = present(LOTTO, playing, 'tour');
    expect(presenting.activity).toEqual({
      kind: 'presenting',
      walkthrough: 'tour',
      step: 1,
      scenarioStep: null,
    });
    expect(stop(LOTTO, presenting).activity).toEqual({ kind: 'reading' });
  });

  it('MODEL-602 starts on the first view, the default audience, nothing open or selected', () => {
    expect({ ...START, zoom: entries(START.zoom) }).toEqual({
      view: 'big-picture',
      audience: 'manager',
      zoom: [],
      activity: { kind: 'reading' },
    });
    expect(defaultPicture(semanticsOf('web: Web\n')).view).toBe('overview');
  });

  it('MODEL-603 normalises the zoom state and replaces a hidden selection with its lift', () => {
    const { picture, dropped } = normalisePicture(
      LOTTO,
      on('services', {
        zoom: zoom({ engine: 'open', 'engine-service': 'open' }),
        activity: { kind: 'selected', element: 'request-handling' },
      }),
    );
    expect(entries(picture.zoom)).toEqual([['engine-service', 'open']]);
    expect(picture.activity).toEqual({ kind: 'selected', element: 'request-handling' });
    expect(dropped).toEqual([]);
    const lifted = normalisePicture(
      LOTTO,
      on('services', { activity: { kind: 'selected', element: 'request-handling' } }),
    );
    expect(lifted.picture.activity).toEqual({ kind: 'selected', element: 'engine-service' });
    // INT-203: closing a container around the selection moves the selection to it.
    const closed = closeContainer(LOTTO, picture, 'engine');
    expect(closed.activity).toEqual({ kind: 'selected', element: 'engine' });
    expect(entries(closed.zoom)).toEqual([['engine', 'closed']]);
    expect(openContainer(LOTTO, closed, 'engine').activity).toEqual({
      kind: 'selected',
      element: 'engine',
    });
  });

  it('MODEL-603 clamps step numbers to the nearest valid one', () => {
    const playing = (step: number): Picture =>
      on('big-picture', {
        activity: { kind: 'playing', scenario: 'generate-picks', step, lanes: true },
      });
    const stepOf = (picture: Picture): unknown => normalisePicture(LOTTO, picture).picture.activity;
    expect(stepOf(playing(99))).toMatchObject({ step: 14, lanes: true });
    expect(stepOf(playing(0))).toMatchObject({ step: 1 });
    expect(stepOf(playing(Number.NaN))).toMatchObject({ step: 1 });
    const presenting = (step: number, scenarioStep: number | null): Picture =>
      on('engineering', {
        activity: { kind: 'presenting', walkthrough: 'tour', step, scenarioStep },
      });
    expect(stepOf(presenting(20, null))).toMatchObject({ step: 8, scenarioStep: null });
    expect(stepOf(presenting(7, 40))).toMatchObject({ step: 7, scenarioStep: 14 });
    expect(stepOf(presenting(7, null))).toMatchObject({ step: 7, scenarioStep: 1 });
    expect(stepOf(presenting(3, 9))).toMatchObject({ step: 3, scenarioStep: null });
    // A presented walkthrough decides the view and zoom state (MODEL-501).
    const fourth = normalisePicture(LOTTO, presenting(4, null)).picture;
    expect([fourth.view, entries(fourth.zoom)]).toEqual(['services', [['engine-service', 'open']]]);
    // A playing scenario moves to its stage view with an empty zoom state (MODEL-404).
    const staged = normalisePicture(
      LOTTO,
      on('engineering', {
        zoom: zoom({ 'engine-service': 'open' }),
        activity: { kind: 'playing', scenario: 'generate-picks', step: 3, lanes: false },
      }),
    ).picture;
    expect([staged.view, entries(staged.zoom)]).toEqual(['big-picture', []]);
  });

  it('MODEL-603 drops whatever names an id the model does not have, and says so', () => {
    const { picture, dropped } = normalisePicture(LOTTO, {
      view: 'old-view',
      audience: 'board',
      zoom: zoom({ gone: 'open' }),
      activity: { kind: 'selected', element: 'nothing-here' },
    });
    expect({ ...picture, zoom: entries(picture.zoom) }).toEqual({
      view: 'big-picture',
      audience: 'manager',
      zoom: [],
      activity: { kind: 'reading' },
    });
    expect(dropped).toEqual([
      { part: 'view', id: 'old-view' },
      { part: 'audience', id: 'board' },
      { part: 'zoom', id: 'gone' },
      { part: 'selection', id: 'nothing-here' },
    ]);
    const lost = (activity: Picture['activity']): unknown =>
      normalisePicture(LOTTO, on('services', { activity })).dropped;
    expect(lost({ kind: 'playing', scenario: 'gone', step: 1, lanes: false })).toEqual([
      { part: 'scenario', id: 'gone' },
    ]);
    expect(lost({ kind: 'presenting', walkthrough: 'gone', step: 1, scenarioStep: null })).toEqual([
      { part: 'walkthrough', id: 'gone' },
    ]);
    // An element the view can never draw cannot stay selected.
    expect(
      normalisePicture(
        LOTTO,
        on('engineering', { activity: { kind: 'selected', element: 'user' } }),
      ).dropped,
    ).toEqual([{ part: 'selection', id: 'user' }]);
    // Changes that name unknown ids drop them instead of failing.
    expect(select(LOTTO, START, 'nothing-here')).toEqual(START);
    expect(reveal(LOTTO, START, 'nothing-here')).toEqual(START);
    expect(present(LOTTO, START, 'nothing-here')).toEqual(START);
    const fallback = openContainer(LOTTO, on('old-view'), 'engine');
    expect([fallback.view, entries(fallback.zoom)]).toEqual(['big-picture', [['engine', 'open']]]);
    // A normalised picture normalises to itself.
    const again = normalisePicture(LOTTO, picture);
    expect(again.picture).toEqual(picture);
    expect(again.dropped).toEqual([]);
  });

  it('MODEL-604 starting a scenario or a walkthrough clears the selection', () => {
    const selected = select(LOTTO, on('services'), 'pick-generation');
    expect(selected.activity).toEqual({ kind: 'selected', element: 'pick-generation' });
    // Selecting revealed it (MODEL-207).
    expect(entries(selected.zoom)).toEqual([['engine-service', 'open']]);
    expect(play(LOTTO, selected, 'generate-picks').activity.kind).toBe('playing');
    expect(present(LOTTO, selected, 'tour').activity.kind).toBe('presenting');
    // While playing, clicking does not select (INT-201).
    const playing = play(LOTTO, selected, 'generate-picks');
    expect(select(LOTTO, playing, 'website')).toBe(playing);
    expect(select(LOTTO, selected, null).activity).toEqual({ kind: 'reading' });
    expect(entries(play(LOTTO, START, 'results-poll').zoom)).toEqual(entries(DEFAULT_ZOOM));
  });
});
