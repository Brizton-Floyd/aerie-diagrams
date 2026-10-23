// The camera (docs/spec/layout.md, LAYOUT-404 to LAYOUT-455; docs/spec/interaction.md, INT-351 to
// INT-354): how the picture sits on the stage. It only magnifies and moves the picture on screen;
// it is separate from zoom, which changes depth, and it is not part of the picture (MODEL-601).
import type { Id } from '../lines/index.ts';
import type { Tree } from '../model/index.ts';
import { PAGE, fitScale } from './scores.ts';
import type { StructureLayout } from './structure.ts';
import type { Box, Point } from './types.ts';

/**
 * Where the picture is on the stage: a point at picture coordinates `p` is drawn on screen at
 * `x + scale * p.x`, `y + scale * p.y`, from the stage's top left. In `fit` mode every layout change
 * fits the whole picture again; in `free` mode the reader has magnified or moved it (LAYOUT-404).
 */
export interface Camera {
  scale: number;
  x: number;
  y: number;
  mode: 'fit' | 'free';
}

/** INT-351 to INT-353 and LAYOUT-452: the camera's steps and limits. */
export const CAMERA = {
  /** The camera button and `+` key magnify by this. */
  magnify: 1.25,
  /** The camera button and `-` key shrink by this. */
  shrink: 0.8,
  /** LAYOUT-452: the scale stays between these. */
  minScale: 0.2,
  maxScale: 2.5,
  /**
   * LAYOUT-453: the smallest scale the camera goes to by itself when it follows the reader. At scale
   * 1 every text role is at least 13.5 px on screen (RULE-008).
   */
  readable: 1,
  /** INT-351: a drag shorter than this, in pixels, is a click. */
  click: 4,
} as const;

/** A size on screen or in the picture. */
export interface Size {
  width: number;
  height: number;
}

const clampScale = (scale: number): number =>
  Math.min(CAMERA.maxScale, Math.max(CAMERA.minScale, scale));

/**
 * LAYOUT-451: the camera that fits the whole picture on the stage, at no more than 1.15, centred
 * across, and centred down with its top at least 34 px from the top. While a caption or narration
 * bar shows, the picture keeps clear of its `room` at the bottom.
 */
export function fitCamera(picture: Size, stage: Size, room = 0): Camera {
  const scale = fitScale(picture, stage, room);
  const height = stage.height - room;
  return {
    scale,
    x: (stage.width - picture.width * scale) / 2,
    y: Math.max(PAGE.margin, (height - picture.height * scale) / 2),
    mode: 'fit',
  };
}

/**
 * INT-702: the camera that fits a walkthrough step's focus elements, given as their boxes in the
 * picture: the smallest box around them fills the stage less an 80 px margin on every side and the
 * `room` of the narration bar at the bottom, at no more than 1.15, centred in what is left. With no
 * boxes it fits the whole picture instead.
 */
export function focusCamera(focus: readonly Box[], picture: Size, stage: Size, room = 0): Camera {
  if (focus.length === 0) return fitCamera(picture, stage, room);
  const left = Math.min(...focus.map((box) => box.x));
  const top = Math.min(...focus.map((box) => box.y));
  const width = Math.max(...focus.map((box) => box.x + box.width)) - left;
  const height = Math.max(...focus.map((box) => box.y + box.height)) - top;
  const across = stage.width - 2 * PAGE.focusMargin;
  const down = stage.height - room - 2 * PAGE.focusMargin;
  const scale = clampScale(
    width <= 0 || height <= 0
      ? PAGE.maxScale
      : Math.min(PAGE.maxScale, across / width, down / height),
  );
  return {
    scale,
    x: stage.width / 2 - (left + width / 2) * scale,
    y: (stage.height - room) / 2 - (top + height / 2) * scale,
    mode: 'fit',
  };
}

/** The smallest box around some boxes. */
function around(boxes: readonly Box[]): Box {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  return {
    x: left,
    y: top,
    width: Math.max(...boxes.map((box) => box.x + box.width)) - left,
    height: Math.max(...boxes.map((box) => box.y + box.height)) - top,
  };
}

const middleOf = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/**
 * LAYOUT-453: the boxes a following camera frames for an element the reader opened, closed or
 * selected: its own box first, then the boxes of its directly connected neighbours, nearest first.
 * A neighbour is a drawn element at the other end of a drawn edge from the element or anything
 * inside it; the element's own ancestors are not neighbours, since their boxes hold it.
 */
export function followBoxes(tree: Tree, layout: StructureLayout, id: Id): Box[] {
  const own = layout.result.boxes[id];
  if (own === undefined) return [];
  const inside = (each: Id): boolean =>
    each === id || (tree.has(each) && tree.ancestors(each).includes(id));
  const holders = new Set(tree.has(id) ? tree.ancestors(id) : []);
  const found = new Map<Id, Box>();
  for (const edge of layout.drawing.edges) {
    const other = inside(edge.source) ? edge.target : inside(edge.target) ? edge.source : null;
    if (other === null || inside(other) || holders.has(other)) continue;
    const box = layout.result.boxes[other];
    if (box !== undefined) found.set(other, box);
  }
  const centre = middleOf(own);
  const distance = (box: Box): number => {
    const middle = middleOf(box);
    return Math.hypot(middle.x - centre.x, middle.y - centre.y);
  };
  const near = [...found]
    .map(([other, box]) => ({ other, box, far: distance(box) }))
    .sort((a, b) => a.far - b.far || (a.other < b.other ? -1 : a.other > b.other ? 1 : 0));
  return [own, ...near.map((each) => each.box)];
}

/**
 * LAYOUT-453 and LAYOUT-454: the boxes kept in view at a scale: the first box, then each other box
 * in turn while the box around them all still fits the space at that scale.
 */
function framed(focus: readonly Box[], scale: number, across: number, down: number): Box {
  const [first, ...rest] = focus;
  if (first === undefined) return { x: 0, y: 0, width: 0, height: 0 };
  let frame = first;
  for (const box of rest) {
    const wider = around([frame, box]);
    if (wider.width * scale <= across && wider.height * scale <= down) frame = wider;
  }
  return frame;
}

/**
 * One axis of a following or revealing camera: where the picture starts on screen so that the
 * frame (`start`, `length`, in picture units) is in the space from `margin` to `end - margin`.
 * With `centre`, the frame is centred in that space, a picture that fits the space is centred in
 * it, and a larger one never leaves more than the margin empty at either end; otherwise the picture
 * moves the least it must. A frame longer than the space shows its start.
 */
function axis(
  at: number,
  scale: number,
  start: number,
  length: number,
  picture: number,
  end: number,
  centre: boolean,
): number {
  const space = end - 2 * PAGE.margin;
  if (centre && picture * scale <= space) return (end - picture * scale) / 2;
  if (!centre && length * scale <= space) {
    const first = at + start * scale;
    const last = first + length * scale;
    // A hair's breadth of rounding never moves the picture.
    if (first < PAGE.margin - 0.5) return at + PAGE.margin - first;
    if (last > end - PAGE.margin + 0.5) return at + end - PAGE.margin - last;
    return at;
  }
  const place =
    length * scale > space ? PAGE.margin - start * scale : end / 2 - (start + length / 2) * scale;
  if (!centre) return place;
  return Math.min(PAGE.margin, Math.max(end - PAGE.margin - picture * scale, place));
}

/**
 * LAYOUT-453: the camera that follows the element the reader opened, closed or selected, given as
 * `followBoxes`. While the whole picture fits at a readable scale (1) or more, it fits the whole
 * picture (LAYOUT-451). Otherwise it frames the element's box and as many of its neighbours as fit
 * at a readable scale, at no less than that scale and no more than 1.15, centred on the stage less
 * the margin and the `room` of a caption bar. The rest of the picture stays where the reader can
 * move to it; the picture never leaves more than the margin empty at an edge it overflows.
 */
export function followCamera(focus: readonly Box[], picture: Size, stage: Size, room = 0): Camera {
  if (focus.length === 0 || fitScale(picture, stage, room) >= CAMERA.readable) {
    return fitCamera(picture, stage, room);
  }
  const across = stage.width - 2 * PAGE.margin;
  const down = stage.height - room - 2 * PAGE.margin;
  const frame = framed(focus, CAMERA.readable, across, down);
  const fits =
    frame.width <= 0 || frame.height <= 0
      ? PAGE.maxScale
      : Math.min(PAGE.maxScale, across / frame.width, down / frame.height);
  const scale = Math.max(CAMERA.readable, fits);
  const height = stage.height - room;
  return {
    scale,
    x: axis(0, scale, frame.x, frame.width, picture.width, stage.width, true),
    y: axis(0, scale, frame.y, frame.height, picture.height, height, true),
    mode: 'fit',
  };
}

/**
 * LAYOUT-454: the camera that brings boxes into view without changing the scale: the first box and
 * as many of the others as fit, given as `followBoxes`, end up inside the stage less the margin and
 * the `room` of a caption bar, moving the picture the least it must. Boxes already in view move
 * nothing. The camera keeps its mode.
 */
export function revealCamera(
  camera: Camera,
  focus: readonly Box[],
  picture: Size,
  stage: Size,
  room = 0,
): Camera {
  if (focus.length === 0) return camera;
  const height = stage.height - room;
  const across = stage.width - 2 * PAGE.margin;
  const down = height - 2 * PAGE.margin;
  const frame = framed(focus, camera.scale, across, down);
  const { scale } = camera;
  return {
    scale,
    x: axis(camera.x, scale, frame.x, frame.width, picture.width, stage.width, false),
    y: axis(camera.y, scale, frame.y, frame.height, picture.height, height, false),
    mode: camera.mode,
  };
}

/**
 * INT-351 and INT-352: magnifies by `factor` around a point on screen, which stays where it is. The
 * scale stays between 0.2 and 2.5 (INT-353), and the camera is then in free mode.
 */
export function magnify(camera: Camera, factor: number, at: Point): Camera {
  const scale = clampScale(camera.scale * factor);
  const ratio = scale / camera.scale;
  return {
    scale,
    x: at.x - (at.x - camera.x) * ratio,
    y: at.y - (at.y - camera.y) * ratio,
    mode: 'free',
  };
}

/** INT-351: dragging the stage moves the picture with the pointer; the camera is then free. */
export function pan(camera: Camera, dx: number, dy: number): Camera {
  return { scale: camera.scale, x: camera.x + dx, y: camera.y + dy, mode: 'free' };
}

/** INT-351: true when a pointer that moved this far was dragged rather than clicked. */
export function dragged(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= CAMERA.click;
}

/**
 * LAYOUT-404: in free mode, opening or closing a container keeps its top-left corner at the same
 * place on screen, at the same scale. `before` and `after` are its boxes in the two pictures.
 */
export function keepCorner(camera: Camera, before: Box, after: Box): Camera {
  return {
    scale: camera.scale,
    x: camera.x + camera.scale * (before.x - after.x),
    y: camera.y + camera.scale * (before.y - after.y),
    mode: 'free',
  };
}

/** Where a point of the picture is drawn on screen. */
export function onScreen(camera: Camera, point: Point): Point {
  return { x: camera.x + camera.scale * point.x, y: camera.y + camera.scale * point.y };
}
