// Changes between pictures and the camera (docs/spec/layout.md, LAYOUT-401 to LAYOUT-455;
// docs/spec/interaction.md, INT-351 to INT-354): the transition plan (who glides, who fades in,
// who leaves and toward where, when the lines come back), fitting, following and revealing, and
// magnifying and moving.
import { describe, expect, it } from 'vitest';
import { DEFAULT_ZOOM, type Zoom } from '../../../src/model/index.ts';
import {
  CAMERA,
  PAGE,
  dragged,
  fitCamera,
  fitScale,
  focusCamera,
  followBoxes,
  followCamera,
  headerMiddle,
  keepCorner,
  magnify,
  onScreen,
  pan,
  revealCamera,
  timings,
  transitionPlan,
  type Box,
  type Camera,
  type Point,
} from '../../../src/layout/index.ts';
import { LOTTO, layouter } from './helpers.ts';

const OPEN_ENGINE_SERVICE: Zoom = new Map([['engine-service', 'open']]);
const ENGINE_PARTS = ['request-handling', 'game-analysis', 'pick-generation', 'history-lookup'];

describe('the transition plan', () => {
  it('LAYOUT-401 opening a container lays the new picture out from scratch', async () => {
    const before = await layouter(LOTTO).structure('services', DEFAULT_ZOOM);
    const after = await layouter(LOTTO).structure('services', OPEN_ENGINE_SERVICE);
    // A layouter that never saw the closed picture places the open one exactly the same.
    const fresh = await layouter(LOTTO).structure('services', OPEN_ENGINE_SERVICE);
    expect(after.result).toEqual(fresh.result);
    expect(after.result).not.toEqual(before.result);
    expect(Object.keys(after.result.boxes)).toEqual(expect.arrayContaining(ENGINE_PARTS));
  });

  it('LAYOUT-402 opening: elements in both pictures glide, the children of the container fade in', async () => {
    const lay = layouter(LOTTO);
    const before = await lay.structure('services', DEFAULT_ZOOM);
    const after = await lay.structure('services', OPEN_ENGINE_SERVICE);
    const plan = transitionPlan(LOTTO.tree, before, after);
    expect(plan.enter).toEqual(ENGINE_PARTS);
    expect(plan.leave).toEqual([]);
    expect(plan.glide.map((each) => each.id)).toEqual(before.drawing.nodes.map((node) => node.id));
    const service = plan.glide.find((each) => each.id === 'engine-service');
    expect(service?.from).toEqual(before.result.boxes['engine-service']);
    expect(service?.to).toEqual(after.result.boxes['engine-service']);
    // The opened container grows around its children.
    expect(service?.to.height).toBeGreaterThan(service?.from.height ?? Infinity);
  });

  it('LAYOUT-402 closing: the children leave toward the middle of the header of the container', async () => {
    const lay = layouter(LOTTO);
    const before = await lay.structure('services', OPEN_ENGINE_SERVICE);
    const after = await lay.structure('services', DEFAULT_ZOOM);
    const plan = transitionPlan(LOTTO.tree, before, after);
    expect(plan.enter).toEqual([]);
    expect(plan.leave.map((each) => each.id)).toEqual(ENGINE_PARTS);
    const closed = after.result.boxes['engine-service'];
    if (closed === undefined) throw new Error('Engine service is not drawn.');
    for (const leaving of plan.leave) {
      expect(leaving.from).toEqual(before.result.boxes[leaving.id]);
      // A closed box is all header: its middle.
      expect(leaving.toward).toEqual({
        x: closed.x + closed.width / 2,
        y: closed.y + closed.height / 2,
      });
    }
  });

  it('LAYOUT-402 the header middle of an open container is the middle of its header band', async () => {
    const after = await layouter(LOTTO).structure('services', OPEN_ENGINE_SERVICE);
    const box = after.result.boxes['engine-service'];
    const node = after.graph.nodes.find((each) => each.id === 'engine-service');
    if (box === undefined || node?.open !== true) throw new Error('Engine service is not open.');
    expect(headerMiddle(after, 'engine-service')).toEqual({
      x: box.x + box.width / 2,
      y: box.y + node.header / 2,
    });
    expect(headerMiddle(after, 'nothing-here')).toBeNull();
  });

  it('LAYOUT-402 switching view: elements with no drawn ancestor shrink toward their own middle', async () => {
    const lay = layouter(LOTTO);
    const before = await lay.structure('services', DEFAULT_ZOOM);
    const after = await lay.structure('engineering', DEFAULT_ZOOM);
    const plan = transitionPlan(LOTTO.tree, before, after);
    const user = plan.leave.find((each) => each.id === 'user');
    const box = before.result.boxes['user'];
    if (user === undefined || box === undefined) throw new Error('The user does not leave.');
    expect(user.toward).toEqual({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    // Every element of either picture is in exactly one part of the plan.
    const ids = [
      ...plan.glide.map((each) => each.id),
      ...plan.enter,
      ...plan.leave.map((each) => each.id),
    ];
    const all = new Set([...Object.keys(before.result.boxes), ...Object.keys(after.result.boxes)]);
    expect(ids.length).toBe(all.size);
    expect(new Set(ids)).toEqual(all);
  });

  it('LAYOUT-402 and LOOK-901 the parts overlap: glide over G, fade in from 0.4 G, lines from G + 60 ms', () => {
    expect(timings(560)).toEqual({
      glide: { delay: 0, duration: 560 },
      enter: { delay: 224, duration: 392 },
      leave: { delay: 0, duration: 280 },
      lines: { delay: 620, duration: 336 },
    });
  });

  it('LOOK-903 reduced motion makes every part of a change instant, the gap before the lines too', () => {
    const none = { delay: 0, duration: 0 };
    expect(timings(0)).toEqual({ glide: none, enter: none, leave: none, lines: none });
  });
});

describe('the camera', () => {
  const stage = { width: 1042, height: 842 };

  it('LAYOUT-451 fitting fills the stage less the margin, at no more than 1.15, centred', () => {
    const wide = { width: 2000, height: 600 };
    const camera = fitCamera(wide, stage);
    expect(camera.mode).toBe('fit');
    expect(camera.scale).toBe(fitScale(wide, stage));
    expect(camera.scale).toBeCloseTo((stage.width - 2 * PAGE.margin) / wide.width);
    expect(camera.x).toBeCloseTo(PAGE.margin);
    expect(camera.y).toBeCloseTo((stage.height - wide.height * camera.scale) / 2);
    const small = fitCamera({ width: 200, height: 100 }, stage);
    expect(small.scale).toBe(PAGE.maxScale);
    expect(small.x).toBeCloseTo((stage.width - 200 * 1.15) / 2);
  });

  it('LAYOUT-451 a tall picture keeps its top 34 px down, and clear of a caption bar', () => {
    const tall = { width: 400, height: 3000 };
    expect(fitCamera(tall, stage).y).toBeCloseTo(PAGE.margin);
    const captioned = fitCamera({ width: 400, height: 300 }, stage, PAGE.captionBar);
    expect(captioned.y).toBeCloseTo((stage.height - PAGE.captionBar - 300 * 1.15) / 2);
    expect(captioned.y + 300 * captioned.scale).toBeLessThanOrEqual(stage.height - PAGE.captionBar);
  });

  it('INT-702 a focus step fits its focus elements with an 80 px margin, clear of the narration bar', () => {
    const picture = { width: 1800, height: 1200 };
    const one = { x: 600, y: 300, width: 400, height: 250 };
    const two = { x: 1100, y: 500, width: 300, height: 200 };
    const camera = focusCamera([one, two], picture, stage, PAGE.narrationBar);
    expect(camera.mode).toBe('fit');
    // The box around both is 800 x 400; across is the tighter fit.
    const room = stage.height - PAGE.narrationBar;
    expect(camera.scale).toBeCloseTo(
      Math.min((stage.width - 2 * PAGE.focusMargin) / 800, (room - 2 * PAGE.focusMargin) / 400),
    );
    // The box around them is centred in the stage above the bar.
    const middle = onScreen(camera, { x: 600 + 400, y: 300 + 200 });
    expect(middle.x).toBeCloseTo(stage.width / 2);
    expect(middle.y).toBeCloseTo(room / 2);
    const corner = onScreen(camera, { x: 600, y: 300 });
    expect(corner.x).toBeGreaterThanOrEqual(PAGE.focusMargin - 0.001);
    expect(corner.y).toBeGreaterThanOrEqual(PAGE.focusMargin - 0.001);
    const end = onScreen(camera, { x: 1400, y: 700 });
    expect(end.y).toBeLessThanOrEqual(room - PAGE.focusMargin + 0.001);
  });

  it('INT-702 focus never magnifies above 1.15, and no focus fits the whole picture', () => {
    const picture = { width: 1800, height: 1200 };
    const small = { x: 100, y: 100, width: 120, height: 60 };
    const camera = focusCamera([small], picture, stage, PAGE.narrationBar);
    expect(camera.scale).toBe(PAGE.maxScale);
    const middle = onScreen(camera, { x: 160, y: 130 });
    expect(middle.x).toBeCloseTo(stage.width / 2);
    expect(middle.y).toBeCloseTo((stage.height - PAGE.narrationBar) / 2);
    expect(focusCamera([], picture, stage, PAGE.narrationBar)).toEqual(
      fitCamera(picture, stage, PAGE.narrationBar),
    );
  });

  it('INT-351 the wheel magnifies around the pointer, which stays where it is', () => {
    const camera: Camera = { scale: 0.8, x: 40, y: 60, mode: 'fit' };
    const pointer = { x: 300, y: 200 };
    const under = { x: (pointer.x - camera.x) / camera.scale, y: (pointer.y - camera.y) / 0.8 };
    const next = magnify(camera, 1.1, pointer);
    expect(next.scale).toBeCloseTo(0.88);
    expect(next.mode).toBe('free');
    const drawn = onScreen(next, under);
    expect(drawn.x).toBeCloseTo(pointer.x);
    expect(drawn.y).toBeCloseTo(pointer.y);
  });

  it('INT-351 dragging moves the picture, and a drag shorter than 4 px is a click', () => {
    const camera: Camera = { scale: 1, x: 10, y: 20, mode: 'fit' };
    expect(pan(camera, 30, -5)).toEqual({ scale: 1, x: 40, y: 15, mode: 'free' });
    expect(dragged(3, 2)).toBe(false);
    expect(dragged(0, 3.9)).toBe(false);
    expect(dragged(4, 0)).toBe(true);
    expect(dragged(3, 3)).toBe(true);
  });

  it('INT-352 the camera buttons magnify by 1.25 and shrink by 0.8', () => {
    const camera: Camera = { scale: 1, x: 0, y: 0, mode: 'fit' };
    const centre = { x: 500, y: 400 };
    expect(magnify(camera, CAMERA.magnify, centre).scale).toBe(1.25);
    expect(magnify(camera, CAMERA.shrink, centre).scale).toBe(0.8);
  });

  it('INT-353 the scale stays between 0.2 and 2.5', () => {
    let camera: Camera = { scale: 1, x: 0, y: 0, mode: 'fit' };
    for (let i = 0; i < 20; i++) camera = magnify(camera, CAMERA.magnify, { x: 0, y: 0 });
    expect(camera.scale).toBe(2.5);
    for (let i = 0; i < 40; i++) camera = magnify(camera, CAMERA.shrink, { x: 0, y: 0 });
    expect(camera.scale).toBe(0.2);
  });

  it('LAYOUT-404 in free mode, opening a container keeps its top-left corner in place on screen', async () => {
    const lay = layouter(LOTTO);
    const before = await lay.structure('services', DEFAULT_ZOOM);
    const after = await lay.structure('services', OPEN_ENGINE_SERVICE);
    const from = before.result.boxes['engine-service'];
    const to = after.result.boxes['engine-service'];
    if (from === undefined || to === undefined) throw new Error('Engine service is not drawn.');
    const camera: Camera = { scale: 1.4, x: -120, y: 35, mode: 'free' };
    const next = keepCorner(camera, from, to);
    expect(next.scale).toBe(camera.scale);
    expect(next.mode).toBe('free');
    const was = onScreen(camera, from);
    const now = onScreen(next, to);
    expect(now.x).toBeCloseTo(was.x);
    expect(now.y).toBeCloseTo(was.y);
  });
});

describe('following the reader', () => {
  const stage = { width: 1042, height: 842 };
  const OPEN_ENGINE: Zoom = new Map([['engine', 'open']]);

  it('LAYOUT-453 an opened container is followed with its directly connected neighbours, nearest first', async () => {
    const layout = await layouter(LOTTO).structure('big-picture', OPEN_ENGINE);
    const boxes = followBoxes(LOTTO.tree, layout, 'engine');
    const { result } = layout;
    expect(boxes[0]).toEqual(result.boxes['engine']);
    // The Screen API asks Request handling, inside the engine; the engine asks the Results store.
    // The Lotto suite holds the engine, so it is no neighbour; the User and Texas are not joined to it.
    const ids = boxes.map((box) =>
      Object.keys(result.boxes).find((id) => result.boxes[id] === box),
    );
    expect(ids.slice(1).sort()).toEqual(['screen-api', 'store']);
    const middle = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    const far = boxes.slice(1).map((box) => {
      const [a, b] = [middle(box), middle(boxes[0] ?? box)];
      return Math.hypot(a.x - b.x, a.y - b.y);
    });
    expect(far).toEqual([...far].sort((a, b) => a - b));
    expect(followBoxes(LOTTO.tree, layout, 'nothing-here')).toEqual([]);
  });

  it('LAYOUT-453 following fits the whole picture while it fits at scale 1 or more', () => {
    const picture = { width: 800, height: 600 };
    const focus = [{ x: 100, y: 100, width: 200, height: 80 }];
    expect(followCamera(focus, picture, stage)).toEqual(fitCamera(picture, stage));
    expect(followCamera([], { width: 4000, height: 3000 }, stage)).toEqual(
      fitCamera({ width: 4000, height: 3000 }, stage),
    );
  });

  it('LAYOUT-453 following frames the element and the neighbours that fit at scale 1, at no less than 1 nor more than 1.15', () => {
    const picture = { width: 3000, height: 2400 };
    const element = { x: 1200, y: 1000, width: 400, height: 300 };
    const near = { x: 1200, y: 700, width: 300, height: 100 };
    const far = { x: 100, y: 100, width: 300, height: 100 };
    const camera = followCamera([element, far, near], picture, stage);
    expect(camera.mode).toBe('fit');
    expect(camera.scale).toBeGreaterThanOrEqual(CAMERA.readable);
    expect(camera.scale).toBeLessThanOrEqual(PAGE.maxScale);
    // The far neighbour would make the frame too large at scale 1, so it is left out.
    const top = onScreen(camera, { x: near.x, y: near.y });
    const bottom = onScreen(camera, {
      x: element.x + element.width,
      y: element.y + element.height,
    });
    expect(top.y).toBeGreaterThanOrEqual(PAGE.margin - 0.001);
    expect(bottom.y).toBeLessThanOrEqual(stage.height - PAGE.margin + 0.001);
    expect(onScreen(camera, { x: far.x, y: far.y }).y).toBeLessThan(0);
    // The frame (near and element) is centred on the stage.
    expect((top.y + bottom.y) / 2).toBeCloseTo(stage.height / 2);
    // The frame alone would magnify above 1.15, so the scale stops there.
    const small = followCamera([{ x: 1200, y: 1000, width: 100, height: 40 }], picture, stage);
    expect(small.scale).toBe(PAGE.maxScale);
  });

  it('LAYOUT-453 a frame too large for the stage shows its top left, and a larger picture leaves no more than the margin empty', () => {
    const picture = { width: 3000, height: 2400 };
    const huge = { x: 1000, y: 800, width: 1500, height: 1200 };
    const camera = followCamera([huge], picture, stage);
    expect(camera.scale).toBe(CAMERA.readable);
    const corner = onScreen(camera, { x: huge.x, y: huge.y });
    expect(corner.x).toBeCloseTo(PAGE.margin);
    expect(corner.y).toBeCloseTo(PAGE.margin);
    // An element at the picture's edge does not pull the picture away from the stage's edge.
    const edge = followCamera([{ x: 0, y: 0, width: 200, height: 80 }], picture, stage);
    expect(edge.x).toBeCloseTo(PAGE.margin);
    expect(edge.y).toBeCloseTo(PAGE.margin);
    const end = followCamera([{ x: 2800, y: 2320, width: 200, height: 80 }], picture, stage);
    expect(end.x + picture.width * end.scale).toBeCloseTo(stage.width - PAGE.margin);
    expect(end.y + picture.height * end.scale).toBeCloseTo(stage.height - PAGE.margin);
    // A picture narrow enough to fit across is centred across.
    const narrow = followCamera(
      [{ x: 100, y: 1000, width: 200, height: 80 }],
      { width: 600, height: 2400 },
      stage,
    );
    expect(narrow.x).toBeCloseTo((stage.width - 600 * narrow.scale) / 2);
  });

  it('LAYOUT-454 revealing moves the picture the least it must, never changes the scale, and leaves boxes in view alone', () => {
    const picture = { width: 3000, height: 2400 };
    const camera: Camera = { scale: 0.7, x: -100, y: -50, mode: 'free' };
    const seen = { x: 400, y: 300, width: 200, height: 80 };
    expect(revealCamera(camera, [seen], picture, stage)).toEqual(camera);
    const right = { x: 1600, y: 300, width: 200, height: 80 };
    const moved = revealCamera(camera, [right], picture, stage);
    expect(moved.scale).toBe(camera.scale);
    expect(moved.mode).toBe('free');
    expect(moved.y).toBe(camera.y);
    expect(onScreen(moved, { x: right.x + right.width, y: 0 }).x).toBeCloseTo(
      stage.width - PAGE.margin,
    );
    // Its neighbours come too, as many as fit, and a fitted camera stays fitted.
    const neighbour = { x: 1600, y: 700, width: 200, height: 80 };
    const both = revealCamera({ ...camera, mode: 'fit' }, [right, neighbour], picture, stage);
    expect(both.mode).toBe('fit');
    expect(onScreen(both, { x: 0, y: neighbour.y + neighbour.height }).y).toBeLessThanOrEqual(
      stage.height - PAGE.margin + 0.001,
    );
    expect(revealCamera(camera, [], picture, stage)).toEqual(camera);
  });
});
