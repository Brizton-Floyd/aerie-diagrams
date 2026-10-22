// The camera (docs/spec/layout.md, LAYOUT-404 to LAYOUT-452; docs/spec/interaction.md, INT-351 to
// INT-353): how the picture sits on the stage. It only magnifies and moves the picture on screen;
// it is separate from zoom, which changes depth, and it is not part of the picture (MODEL-601).
import { PAGE, fitScale } from './scores.ts';
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
  /** INT-351: a drag shorter than this, in pixels, is a click. */
  click: 4,
} as const;

/** A size on screen or in the picture. */
export interface Size {
  width: number;
  height: number;
}

/**
 * LAYOUT-451: the camera that fits the whole picture on the stage, at no more than 1.15, centred
 * across, and centred down with its top at least 34 px from the top. While a caption bar shows, the
 * picture keeps clear of its room at the bottom.
 */
export function fitCamera(picture: Size, stage: Size, caption = false): Camera {
  const scale = fitScale(picture, stage, caption);
  const room = stage.height - (caption ? PAGE.captionBar : 0);
  return {
    scale,
    x: (stage.width - picture.width * scale) / 2,
    y: Math.max(PAGE.margin, (room - picture.height * scale) / 2),
    mode: 'fit',
  };
}

const clampScale = (scale: number): number =>
  Math.min(CAMERA.maxScale, Math.max(CAMERA.minScale, scale));

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
