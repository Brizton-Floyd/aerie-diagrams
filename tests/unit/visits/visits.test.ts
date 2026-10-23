// The reader's visits (docs/spec/interaction.md, INT-551 to INT-556): the list in the order of
// the browser's history entries, which change of picture is a new visit, the recent visits, keeping
// them for a reload, and their names, on the Lotto worked example.
import { describe, expect, it } from 'vitest';
import { writeFragment } from '../../../src/app/link.ts';
import { TRAVEL, namesThatFit } from '../../../src/app/travel.ts';
import {
  RECENT,
  Visits,
  entryOf,
  visitKey,
  visitName,
  type CameraState,
  type Shelf,
} from '../../../src/app/visits.ts';
import {
  defaultPicture,
  openContainer,
  play,
  present,
  presentForward,
  select,
  switchAudience,
  switchView,
  type Picture,
} from '../../../src/model/index.ts';
import { LOTTO } from '../model/helpers.ts';

const START = defaultPicture(LOTTO);

/** A shelf in memory, as the tab's session storage would be. */
function shelf(): Shelf & { kept: Map<string, string> } {
  const kept = new Map<string, string>();
  return {
    kept,
    get: (key) => kept.get(key) ?? null,
    set: (key, value) => {
      kept.set(key, value);
    },
  };
}

const CAMERA: CameraState = {
  camera: { scale: 1.2, x: -340.5, y: 18, mode: 'free' },
  follow: 'engine-service',
  framing: false,
};

/** The key of a picture's visit, from the picture alone. */
const key = (picture: Picture): string => visitKey(picture, writeFragment(LOTTO, picture));

/** A run of visits with one visit per fragment given, the last one current. */
function visitsOf(...fragments: string[]): Visits {
  const [first = '', ...rest] = fragments;
  const visits = Visits.start('run', 'lotto', first);
  for (const each of rest) visits.push(each, null);
  return visits;
}

describe('INT-551 which change of picture is a new visit', () => {
  it('INT-551 selecting, opening, switching the audience or the view, and starting an activity each reach another visit', () => {
    const selected = select(LOTTO, START, 'website');
    expect(key(selected)).not.toBe(key(START));
    expect(key(select(LOTTO, selected, null))).toBe(key(START));
    expect(key(openContainer(LOTTO, START, 'engine'))).not.toBe(key(START));
    expect(key(switchAudience(LOTTO, START, 'engineer'))).not.toBe(key(START));
    expect(key(switchView(LOTTO, START, 'services'))).not.toBe(key(START));
    expect(key(play(LOTTO, START, 'generate-picks'))).not.toBe(key(START));
    expect(key(present(LOTTO, START, 'tour'))).not.toBe(key(START));
  });

  it('INT-551 a scenario at any step, lanes or audience is one visit, and so is a presented walkthrough', () => {
    const playing = play(LOTTO, START, 'generate-picks');
    if (playing.activity.kind !== 'playing') throw new Error('Not playing.');
    const later: Picture = { ...playing, activity: { ...playing.activity, step: 9, lanes: true } };
    expect(key(later)).toBe(key(playing));
    expect(key(switchAudience(LOTTO, later, 'exec'))).toBe(key(playing));
    expect(key(play(LOTTO, START, 'results-poll'))).not.toBe(key(playing));
    const presenting = present(LOTTO, START, 'tour');
    expect(key(presentForward(LOTTO, presentForward(LOTTO, presenting)))).toBe(key(presenting));
  });
});

describe('INT-552 visits in the order of the history entries', () => {
  it('INT-552 a new visit follows the current one, and going back then on forgets the ones ahead', () => {
    const visits = visitsOf('', '#sel=website', '#sel=screen-api');
    expect(visits.at).toBe(2);
    expect(visits.canBack).toBe(true);
    expect(visits.canForward).toBe(false);
    expect(visits.moveTo(0)).toBe(true);
    expect(visits.canForward).toBe(true);
    expect(visits.entry()).toEqual({ aerie: { visits: 'run', at: 0 } });
    visits.push('#open=engine', 'engine');
    expect(visits.length).toBe(2);
    expect(visits.current).toEqual({ fragment: '#open=engine', about: 'engine', camera: null });
    expect(visits.moveTo(2)).toBe(false);
    expect(visits.moveTo(-1)).toBe(false);
    expect(visits.at).toBe(1);
  });

  it('INT-552 a change within a visit replaces its picture and keeps its camera', () => {
    const visits = visitsOf('#play=generate-picks.1');
    visits.keepCamera(CAMERA);
    visits.replace('#play=generate-picks.5');
    expect(visits.current).toEqual({
      fragment: '#play=generate-picks.5',
      about: null,
      camera: CAMERA,
    });
  });

  it('INT-552 only a state Aerie wrote names a visit', () => {
    expect(entryOf({ aerie: { visits: 'run', at: 3 } })).toEqual({ visits: 'run', at: 3 });
    for (const state of [
      null,
      'run',
      {},
      { aerie: null },
      { aerie: { visits: 'run' } },
      { aerie: { visits: 3, at: 3 } },
      { aerie: { visits: 'run', at: -1 } },
      { aerie: { visits: 'run', at: 1.5 } },
    ]) {
      expect(entryOf(state)).toBeNull();
    }
  });
});

describe('INT-554 a visit keeps the camera where the reader left it', () => {
  it('INT-554 the last camera of a visit is the one kept, and the next visit starts with none', () => {
    const visits = visitsOf('');
    visits.keepCamera({ ...CAMERA, camera: { ...CAMERA.camera, x: 0 } });
    visits.keepCamera(CAMERA);
    visits.push('#sel=website', null);
    expect(visits.current.camera).toBeNull();
    visits.moveTo(0);
    expect(visits.current.camera).toEqual(CAMERA);
  });
});

describe('INT-555 the recent visits', () => {
  const places = (length: number, at: number, count = RECENT): number[] => {
    const visits = visitsOf(...Array.from({ length }, (_, i) => `#sel=v${String(i)}`));
    visits.moveTo(at);
    return visits.recent(count);
  };

  it('INT-555 names the latest five, oldest first, or five from the current one when it is further back', () => {
    expect(places(1, 0)).toEqual([0]);
    expect(places(3, 1)).toEqual([0, 1, 2]);
    expect(places(8, 7)).toEqual([3, 4, 5, 6, 7]);
    expect(places(8, 4)).toEqual([3, 4, 5, 6, 7]);
    expect(places(8, 2)).toEqual([2, 3, 4, 5, 6]);
    expect(places(8, 0)).toEqual([0, 1, 2, 3, 4]);
    expect(places(8, 7, 2)).toEqual([6, 7]);
    expect(places(8, 7, 0)).toEqual([]);
  });

  it('INT-555 names as many as fit beside the camera buttons, up to five', () => {
    const width = (names: number): number =>
      TRAVEL.kept + TRAVEL.buttons + names * TRAVEL.name + (names - 1) * TRAVEL.separator;
    expect(namesThatFit(1042)).toBe(5);
    expect(namesThatFit(width(3))).toBe(3);
    expect(namesThatFit(width(3) - 1)).toBe(2);
    expect(namesThatFit(200)).toBe(0);
  });

  it('INT-555 a visit is named by its selection, activity, the container opened, or its view, for an audience', () => {
    const named = (fragment: string, about: string | null, audience: string): string =>
      visitName(LOTTO, { fragment, about, camera: null }, audience);
    expect(named('#sel=screen-api', null, 'manager')).toBe('Screen API');
    expect(named('#sel=screen-api', null, 'exec')).toBe('Website back end');
    expect(named('#play=generate-picks.3', null, 'manager')).toBe('Generate picks');
    expect(named('#present=tour.2', null, 'manager')).toBe('A tour of the Lotto suite');
    expect(named('#open=engine', 'engine', 'exec')).toBe('Number engine');
    expect(named('#view=services', null, 'manager')).toBe('Services');
    expect(named('', null, 'manager')).toBe('Big picture');
    // A container the model no longer has leaves the view's title.
    expect(named('', 'gone', 'manager')).toBe('Big picture');
  });
});

describe('INT-556 the visits last as long as the tab', () => {
  it('INT-556 a reload finds the visits on the shelf, at the entry it reloads', () => {
    const kept = shelf();
    const visits = visitsOf('', '#sel=website', '#open=engine');
    visits.keepCamera(CAMERA);
    visits.moveTo(1);
    visits.save(kept);
    const resumed = Visits.resume(kept, 'lotto', { aerie: { visits: 'run', at: 2 } });
    expect(resumed?.at).toBe(2);
    expect(resumed?.length).toBe(3);
    expect(resumed?.current).toEqual({ fragment: '#open=engine', about: null, camera: CAMERA });
  });

  it('INT-556 another diagram, a lost run, a place past the end or a damaged shelf start afresh', () => {
    const kept = shelf();
    visitsOf('', '#sel=website').save(kept);
    const entry = { aerie: { visits: 'run', at: 1 } };
    expect(Visits.resume(kept, 'lotto', entry)).not.toBeNull();
    expect(Visits.resume(kept, 'shapes', entry)).toBeNull();
    expect(Visits.resume(kept, 'lotto', { aerie: { visits: 'other', at: 0 } })).toBeNull();
    expect(Visits.resume(kept, 'lotto', { aerie: { visits: 'run', at: 2 } })).toBeNull();
    expect(Visits.resume(kept, 'lotto', null)).toBeNull();
    for (const damaged of [
      '{',
      'null',
      '{"model":"lotto","visits":[]}',
      '{"model":"lotto","visits":[{"about":null}]}',
    ]) {
      kept.kept.set('aerie.visits.run', damaged);
      expect(Visits.resume(kept, 'lotto', entry)).toBeNull();
    }
  });

  it('INT-556 a camera the shelf holds damaged is dropped, and the visit kept', () => {
    const kept = shelf();
    kept.kept.set(
      'aerie.visits.run',
      JSON.stringify({
        model: 'lotto',
        at: 0,
        visits: [{ fragment: '', about: 7, camera: { camera: { scale: 'big' } } }],
      }),
    );
    const resumed = Visits.resume(kept, 'lotto', { aerie: { visits: 'run', at: 0 } });
    expect(resumed?.current).toEqual({ fragment: '', about: null, camera: null });
  });
});
