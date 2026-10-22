// Drawing a scenario as lanes (docs/spec/look.md, LOOK-706): headers like boxes, bands like open
// containers, dashed lane lines, the steps up to the current one as trail arrows and loops with
// their badges and labels, and the current step's row tinted.
import type { Id } from '../lines/index.ts';
import { wordsFor, type Semantics } from '../model/index.ts';
import { placeLanesText, type LanesLayout } from '../layout/index.ts';
import { SHAPE, drawBox, drawingRoot, textLine, type RenderOptions } from './picture.ts';
import { chevron, roundedRoute } from './route.ts';
import { el, path, translate, type SvgNode } from './svg.ts';
import { BADGE_TEXT } from './type.ts';

/** LOOK-706: a band's corner radius, and the corner of a self step's loop. */
export const LANE_SHAPE = { bandCorner: 9, loopCorner: 6 } as const;

/**
 * A scenario's lanes for an audience, with steps 1 to `step` drawn and step `step` current. The
 * trail look is the one the map uses (LOOK-701 to LOOK-704); `options.trail` is ignored here.
 */
export function renderLanes(
  semantics: Semantics,
  lanes: LanesLayout,
  audience: Id,
  step: number,
  options: Omit<RenderOptions, 'trail' | 'focus'> = {},
): SvgNode {
  const text = placeLanesText(lanes, audience);
  const shown = lanes.rows.filter((row) => row.number <= step);
  const current = shown.at(-1);
  const currentLanes = new Set(current === undefined ? [] : [current.from, current.to]);
  const rows =
    current === undefined
      ? []
      : [
          el('rect', {
            class: 'row now',
            'data-step': current.number,
            x: 0,
            y: current.top,
            width: lanes.width,
            height: current.height,
          }),
        ];
  const bands = lanes.bands.map((band) => {
    const name = text.bands[band.id];
    return el(
      'g',
      { class: `band open depth-${String(Math.min(3, band.depth))}`, 'data-id': band.id },
      [
        el('rect', {
          class: 'shape',
          x: band.box.x,
          y: band.box.y,
          width: band.box.width,
          height: band.box.height,
          rx: LANE_SHAPE.bandCorner,
        }),
        name === undefined ? null : textLine(name, { x: 0, y: 0 }),
      ],
    );
  });
  const lines = lanes.lanes.map((lane) =>
    el('path', {
      class: 'lane-line',
      'data-id': lane.id,
      d: path('M', lane.x, lane.top, 'V', lane.bottom),
    }),
  );
  const headers = lanes.lanes.map((lane) => {
    const tags = semantics.tree.get(lane.id).tags;
    return drawBox(
      lane.id,
      lane.header,
      {
        state: 'leaf',
        person: tags.includes('person'),
        external: tags.includes('external'),
        depth: semantics.tree.depth(lane.id),
      },
      semantics.tree.icon(lane.id),
      text.headers[lane.id],
      currentLanes.has(lane.id) ? 'now' : 'plain',
    );
  });
  const steps = shown.map((row) => {
    const now = row === current;
    const call = row.role === 'call';
    const d =
      row.kind === 'arrow'
        ? roundedRoute(row.points, 0)
        : roundedRoute(row.points, LANE_SHAPE.loopCorner);
    const tip = row.points.at(-1);
    const before = row.points.at(-2);
    return el('g', { class: `step ${row.role} ${now ? 'now' : 'past'}`, 'data-step': row.number }, [
      el('path', { class: 'curve', d, pathLength: now && call ? 1 : null }),
      call &&
        tip !== undefined &&
        before !== undefined &&
        el('path', { class: 'arrow', d: chevron(tip, before) }),
    ]);
  });
  const labels = shown.map((row) =>
    el(
      'g',
      { class: 'label', 'data-step': row.number },
      (text.labels[row.number] ?? []).map((line) => textLine(line, { x: 0, y: 0 })),
    ),
  );
  const badges = shown.map((row) => {
    const now = row === current;
    return el(
      'g',
      {
        class: now ? 'badge now' : 'badge',
        'data-step': row.number,
        transform: translate(row.badge.x, row.badge.y),
      },
      [
        el('circle', { r: now ? SHAPE.currentBadge : SHAPE.badge }),
        el(
          'text',
          {
            class: BADGE_TEXT.className,
            y: now ? BADGE_TEXT.currentBaseline : BADGE_TEXT.baseline,
          },
          [String(row.number)],
        ),
      ],
    );
  });
  const title = semantics.title(audience);
  return drawingRoot(
    lanes,
    `${title === null ? '' : `${title}: `}${scenarioTitle(semantics, lanes.scenario, audience)}, as lanes`,
    { 'data-view': lanes.view, 'data-audience': audience, 'data-scenario': lanes.scenario },
    options,
    [
      el('g', { class: 'rows' }, rows),
      el('g', { class: 'bands' }, bands),
      el('g', { class: 'lanes' }, lines),
      el('g', { class: 'boxes' }, headers),
      el('g', { class: 'trail' }, steps),
      el('g', { class: 'labels' }, labels),
      el('g', { class: 'badges' }, badges),
    ],
  );
}

/** A scenario's title for an audience. */
export function scenarioTitle(semantics: Semantics, scenario: Id, audience: Id): string {
  return wordsFor(semantics.scenario(scenario).title, audience) ?? scenario;
}
