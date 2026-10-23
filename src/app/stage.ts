// The stage (docs/spec/interaction.md): the drawing in the middle of the page, the camera that
// places it (INT-351 to INT-353, LAYOUT-404), the change from one picture to the next (LAYOUT-402,
// LAYOUT-403, LOOK-901), the clicks a reader makes on it (INT-201, INT-302), and the sentences a
// screen reader hears after it (INT-903).
import type { Id } from '../lines/index.ts';
import type { Tree } from '../model/index.ts';
import {
  BOX,
  CAMERA,
  dragged,
  fitCamera,
  keepCorner,
  magnify,
  pan,
  timings,
  transitionPlan,
  type Box,
  type Camera,
  type Point,
  type Size,
  type StructureLayout,
} from '../layout/index.ts';
import { SHAPE } from '../render/index.ts';
import { h } from './dom.ts';
import { Choreography, glideEase, timing } from './motion.ts';

/** What the stage is asked to show. */
export interface Showing {
  /** The drawing's markup: one `svg.aerie`. */
  markup: string;
  /** The structure layout it draws, so a change can glide; null for lanes. */
  layout: StructureLayout | null;
  /** The sentences of every drawn relationship, for screen readers (INT-903). */
  sentences: readonly string[];
}

/** How a new picture arrives. */
export interface Arrival {
  /** Switching view fits the camera and returns it to fit mode (LAYOUT-404). */
  fit?: boolean;
  /** The container opened or closed, whose corner a free camera keeps in place (LAYOUT-404). */
  anchor?: Id;
}

/** What the reader does on the stage. */
export interface StageActions {
  /** A click on an element (its id) or on empty stage (null), INT-201. */
  pick(id: Id | null): void;
  /** The open and close control, or a double click on a container (INT-302). */
  toggle(id: Id): void;
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

/** The layers whose groups are matched one to one when only wording and emphasis change. */
const LAYERS = ['boxes', 'edges', 'heads', 'labels'] as const;

/** The layers that are redrawn whole on every change: lines and the trail. */
const LINES = ['edges', 'labels', 'trail', 'badges'] as const;

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
  private camera: Camera = { scale: 1, x: 0, y: 0, mode: 'fit' };
  private drag: { pointer: number; start: Point; camera: Camera; moved: boolean } | null = null;
  private swallowClick = false;

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
      button('Fit', 'Fit', () => {
        this.fit(true);
      }),
    ]);
    this.element = h('main', { class: 'aerie-stage', 'aria-label': 'Diagram' }, [
      this.holder,
      this.sentences,
      camera,
    ]);
    this.listen();
    new ResizeObserver(() => {
      if (this.camera.mode === 'fit') this.fit(false);
    }).observe(this.element);
  }

  /** Shows a message instead of a drawing. */
  showMessage(content: Node): void {
    this.motion.finish();
    this.svg = null;
    this.layout = null;
    this.holder.replaceChildren(content);
    this.sentences.replaceChildren();
  }

  /**
   * Shows a picture. The same layout as before (another audience, selection or step) changes in
   * place; another layout of a structure view glides (LAYOUT-402); anything else is replaced.
   * A change still moving is first finished at once (LAYOUT-403).
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
    this.sentences.replaceChildren(...showing.sentences.map((each) => h('li', {}, [each])));
    if (old !== null && before !== null && after !== null && before.result === after.result) {
      if (this.morph(old, next)) return;
    }
    const size = this.sizeOf(next);
    const was = this.camera;
    if (arrival.fit === true || this.camera.mode === 'fit' || old === null) {
      this.camera = fitCamera(size, this.stageSize());
    } else if (arrival.anchor !== undefined && before !== null && after !== null) {
      const from = before.result.boxes[arrival.anchor];
      const to = after.result.boxes[arrival.anchor];
      if (from !== undefined && to !== undefined) this.camera = keepCorner(this.camera, from, to);
    }
    this.svg = next;
    this.layout = after;
    this.holder.replaceChildren(next);
    next.style.transform = cameraTransform(this.camera);
    const tree = this.tree();
    if (old !== null && before !== null && after !== null && tree !== null) {
      this.glide(old, next, tree, before, after, was);
    }
    this.restoreFocus(focused);
  }

  // ------------------------------------------------------------ changing in place

  /**
   * Changes the drawing in place when only wording and emphasis differ: groups keep their place,
   * dimming and highlighting fade by the stylesheet (LOOK-901), and changed wording fades out and
   * back in (INT-102). False when the two drawings do not match group for group.
   */
  private morph(old: SVGSVGElement, next: SVGSVGElement): boolean {
    const pairs: [Element, Element][] = [];
    for (const layer of LAYERS) {
      const was = old.querySelector(`:scope > g.${layer}`);
      const now = next.querySelector(`:scope > g.${layer}`);
      if (was === null || now === null) return false;
      if (was.children.length !== now.children.length) return false;
      for (let i = 0; i < now.children.length; i++) {
        const a = was.children[i];
        const b = now.children[i];
        if (a === undefined || b === undefined) return false;
        if (a.getAttribute('data-id') !== b.getAttribute('data-id')) return false;
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
    // The trail is redrawn whole, so the current step draws itself again (LOOK-701).
    for (const layer of ['trail', 'badges']) old.querySelector(`:scope > g.${layer}`)?.remove();
    for (const layer of ['trail', 'badges']) {
      const found = next.querySelector(`:scope > g.${layer}`);
      if (found !== null) old.append(found);
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

  private place(camera: Camera, glide: boolean): void {
    const was = this.camera;
    this.camera = camera;
    if (this.svg === null) return;
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

  /** LAYOUT-451 and INT-352: fits the whole picture and returns the camera to fit mode. */
  fit(glide: boolean): void {
    if (this.svg === null) return;
    this.place(fitCamera(this.sizeOf(this.svg), this.stageSize()), glide);
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
        found.focus({ preventScroll: true });
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
