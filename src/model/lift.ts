// Lifting: drawing relationships declared at any depth between the elements a reader can see
// (docs/spec/model.md, MODEL-301 to MODEL-303).
import type { Id, Relationship } from '../lines/index.ts';
import type { Tree } from './tree.ts';
import type { DrawnSet } from './views.ts';

/** MODEL-301: `id` if it is drawn, otherwise its nearest drawn ancestor, otherwise null. */
export function lift(tree: Tree, drawn: DrawnSet, id: Id): Id | null {
  if (drawn.has(id)) return id;
  return tree.ancestors(id).find((ancestor) => drawn.has(ancestor)) ?? null;
}

/** MODEL-303: one line on screen, from one drawn element to another. */
export interface DrawnEdge {
  /** `source->target`, the same across zoom states and audiences. */
  id: string;
  source: Id;
  target: Id;
  /**
   * The relationships the edge carries, as indexes into the model's `relationships`, in model order.
   * The first one gives the label (MODEL-304).
   */
  carries: number[];
}

/**
 * MODEL-302 and MODEL-303: the drawn edges for a drawn set. Each relationship of a drawn kind is
 * carried between the lifts of its ends, unless an end has no lift, both ends lift to one element, or
 * one lift contains the other. Edges are ordered by their first relationship.
 */
export function drawnEdges(
  tree: Tree,
  relationships: readonly Relationship[],
  kinds: readonly Id[],
  drawn: DrawnSet,
): DrawnEdge[] {
  const edges = new Map<string, DrawnEdge>();
  relationships.forEach((relationship, index) => {
    if (!kinds.includes(relationship.kind)) return;
    const source = lift(tree, drawn, relationship.subject);
    const target = lift(tree, drawn, relationship.object);
    if (source === null || target === null || source === target) return;
    if (tree.contains(source, target) || tree.contains(target, source)) return;
    const id = `${source}->${target}`;
    const edge = edges.get(id);
    if (edge === undefined) {
      edges.set(id, { id, source, target, carries: [index] });
    } else {
      edge.carries.push(index);
    }
  });
  return [...edges.values()];
}
