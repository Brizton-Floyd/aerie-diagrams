// View resolution: what a view selects, what it draws at a zoom state, and how opening, closing and
// revealing change the zoom state (docs/spec/model.md, MODEL-201 to MODEL-211).
import type { Id, View } from '../lines/index.ts';
import type { Tree } from './tree.ts';

/** A reader's change to one container: shown with its children inside, or as one box. */
export type ZoomMark = 'open' | 'closed';

/**
 * MODEL-204: the zoom state, from container id to its mark. A container with no entry is in its
 * default state. Every zoom state this module returns is normalised (MODEL-208), with its entries in
 * model order, so two zoom states that draw the same elements have the same entries.
 */
export type Zoom = ReadonlyMap<Id, ZoomMark>;

/** The empty zoom state: every container in its default state. */
export const DEFAULT_ZOOM: Zoom = new Map();

/** The elements drawn on screen, in model order. Every drawn element's parent is drawn too. */
export type DrawnSet = ReadonlySet<Id>;

/** LANG-506: the view of a model that declares none. It is not written into the canonical model. */
export const OVERVIEW: View = {
  id: 'overview',
  title: { base: 'Overview', set: {} },
  about: { base: null, set: {}, add: {} },
  show: [],
  kinds: ['runtime'],
};

/** How a drawn element is drawn: a leaf box, an open container or a closed container (MODEL-203). */
export type DrawnState = 'leaf' | 'open' | 'closed';

/** One view's selection and default drawn set, and the zoom operations on it. */
export class ViewScope {
  readonly view: View;
  /** MODEL-201: the elements the view's `show` items select, in model order. */
  readonly selected: ReadonlySet<Id>;
  /** MODEL-202: the default drawn set `D0`, the selected elements and all their ancestors. */
  readonly defaults: DrawnSet;
  private readonly tree: Tree;

  constructor(tree: Tree, view: View) {
    this.tree = tree;
    this.view = view;
    const selected = new Set<Id>();
    for (const item of view.show) {
      if ('tag' in item) {
        for (const element of tree.elements) {
          if (element.tags.includes(item.tag)) selected.add(element.id);
        }
      } else {
        const base = tree.depth(item.element);
        selected.add(item.element);
        for (const element of tree.descendants(item.element)) {
          if (tree.depth(element.id) - base <= item.depth) selected.add(element.id);
        }
      }
    }
    if (view.show.length === 0) {
      for (const element of tree.topLevel()) selected.add(element.id);
    }
    const defaults = new Set<Id>();
    for (const id of selected) {
      defaults.add(id);
      for (const ancestor of tree.ancestors(id)) defaults.add(ancestor);
    }
    this.selected = new Set(tree.sort([...selected]));
    this.defaults = new Set(tree.sort([...defaults]));
  }

  /**
   * MODEL-205: the drawn set at a zoom state, built from the top down. The top-level elements of `D0`
   * are always drawn; below a drawn container, `open` draws every child, `closed` none, and the
   * default the children in `D0`.
   */
  drawn(zoom: Zoom): DrawnSet {
    const drawn = new Set<Id>();
    // Model order lists each parent before its children, so one pass sees every parent first.
    for (const element of this.tree.elements) {
      if (element.parent === null) {
        if (this.defaults.has(element.id)) drawn.add(element.id);
        continue;
      }
      if (!drawn.has(element.parent)) continue;
      const mark = zoom.get(element.parent);
      if (mark === 'open' || (mark === undefined && this.defaults.has(element.id))) {
        drawn.add(element.id);
      }
    }
    return drawn;
  }

  /** MODEL-203: leaf, open (at least one child drawn) or closed. */
  state(drawn: DrawnSet, id: Id): DrawnState {
    const children = this.tree.children(id);
    if (children.length === 0) return 'leaf';
    return children.some((child) => drawn.has(child.id)) ? 'open' : 'closed';
  }

  /** MODEL-203: an open container that draws only some of its children is open partly. */
  partly(drawn: DrawnSet, id: Id): boolean {
    const children = this.tree.children(id);
    const shown = children.filter((child) => drawn.has(child.id)).length;
    return shown > 0 && shown < children.length;
  }

  /**
   * MODEL-208: keeps an entry only for a drawn container whose mark differs from its default, so
   * `open` goes when the default already draws every child and `closed` when it draws none. Entries
   * for ids that are not drawn containers, including ids the model does not have, are dropped.
   * Normalising never changes the drawn set.
   */
  normalise(zoom: Zoom): Zoom {
    const drawn = this.drawn(zoom);
    const out = new Map<Id, ZoomMark>();
    for (const id of drawn) {
      const mark = zoom.get(id);
      const children = this.tree.children(id);
      if (mark === undefined || children.length === 0) continue;
      const byDefault = children.filter((child) => this.defaults.has(child.id)).length;
      if (mark === 'open' && byDefault === children.length) continue;
      if (mark === 'closed' && byDefault === 0) continue;
      out.set(id, mark);
    }
    return out;
  }

  /** MODEL-206: opening sets `open`; the children then show, each in its own default state. */
  open(zoom: Zoom, id: Id): Zoom {
    return this.normalise(new Map(zoom).set(id, 'open'));
  }

  /** MODEL-206: closing sets `closed` and hides every descendant. */
  close(zoom: Zoom, id: Id): Zoom {
    return this.normalise(new Map(zoom).set(id, 'closed'));
  }

  /**
   * MODEL-207: opens, from the outermost down, each ancestor of `id` that does not already draw the
   * next element on the way to `id`. An element whose top-level ancestor the view never draws cannot
   * be revealed; the zoom state is then returned unchanged.
   */
  reveal(zoom: Zoom, id: Id): Zoom {
    return this.normalise(this.revealing(zoom, id).zoom);
  }

  /** The containers that revealing `id` opens, outermost first, and the zoom state it gives. */
  revealing(zoom: Zoom, id: Id): { opened: Id[]; zoom: Zoom } {
    const path = [...this.tree.ancestors(id).reverse(), id];
    const out = new Map(zoom);
    const opened: Id[] = [];
    let drawn = this.drawn(out);
    if (!drawn.has(path[0] ?? id)) return { opened, zoom: out };
    for (let i = 0; i + 1 < path.length; i++) {
      const container = path[i] ?? id;
      if (!drawn.has(path[i + 1] ?? id)) {
        out.set(container, 'open');
        opened.push(container);
        drawn = this.drawn(out);
      }
    }
    return { opened, zoom: out };
  }

  /** MODEL-211: every drawn container open, recursively. */
  everythingOpen(): Zoom {
    const out = new Map<Id, ZoomMark>();
    for (const element of this.tree.elements) {
      if (this.tree.isContainer(element.id)) out.set(element.id, 'open');
    }
    return this.normalise(out);
  }

  /** MODEL-211: every top-level container closed. */
  allClosed(): Zoom {
    const out = new Map<Id, ZoomMark>();
    for (const element of this.tree.topLevel()) {
      if (this.tree.isContainer(element.id)) out.set(element.id, 'closed');
    }
    return this.normalise(out);
  }

  /**
   * True when `id` has a lift in every drawn set of this view: its top-level ancestor is drawn, and
   * top-level elements never change while the view is shown (MODEL-205).
   */
  holds(id: Id): boolean {
    return this.defaults.has(this.tree.top(id));
  }
}
