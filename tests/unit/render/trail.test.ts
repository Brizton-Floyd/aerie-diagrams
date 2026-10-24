// The scenario trail and lanes as drawn (docs/spec/look.md, LOOK-701 to LOOK-706), and motion
// (LOOK-901 to LOOK-903).
import { describe, expect, it } from 'vitest';
import { DEFAULT_ZOOM } from '../../../src/model/index.ts';
import { trailShapes } from '../../../src/layout/index.ts';
import {
  MOTION,
  SHAPE,
  classes,
  signalStyle,
  renderLanes,
  textOf,
  walk,
  type SvgNode,
} from '../../../src/render/index.ts';
import { LOTTO, SHAPES, child, draw, group, layouter, withClass } from './helpers.ts';

const css = signalStyle();

function rule(selector: string): string {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`No rule for ${selector}.`);
  return css
    .slice(at + selector.length + 2, css.indexOf('}', at))
    .replace(/\s+/g, ' ')
    .trim();
}

async function playing(step: number): Promise<SvgNode> {
  const trail = LOTTO.trail('generate-picks', 'big-picture', DEFAULT_ZOOM, step);
  const picture = await layouter(LOTTO).picture('big-picture', DEFAULT_ZOOM, 'manager');
  return draw(LOTTO, 'big-picture', 'manager', DEFAULT_ZOOM, {
    trail: trailShapes(picture.result, trail),
    focus: { kind: 'trail', visited: trail.visited, current: trail.current },
  });
}

const steps = (root: SvgNode): SvgNode[] => withClass(root, 'step');

describe('the scenario trail', () => {
  it('LOOK-701 a call step is a 2 px accent-ink curve with round caps and a chevron; the current one draws itself in live light in 900 ms', async () => {
    const root = await playing(3);
    const [, , current] = steps(root);
    expect(current && classes(current)).toEqual(['step', 'call', 'now']);
    expect(current && child(current, 'curve').attrs['pathLength']).toBe(1);
    expect(current && child(current, 'arrow').attrs['d']).toMatch(/^M.+L.+L.+$/);
    expect(rule('.aerie .step .curve, .aerie .step .arrow')).toBe(
      'fill: none; stroke: var(--aerie-accent-ink); stroke-width: 2px; stroke-linecap: round; stroke-linejoin: round; ' +
        'filter: drop-shadow(0 0 3px color-mix(in srgb, var(--aerie-glow) 60%, transparent));',
    );
    expect(rule('.aerie .step.now .curve, .aerie .step.now .arrow')).toBe(
      'stroke: var(--aerie-live); stroke-width: 2.6px; ' +
        'filter: drop-shadow(0 0 5px color-mix(in srgb, var(--aerie-live) 75%, transparent));',
    );
    expect(rule('.aerie .step.now.call .curve')).toBe(
      'stroke-dasharray: 1 1; animation: aerie-draw var(--aerie-step-draw) var(--aerie-ease) backwards;',
    );
    expect(MOTION.stepDraw).toBe(900);
  });

  it('LOOK-702 a reply step is a 2.6 px trail-back dotted curve, drawn whole, with no arrowhead', async () => {
    const root = await playing(7);
    const reply = steps(root).find((node) => classes(node).includes('reply'));
    expect(reply && classes(reply)).toEqual(['step', 'reply', 'now']);
    expect(reply?.children.filter((each) => typeof each !== 'string')).toHaveLength(1);
    expect(reply && child(reply, 'curve').attrs['pathLength']).toBeNull();
    expect(rule('.aerie .step.reply .curve')).toBe(
      'stroke: var(--aerie-trail-back); stroke-width: 2.6px; stroke-dasharray: 1 6;',
    );
  });

  it('LOOK-703 earlier steps stay on the diagram, 1.6 px at past', async () => {
    const root = await playing(5);
    expect(steps(root).map((node) => classes(node).at(-1))).toEqual([
      'past',
      'past',
      'past',
      'past',
      'now',
    ]);
    expect(rule('.aerie .step.past .curve, .aerie .step.past .arrow')).toBe(
      'stroke-width: 1.6px; opacity: 0.55;',
    );
  });

  it('LOOK-704 each step has a numbered badge of radius 9; the current one radius 12, filled accent, ringed in live light', async () => {
    const root = await playing(4);
    const badges = withClass(root, 'badge');
    expect(badges.map((node) => textOf(node))).toEqual(['1', '2', '3', '4']);
    expect(badges.map((node) => child(node, 'circle').attrs['r'])).toEqual([9, 9, 9, 12]);
    expect(SHAPE.currentBadge).toBe(12);
    expect(classes(badges[3] ?? badges[0] ?? root)).toEqual(['badge', 'now']);
    expect(rule('.aerie .badge circle')).toBe(
      'fill: var(--aerie-surface); stroke: var(--aerie-accent-ink); stroke-width: 1.2px;',
    );
    expect(rule('.aerie .badge.now circle')).toBe(
      'fill: var(--aerie-accent); stroke: var(--aerie-live); stroke-width: 1.5px; ' +
        'filter: drop-shadow(0 0 8px color-mix(in srgb, var(--aerie-glow) 80%, transparent)); ' +
        'animation: aerie-ping calc(var(--aerie-glide) * 1.6) var(--aerie-ease) 2;',
    );
    expect(rule('.aerie .badge.now .t-badge')).toBe(
      'font-size: 13px; fill: var(--aerie-on-accent);',
    );
    // Badges sit above every curve.
    const layers = root.children.filter((each): each is SvgNode => typeof each !== 'string');
    expect(layers.slice(-2).map((each) => each.attrs['class'])).toEqual(['trail', 'badges']);
  });

  it("LOOK-705 the current step's elements are outlined; visited ones keep full strength, their containers context, lines edge-dim", async () => {
    const root = await playing(2);
    expect(classes(group(root, 'node', 'website'))).toContain('now');
    expect(classes(group(root, 'node', 'screen-api'))).toContain('now');
    expect(classes(group(root, 'node', 'user'))).toContain('full');
    expect(classes(group(root, 'node', 'suite'))).toContain('context');
    expect(classes(group(root, 'node', 'texas'))).toContain('dim');
    for (const edge of withClass(root, 'edge')) expect(classes(edge)).toContain('dim');
  });

  it('LOOK-706 lanes: header boxes, bands, dashed lane lines, trail arrows and badges, the current row tinted', async () => {
    const lanes = await layouter(LOTTO).lanes('generate-picks', 'big-picture', DEFAULT_ZOOM);
    const root = renderLanes(LOTTO, lanes, 'manager', 9);
    const layers = root.children.filter((each): each is SvgNode => typeof each !== 'string');
    expect(layers.map((each) => each.attrs['class'] ?? each.tag)).toEqual([
      'defs',
      'rows',
      'bands',
      'lanes',
      'boxes',
      'trail',
      'labels',
      'badges',
    ]);
    expect(withClass(root, 'node').map((node) => node.attrs['data-id'])).toEqual(
      lanes.lanes.map((lane) => lane.id),
    );
    expect(classes(group(root, 'band', 'suite'))).toEqual(['band', 'open', 'depth-0']);
    expect(withClass(root, 'lane-line')).toHaveLength(lanes.lanes.length);
    expect(steps(root)).toHaveLength(9);
    expect(withClass(root, 'row').map((node) => node.attrs['data-step'])).toEqual([9]);
    expect(rule('.aerie .lane-line')).toBe(
      'fill: none; stroke: color-mix(in srgb, var(--aerie-frame) 55%, transparent); stroke-width: 1px; stroke-dasharray: 2 5;',
    );
    expect(rule('.aerie .row.now')).toBe(
      'fill: color-mix(in srgb, var(--aerie-accent) 14%, transparent);',
    );
    // The current step's lanes are outlined.
    const current = lanes.rows[8];
    expect(classes(group(root, 'node', current?.from ?? ''))).toContain('now');
  });

  it('LAYOUT-504 a folded step on the shapes sample loops on the closed shed', async () => {
    const trail = SHAPES.trail('visit', 'shapes', DEFAULT_ZOOM, 5);
    const picture = await layouter(SHAPES).picture('shapes', DEFAULT_ZOOM, 'manager');
    const shapes = trailShapes(picture.result, trail);
    expect(shapes.at(-1)).toMatchObject({ kind: 'loop', on: 'shed', role: 'call' });
    expect(shapes[2]).toMatchObject({ kind: 'curve', role: 'reply' });
  });
});

describe('motion', () => {
  it('LOOK-901 the timings and the glide easing', () => {
    expect(MOTION).toEqual({
      glide: 520,
      ease: 'cubic-bezier(.16,1,.3,1)',
      swap: 170,
      dimming: 280,
      hover: 250,
      stepDraw: 900,
      arriveStep: 45,
      peek: 180,
      autoplay: 2400,
      presenterFade: 300,
      presenterIdle: 2500,
    });
    expect(css).toContain('--aerie-glide: 520ms;');
    expect(css).toContain('--aerie-arrive-step: 45ms;');
    expect(css).toContain('--aerie-peek: 180ms;');
    expect(css).toContain('--aerie-presenter-fade: 300ms;');
    // The autoplay pace and the presenter's wait before its controls hide are not motion, so they
    // are no custom properties for reduced motion to zero.
    expect(css).not.toContain('2400');
    expect(css).not.toContain('2500');
    expect(rule('.aerie .node > *')).toBe(
      'transition: stroke var(--aerie-hover) ease, stroke-width var(--aerie-hover) ease, opacity var(--aerie-dimming) ease;',
    );
  });

  it('LOOK-902 nothing bounces or overshoots: every easing stays inside 0 to 1', () => {
    for (const [, x1, y1, x2, y2] of css.matchAll(
      /cubic-bezier\(([\d.]+),([\d.]+),([\d.]+),([\d.]+)\)/g,
    )) {
      for (const value of [x1, y1, x2, y2]) {
        expect(Number(value)).toBeGreaterThanOrEqual(0);
        expect(Number(value)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('LOOK-903 reduced motion sets every duration and delay to zero, from the system or the page', () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\n {2}:root:not\(\[data-motion="full"\]\) \{\n(\s+--aerie-[a-z-]+: 0ms;\n)+/,
    );
    const reduced = rule('[data-motion="reduce"]');
    for (const name of [
      'glide',
      'swap',
      'dimming',
      'hover',
      'step-draw',
      'arrive-step',
      'peek',
      'presenter-fade',
    ]) {
      expect(reduced).toContain(`--aerie-${name}: 0ms;`);
    }
    expect(css).toContain('animation-duration: 0ms !important;');
    expect(css).toContain('transition-delay: 0ms !important;');
    // Every duration in a rule is one of the motion variables, so it follows the setting; the
    // flowing light and the ping are multiples of the glide, so they stand still with it.
    const durations = css.match(/\b\d+(?:\.\d+)?m?s\b/g) ?? [];
    expect(
      durations.filter(
        (each) =>
          ![
            '0ms',
            '1ms',
            '520ms',
            '170ms',
            '280ms',
            '250ms',
            '900ms',
            '45ms',
            '180ms',
            '300ms',
          ].includes(each),
      ),
    ).toEqual([]);
    expect(rule('.aerie .edge.on .flow')).toContain(
      'calc(var(--aerie-glide) * 2.4) linear infinite',
    );
  });
});

it('draws the whole picture as one SVG root', async () => {
  const root = await draw(LOTTO, 'services', 'manager');
  expect(root.tag).toBe('svg');
  expect([...walk(root)].filter((node) => node.tag === 'svg')).toHaveLength(1);
  expect(root.attrs).toMatchObject({
    class: 'aerie',
    role: 'img',
    'aria-label': 'The Lotto suite: Services',
  });
});
