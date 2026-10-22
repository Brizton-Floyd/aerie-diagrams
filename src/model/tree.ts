// The containment tree of a canonical model and the facts that follow from an element's tags
// (docs/spec/model.md, MODEL-001 to MODEL-005).
import type { Element, IconName, Id, Model } from '../lines/index.ts';

/** Thrown when a model breaks a rule the parser guarantees, such as a parent listed after its child. */
export class InvalidModelError extends Error {
  override name = 'InvalidModelError';
}

/** MODEL-004: the default icon of each tag that has one, in the order the spec lists them. */
const TAG_ICONS: ReadonlyMap<string, IconName> = new Map<string, IconName>([
  ['person', 'person'],
  ['external', 'building'],
  ['store', 'cylinder'],
  ['system', 'stack'],
  ['service', 'gear'],
  ['module', 'module'],
]);

/**
 * Lookups over the element forest (MODEL-002). Built once per model; every list it returns is in
 * model order (MODEL-001), the order of the canonical `elements` list.
 */
export class Tree {
  readonly elements: readonly Element[];
  private readonly byId = new Map<Id, Element>();
  private readonly orderOf = new Map<Id, number>();
  private readonly childrenOf = new Map<Id | null, Element[]>();
  private readonly depthOf = new Map<Id, number>();

  constructor(model: Model) {
    this.elements = model.elements;
    this.childrenOf.set(null, []);
    model.elements.forEach((element, index) => {
      if (this.byId.has(element.id)) {
        throw new InvalidModelError(`The element id ${element.id} is used twice.`);
      }
      // LANG-803 lists each parent before its children, which also rules out cycles.
      const parentDepth = element.parent === null ? -1 : this.depthOf.get(element.parent);
      if (parentDepth === undefined) {
        throw new InvalidModelError(
          `The element ${element.id} names ${String(element.parent)} as its parent, which is not listed before it.`,
        );
      }
      this.byId.set(element.id, element);
      this.orderOf.set(element.id, index);
      this.depthOf.set(element.id, parentDepth + 1);
      this.childrenOf.set(element.id, []);
      this.childrenOf.get(element.parent)?.push(element);
    });
  }

  has(id: Id): boolean {
    return this.byId.has(id);
  }

  /** The element with this id; throws for an id the model does not have. */
  get(id: Id): Element {
    const element = this.byId.get(id);
    if (element === undefined) {
      throw new InvalidModelError(`There is no element ${id}.`);
    }
    return element;
  }

  /** MODEL-001: the element's position in model order. */
  order(id: Id): number {
    return this.orderOf.get(id) ?? -1;
  }

  /** Sorts ids into model order, in place, and returns them. */
  sort(ids: Id[]): Id[] {
    return ids.sort((a, b) => this.order(a) - this.order(b));
  }

  /** MODEL-002: the elements with no parent. */
  topLevel(): readonly Element[] {
    return this.childrenOf.get(null) ?? [];
  }

  parent(id: Id): Id | null {
    return this.get(id).parent;
  }

  children(id: Id): readonly Element[] {
    return this.childrenOf.get(id) ?? [];
  }

  /** Children and their descendants, in model order. */
  descendants(id: Id): Element[] {
    return this.children(id).flatMap((child) => [child, ...this.descendants(child.id)]);
  }

  /** The parent, then the parent's parent, and so on: nearest first. */
  ancestors(id: Id): Id[] {
    const out: Id[] = [];
    for (let at = this.parent(id); at !== null; at = this.parent(at)) {
      out.push(at);
    }
    return out;
  }

  /** The number of ancestors: top-level elements have depth 0. */
  depth(id: Id): number {
    return this.depthOf.get(id) ?? this.ancestors(id).length;
  }

  /** The top-level element that holds `id`, or `id` itself when it is top level. */
  top(id: Id): Id {
    return this.ancestors(id).at(-1) ?? id;
  }

  /** A container has at least one child; a leaf has none. */
  isContainer(id: Id): boolean {
    return this.children(id).length > 0;
  }

  /** True when `outer` is an ancestor of `inner` (never for the element itself). */
  contains(outer: Id, inner: Id): boolean {
    return this.ancestors(inner).includes(outer);
  }

  /** MODEL-003: `person` and `external` elements sit on the rim of the picture. */
  isRim(id: Id): boolean {
    const tags = this.get(id).tags;
    return tags.includes('person') || tags.includes('external');
  }

  /** MODEL-004: the `icon` line's icon, else the first tag's default, else `box`. */
  icon(id: Id): IconName {
    const element = this.get(id);
    if (element.icon !== null) {
      return element.icon as IconName;
    }
    for (const tag of element.tags) {
      const icon = TAG_ICONS.get(tag);
      if (icon !== undefined) {
        return icon;
      }
    }
    return 'box';
  }

  /**
   * MODEL-005: the kicker of the side panel. `parentName` is the parent's name in the reader's
   * audience; it is ignored for a top-level element.
   */
  kindLabel(id: Id, parentName: string | null): string {
    const element = this.get(id);
    const tags = element.tags;
    const first = tags[0];
    let label: string;
    if (tags.includes('person')) {
      label = 'Person';
    } else if (tags.includes('external')) {
      label = 'Outside the system';
    } else if (first === undefined) {
      label = 'Element';
    } else {
      const words = first.replace(/-/g, ' ');
      label = words.charAt(0).toUpperCase() + words.slice(1);
    }
    return element.parent === null || parentName === null ? label : `${label} in ${parentName}`;
  }
}
