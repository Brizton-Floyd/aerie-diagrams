// The readability scores themselves (docs/spec/layout.md, SCORE-001 to SCORE-003), on routes made
// by hand. The rules suite compares them with the committed baseline on every sample.
import { describe, expect, it } from 'vitest';
import {
  REFERENCE_STAGE,
  bends,
  better,
  crossings,
  fitScale,
  scores,
  segmentsCross,
  worse,
  type LayoutResult,
  type Point,
} from '../../../src/layout/index.ts';

const p = (x: number, y: number): Point => ({ x, y });

/** A layout result with only these routes. */
function routes(...lines: Point[][]): LayoutResult {
  const edges: LayoutResult['edges'] = {};
  lines.forEach((points, index) => {
    edges[`e${String(index)}`] = { points, label: { x: 0, y: 0, width: 0, height: 0 } };
  });
  return { width: 100, height: 100, boxes: {}, edges };
}

describe('readability scores', () => {
  it('SCORE-001 counts the points where two edge routes cross', () => {
    expect(segmentsCross(p(0, 5), p(10, 5), p(5, 0), p(5, 10))).toBe(true);
    // Touching at an end, meeting at a shared corner, or running along each other is no crossing.
    expect(segmentsCross(p(0, 5), p(10, 5), p(10, 0), p(10, 10))).toBe(false);
    expect(segmentsCross(p(0, 0), p(10, 0), p(10, 0), p(10, 10))).toBe(false);
    expect(segmentsCross(p(0, 0), p(10, 0), p(5, 0), p(15, 0))).toBe(false);
    expect(segmentsCross(p(0, 5), p(10, 5), p(5, 5.3), p(5, 10))).toBe(false);
    // A route snaking across another twice crosses it twice; a route never crosses itself.
    const straight = [p(0, 50), p(100, 50)];
    const snake = [p(20, 0), p(20, 100), p(60, 100), p(60, 0)];
    expect(crossings(routes(straight, snake))).toBe(2);
    expect(crossings(routes(snake))).toBe(0);
    expect(crossings(routes(straight, [p(0, 60), p(100, 60)]))).toBe(0);
  });

  it('SCORE-002 counts the corners in all edge routes', () => {
    expect(bends(routes([p(0, 0), p(0, 10)]))).toBe(0);
    expect(bends(routes([p(0, 0), p(0, 10), p(10, 10), p(10, 20)]))).toBe(2);
    // A point on a straight run is no corner.
    expect(bends(routes([p(0, 0), p(0, 10), p(0, 20)]))).toBe(0);
    expect(bends(routes([p(0, 0), p(0, 10), p(10, 10)], [p(5, 5), p(5, 6), p(6, 6)]))).toBe(2);
  });

  it('SCORE-003 is the scale that fits the picture into a 1920 x 1080 window with both panels', () => {
    // 1920 less the 214 px sidebar and 344 px side panel; 1080 less the 58 px top bar.
    expect(REFERENCE_STAGE).toEqual({ width: 1362, height: 1022 });
    // A margin of 34 px on every side, and never above 1.15.
    expect(fitScale({ width: 100, height: 100 }, REFERENCE_STAGE)).toBe(1.15);
    expect(fitScale({ width: 2588, height: 100 }, REFERENCE_STAGE)).toBe(0.5);
    expect(fitScale({ width: 100, height: 1908 }, REFERENCE_STAGE)).toBe(0.5);
    // While a caption bar shows, it takes 92 px at the bottom.
    expect(fitScale({ width: 100, height: 1724 }, REFERENCE_STAGE, true)).toBe(0.5);
    expect(scores({ ...routes(), width: 2588, height: 100 })).toEqual({
      crossings: 0,
      bends: 0,
      fitScale: 0.5,
    });
  });

  it('SCORE-001 to SCORE-003 say which scores got worse or better than a baseline', () => {
    const base = { crossings: 2, bends: 10, fitScale: 0.8 };
    expect(worse(base, base)).toEqual([]);
    expect(worse({ crossings: 3, bends: 9, fitScale: 0.7 }, base)).toEqual([
      'crossings',
      'fitScale',
    ]);
    expect(better({ crossings: 3, bends: 9, fitScale: 0.7 }, base)).toEqual(['bends']);
  });
});
