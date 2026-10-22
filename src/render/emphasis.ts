// Highlight and dim (docs/spec/look.md, LOOK-601 to LOOK-603 and LOOK-705): which drawn elements and
// lines keep full strength, which are marked, and which are pushed back, for a selection, a
// walkthrough's focus or a playing scenario. The renderer turns the marks into classes.
import type { Id } from '../lines/index.ts';
import type { Drawing, Tree } from '../model/index.ts';

/** What is in focus on a picture. */
export type Focus =
  | { kind: 'none' }
  /** LOOK-601 and LOOK-603: a selected element, or every element a walkthrough step focuses. */
  | { kind: 'select'; ids: readonly Id[] }
  /** LOOK-705: a playing scenario's elements visited so far and the current step's two. */
  | { kind: 'trail'; visited: readonly Id[]; current: readonly Id[] };

/**
 * How an element is drawn: `sel` selected or focused, `now` an end of the current step, `rel` the
 * other end of a selected element's relationship, `full` at full strength, `context` a container
 * around something in focus (its frame pushed back, its text kept), `dim` pushed back, `plain`
 * nothing in focus.
 */
export type NodeMark = 'sel' | 'now' | 'rel' | 'full' | 'context' | 'dim' | 'plain';

/** How a line and its label are drawn: `on` a selected element's, `dim` pushed back, `plain`. */
export type EdgeMark = 'on' | 'dim' | 'plain';

export interface Emphasis {
  nodes: Map<Id, NodeMark>;
  edges: Map<string, EdgeMark>;
}

/** The marks of every drawn element and edge for a focus. Ids not drawn are ignored. */
export function emphasis(tree: Tree, drawing: Drawing, focus: Focus): Emphasis {
  const nodes = new Map<Id, NodeMark>();
  const edges = new Map<string, EdgeMark>();
  const drawn = new Set(drawing.nodes.map((node) => node.id));
  if (focus.kind === 'none') {
    for (const id of drawn) nodes.set(id, 'plain');
    for (const edge of drawing.edges) edges.set(edge.id, 'plain');
    return { nodes, edges };
  }
  const marked = new Map<Id, NodeMark>();
  const mark = (ids: Iterable<Id>, value: NodeMark): void => {
    for (const id of ids) if (drawn.has(id) && !marked.has(id)) marked.set(id, value);
  };
  if (focus.kind === 'select') {
    const chosen = new Set(focus.ids.filter((id) => drawn.has(id)));
    const related = new Set<Id>();
    for (const edge of drawing.edges) {
      const on = chosen.has(edge.source) || chosen.has(edge.target);
      edges.set(edge.id, on ? 'on' : 'dim');
      if (on) related.add(edge.source).add(edge.target);
    }
    mark(chosen, 'sel');
    mark(related, 'rel');
    // LOOK-602: elements inside a selected one keep full strength.
    mark(
      [...drawn].filter((id) => [...chosen].some((outer) => tree.contains(outer, id))),
      'full',
    );
    mark(
      [...chosen, ...related].flatMap((id) => tree.ancestors(id)),
      'context',
    );
  } else {
    for (const edge of drawing.edges) edges.set(edge.id, 'dim');
    mark(focus.current, 'now');
    mark(focus.visited, 'full');
    mark(
      focus.visited.flatMap((id) => tree.ancestors(id)),
      'context',
    );
  }
  for (const id of drawn) nodes.set(id, marked.get(id) ?? 'dim');
  return { nodes, edges };
}
