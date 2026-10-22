// Readability scores (docs/spec/layout.md, SCORE-001 to SCORE-003): numbers that say how easy a
// layout is to read. The rules suite keeps a committed baseline and fails when any score gets worse.
import type { LayoutResult, Point } from './types.ts';

/** The tolerance of every comparison, in pixels, as for the rule checks. */
const TOLERANCE = 0.5;

/** The readability scores of one structure layout. */
export interface Scores {
  /** SCORE-001: points where two edge routes cross. Lower is better. */
  crossings: number;
  /** SCORE-002: corners in all edge routes. Lower is better. */
  bends: number;
  /** SCORE-003: the scale at which the picture fits the reference window. Higher is better. */
  fitScale: number;
}

const cross = (o: Point, a: Point, b: Point): number =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/**
 * True when two segments cross at a point inside both of them: touching ends, shared corners and
 * runs along the same line are not crossings.
 */
export function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  // Signed areas are lengths times distances; scale the tolerance by each segment's length.
  const cd = Math.hypot(d.x - c.x, d.y - c.y) * TOLERANCE;
  const ab = Math.hypot(b.x - a.x, b.y - a.y) * TOLERANCE;
  const apart = (p: number, q: number, slack: number): boolean =>
    (p > slack && q < -slack) || (p < -slack && q > slack);
  return apart(d1, d2, cd) && apart(d3, d4, ab);
}

/** SCORE-001: the number of points where two different edge routes cross. */
export function crossings(result: LayoutResult): number {
  const routes = Object.values(result.edges).map((edge) => edge.points);
  let count = 0;
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const one = routes[i] ?? [];
      const two = routes[j] ?? [];
      for (let s = 0; s + 1 < one.length; s++) {
        for (let t = 0; t + 1 < two.length; t++) {
          const a = one[s];
          const b = one[s + 1];
          const c = two[t];
          const d = two[t + 1];
          if (a && b && c && d && segmentsCross(a, b, c, d)) count += 1;
        }
      }
    }
  }
  return count;
}

/** SCORE-002: the number of corners in all edge routes, where a route turns. */
export function bends(result: LayoutResult): number {
  let count = 0;
  for (const edge of Object.values(result.edges)) {
    for (let i = 1; i + 1 < edge.points.length; i++) {
      const a = edge.points[i - 1];
      const b = edge.points[i];
      const c = edge.points[i + 1];
      if (a && b && c && Math.abs(cross(b, a, c)) > TOLERANCE * Math.hypot(c.x - a.x, c.y - a.y)) {
        count += 1;
      }
    }
  }
  return count;
}

/** The page around the stage (docs/spec/look.md, LOOK-801) and fitting (LAYOUT-451). */
export const PAGE = {
  topBar: 58,
  sidebar: 214,
  sidePanel: 344,
  /** LAYOUT-451: the margin kept on every side of a fitted picture. */
  margin: 34,
  /** LAYOUT-451: the room a showing caption bar takes at the bottom. */
  captionBar: 92,
  /** LAYOUT-451: the largest scale fitting ever uses. */
  maxScale: 1.15,
} as const;

/**
 * LAYOUT-451: the scale that fits a picture on a stage of the given size, never more than 1.15,
 * leaving the margin on every side and, while a caption bar shows, its room at the bottom.
 */
export function fitScale(
  picture: { width: number; height: number },
  stage: { width: number; height: number },
  caption = false,
): number {
  const width = stage.width - 2 * PAGE.margin;
  const height = stage.height - 2 * PAGE.margin - (caption ? PAGE.captionBar : 0);
  if (picture.width <= 0 || picture.height <= 0) return PAGE.maxScale;
  return Math.min(PAGE.maxScale, width / picture.width, height / picture.height);
}

/** SCORE-003: the stage of a 1920 x 1080 window with the sidebar and side panel showing. */
export const REFERENCE_STAGE = {
  width: 1920 - PAGE.sidebar - PAGE.sidePanel,
  height: 1080 - PAGE.topBar,
} as const;

/** SCORE-001 to SCORE-003 of one structure layout; the fit scale to three decimal places. */
export function scores(result: LayoutResult): Scores {
  return {
    crossings: crossings(result),
    bends: bends(result),
    fitScale: Math.round(fitScale(result, REFERENCE_STAGE) * 1000) / 1000,
  };
}

/** The scores in which `now` is worse than `before`, by name. Empty when nothing got worse. */
export function worse(now: Scores, before: Scores): (keyof Scores)[] {
  const out: (keyof Scores)[] = [];
  if (now.crossings > before.crossings) out.push('crossings');
  if (now.bends > before.bends) out.push('bends');
  if (now.fitScale < before.fitScale) out.push('fitScale');
  return out;
}

/** The scores in which `now` is better than `before`, by name. */
export function better(now: Scores, before: Scores): (keyof Scores)[] {
  const out: (keyof Scores)[] = [];
  if (now.crossings < before.crossings) out.push('crossings');
  if (now.bends < before.bends) out.push('bends');
  if (now.fitScale > before.fitScale) out.push('fitScale');
  return out;
}
