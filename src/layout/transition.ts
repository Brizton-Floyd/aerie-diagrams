// The change from one layout to the next (docs/spec/layout.md, LAYOUT-401 to LAYOUT-403): which
// elements glide, which fade in and which leave, and when the lines come back. Each picture is laid
// out from scratch (LAYOUT-401); this plan only matches the two by element id, so a reader sees the
// same element move rather than one vanish and another appear.
import type { Id } from '../lines/index.ts';
import type { Tree } from '../model/index.ts';
import type { StructureLayout } from './structure.ts';
import type { Box, Point } from './types.ts';

/** When one part of a change starts and how long it lasts, in milliseconds. */
export interface Timing {
  delay: number;
  duration: number;
}

/** LAYOUT-402 and LOOK-901: the timing of each part of a change, from the glide time `G`. */
export interface Timings {
  /** Elements in both pictures, and the camera: over `G`. */
  glide: Timing;
  /** New elements fade in from `0.4 G`, over `0.7 G`. */
  enter: Timing;
  /** Leaving elements shrink and fade over `0.5 G`. */
  leave: Timing;
  /** The new lines and labels fade in from `G + 60 ms`, over `0.6 G`. */
  lines: Timing;
}

/** LAYOUT-402: the gap between the end of the glide and the lines coming back. */
const LINES_GAP = 60;

/**
 * LAYOUT-402 for a glide time `G` in milliseconds. Reduced motion makes `G` zero, and then every
 * part, the gap before the lines included, takes no time at all (LOOK-903).
 */
export function timings(glide: number): Timings {
  if (glide <= 0) {
    const none = { delay: 0, duration: 0 };
    return { glide: none, enter: none, leave: none, lines: none };
  }
  return {
    glide: { delay: 0, duration: glide },
    enter: { delay: 0.4 * glide, duration: 0.7 * glide },
    leave: { delay: 0, duration: 0.5 * glide },
    lines: { delay: glide + LINES_GAP, duration: 0.6 * glide },
  };
}

/** An element in both pictures, gliding from its old box to its new one. */
export interface Glide {
  id: Id;
  from: Box;
  to: Box;
}

/** An element only in the old picture, shrinking toward a point of the new one as it fades. */
export interface Leave {
  id: Id;
  from: Box;
  toward: Point;
}

/** LAYOUT-402: how the elements of one picture become those of the next. */
export interface Transition {
  /** Elements in both pictures, in the new picture's model order. */
  glide: Glide[];
  /** Elements only in the new picture, in model order: placed at their new box, fading in. */
  enter: Id[];
  /** Elements only in the old picture, in model order. */
  leave: Leave[];
}

const centre = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/**
 * The middle of an element's header in a layout: an open container's header band, or the whole box
 * of a leaf or closed container, which is all header.
 */
export function headerMiddle(layout: StructureLayout, id: Id): Point | null {
  const box = layout.result.boxes[id];
  if (box === undefined) return null;
  const node = layout.graph.nodes.find((each) => each.id === id);
  if (node?.open !== true) return centre(box);
  return { x: box.x + box.width / 2, y: box.y + Math.min(box.height, node.header) / 2 };
}

/**
 * LAYOUT-402: matches two layouts by element id. Elements drawn in both glide; new ones fade in;
 * leaving ones shrink toward the middle of their nearest ancestor's header in the new picture, or
 * toward their own middle when no ancestor is drawn there (as when switching view).
 */
export function transitionPlan(
  tree: Tree,
  before: StructureLayout,
  after: StructureLayout,
): Transition {
  const glide: Glide[] = [];
  const enter: Id[] = [];
  for (const node of after.drawing.nodes) {
    const to = after.result.boxes[node.id];
    if (to === undefined) continue;
    const from = before.result.boxes[node.id];
    if (from === undefined) enter.push(node.id);
    else glide.push({ id: node.id, from, to });
  }
  const leave: Leave[] = [];
  const oldParents = new Map(before.drawing.nodes.map((node) => [node.id, node.parent]));
  for (const node of before.drawing.nodes) {
    const from = before.result.boxes[node.id];
    if (from === undefined || after.result.boxes[node.id] !== undefined) continue;
    const ancestors = tree.has(node.id) ? tree.ancestors(node.id) : [];
    // A valid edit may remove the id from the new tree; its old drawing still knows its parents.
    if (!tree.has(node.id)) {
      for (let parent = node.parent; parent !== null; parent = oldParents.get(parent) ?? null)
        ancestors.push(parent);
    }
    const ancestor = ancestors.find((id) => after.result.boxes[id] !== undefined);
    const toward = ancestor === undefined ? null : headerMiddle(after, ancestor);
    leave.push({ id: node.id, from, toward: toward ?? centre(from) });
  }
  return { glide, enter, leave };
}
