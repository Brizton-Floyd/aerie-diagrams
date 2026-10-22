// The scenario trail on the map (docs/spec/layout.md, LAYOUT-501 to LAYOUT-504).
import { describe, expect, it } from 'vitest';
import { DEFAULT_ZOOM } from '../../../src/model/index.ts';
import {
  TRAIL,
  curveBetween,
  leave,
  loopOn,
  trailShapes,
  type Box,
  type TrailLoop,
} from '../../../src/layout/index.ts';
import { LOTTO, layouter } from './helpers.ts';

const a: Box = { x: 0, y: 0, width: 100, height: 40 };
const b: Box = { x: 0, y: 300, width: 100, height: 40 };

describe('the trail on the map', () => {
  it('LAYOUT-501 a step is a quadratic curve bowed min(64, 0.24 len) to the left of travel on screen', () => {
    const down = curveBetween(a, b);
    // From (50, 20) down to (50, 320): len 300, bend 64 (0.24 * 300 = 72 is more than 64).
    // Travelling down the screen, the left is +x.
    expect(down.control).toEqual({ x: 114, y: 170 });
    const up = curveBetween(b, a);
    expect(up.control).toEqual({ x: -14, y: 170 });
    const near = curveBetween(a, { x: 0, y: 100, width: 100, height: 40 });
    // len 100 gives 24.
    expect(near.control).toEqual({ x: 74, y: 70 });
    const right = curveBetween(a, { x: 300, y: 0, width: 100, height: 40 });
    // Travelling right, the left on screen is up.
    expect(right.control.y).toBeLessThan(20);
  });

  it('LAYOUT-502 each end is where the line from the centre to the control point leaves the box grown by 5 px', () => {
    const { start, control, end } = curveBetween(a, b);
    const near = (one: { x: number; y: number }, two: { x: number; y: number }): void => {
      expect(one.x).toBeCloseTo(two.x, 1);
      expect(one.y).toBeCloseTo(two.y, 1);
    };
    near(start, leave(a, control));
    near(end, leave(b, control));
    // The control point (114, 170) seen from (50, 20) leaves through the bottom, 5 px below it.
    expect(start.y).toBeCloseTo(a.height + TRAIL.clear, 1);
    expect(end.y).toBeCloseTo(b.y - TRAIL.clear, 1);
    expect(leave(a, { x: 500, y: 20 })).toEqual({ x: 105, y: 20 });
  });

  it('LAYOUT-503 the badge sits at the curve middle point, (p0 + 2c + p2) / 4', () => {
    const { start, control, end, badge } = curveBetween(a, b);
    expect(badge.x).toBeCloseTo((start.x + 2 * control.x + end.x) / 4, 1);
    expect(badge.y).toBeCloseTo((start.y + 2 * control.y + end.y) / 4, 1);
  });

  it('LAYOUT-504 a folded step is a small loop on the right edge, stacked 22 px apart and wrapping', () => {
    const box: Box = { x: 10, y: 100, width: 200, height: 60 };
    // slots = floor((60 - 16) / 22) = 2
    const first = loopOn(box, 1);
    expect(first.start).toEqual({ x: 213, y: 111 });
    expect(first.end).toEqual({ x: 213, y: 121 });
    expect(first.badge).toEqual({ x: 233, y: 116 });
    // Its two controls sit so the loop bulges 26 px: a cubic reaches 3/4 of its controls' offset.
    expect(((first.controls[0].x - 213) * 3) / 4).toBeCloseTo(26, 1);
    expect(loopOn(box, 2).badge.y).toBe(138);
    expect(loopOn(box, 3).badge.y).toBe(116);
    expect(loopOn({ ...box, height: 20 }, 2).badge.y).toBe(116);
  });

  it('LAYOUT-504 the Generate picks trail on the Big picture folds steps inside the engine onto it, in turn', async () => {
    const picture = await layouter(LOTTO).picture('big-picture', DEFAULT_ZOOM, 'manager');
    const shapes = trailShapes(
      picture.result,
      LOTTO.trail('generate-picks', 'big-picture', DEFAULT_ZOOM, 14),
    );
    expect(shapes).toHaveLength(14);
    const loops = shapes.filter((shape): shape is TrailLoop => shape.kind === 'loop');
    expect(loops.map((shape) => shape.on)).toEqual(loops.map(() => 'engine'));
    const engine = picture.result.boxes['engine'];
    expect(loops[0]?.start.x).toBe((engine?.x ?? 0) + (engine?.width ?? 0) + 3);
    expect(new Set(loops.map((shape) => shape.badge.y)).size).toBeGreaterThan(1);
    expect(shapes[0]).toMatchObject({
      number: 1,
      role: 'call',
      kind: 'curve',
      from: 'user',
      to: 'website',
    });
  });
});
