// Shared links (docs/spec/interaction.md, INT-501 to INT-505): the picture written into the
// address's fragment, and read back from it. Pure: it builds only on the model's picture functions,
// so a link always describes the normalised picture (MODEL-603) and one picture has one fragment.
import type { Id } from '../lines/index.ts';
import {
  normalisePicture,
  type Activity,
  type Dropped,
  type Picture,
  type Semantics,
  type ZoomMark,
} from '../model/index.ts';

/** INT-505: what the stage says when part of a link names something the diagram no longer has. */
export const STALE_LINK = 'This link is older than the diagram. Showing the closest picture.';

/** INT-501: the fragment's keys, in the order they are written. */
const KEYS = ['view', 'aud', 'open', 'closed', 'sel', 'play', 'lanes', 'present'] as const;

type Key = (typeof KEYS)[number];

const isKey = (key: string): key is Key => (KEYS as readonly string[]).includes(key);

/**
 * The audience a presentation opened afresh reaches at `step`: the last `for` line of steps 1 to
 * `step`, or the model's default audience (MODEL-505). A link leaves `aud` out when it is this one.
 */
function reachedAudience(semantics: Semantics, walkthrough: Id, step: number): Id {
  let audience = semantics.model.defaultAudience;
  for (const picture of semantics.walkPictures(walkthrough).slice(0, step)) {
    audience = picture.audience ?? audience;
  }
  return audience;
}

/**
 * INT-501 and INT-502: the fragment of a picture, with its `#`, or the empty string for the default
 * picture. The picture is normalised first, and each key is left out at its default value. While
 * presenting, only `aud` and `present` are written, because the walkthrough decides the rest.
 */
export function writeFragment(semantics: Semantics, picture: Picture): string {
  const shown = normalisePicture(semantics, picture).picture;
  const parts = new Map<Key, string>();
  const { activity } = shown;
  if (activity.kind === 'presenting') {
    if (shown.audience !== reachedAudience(semantics, activity.walkthrough, activity.step)) {
      parts.set('aud', shown.audience);
    }
    const inside = activity.scenarioStep === null ? '' : `.${String(activity.scenarioStep)}`;
    parts.set('present', `${activity.walkthrough}.${String(activity.step)}${inside}`);
  } else {
    if (shown.view !== semantics.firstView) parts.set('view', shown.view);
    if (shown.audience !== semantics.model.defaultAudience) parts.set('aud', shown.audience);
    const marked = (mark: ZoomMark): Id[] =>
      [...shown.zoom].filter(([, each]) => each === mark).map(([id]) => id);
    if (marked('open').length > 0) parts.set('open', marked('open').join(','));
    if (marked('closed').length > 0) parts.set('closed', marked('closed').join(','));
    if (activity.kind === 'selected') parts.set('sel', activity.element);
    if (activity.kind === 'playing') {
      parts.set('play', `${activity.scenario}.${String(activity.step)}`);
      if (activity.lanes) parts.set('lanes', '1');
    }
  }
  const pairs = KEYS.flatMap((key) => {
    const value = parts.get(key);
    return value === undefined ? [] : [`${key}=${value}`];
  });
  return pairs.length === 0 ? '' : `#${pairs.join('&')}`;
}

/** A value as it was written; a hand-typed escape such as `%2C` is read as its character. */
function decoded(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** A list of ids, as `open` and `closed` hold them. */
const ids = (value: string | undefined): Id[] =>
  value === undefined ? [] : value.split(',').filter((id) => id !== '');

/** An id followed by step numbers, as `play` and `present` hold them: `tour.7.9`. */
function stepped(value: string): { id: Id; steps: number[] } {
  const [id = '', ...steps] = value.split('.');
  return { id, steps: steps.map(Number) };
}

/**
 * INT-504 and INT-505: the picture a fragment describes, normalised (MODEL-603), and the parts of it
 * that named ids the model does not have, so the reader can be told. The fragment may start with
 * `#` or not. Unknown keys are ignored; when a key is given twice, the first counts; when a link
 * names more than one activity, a walkthrough wins over a scenario and a scenario over a selection.
 */
export function readFragment(
  semantics: Semantics,
  fragment: string,
): { picture: Picture; dropped: Dropped[] } {
  const given = new Map<Key, string>();
  for (const pair of fragment.replace(/^#/, '').split('&')) {
    const at = pair.indexOf('=');
    const key = at < 0 ? pair : pair.slice(0, at);
    if (!isKey(key) || given.has(key)) continue;
    given.set(key, decoded(at < 0 ? '' : pair.slice(at + 1)));
  }
  const zoom = new Map<Id, ZoomMark>();
  for (const id of ids(given.get('open'))) zoom.set(id, 'open');
  for (const id of ids(given.get('closed'))) zoom.set(id, 'closed');
  let activity: Activity = { kind: 'reading' };
  const present = given.get('present');
  const play = given.get('play');
  const sel = given.get('sel');
  if (present !== undefined) {
    const { id, steps } = stepped(present);
    activity = {
      kind: 'presenting',
      walkthrough: id,
      step: steps[0] ?? 1,
      scenarioStep: steps[1] ?? null,
    };
  } else if (play !== undefined) {
    const { id, steps } = stepped(play);
    activity = {
      kind: 'playing',
      scenario: id,
      step: steps[0] ?? 1,
      lanes: given.get('lanes') === '1',
    };
  } else if (sel !== undefined) {
    activity = { kind: 'selected', element: sel };
  }
  const aud = given.get('aud');
  const read = normalisePicture(semantics, {
    view: given.get('view') ?? semantics.firstView,
    audience: aud ?? semantics.model.defaultAudience,
    zoom,
    activity,
  });
  const shown = read.picture.activity;
  // INT-502: without its own audience, a presentation opens in the one its steps reach.
  if (shown.kind === 'presenting' && (aud === undefined || !semantics.hasAudience(aud))) {
    const audience = reachedAudience(semantics, shown.walkthrough, shown.step);
    return { picture: { ...read.picture, audience }, dropped: read.dropped };
  }
  return read;
}
