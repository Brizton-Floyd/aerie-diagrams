// Shared links (docs/spec/interaction.md, INT-501 to INT-505): writing the picture into the
// address's fragment and reading it back, on the Lotto worked example.
import { describe, expect, it } from 'vitest';
import { readFragment, writeFragment } from '../../../src/app/link.ts';
import {
  closeContainer,
  defaultPicture,
  normalisePicture,
  openContainer,
  play,
  present,
  presentForward,
  select,
  switchAudience,
  switchView,
  type Picture,
  type Semantics,
} from '../../../src/model/index.ts';
import { LOTTO, entries, semanticsOf, zoom } from '../model/helpers.ts';

const START = defaultPicture(LOTTO);

/** A picture as plain data, with the zoom state as a list, for comparing. */
const plain = (picture: Picture): unknown => ({ ...picture, zoom: entries(picture.zoom) });

/** Reads a fragment and expects nothing in it to be dropped. */
function reads(semantics: Semantics, fragment: string): Picture {
  const read = readFragment(semantics, fragment);
  expect(read.dropped).toEqual([]);
  return read.picture;
}

/** The fragment and the picture it reads back as, for a picture built by the reader's moves. */
function roundTrip(semantics: Semantics, picture: Picture): string {
  const fragment = writeFragment(semantics, picture);
  const back = reads(semantics, fragment);
  expect(plain(back)).toEqual(plain(normalisePicture(semantics, picture).picture));
  expect(writeFragment(semantics, back)).toBe(fragment);
  return fragment;
}

const SERVICES_OPEN = openContainer(LOTTO, switchView(LOTTO, START, 'services'), 'engine-service');

/** Moves forward through a presentation `times` times. */
function forward(semantics: Semantics, picture: Picture, times: number): Picture {
  let at = picture;
  for (let i = 0; i < times; i++) at = presentForward(semantics, at);
  return at;
}

/** A small model whose walkthrough switches the audience with `for` on its second step. */
const SMALL = semanticsOf(
  [
    'model m: M',
    'audiences exec "Executive", manager "Manager" (default), engineer "Engineer"',
    'a: A',
    '  a1: A1',
    'b: B',
    'a1 calls b',
    'view v: V',
    '  show a, b',
    'view w: W',
    '  show a +1, b',
    'walkthrough t: T',
    '  step v',
    '  step w',
    '    for engineer',
    '  step v',
    '',
  ].join('\n'),
);

describe('writing the fragment', () => {
  it('INT-501 writes view, aud, open, closed and sel in order, leaving out defaults', () => {
    const picture = select(
      LOTTO,
      switchAudience(LOTTO, SERVICES_OPEN, 'engineer'),
      'pick-generation',
    );
    expect(writeFragment(LOTTO, picture)).toBe(
      '#view=services&aud=engineer&open=engine-service&sel=pick-generation',
    );
    expect(writeFragment(LOTTO, switchAudience(LOTTO, START, 'engineer'))).toBe('#aud=engineer');
    expect(writeFragment(LOTTO, switchView(LOTTO, START, 'services'))).toBe('#view=services');
  });

  it('INT-501 lists opened and closed containers comma-separated, in model order', () => {
    const both = openContainer(LOTTO, openContainer(LOTTO, START, 'store'), 'engine');
    expect(writeFragment(LOTTO, both)).toBe('#open=engine,store');
    const services = switchView(LOTTO, START, 'services');
    const mixed = closeContainer(LOTTO, openContainer(LOTTO, services, 'engine-service'), 'store');
    expect(writeFragment(LOTTO, mixed)).toBe('#view=services&open=engine-service&closed=store');
    expect(writeFragment(LOTTO, closeContainer(LOTTO, START, 'suite'))).toBe('#closed=suite');
  });

  it('INT-501 writes a playing scenario with its step, and lanes as 1', () => {
    const playing = play(LOTTO, switchAudience(LOTTO, START, 'exec'), 'generate-picks');
    const ninth: Picture = {
      ...playing,
      activity: { kind: 'playing', scenario: 'generate-picks', step: 9, lanes: true },
    };
    // Generate picks plays on the first view, so the link names no view, as in INT-503.
    expect(playing.view).toBe(LOTTO.firstView);
    expect(writeFragment(LOTTO, ninth)).toBe('#aud=exec&play=generate-picks.9&lanes=1');
    const onMap: Picture = {
      ...ninth,
      activity: { kind: 'playing', scenario: 'generate-picks', step: 9, lanes: false },
    };
    expect(writeFragment(LOTTO, onMap)).not.toContain('lanes');
  });

  it('INT-502 writes the default picture as no fragment at all', () => {
    expect(writeFragment(LOTTO, START)).toBe('');
    // Opening a container and closing it again is the default picture once more.
    const opened = openContainer(LOTTO, START, 'engine');
    expect(writeFragment(LOTTO, opened)).toBe('#open=engine');
    expect(writeFragment(LOTTO, closeContainer(LOTTO, opened, 'engine'))).toBe('');
  });

  it('INT-502 writes one fragment per picture, from the normalised picture', () => {
    // A selection inside a closed container is written as the container (MODEL-603).
    const services = switchView(LOTTO, START, 'services');
    const hidden: Picture = {
      ...services,
      activity: { kind: 'selected', element: 'pick-generation' },
    };
    expect(writeFragment(LOTTO, hidden)).toBe('#view=services&sel=engine-service');
    // Zoom entries in any order, or entries the default already has, give the same fragment.
    const shuffled: Picture = {
      ...services,
      zoom: zoom({ store: 'closed', 'engine-service': 'open', engine: 'open' }),
    };
    const ordered: Picture = {
      ...services,
      zoom: zoom({ 'engine-service': 'open', store: 'closed' }),
    };
    expect(writeFragment(LOTTO, shuffled)).toBe(writeFragment(LOTTO, ordered));
  });

  it('INT-502 writes only aud and present while presenting, whatever else the picture holds', () => {
    const presenting = forward(LOTTO, present(LOTTO, SERVICES_OPEN, 'tour'), 3);
    expect(presenting.view).toBe('services');
    expect(writeFragment(LOTTO, presenting)).toBe('#present=tour.4');
    expect(writeFragment(LOTTO, switchAudience(LOTTO, presenting, 'exec'))).toBe(
      '#aud=exec&present=tour.4',
    );
  });

  it('INT-502 leaves aud out when it is the audience the presentation reaches by its steps', () => {
    const first = present(SMALL, defaultPicture(SMALL), 't');
    expect(writeFragment(SMALL, first)).toBe('#present=t.1');
    // Step 2 switches to engineer with `for`; step 3 keeps it.
    const second = presentForward(SMALL, first);
    expect(second.audience).toBe('engineer');
    expect(writeFragment(SMALL, second)).toBe('#present=t.2');
    expect(writeFragment(SMALL, presentForward(SMALL, second))).toBe('#present=t.3');
    // The presenter switching back to the default audience is written, so it reopens the same.
    const manager = switchAudience(SMALL, second, 'manager');
    expect(writeFragment(SMALL, manager)).toBe('#aud=manager&present=t.2');
    expect(reads(SMALL, '#aud=manager&present=t.2').audience).toBe('manager');
    expect(reads(SMALL, '#present=t.2').audience).toBe('engineer');
    expect(reads(SMALL, '#present=t.1').audience).toBe('manager');
  });
});

describe('the spec examples', () => {
  it('INT-503 reads and writes each example of the spec', () => {
    const services = reads(
      LOTTO,
      '#view=services&aud=engineer&open=engine-service&sel=pick-generation',
    );
    expect(plain(services)).toEqual({
      view: 'services',
      audience: 'engineer',
      zoom: [['engine-service', 'open']],
      activity: { kind: 'selected', element: 'pick-generation' },
    });
    const playing = reads(LOTTO, '#aud=exec&play=generate-picks.9&lanes=1');
    expect(playing.audience).toBe('exec');
    expect(playing.activity).toEqual({
      kind: 'playing',
      scenario: 'generate-picks',
      step: 9,
      lanes: true,
    });
    const presenting = reads(LOTTO, '#present=tour.7.9');
    expect(presenting.activity).toEqual({
      kind: 'presenting',
      walkthrough: 'tour',
      step: 7,
      scenarioStep: 9,
    });
    for (const fragment of [
      '#view=services&aud=engineer&open=engine-service&sel=pick-generation',
      '#present=tour.7.9',
    ]) {
      expect(writeFragment(LOTTO, reads(LOTTO, fragment))).toBe(fragment);
    }
  });
});

describe('reading the fragment', () => {
  it('INT-501 reads every picture back exactly as it was written', () => {
    const pictures: Picture[] = [START];
    for (const view of LOTTO.views) {
      for (const audience of LOTTO.model.audiences) {
        const base = switchAudience(LOTTO, switchView(LOTTO, START, view.id), audience.id);
        pictures.push(base);
        for (const element of LOTTO.tree.elements) {
          if (LOTTO.tree.isContainer(element.id))
            pictures.push(openContainer(LOTTO, base, element.id));
          pictures.push(select(LOTTO, base, element.id));
        }
      }
    }
    for (const scenario of LOTTO.model.scenarios) {
      const playing = play(LOTTO, START, scenario.id);
      const count = LOTTO.scenario(scenario.id).steps.length;
      for (let step = 1; step <= count; step++) {
        for (const lanes of [false, true]) {
          pictures.push({
            ...playing,
            activity: { kind: 'playing', scenario: scenario.id, step, lanes },
          });
        }
      }
    }
    let presenting = present(LOTTO, START, 'tour');
    for (;;) {
      pictures.push(presenting, switchAudience(LOTTO, presenting, 'engineer'));
      const next = presentForward(LOTTO, presenting);
      if (next === presenting) break;
      presenting = next;
    }
    const fragments = new Set<string>();
    for (const picture of pictures) fragments.add(roundTrip(LOTTO, picture));
    expect(fragments.size).toBeGreaterThan(100);
  });

  it('INT-504 writes ids as they are, with commas and dots not encoded', () => {
    const both = reads(LOTTO, '#open=engine,store');
    expect(writeFragment(LOTTO, both)).toContain('open=engine,store');
    expect(writeFragment(LOTTO, reads(LOTTO, '#present=tour.7.9'))).toContain('tour.7.9');
    // A hand-typed escape still reads as its character.
    expect(entries(reads(LOTTO, '#open=engine%2Cstore').zoom)).toEqual([
      ['engine', 'open'],
      ['store', 'open'],
    ]);
  });

  it('INT-504 ignores unknown keys, and reads the first of a key given twice', () => {
    const picture = reads(LOTTO, 'view=services&colour=red&zoom=2&view=engineering&aud=exec');
    expect(picture.view).toBe('services');
    expect(picture.audience).toBe('exec');
    expect(writeFragment(LOTTO, picture)).toBe('#view=services&aud=exec');
    expect(plain(reads(LOTTO, ''))).toEqual(plain(START));
    expect(plain(reads(LOTTO, '#'))).toEqual(plain(START));
    expect(plain(reads(LOTTO, '#&&=x&nothing'))).toEqual(plain(START));
  });

  it('INT-505 drops each part that names an id the model does not have, and says which', () => {
    const read = readFragment(
      LOTTO,
      '#view=services&aud=engineer&open=engine-service,gone&sel=nothing-here',
    );
    expect(read.dropped).toEqual([
      { part: 'zoom', id: 'gone' },
      { part: 'selection', id: 'nothing-here' },
    ]);
    expect(writeFragment(LOTTO, read.picture)).toBe(
      '#view=services&aud=engineer&open=engine-service',
    );
    expect(readFragment(LOTTO, '#view=nowhere&aud=martian').dropped).toEqual([
      { part: 'view', id: 'nowhere' },
      { part: 'audience', id: 'martian' },
    ]);
    expect(readFragment(LOTTO, '#play=no-such.3').dropped).toEqual([
      { part: 'scenario', id: 'no-such' },
    ]);
    expect(readFragment(LOTTO, '#present=no-such.3').dropped).toEqual([
      { part: 'walkthrough', id: 'no-such' },
    ]);
  });

  it('INT-505 clamps a step outside its scenario or walkthrough to the nearest one', () => {
    const count = LOTTO.scenario('generate-picks').steps.length;
    expect(reads(LOTTO, '#play=generate-picks.99').activity).toMatchObject({ step: count });
    expect(reads(LOTTO, '#play=generate-picks.0').activity).toMatchObject({ step: 1 });
    expect(reads(LOTTO, '#play=generate-picks').activity).toMatchObject({ step: 1 });
    expect(reads(LOTTO, '#present=tour.x').activity).toMatchObject({ step: 1 });
    // A walkthrough link wins over a scenario and a selection in the same link.
    expect(
      reads(LOTTO, '#sel=website&play=generate-picks.2&present=tour.2').activity,
    ).toMatchObject({
      kind: 'presenting',
      walkthrough: 'tour',
    });
  });
});
