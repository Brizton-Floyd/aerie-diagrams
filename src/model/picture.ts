// The picture: everything that decides what a reader sees, its default and its normalisation, and
// the changes a reader makes to it (docs/spec/model.md, MODEL-601 to MODEL-604). Every function
// here returns a normalised picture.
import type { Id } from '../lines/index.ts';
import { lift } from './lift.ts';
import type { Semantics } from './semantics.ts';
import { DEFAULT_ZOOM, type Zoom, type ZoomMark } from './views.ts';

/** MODEL-601: selection, overview, playback and presentation are mutually exclusive activities. */
export type Activity =
  | { kind: 'reading' }
  | { kind: 'selected'; element: Id }
  | { kind: 'overview'; scenario: Id; step: number }
  | { kind: 'playing'; scenario: Id; step: number; lanes: boolean }
  | {
      kind: 'presenting';
      walkthrough: Id;
      step: number;
      /** Inside a scenario step, the scenario step shown; otherwise null. */
      scenarioStep: number | null;
    };

/**
 * MODEL-601: a view, an audience, a zoom state and an activity. The theme, reduced motion and the
 * camera are reader preferences, not part of the picture.
 */
export interface Picture {
  view: Id;
  audience: Id;
  zoom: Zoom;
  activity: Activity;
}

/** A part of a picture that named an id the model does not have, or could not be shown. */
export interface Dropped {
  part: 'view' | 'audience' | 'zoom' | 'selection' | 'scenario' | 'walkthrough';
  id: Id;
}

const READING: Activity = { kind: 'reading' };

function initialActivity(semantics: Semantics, view: Id): Activity {
  const id = semantics.scope(view).view.mainScenario;
  return id !== undefined && semantics.hasScenario(id)
    ? { kind: 'overview', scenario: id, step: 1 }
    : READING;
}

/** MODEL-602 and MODEL-106: the first view, the default audience, nothing open, selected or playing. */
export function defaultPicture(semantics: Semantics): Picture {
  return {
    view: semantics.firstView,
    audience: semantics.model.defaultAudience,
    zoom: DEFAULT_ZOOM,
    activity: initialActivity(semantics, semantics.firstView),
  };
}

/** A whole number from `low` to `high`; anything else becomes the nearest one. */
function clamp(value: number, low: number, high: number): number {
  if (Number.isNaN(value)) return low;
  return Math.min(Math.max(Math.round(value), low), Math.max(low, high));
}

/**
 * MODEL-603: makes a picture, such as one read from a shared link, safe to show. The zoom state is
 * normalised (MODEL-208); a selected element that is not drawn is replaced by its lift; a step number
 * is clamped to the nearest valid one; anything naming an id the model does not have is dropped and
 * listed in `dropped`, so the reader can be told. A playing scenario moves to its stage view
 * (MODEL-404), and a presented walkthrough decides the view and zoom state (MODEL-501).
 */
export function normalisePicture(
  semantics: Semantics,
  picture: Picture,
): { picture: Picture; dropped: Dropped[] } {
  const dropped: Dropped[] = [];
  let view = picture.view;
  const viewKnown = semantics.hasView(view);
  if (!viewKnown) {
    dropped.push({ part: 'view', id: view });
    view = semantics.firstView;
  }
  let audience = picture.audience;
  if (!semantics.hasAudience(audience)) {
    dropped.push({ part: 'audience', id: audience });
    audience = semantics.model.defaultAudience;
  }
  const known = new Map<Id, ZoomMark>();
  for (const [id, mark] of picture.zoom) {
    if (semantics.tree.has(id)) {
      known.set(id, mark);
    } else {
      dropped.push({ part: 'zoom', id });
    }
  }
  // The zoom state belonged to a view the model no longer has, so the first view starts afresh.
  let zoom = semantics.scope(view).normalise(viewKnown ? known : DEFAULT_ZOOM);
  const activity = picture.activity;
  const out = (changes: Partial<Picture> = {}): { picture: Picture; dropped: Dropped[] } => ({
    picture: { view, audience, zoom, activity: READING, ...changes },
    dropped,
  });
  switch (activity.kind) {
    case 'reading':
      return out();
    case 'selected': {
      if (!semantics.tree.has(activity.element)) {
        dropped.push({ part: 'selection', id: activity.element });
        return out();
      }
      const shown = lift(semantics.tree, semantics.drawn(view, zoom), activity.element);
      if (shown === null) {
        dropped.push({ part: 'selection', id: activity.element });
        return out();
      }
      return out({ activity: { kind: 'selected', element: shown } });
    }
    case 'overview':
    case 'playing': {
      if (!semantics.hasScenario(activity.scenario)) {
        dropped.push({ part: 'scenario', id: activity.scenario });
        return out();
      }
      const stage = semantics.stage(activity.scenario, view) ?? view;
      if (stage !== view) {
        view = stage;
        zoom = DEFAULT_ZOOM;
      }
      const count = semantics.scenario(activity.scenario).steps.length;
      if (activity.kind === 'overview')
        return out({
          activity: {
            kind: 'overview',
            scenario: activity.scenario,
            step: clamp(
              activity.step,
              1,
              semantics.overviewSteps(activity.scenario, audience).length,
            ),
          },
        });
      return out({
        activity: {
          kind: 'playing',
          scenario: activity.scenario,
          step: clamp(activity.step, 1, count),
          lanes: activity.lanes,
        },
      });
    }
    case 'presenting': {
      if (!semantics.hasWalkthrough(activity.walkthrough)) {
        dropped.push({ part: 'walkthrough', id: activity.walkthrough });
        return out();
      }
      const pictures = semantics.walkPictures(activity.walkthrough);
      const step = clamp(activity.step, 1, pictures.length);
      const here = pictures[step - 1];
      if (here === undefined) return out();
      const range = here.scenario;
      const scenarioStep =
        range === null ? null : clamp(activity.scenarioStep ?? range.from, range.from, range.to);
      view = here.view;
      zoom = here.zoom;
      return out({
        activity: { kind: 'presenting', walkthrough: activity.walkthrough, step, scenarioStep },
      });
    }
  }
}

const normal = (semantics: Semantics, picture: Picture): Picture =>
  normalisePicture(semantics, picture).picture;

/** MODEL-209: another view starts from its default zoom, with nothing selected or playing. */
export function switchView(semantics: Semantics, picture: Picture, view: Id): Picture {
  return normal(semantics, {
    ...picture,
    view,
    zoom: DEFAULT_ZOOM,
    activity: initialActivity(semantics, semantics.hasView(view) ? view : semantics.firstView),
  });
}

/** Audience changes wording only, so nothing else in the picture changes. */
export function switchAudience(semantics: Semantics, picture: Picture, audience: Id): Picture {
  return normal(semantics, { ...picture, audience });
}

/** MODEL-206: opens a container in place. */
export function openContainer(semantics: Semantics, picture: Picture, id: Id): Picture {
  const base = normal(semantics, picture);
  const zoom = semantics.scope(base.view).open(base.zoom, id);
  return normal(semantics, { ...base, zoom });
}

/** MODEL-206: closes a container in place; a selection inside it moves to it (MODEL-603). */
export function closeContainer(semantics: Semantics, picture: Picture, id: Id): Picture {
  const base = normal(semantics, picture);
  const zoom = semantics.scope(base.view).close(base.zoom, id);
  return normal(semantics, { ...base, zoom });
}

/** MODEL-207: opens what is needed to draw `id`. An id the model does not have changes nothing. */
export function reveal(semantics: Semantics, picture: Picture, id: Id): Picture {
  const base = normal(semantics, picture);
  if (!semantics.tree.has(id)) return base;
  const zoom = semantics.scope(base.view).reveal(base.zoom, id);
  return normal(semantics, { ...base, zoom });
}

/**
 * Selects an element, revealing it first (MODEL-207), or clears the selection with null. Nothing is
 * selected during scenario playback or presentation: the picture is returned unchanged. Selecting
 * an element from a static overview replaces the overview with that element's details (INT-627).
 */
export function select(semantics: Semantics, picture: Picture, id: Id | null): Picture {
  const { kind } = picture.activity;
  if (kind === 'playing' || kind === 'presenting') return picture;
  if (id === null) return normal(semantics, { ...picture, activity: READING });
  const shown = reveal(semantics, picture, id);
  return normal(semantics, { ...shown, activity: { kind: 'selected', element: id } });
}

/** MODEL-605: a complete, static scenario trail with one step selected for explanation. */
export function overview(semantics: Semantics, picture: Picture, scenario: Id, step = 1): Picture {
  return normal(semantics, { ...picture, activity: { kind: 'overview', scenario, step } });
}

/** MODEL-604 and MODEL-404: plays a scenario from step 1 on its stage view, clearing the selection. */
export function play(semantics: Semantics, picture: Picture, scenario: Id): Picture {
  return normal(semantics, {
    ...picture,
    activity: { kind: 'playing', scenario, step: 1, lanes: false },
  });
}

/** Ends a scenario or a presentation (INT-707): reading at the same view, zoom and audience. */
export function stop(semantics: Semantics, picture: Picture): Picture {
  return normal(semantics, { ...picture, activity: READING });
}

/** MODEL-604: presents a walkthrough from its first step, clearing the selection. */
export function present(semantics: Semantics, picture: Picture, walkthrough: Id): Picture {
  if (!semantics.hasWalkthrough(walkthrough)) return normal(semantics, picture);
  return enter(semantics, picture, walkthrough, 1, 'start');
}

/** Goes to step `step` of the presented walkthrough (Home and End), entering it at its start. */
export function presentStep(semantics: Semantics, picture: Picture, step: number): Picture {
  if (picture.activity.kind !== 'presenting') return picture;
  return enter(semantics, picture, picture.activity.walkthrough, step, 'start');
}

/**
 * MODEL-504: forward plays the next scenario step until the end of the range, then enters the next
 * walkthrough step. On the last step it does nothing.
 */
export function presentForward(semantics: Semantics, picture: Picture): Picture {
  return move(semantics, picture, 1);
}

/** MODEL-504: back plays the previous scenario step, then enters the previous step at its end. */
export function presentBack(semantics: Semantics, picture: Picture): Picture {
  return move(semantics, picture, -1);
}

function move(semantics: Semantics, picture: Picture, by: 1 | -1): Picture {
  const activity = picture.activity;
  if (activity.kind !== 'presenting') return picture;
  const pictures = semantics.walkPictures(activity.walkthrough);
  const range = pictures[activity.step - 1]?.scenario ?? null;
  const at = activity.scenarioStep;
  if (range !== null && at !== null && (by > 0 ? at < range.to : at > range.from)) {
    return normal(semantics, { ...picture, activity: { ...activity, scenarioStep: at + by } });
  }
  const next = activity.step + by;
  if (next < 1 || next > pictures.length) return picture;
  return enter(semantics, picture, activity.walkthrough, next, by > 0 ? 'start' : 'end');
}

/**
 * Enters a walkthrough step: its picture (MODEL-501), the first or last step of its scenario range
 * (MODEL-504), and its `for` audience, or the current audience when it has none (MODEL-505).
 */
function enter(
  semantics: Semantics,
  picture: Picture,
  walkthrough: Id,
  step: number,
  at: 'start' | 'end',
): Picture {
  const pictures = semantics.walkPictures(walkthrough);
  const here = pictures[clamp(step, 1, pictures.length) - 1];
  const range = here?.scenario ?? null;
  return normal(semantics, {
    view: here?.view ?? picture.view,
    zoom: here?.zoom ?? picture.zoom,
    audience: here?.audience ?? picture.audience,
    activity: {
      kind: 'presenting',
      walkthrough,
      step,
      scenarioStep: range === null ? null : at === 'start' ? range.from : range.to,
    },
  });
}
