// Drawing relationship routes and arrowheads (docs/spec/look.md, LOOK-501): a route's corners are
// rounded to 9 px, less where a segment is shorter than 18 px, and a line ends in an open chevron
// 12 px long.
import type { Point } from '../layout/index.ts';
import { path } from './svg.ts';

/** LOOK-501: the corner radius of a route, the chevron's length and its half-width. */
export const ROUTE = { corner: 9, arrowLength: 12, arrowHalf: 5 } as const;

const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

/** The point `by` pixels from `from` toward `to`. */
function toward(from: Point, to: Point, by: number): Point {
  const length = distance(from, to);
  if (length === 0) return from;
  return {
    x: from.x + ((to.x - from.x) * by) / length,
    y: from.y + ((to.y - from.y) * by) / length,
  };
}

/**
 * LOOK-501: path data along a route with every corner rounded. Each corner's radius is `corner`,
 * or half the shorter of its two segments when that is less, so neighbouring curves never overlap.
 */
export function roundedRoute(points: readonly Point[], corner: number = ROUTE.corner): string {
  const [first, ...rest] = points;
  if (first === undefined) return '';
  const parts: (string | number)[] = ['M', first.x, first.y];
  for (let at = 0; at < rest.length; at++) {
    const here = rest[at];
    if (here === undefined) continue;
    const before = points[at] ?? first;
    const after = rest[at + 1];
    if (after === undefined) {
      parts.push('L', here.x, here.y);
      continue;
    }
    const radius = Math.min(corner, distance(before, here) / 2, distance(here, after) / 2);
    const turn =
      (here.x - before.x) * (after.y - here.y) - (here.y - before.y) * (after.x - here.x);
    if (radius <= 0 || Math.abs(turn) < 1e-9) {
      parts.push('L', here.x, here.y);
      continue;
    }
    const enter = toward(here, before, radius);
    const leave = toward(here, after, radius);
    parts.push('L', enter.x, enter.y, 'Q', here.x, here.y, leave.x, leave.y);
  }
  return path(...parts);
}

/**
 * LOOK-501 and LOOK-701: an open chevron with its tip at `tip`, pointing along the direction from
 * `from` to `tip`, `length` long and `half` wide on each side.
 */
export function chevron(
  tip: Point,
  from: Point,
  length: number = ROUTE.arrowLength,
  half: number = ROUTE.arrowHalf,
): string {
  const run = distance(from, tip);
  const ux = run === 0 ? 0 : (tip.x - from.x) / run;
  const uy = run === 0 ? 1 : (tip.y - from.y) / run;
  const backX = tip.x - ux * length;
  const backY = tip.y - uy * length;
  return path(
    'M',
    backX - uy * half,
    backY + ux * half,
    'L',
    tip.x,
    tip.y,
    'L',
    backX + uy * half,
    backY - ux * half,
  );
}
