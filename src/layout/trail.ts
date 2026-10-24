// The scenario trail on the map (docs/spec/layout.md, LAYOUT-501 to LAYOUT-504): where each step
// of a playing scenario is drawn over a structure layout. The trail never moves a box; it is worked
// out again from the current lifts whenever the zoom changes (LAYOUT-505).
import type { Id } from '../lines/index.ts';
import type { StepRole, Trail } from '../model/index.ts';
import { round, type Box, type LayoutResult, type Point } from './types.ts';

/** The trail's geometry, in pixels. */
export const TRAIL = {
  /** LAYOUT-501: the most a curve bows sideways. */
  bendMax: 64,
  /** LAYOUT-501: how far a curve bows for its length. */
  bendRatio: 0.24,
  /** LAYOUT-502: curves end this far outside their boxes. */
  clear: 5,
  /** LAYOUT-504: the first loop's line below the top of its box, and the space between loops. */
  loopTop: 16,
  loopStep: 22,
  /** LAYOUT-504: a loop starts and ends this far above and below its line. */
  loopHalf: 5,
  /** LAYOUT-504: a loop starts this far right of its box and bulges this far further. */
  loopGap: 3,
  loopBulge: 26,
  /** LAYOUT-504: a loop's badge sits this far right of where it starts. */
  loopBadge: 20,
} as const;

/** A step between two different lifts: a quadratic curve from `start` to `end` through `control`. */
export interface TrailCurve {
  number: number;
  role: StepRole;
  kind: 'curve';
  from: Id;
  to: Id;
  start: Point;
  control: Point;
  end: Point;
  /** LAYOUT-503: the curve's middle point. */
  badge: Point;
  /** An overview can follow the structure's routed connection instead of bowing across boxes. */
  route?: readonly Point[];
}

/** A folded step: a small cubic loop on the right edge of its box. */
export interface TrailLoop {
  number: number;
  role: StepRole;
  kind: 'loop';
  on: Id;
  start: Point;
  controls: [Point, Point];
  end: Point;
  badge: Point;
}

export type TrailShape = TrailCurve | TrailLoop;

const centreOf = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

const roundPoint = (at: Point): Point => ({ x: round(at.x), y: round(at.y) });

/**
 * LAYOUT-502: where the line from a box's centre toward `toward` leaves the box grown by `clear`
 * on every side.
 */
export function leave(box: Box, toward: Point): Point {
  const centre = centreOf(box);
  const dx = toward.x - centre.x;
  const dy = toward.y - centre.y;
  const halfWidth = box.width / 2 + TRAIL.clear;
  const halfHeight = box.height / 2 + TRAIL.clear;
  const t = Math.min(
    dx === 0 ? Infinity : halfWidth / Math.abs(dx),
    dy === 0 ? Infinity : halfHeight / Math.abs(dy),
  );
  if (!Number.isFinite(t)) return centre;
  return { x: centre.x + t * dx, y: centre.y + t * dy };
}

/**
 * LAYOUT-501 to LAYOUT-503: a step from box `a` to box `b`. The control point is the midpoint of
 * the centres pushed sideways by `bend = min(64, 0.24 * len)`, to the left of the direction of
 * travel as seen on screen (y grows downward), so a call and its reply bow to opposite sides.
 */
export function curveBetween(
  a: Box,
  b: Box,
): { start: Point; control: Point; end: Point; badge: Point } {
  const from = centreOf(a);
  const to = centreOf(b);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const bend = Math.min(TRAIL.bendMax, TRAIL.bendRatio * length);
  // On screen, the left of travel along (dx, dy) is (dy, -dx).
  const side = length === 0 ? { x: 0, y: 0 } : { x: dy / length, y: -dx / length };
  const control = {
    x: (from.x + to.x) / 2 + side.x * bend,
    y: (from.y + to.y) / 2 + side.y * bend,
  };
  const start = leave(a, control);
  const end = leave(b, control);
  const badge = {
    x: (start.x + 2 * control.x + end.x) / 4,
    y: (start.y + 2 * control.y + end.y) / 4,
  };
  return {
    start: roundPoint(start),
    control: roundPoint(control),
    end: roundPoint(end),
    badge: roundPoint(badge),
  };
}

/**
 * LAYOUT-504: the k-th folded step (from 1) drawn on a box. It sits on the line
 * `y = top + 16 + ((k - 1) mod slots) * 22`, starts and ends 5 px above and below it at
 * `x = right + 3`, and bulges 26 px to the right; its badge sits 20 px right of `x`.
 */
export function loopOn(
  box: Box,
  k: number,
): { start: Point; controls: [Point, Point]; end: Point; badge: Point } {
  const slots = Math.max(1, Math.floor((box.height - TRAIL.loopTop) / TRAIL.loopStep));
  const y = box.y + TRAIL.loopTop + ((k - 1) % slots) * TRAIL.loopStep;
  const x = box.x + box.width + TRAIL.loopGap;
  // A cubic whose two controls are `reach` to the right bulges three quarters of `reach`.
  const reach = (TRAIL.loopBulge * 4) / 3;
  const spread = TRAIL.loopHalf * 2;
  return {
    start: roundPoint({ x, y: y - TRAIL.loopHalf }),
    controls: [
      roundPoint({ x: x + reach, y: y - TRAIL.loopHalf - spread }),
      roundPoint({ x: x + reach, y: y + TRAIL.loopHalf + spread }),
    ],
    end: roundPoint({ x, y: y + TRAIL.loopHalf }),
    badge: roundPoint({ x: x + TRAIL.loopBadge, y }),
  };
}

/** The shapes of a trail's steps over a structure layout, in step order. */
export function trailShapes(result: LayoutResult, trail: Trail): TrailShape[] {
  const loops = new Map<Id, number>();
  const boxOf = (id: Id): Box => {
    const box = result.boxes[id];
    if (box === undefined) throw new Error(`The trail runs through ${id}, which has no box.`);
    return box;
  };
  return trail.steps.map((step): TrailShape => {
    if (step.kind === 'loop') {
      const k = (loops.get(step.on) ?? 0) + 1;
      loops.set(step.on, k);
      return {
        number: step.number,
        role: step.role,
        kind: 'loop',
        on: step.on,
        ...loopOn(boxOf(step.on), k),
      };
    }
    return {
      number: step.number,
      role: step.role,
      kind: 'curve',
      from: step.from,
      to: step.to,
      ...curveBetween(boxOf(step.from), boxOf(step.to)),
    };
  });
}
