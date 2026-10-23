// The stage (docs/spec/interaction.md): the drawing in the middle of the page, the camera that
// places it and follows the reader (INT-351 to INT-354, LAYOUT-404, LAYOUT-453 to LAYOUT-455), the
// change from one picture to the next (LAYOUT-402, LAYOUT-403, LOOK-901), the clicks a reader makes
// on it (INT-201, INT-302), the sentences a screen reader hears after it (INT-903), a playing
// scenario's caption bar (INT-603, LOOK-805) and cross-fade between the map and lanes (INT-604),
// a presented walkthrough's narration bar and camera framing its focus (INT-701, INT-702), and the
// camera a visit gone back or forward to brings back (INT-554).
import type { Id } from '../lines/index.ts';
import type { Tree } from '../model/index.ts';
import {
  BOX,
  CAMERA,
  dragged,
  PAGE,
  focusCamera,
  followBoxes,
  followCamera,
  keepCorner,
  magnify,
  pan,
  revealCamera,
  timings,
  transitionPlan,
  type Box,
  type Camera,
  type LanesLayout,
  type LayoutResult,
  type Point,
  type Size,
  type StructureLayout,
} from '../layout/index.ts';
import { SHAPE } from '../render/index.ts';
import { h } from './dom.ts';
import { Choreography, Swap, glideEase, timing } from './motion.ts';
import { narrationContent, type Narration } from './presenter.ts';
import { captionText, type Caption } from './scenario.ts';
import type { CameraState } from './visits.ts';

/** What the stage is asked to show. */
export interface Showing {
  /** The drawing's markup: one `svg.aerie`. */
  markup: string;
  /** The structure layout it draws, so a change can glide; null for lanes. */
  layout: StructureLayout | null;
  /** The lanes layout it draws (INT-604); null on the map. */
  lanes: LanesLayout | null;
  /** The sentences of every drawn relationship, for screen readers (INT-903). */
  sentences: readonly string[];
  /** A playing scenario's caption bar (INT-603); null when no scenario plays. */
  caption: Caption | null;
  /** A presented walkthrough's narration bar (INT-701); null when nothing is presented. */
  narration: Narration | null;
  /** INT-702: the elements a fitted camera frames, or none to fit the whole picture. */
  frame: readonly Id[];
}

/** How a new picture arrives. */
export interface Arrival {
  /** Switching view fits the camera and returns it to fit mode (LAYOUT-404). */
  fit?: boolean;
  /**
   * The container opened or closed: the camera follows it in fit mode (LAYOUT-453), and a free
   * camera keeps its corner in place (LAYOUT-404).
   */
  anchor?: Id;
  /** True when `anchor` was closed, so the camera can return to where it was (LAYOUT-455). */
  closing?: boolean;
  /** The element selected, brought into view with its connections (LAYOUT-454). */
  reveal?: Id;
  /** INT-554: a visit gone back or forward to: the camera returns to where the reader left it. */
  camera?: CameraState;
}

/** LAYOUT-455: where a fitted camera was before a container was opened. */
interface Return {
  /** The container opened. */
  id: Id;
  camera: Camera;
  follow: Id | null;
  /** The layout and stage it framed, which closing the container must bring back exactly. */
  result: LayoutResult;
  stage: Size;
  room: number;
}

/** What the reader does on the stage. */
export interface StageActions {
  /** A click on an element (its id) or on empty stage (null), INT-201. */
  pick(id: Id | null): void;
  /** The open and close control, or a double click on a container (INT-302). */
  toggle(id: Id): void;
  /** The camera moved, by the reader or a change of picture, so the visit can keep it (INT-554). */
  moved(camera: CameraState): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Moves an element of a drawing, in picture units. */
const at = (x: number, y: number): string => `translate(${String(x)}px, ${String(y)}px)`;

const cameraTransform = (camera: Camera): string =>
  `translate(${String(camera.x)}px, ${String(camera.y)}px) scale(${String(camera.scale)})`;

/** The layer each kind of group is drawn in. */
const LAYER_OF = { node: 'boxes', head: 'heads' } as const;

/** An element's box group (`node`) or open container's header text (`head`) in a drawing. */
const byId = (root: ParentNode, kind: 'node' | 'head', id: Id): Element | null =>
  root.querySelector(`:scope > g.${LAYER_OF[kind]} > g.${kind}[data-id="${CSS.escape(id)}"]`);

/**
 * The layers of each kind of drawing whose groups are matched one to one (by `data-id`, or
 * `data-step` for a lanes label) when only wording and emphasis change, and the layers that are
 * replaced whole when they change at all: the trail, and the rows and lines of the lanes.
 */
const MATCHED = {
  map: ['boxes', 'edges', 'heads', 'labels'],
  lanes: ['bands', 'boxes', 'labels'],
} as const;
const WHOLE = {
  map: ['trail', 'badges'],
  lanes: ['rows', 'lanes', 'trail', 'badges'],
} as const;

/** The layers that fade in after a glide: lines and the trail. */
const LINES = ['edges', 'labels', 'trail', 'badges'] as const;

/** The key a group is matched by when a drawing changes in place. */
const keyOf = (group: Element): string | null =>
  group.getAttribute('data-id') ?? group.getAttribute('data-step');

/** Attributes of a box's button that change with the audience or the selection. */
const SPOKEN = ['aria-label', 'aria-pressed', 'aria-expanded'];

/** Gives an element another's values of some attributes, touching only those that differ. */
function copyAttributes(to: Element, from: Element, names: readonly string[]): void {
  for (const name of names) {
    const value = from.getAttribute(name);
    if (value === null) to.removeAttribute(name);
    else if (to.getAttribute(name) !== value) to.setAttribute(name, value);
  }
}

export class Stage {
  readonly element: HTMLElement;
  private readonly holder: HTMLElement;
  private readonly sentences: HTMLElement;
  private readonly tree: () => Tree | null;
  private readonly actions: StageActions;
  private readonly motion = new Choreography();
  private svg: SVGSVGElement | null = null;
  private layout: StructureLayout | null = null;
  private lanes: LanesLayout | null = null;
  /** INT-603 and LOOK-805: the caption bar, shown while a scenario plays. */
  private readonly captionBar: HTMLElement;
  private readonly captionSwap: Swap;
  /** INT-701: the narration bar, shown while a walkthrough is presented. */
  private readonly narrationBar: HTMLElement;
  private readonly narrationSwap: Swap;
  /** INT-702: the elements fitting frames, until the reader presses Fit all. */
  private frame: readonly Id[] = [];
  private framing = false;
  /** LAYOUT-453: the element a fitted camera follows, until the reader presses Fit all. */
  private follow: Id | null = null;
  /** LAYOUT-455: where the fitted camera was before each container still open was opened. */
  private returns: Return[] = [];
  private camera: Camera = { scale: 1, x: 0, y: 0, mode: 'fit' };
  private drag: { pointer: number; start: Point; camera: Camera; moved: boolean } | null = null;
  private swallowClick = false;
  /** True while a change puts the focus back, which the camera has already placed (INT-354). */
  private restoring = false;

  constructor(tree: () => Tree | null, actions: StageActions) {
    this.tree = tree;
    this.actions = actions;
    this.holder = h('div', { class: 'drawing' }, [
      h('p', { class: 'loading', role: 'status' }, ['Loading the diagram']),
    ]);
    this.sentences = h('ul', { class: 'sr-only', 'aria-label': 'Relationships in this picture' });
    const button = (label: string, text: string, run: () => void): HTMLButtonElement =>
      h(
        'button',
        { type: 'button', class: 'cam', 'aria-label': label, title: label, onclick: run },
        [text],
      );
    const camera = h('div', { class: 'camera', role: 'group', 'aria-label': 'Camera' }, [
      button('Magnify', '+', () => {
        this.magnifyBy(CAMERA.magnify);
      }),
      button('Shrink', '−', () => {
        this.magnifyBy(CAMERA.shrink);
      }),
      button('Fit all', 'Fit all', () => {
        this.fit(true);
      }),
    ]);
    // INT-904: captions are announced as they change. The bar scrolls a caption longer than its
    // fixed height, so Tab reaches it and the keys scroll it (INT-901).
    this.captionBar = h('div', {
      class: 'caption-bar',
      role: 'status',
      'aria-live': 'polite',
      'aria-label': 'Step',
      tabindex: '0',
      hidden: true,
    });
    this.captionSwap = new Swap(this.captionBar);
    // INT-904: so is a walkthrough's narration, which scrolls the same way.
    this.narrationBar = h('div', {
      class: 'narration-bar',
      role: 'status',
      'aria-live': 'polite',
      'aria-label': 'Narration',
      tabindex: '0',
      hidden: true,
    });
    this.narrationSwap = new Swap(this.narrationBar);
    this.element = h('main', { class: 'aerie-stage', 'aria-label': 'Diagram' }, [
      this.holder,
      this.sentences,
      this.captionBar,
      this.narrationBar,
      camera,
    ]);
    this.listen();
    new ResizeObserver(() => {
      if (this.camera.mode === 'fit') this.refit(false);
    }).observe(this.element);
  }

  /** Shows a message instead of a drawing. */
  showMessage(content: Node): void {
    this.motion.finish();
    this.svg = null;
    this.layout = null;
    this.lanes = null;
    this.holder.replaceChildren(content);
    this.sentences.replaceChildren();
    this.frame = [];
    this.follow = null;
    this.returns = [];
    this.setBars(null, null);
  }

  /**
   * The room the caption bar or the narration bar takes at the bottom, which fitting keeps clear
   * of (LAYOUT-451, INT-702).
   */
  private get room(): number {
    if (!this.narrationBar.hidden) return PAGE.narrationBar;
    return this.captionBar.hidden ? 0 : PAGE.captionBar;
  }

  /** Shows the caption and narration bars' words, or hides them; true when their room changed. */
  private setBars(caption: Caption | null, narration: Narration | null): boolean {
    const was = this.room;
    this.captionBar.hidden = caption === null;
    if (caption !== null) this.captionSwap.set(h('div', {}, [captionText(caption)]));
    this.narrationBar.hidden = narration === null;
    if (narration !== null) this.narrationSwap.set(narrationContent(narration));
    return was !== this.room;
  }

  /**
   * Shows a picture. The same layout as before (another audience, selection or step) changes in
   * place; another layout of a structure view glides (LAYOUT-402); the map and the lanes
   * cross-fade (INT-604); anything else is replaced. A change still moving is first finished at
   * once (LAYOUT-403).
   */
  show(showing: Showing, arrival: Arrival = {}): void {
    this.motion.finish();
    const template = document.createElement('template');
    template.innerHTML = showing.markup;
    const next = template.content.querySelector('svg');
    if (!(next instanceof SVGSVGElement)) throw new Error('Aerie drew no picture.');
    const focused = this.focusedId();
    const old = this.svg;
    const before = this.layout;
    const after = showing.layout;
    const wasLanes = this.lanes;
    this.sentences.replaceChildren(...showing.sentences.map((each) => h('li', {}, [each])));
    const roomMoved = this.setBars(showing.caption, showing.narration);
    this.frame = showing.frame;
    // INT-704: a new walkthrough step fits the camera to its focus again; switching view fits the
    // whole picture and forgets what the camera followed (LAYOUT-404).
    if (arrival.fit === true) {
      this.framing = true;
      this.follow = null;
      this.returns = [];
    }
    // INT-554: a visit's camera follows and frames what it did when the reader left it.
    const back = arrival.camera;
    if (back !== undefined) {
      this.framing = back.framing;
      this.follow = back.follow;
    }
    const samePlaces =
      (before !== null && after !== null && before.result === after.result) ||
      (wasLanes !== null && wasLanes === showing.lanes);
    if (old !== null && samePlaces && this.morph(old, next, after === null ? 'lanes' : 'map')) {
      // The caption or narration bar's room changes the fitted picture (LAYOUT-451).
      if (back !== undefined) this.place(back.camera, true);
      else if (arrival.fit === true || (roomMoved && this.camera.mode === 'fit')) this.refit(true);
      else if (arrival.reveal !== undefined) this.reveal(arrival.reveal);
      this.actions.moved(this.cameraState());
      return;
    }
    const was = this.camera;
    if (back !== undefined) {
      this.camera = back.camera;
    } else if (arrival.fit === true || old === null) {
      this.camera = this.fitted(next, after);
    } else if (this.camera.mode === 'fit') {
      this.camera = this.followed(arrival, before, after, next);
    } else if (after !== null) {
      // LAYOUT-404 and LAYOUT-454: a free camera keeps an opened or closed container's corner in
      // place, then brings it and its connections into view at the reader's scale.
      const from = arrival.anchor === undefined ? undefined : before?.result.boxes[arrival.anchor];
      const to = arrival.anchor === undefined ? undefined : after.result.boxes[arrival.anchor];
      if (from !== undefined && to !== undefined) this.camera = keepCorner(this.camera, from, to);
      const target = arrival.anchor ?? arrival.reveal;
      if (target !== undefined) this.camera = this.revealed(this.camera, next, after, target);
    }
    this.svg = next;
    this.layout = after;
    this.lanes = showing.lanes;
    next.style.transform = cameraTransform(this.camera);
    const tree = this.tree();
    const crossing = old !== null && (wasLanes !== null) !== (showing.lanes !== null);
    if (crossing && timing('glide') > 0) {
      this.crossFade(old, next);
    } else {
      this.holder.replaceChildren(next);
    }
    if (old !== null && before !== null && after !== null && tree !== null) {
      this.glide(old, next, tree, before, after, was);
    }
    this.restoreFocus(focused);
    this.actions.moved(this.cameraState());
  }

  /**
   * INT-604: switching between the map and the lanes cross-fades over the glide time: the old
   * drawing fades out where it is, out of reach of the pointer and the keyboard, as the new one
   * fades in.
   */
  private crossFade(old: SVGSVGElement, next: SVGSVGElement): void {
    const duration = timing('glide');
    old.setAttribute('inert', '');
    old.setAttribute('aria-hidden', 'true');
    old.classList.add('fading');
    this.holder.replaceChildren(old, next);
    this.motion.animate(old, [{ opacity: 1 }, { opacity: 0 }], { duration, fill: 'forwards' });
    this.motion.animate(next, [{ opacity: 0 }, { opacity: 1 }], { duration });
    this.motion.after(duration, () => {
      old.remove();
    });
  }

  // ------------------------------------------------------------ changing in place

  /**
   * Changes the drawing in place when only wording and emphasis differ: groups keep their place,
   * dimming and highlighting fade by the stylesheet (LOOK-901), and changed wording fades out and
   * back in (INT-102). False when the two drawings do not match group for group.
   */
  private morph(old: SVGSVGElement, next: SVGSVGElement, kind: 'map' | 'lanes'): boolean {
    const pairs: [Element, Element][] = [];
    for (const layer of MATCHED[kind]) {
      const was = old.querySelector(`:scope > g.${layer}`);
      const now = next.querySelector(`:scope > g.${layer}`);
      if (was === null || now === null) return false;
      if (was.children.length !== now.children.length) return false;
      for (let i = 0; i < now.children.length; i++) {
        const a = was.children[i];
        const b = now.children[i];
        if (a === undefined || b === undefined) return false;
        if (keyOf(a) !== keyOf(b)) return false;
        pairs.push([a, b]);
      }
    }
    copyAttributes(old, next, [
      'aria-label',
      'data-view',
      'data-audience',
      'data-scenario',
      'role',
    ]);
    const reworded: [Element, Element][] = [];
    for (const [a, b] of pairs) {
      copyAttributes(a, b, ['class']);
      const button = a.querySelector(':scope > .shape');
      const named = b.querySelector(':scope > .shape');
      if (button !== null && named !== null) copyAttributes(button, named, SPOKEN);
      if (wordsOf(a) !== wordsOf(b)) reworded.push([a, b]);
    }
    // A trail that changed is replaced whole, so a new current step draws itself (LOOK-701); one
    // that did not, as when only the audience changes, stays as it is and does not draw again.
    for (const layer of WHOLE[kind]) {
      const was = old.querySelector(`:scope > g.${layer}`);
      const now = next.querySelector(`:scope > g.${layer}`);
      if (was !== null && now !== null && was.outerHTML === now.outerHTML) continue;
      if (now === null) was?.remove();
      else if (was === null) old.append(now);
      else was.replaceWith(now);
    }
    if (reworded.length === 0) return true;
    const swap = timing('swap');
    const outgoing = reworded.flatMap(([a]) => [...a.querySelectorAll(':scope > text')]);
    for (const text of outgoing) {
      this.motion.animate(text, [{ opacity: 1 }, { opacity: 0 }], {
        duration: swap,
        fill: 'forwards',
      });
    }
    this.motion.after(swap, () => {
      for (const [a, b] of reworded) {
        const incoming = rewordGroup(a, b);
        for (const text of incoming) {
          this.motion.animate(text, [{ opacity: 0 }, { opacity: 1 }], { duration: swap });
        }
      }
    });
    return true;
  }

  // ------------------------------------------------------------ gliding

  /** LAYOUT-402: the three overlapping parts of a change between two layouts. */
  private glide(
    old: SVGSVGElement,
    next: SVGSVGElement,
    tree: Tree,
    before: StructureLayout,
    after: StructureLayout,
    camera: Camera,
  ): void {
    const parts = timings(timing('glide'));
    if (parts.glide.duration <= 0) return;
    const ease = glideEase();
    const plan = transitionPlan(tree, before, after);
    const glide = { duration: parts.glide.duration, easing: ease };
    this.motion.animate(
      next,
      [{ transform: cameraTransform(camera) }, { transform: cameraTransform(this.camera) }],
      glide,
    );
    // 1. Elements in both pictures glide from their old box to their new one.
    for (const { id, from, to } of plan.glide) {
      for (const group of [byId(next, 'node', id), byId(next, 'head', id)]) {
        if (group === null) continue;
        this.motion.animate(
          group,
          [{ transform: at(from.x, from.y) }, { transform: at(to.x, to.y) }],
          glide,
        );
      }
      const node = byId(next, 'node', id);
      if (node !== null && (from.width !== to.width || from.height !== to.height)) {
        this.resize(node, from, to, glide);
      }
    }
    // 2. New elements fade in at their new box; leaving ones shrink toward their ancestor's header.
    for (const id of plan.enter) {
      for (const group of [byId(next, 'node', id), byId(next, 'head', id)]) {
        if (group === null) continue;
        this.motion.animate(group, [{ opacity: 0 }, { opacity: 1 }], {
          ...parts.enter,
          fill: 'backwards',
        });
      }
    }
    if (plan.leave.length > 0) {
      const leaving = document.createElementNS(SVG_NS, 'g');
      leaving.setAttribute('class', 'leaving');
      leaving.setAttribute('aria-hidden', 'true');
      next.querySelector(':scope > g.boxes')?.after(leaving);
      for (const { id, from, toward } of plan.leave) {
        for (const group of [byId(old, 'node', id), byId(old, 'head', id)]) {
          if (group === null) continue;
          group.querySelector(':scope > .shape')?.removeAttribute('tabindex');
          leaving.append(group);
          this.motion.animate(
            group,
            [
              { transform: `${at(from.x, from.y)} scale(1)`, opacity: 1 },
              { transform: `${at(toward.x, toward.y)} scale(0)`, opacity: 0 },
            ],
            { ...parts.leave, fill: 'forwards' },
          );
        }
      }
      this.motion.after(parts.leave.duration, () => {
        leaving.remove();
      });
    }
    // 3. The new lines, labels and trail fade in once the elements have arrived.
    for (const layer of LINES) {
      const found = next.querySelector(`:scope > g.${layer}`);
      if (found === null) continue;
      this.motion.animate(found, [{ opacity: 0 }, { opacity: 1 }], {
        ...parts.lines,
        fill: 'backwards',
      });
    }
  }

  /** A box that changes size glides its outline, inner contour, focus ring and control with it. */
  private resize(
    node: Element,
    from: Box,
    to: Box,
    options: { duration: number; easing: string },
  ): void {
    const size = (box: Box, grow: number): Keyframe => ({
      width: `${String(box.width + 2 * grow)}px`,
      height: `${String(box.height + 2 * grow)}px`,
    });
    const parts: [string, number][] = [
      ['shape', 0],
      ['inner', -BOX.inset],
      ['ring', SHAPE.ringOffset],
    ];
    for (const [name, grow] of parts) {
      const part = node.querySelector(`:scope > .${name}`);
      if (part !== null) this.motion.animate(part, [size(from, grow), size(to, grow)], options);
    }
    const control = node.querySelector(':scope > .control');
    if (control !== null) {
      const radius = BOX.toggle / 2;
      const place = (box: Box): Keyframe => ({
        transform: at(box.width - BOX.pad - radius, BOX.pad + radius),
      });
      this.motion.animate(control, [place(from), place(to)], options);
    }
  }

  // ------------------------------------------------------------ the camera

  private stageSize(): Size {
    return { width: this.element.clientWidth, height: this.element.clientHeight };
  }

  private sizeOf(svg: SVGSVGElement): Size {
    return { width: svg.width.baseVal.value, height: svg.height.baseVal.value };
  }

  /** INT-554: where the camera is, and what a fitted camera follows or frames. */
  cameraState(): CameraState {
    return { camera: this.camera, follow: this.follow, framing: this.framing };
  }

  private place(camera: Camera, glide: boolean): void {
    const was = this.camera;
    this.camera = camera;
    if (this.svg === null) return;
    this.actions.moved(this.cameraState());
    this.svg.style.transform = cameraTransform(camera);
    if (glide) {
      this.motion.finish();
      this.motion.animate(
        this.svg,
        [{ transform: cameraTransform(was) }, { transform: cameraTransform(camera) }],
        { duration: timing('glide'), easing: glideEase() },
      );
    }
  }

  /**
   * LAYOUT-451 and LAYOUT-453: the fitted camera for a drawing: a presented step's focus elements
   * (INT-702), or the element the camera follows, until the reader presses Fit all; otherwise the
   * whole picture.
   */
  private fitted(svg: SVGSVGElement, layout: StructureLayout | null): Camera {
    const size = this.sizeOf(svg);
    const stage = this.stageSize();
    if (this.framing && layout !== null) {
      const boxes = this.frame.flatMap((id) => layout.result.boxes[id] ?? []);
      if (boxes.length > 0) return focusCamera(boxes, size, stage, this.room);
    }
    const tree = this.tree();
    const follow =
      this.follow !== null && layout !== null && tree !== null
        ? followBoxes(tree, layout, this.follow)
        : [];
    return followCamera(follow, size, stage, this.room);
  }

  /**
   * LAYOUT-453 and LAYOUT-455: the fitted camera after a layout change. Opening a container
   * remembers where the camera was and follows the container; closing it returns the camera there
   * when the picture is the same again, and otherwise follows the closed container. Selecting an
   * element that had to be revealed follows it.
   */
  private followed(
    arrival: Arrival,
    before: StructureLayout | null,
    after: StructureLayout | null,
    next: SVGSVGElement,
  ): Camera {
    const target = arrival.anchor ?? arrival.reveal;
    if (target !== undefined && after !== null) {
      if (arrival.anchor !== undefined && arrival.closing === true) {
        const back = this.returnTo(arrival.anchor, after.result);
        if (back !== null) {
          this.follow = back.follow;
          return back.camera;
        }
      } else if (arrival.anchor !== undefined && before !== null) {
        this.returns.push({
          id: arrival.anchor,
          camera: this.camera,
          follow: this.follow,
          result: before.result,
          stage: this.stageSize(),
          room: this.room,
        });
      }
      this.follow = target;
    }
    return this.fitted(next, after);
  }

  /**
   * LAYOUT-455: where the camera was before a container was opened, forgetting it and everything
   * opened after it; null when closing it does not bring back the picture and stage it framed.
   */
  private returnTo(id: Id, result: LayoutResult): Return | null {
    const at = this.returns.findLastIndex((each) => each.id === id);
    const back = this.returns[at];
    if (back === undefined) return null;
    this.returns = this.returns.slice(0, at);
    const stage = this.stageSize();
    const same =
      back.result === result &&
      back.stage.width === stage.width &&
      back.stage.height === stage.height &&
      back.room === this.room;
    return same ? back : null;
  }

  /** LAYOUT-454: a camera that brings an element and its connections into view at its scale. */
  private revealed(camera: Camera, svg: SVGSVGElement, layout: StructureLayout, id: Id): Camera {
    const tree = this.tree();
    if (tree === null) return camera;
    const boxes = followBoxes(tree, layout, id);
    return revealCamera(camera, boxes, this.sizeOf(svg), this.stageSize(), this.room);
  }

  /** LAYOUT-454: glides an element and its connections into view, never changing the scale. */
  private reveal(id: Id): void {
    if (this.svg === null || this.layout === null) return;
    const next = this.revealed(this.camera, this.svg, this.layout, id);
    if (next.x !== this.camera.x || next.y !== this.camera.y) this.place(next, true);
  }

  /** Fits the camera again, framing a presented step's focus if it still does (INT-704). */
  private refit(glide: boolean): void {
    if (this.svg === null) return;
    this.place(this.fitted(this.svg, this.layout), glide);
  }

  /**
   * LAYOUT-451 and INT-352: Fit all fits the whole picture and returns the camera to fit mode,
   * following nothing.
   */
  fit(glide: boolean): void {
    this.framing = false;
    this.follow = null;
    this.returns = [];
    this.refit(glide);
  }

  /** INT-352: the camera buttons and keys magnify around the middle of the stage. */
  magnifyBy(factor: number): void {
    const size = this.stageSize();
    this.place(magnify(this.camera, factor, { x: size.width / 2, y: size.height / 2 }), true);
  }

  // ------------------------------------------------------------ the reader's pointer

  private listen(): void {
    const stage = this.element;
    const local = (event: MouseEvent): Point => {
      const bounds = stage.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    this.holder.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || this.svg === null) return;
      this.swallowClick = false;
      this.drag = {
        pointer: event.pointerId,
        start: local(event),
        camera: this.camera,
        moved: false,
      };
    });
    this.holder.addEventListener('pointermove', (event) => {
      const drag = this.drag;
      if (drag?.pointer !== event.pointerId) return;
      const now = local(event);
      const dx = now.x - drag.start.x;
      const dy = now.y - drag.start.y;
      if (!drag.moved && !dragged(dx, dy)) return;
      if (!drag.moved) {
        drag.moved = true;
        this.holder.setPointerCapture(event.pointerId);
        this.holder.classList.add('dragging');
      }
      this.place(pan(drag.camera, dx, dy), false);
    });
    const end = (event: PointerEvent): void => {
      const drag = this.drag;
      if (drag?.pointer !== event.pointerId) return;
      this.drag = null;
      this.holder.classList.remove('dragging');
      // INT-351: a drag is not a click.
      if (drag.moved) this.swallowClick = true;
    };
    this.holder.addEventListener('pointerup', end);
    this.holder.addEventListener('pointercancel', end);
    this.holder.addEventListener('click', (event) => {
      if (this.swallowClick) {
        this.swallowClick = false;
        return;
      }
      // The second click of a double click belongs to the double click.
      if (event.detail > 1) return;
      const target = event.target instanceof Element ? event.target : null;
      // An open container's header text is drawn above the lines, in its own group (g.head).
      const node = target?.closest('g.boxes > g.node, g.heads > g.head') ?? null;
      const id = node?.getAttribute('data-id') ?? null;
      const control = target?.closest('.control') ?? null;
      if (id !== null && control !== null) {
        this.actions.toggle(id);
        return;
      }
      this.actions.pick(id);
    });
    this.holder.addEventListener('dblclick', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target === null) return;
      if (target.closest('.control') !== null) return;
      const node = target.closest('g.boxes > g.node, g.heads > g.head');
      const id = node?.getAttribute('data-id') ?? null;
      if (id !== null && this.svg !== null && byId(this.svg, 'node', id)?.matches('.open, .closed'))
        this.actions.toggle(id);
    });
    // INT-354: an element reached with the keyboard is brought into view at the camera's scale. A
    // click's focus is left alone, since the reader can see what they clicked, and so is the focus
    // a change puts back, which would otherwise cut its glide short.
    this.holder.addEventListener('focusin', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (this.restoring || target?.matches('.shape:focus-visible') !== true) return;
      const id = target.closest('g.boxes > g.node')?.getAttribute('data-id') ?? null;
      const box = id === null ? undefined : this.layout?.result.boxes[id];
      if (this.svg === null || box === undefined) return;
      const next = revealCamera(
        this.camera,
        [box],
        this.sizeOf(this.svg),
        this.stageSize(),
        this.room,
      );
      if (next.x !== this.camera.x || next.y !== this.camera.y) this.place(next, true);
    });
    this.holder.addEventListener(
      'wheel',
      (event) => {
        if (this.svg === null) return;
        event.preventDefault();
        const unit = event.deltaMode === 1 ? 16 : 1;
        this.place(
          magnify(this.camera, Math.exp(-event.deltaY * unit * 0.002), local(event)),
          false,
        );
      },
      { passive: false },
    );
  }

  // ------------------------------------------------------------ keyboard focus

  /** The element of the drawing that has the keyboard focus, if any. */
  private focusedId(): Id | null {
    const active = document.activeElement;
    if (this.svg === null || active === null || !this.svg.contains(active)) return null;
    return active.closest('g.node')?.getAttribute('data-id') ?? null;
  }

  /** Keeps the focus on the same element, or the container it went into (INT-203), after a change. */
  private restoreFocus(id: Id | null): void {
    if (id === null || this.svg === null) return;
    const tree = this.tree();
    const candidates = [id, ...(tree?.has(id) === true ? tree.ancestors(id) : [])];
    for (const each of candidates) {
      const found = byId(this.svg, 'node', each)?.querySelector(':scope > .shape');
      if (found instanceof SVGElement) {
        this.restoring = true;
        try {
          found.focus({ preventScroll: true });
        } finally {
          this.restoring = false;
        }
        return;
      }
    }
  }
}

/** The wording a group shows, with its faces and places: its text and its hover text. */
function wordsOf(group: Element): string {
  return [...group.querySelectorAll(':scope > text, :scope > title')]
    .map((each) => each.outerHTML)
    .join('\n');
}

/**
 * Replaces a group's text and hover text with another audience's, leaving every other part where
 * it is so its own fades keep running. Returns the new text elements.
 */
function rewordGroup(group: Element, next: Element): Element[] {
  for (const old of group.querySelectorAll(':scope > text, :scope > title')) old.remove();
  const kept = [...group.children];
  const incoming: Element[] = [];
  let at = 0;
  for (const child of [...next.children]) {
    if (child.tagName === 'text' || child.tagName === 'title') {
      group.insertBefore(child, kept[at] ?? null);
      if (child.tagName === 'text') incoming.push(child);
    } else {
      at += 1;
    }
  }
  return incoming;
}
