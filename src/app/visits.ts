// The reader's visits (docs/spec/interaction.md, INT-551 to INT-557): every picture the reader
// went to, with the camera where they left it, one per entry of the browser's history, so the
// page's Back and Forward, its list of recent visits and the browser's own Back and Forward all
// move between the same visits. Pure: the viewer keeps the history entries and the stage keeps the
// camera; this module keeps the list, saves it on the shelf it is given (the tab's session storage,
// INT-556), and names a visit for an audience.
import type { Id } from '../lines/index.ts';
import type { Camera } from '../layout/index.ts';
import type { Picture, Semantics } from '../model/index.ts';
import { scenarioTitle } from '../render/index.ts';
import { readFragment } from './link.ts';
import { walkthroughTitle } from './presenter.ts';

/**
 * INT-554: where the camera was at a visit: its place and scale, the element a fitted camera
 * followed (LAYOUT-453), and whether it framed a presented step's focus (INT-702).
 */
export interface CameraState {
  camera: Camera;
  follow: Id | null;
  framing: boolean;
}

/** One picture the reader went to (INT-551). */
export interface Visit {
  /** The picture, as the fragment of its address (INT-501). */
  fragment: string;
  /** The container the reader opened or closed to get here, which names the visit (INT-555). */
  about: Id | null;
  /** Where the reader left the camera; null until the visit has been drawn. */
  camera: CameraState | null;
}

/** What a history entry carries: the visits it belongs to and its place among them. */
export interface EntryState {
  aerie: { visits: string; at: number };
}

/** Somewhere to keep the visits for as long as the tab lives: the session storage, or nothing. */
export interface Shelf {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** What the shelf holds for one run of visits. */
interface Saved {
  model: string;
  at: number;
  visits: Visit[];
}

/** INT-555: how many visits the list of recent visits names. */
export const RECENT = 5;

const KEY = 'aerie.visits.';

/** The visits and place a history entry's state names, or null when it is not one of Aerie's. */
export function entryOf(state: unknown): EntryState['aerie'] | null {
  if (typeof state !== 'object' || state === null || !('aerie' in state)) return null;
  const { aerie } = state;
  if (typeof aerie !== 'object' || aerie === null) return null;
  if (!('visits' in aerie) || !('at' in aerie)) return null;
  const { visits, at } = aerie;
  if (typeof visits !== 'string' || typeof at !== 'number' || !Number.isInteger(at) || at < 0) {
    return null;
  }
  return { visits, at };
}

/** A visit as the shelf holds it, or null when it is not one. */
function visitOf(value: unknown): Visit | null {
  if (typeof value !== 'object' || value === null) return null;
  const { fragment, about, camera } = value as Record<string, unknown>;
  if (typeof fragment !== 'string') return null;
  return {
    fragment,
    about: typeof about === 'string' ? about : null,
    camera: cameraOf(camera),
  };
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function cameraOf(value: unknown): CameraState | null {
  if (typeof value !== 'object' || value === null) return null;
  const { camera, follow, framing } = value as Record<string, unknown>;
  if (typeof camera !== 'object' || camera === null) return null;
  const { scale, x, y, mode } = camera as Record<string, unknown>;
  if (!isNumber(scale) || !isNumber(x) || !isNumber(y) || (mode !== 'fit' && mode !== 'free')) {
    return null;
  }
  return {
    camera: { scale, x, y, mode },
    follow: typeof follow === 'string' ? follow : null,
    framing: framing === true,
  };
}

/**
 * INT-551: the key a picture's visit is known by. A playing scenario or a presented walkthrough is
 * one visit whatever its step, lanes or audience (they keep their own controls); any other picture
 * is its own visit.
 */
export function visitKey(picture: Picture, fragment: string): string {
  const { activity } = picture;
  if (activity.kind === 'playing') return `play ${activity.scenario}`;
  if (activity.kind === 'presenting') return `present ${activity.walkthrough}`;
  return fragment;
}

/** The visits of one diagram in one tab, in the order of their history entries. */
export class Visits {
  /** The name of this run of visits, written into each history entry it owns. */
  readonly id: string;
  /** The diagram they are visits of: a reload keeps them, another starts afresh (INT-556). */
  readonly model: string;
  private list: Visit[];
  private place: number;

  private constructor(id: string, model: string, list: Visit[], at: number) {
    this.id = id;
    this.model = model;
    this.list = list;
    this.place = at;
  }

  /** A new run of visits that starts at one picture. */
  static start(id: string, model: string, fragment: string): Visits {
    return new Visits(id, model, [{ fragment, about: null, camera: null }], 0);
  }

  /**
   * INT-556: the visits a history entry belongs to, as the shelf kept them, at that entry; null
   * when the entry is not one of Aerie's, or the shelf no longer has its visits or has them for
   * another diagram.
   */
  static resume(shelf: Shelf, model: string, state: unknown): Visits | null {
    const entry = entryOf(state);
    if (entry === null) return null;
    let saved: unknown;
    try {
      saved = JSON.parse(shelf.get(KEY + entry.visits) ?? 'null');
    } catch {
      return null;
    }
    if (typeof saved !== 'object' || saved === null) return null;
    const { model: kept, visits } = saved as Partial<Saved>;
    if (kept !== model || !Array.isArray(visits)) return null;
    const list = visits.map(visitOf);
    if (list.length === 0 || list.some((each) => each === null)) return null;
    const known = list as Visit[];
    if (entry.at >= known.length) return null;
    return new Visits(entry.visits, model, known, entry.at);
  }

  /** The place of the current visit in the list. */
  get at(): number {
    return this.place;
  }

  get length(): number {
    return this.list.length;
  }

  get current(): Visit {
    const visit = this.list[this.place];
    if (visit === undefined) throw new Error('Aerie has lost its place among the visits.');
    return visit;
  }

  /** The visit at a place in the list. */
  get(at: number): Visit | undefined {
    return this.list[at];
  }

  /** INT-553: whether there is a visit to go back or forward to. */
  get canBack(): boolean {
    return this.place > 0;
  }

  get canForward(): boolean {
    return this.place < this.list.length - 1;
  }

  /** The state of the current visit's history entry. */
  entry(): EntryState {
    return { aerie: { visits: this.id, at: this.place } };
  }

  /**
   * A new visit after the current one. As in the browser's history, the visits that were ahead of
   * the current one are forgotten.
   */
  push(fragment: string, about: Id | null): void {
    this.list = [...this.list.slice(0, this.place + 1), { fragment, about, camera: null }];
    this.place = this.list.length - 1;
  }

  /** The current visit's picture changed without becoming another visit (INT-551). */
  replace(fragment: string): void {
    this.list[this.place] = { ...this.current, fragment };
  }

  /** INT-554: the camera of the current visit, kept where the reader leaves it. */
  keepCamera(camera: CameraState): void {
    this.list[this.place] = { ...this.current, camera };
  }

  /** Goes to another visit in the list; false when there is none at that place. */
  moveTo(at: number): boolean {
    if (!Number.isInteger(at) || at < 0 || at >= this.list.length) return false;
    this.place = at;
    return true;
  }

  /**
   * INT-555: the places of the visits the list of recent visits names: the latest `count`, or, when
   * the reader has gone further back than those, `count` visits from the current one on.
   */
  recent(count = RECENT): number[] {
    if (count <= 0) return [];
    const last = Math.max(this.list.length - 1, 0);
    const first = Math.min(this.place, Math.max(last - count + 1, 0));
    const end = Math.min(first + count - 1, last);
    const places: number[] = [];
    for (let at = first; at <= end; at++) places.push(at);
    return places;
  }

  /** INT-556: keeps the visits on the shelf, for a reload of the tab. */
  save(shelf: Shelf): void {
    const saved: Saved = { model: this.model, at: this.place, visits: this.list };
    shelf.set(KEY + this.id, JSON.stringify(saved));
  }
}

/**
 * INT-555: a visit's name for an audience: the selected element's name, the playing scenario's or
 * presented walkthrough's title, the name of the container opened or closed, or else the view's
 * title.
 */
export function visitName(semantics: Semantics, visit: Visit, audience: Id): string {
  const { picture } = readFragment(semantics, visit.fragment);
  const { activity } = picture;
  if (activity.kind === 'selected') return semantics.name(activity.element, audience);
  if (activity.kind === 'playing') return scenarioTitle(semantics, activity.scenario, audience);
  if (activity.kind === 'presenting') {
    return walkthroughTitle(semantics, activity.walkthrough, audience);
  }
  if (visit.about !== null && semantics.tree.has(visit.about)) {
    return semantics.name(visit.about, audience);
  }
  return semantics.viewTitle(picture.view, audience);
}
