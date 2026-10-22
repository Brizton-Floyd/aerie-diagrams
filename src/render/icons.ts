// Aerie's own icons (docs/spec/look.md, LOOK-401 and LOOK-402): line drawings on a 64-unit grid,
// strokes only, with round caps and joins, and dots drawn as small filled circles. Each icon is a
// list of shapes; the stylesheet strokes them in `ink` at 4.2 units, about 1.4 px at 22 px.
import type { IconName } from '../lines/index.ts';
import { el, type SvgNode } from './svg.ts';

/** The grid an icon is drawn on. */
export const ICON_GRID = 64;

/** LOOK-401: the icon stroke in grid units. */
export const ICON_STROKE = 4.2;

/** One stroked shape of an icon. */
export type IconShape =
  | { path: string }
  | { circle: [cx: number, cy: number, r: number] }
  /** A dot: a small filled circle, as wide as a stroke's round end and a little more. */
  | { dot: [cx: number, cy: number] }
  | { rect: [x: number, y: number, width: number, height: number, r: number] };

/** LOOK-401: the radius of a dot, in grid units. */
export const ICON_DOT = 3.6;

const dot = (cx: number, cy: number): IconShape => ({ dot: [cx, cy] });

/** LOOK-402: the v1 set, by name. */
export const ICONS: Record<IconName, readonly IconShape[]> = {
  // Head and shoulders.
  person: [{ circle: [32, 21, 10] }, { path: 'M12 56c0-12 9-20 20-20s20 8 20 20' }],
  // Three stacked layers.
  stack: [
    { path: 'M32 9 56 21 32 33 8 21Z' },
    { path: 'M8 31l24 12 24-12' },
    { path: 'M8 41l24 12 24-12' },
  ],
  // A browser window with code brackets.
  web: [
    { rect: [8, 11, 48, 42, 5] },
    { path: 'M8 21h48' },
    { path: 'M27 29l-7 7 7 7' },
    { path: 'M37 29l7 7-7 7' },
  ],
  // A block with lines in and an arrow out.
  api: [
    { rect: [26, 18, 14, 28, 3] },
    { path: 'M7 25h19M7 39h19' },
    { path: 'M40 32h16' },
    { path: 'M50 26l6 6-6 6' },
  ],
  // A cog: eight teeth around a hub.
  gear: [
    {
      path: 'M28.1 16.5 29 10.7h6l.9 5.8 4.3 1.8 4.7-3.5 4.3 4.3-3.5 4.7 1.8 4.3 5.8.9v6l-5.8.9-1.8 4.3 3.5 4.7-4.3 4.3-4.7-3.5-4.3 1.8-.9 5.8h-6l-.9-5.8-4.3-1.8-4.7 3.5-4.3-4.3 3.5-4.7-1.8-4.3-5.8-.9v-6l5.8-.9 1.8-4.3-3.5-4.7 4.3-4.3 4.7 3.5Z',
    },
    { circle: [32, 32, 6] },
  ],
  // A cube.
  module: [
    { path: 'M32 8 53 20v24L32 56 11 44V20Z' },
    { path: 'M11 20l21 12 21-12' },
    { path: 'M32 32v24' },
  ],
  // A point with an arrow leaving it.
  route: [dot(15, 41), { path: 'M21 38c10-4 14-16 27-16h7' }, { path: 'M49 16l6 6-6 6' }],
  // A die showing five.
  dice: [
    { rect: [10, 10, 44, 44, 9] },
    dot(22, 22),
    dot(42, 22),
    dot(32, 32),
    dot(22, 42),
    dot(42, 42),
  ],
  // A magnifying glass.
  search: [{ circle: [27, 27, 15] }, { path: 'M38 38 55 55' }],
  // Books on a shelf: two standing, one leaning.
  books: [
    { path: 'M7 55h50' },
    { rect: [12, 17, 9, 38, 1.5] },
    { rect: [23, 12, 9, 43, 1.5] },
    { path: 'M35.5 19.5l8.7-2.3 9.6 35.6-8.7 2.4Z' },
  ],
  // A table: a header row over two columns.
  grid: [{ rect: [9, 12, 46, 40, 3] }, { path: 'M9 24h46M9 38h46M32 24v28' }],
  // A screen on a stand.
  monitor: [{ rect: [8, 11, 48, 32, 3] }, { path: 'M32 43v9M21 53h22' }],
  // A storage drum with two hoops.
  cylinder: [
    { path: 'M14 14c0-3.3 8-6 18-6s18 2.7 18 6-8 6-18 6-18-2.7-18-6Z' },
    { path: 'M14 14v36c0 3.3 8 6 18 6s18-2.7 18-6V14' },
    { path: 'M14 26c0 3.3 8 6 18 6s18-2.7 18-6' },
    { path: 'M14 38c0 3.3 8 6 18 6s18-2.7 18-6' },
  ],
  // A clock with an arrow turning back.
  history: [
    { path: 'M14.5 24A19 19 0 1 1 13 34' },
    { path: 'M8 18l6.5 6.5L21 18' },
    { path: 'M33 21v12l8 5' },
  ],
  // Two arrows chasing round.
  refresh: [
    { path: 'M49 25A18 18 0 0 0 16 21' },
    { path: 'M15 39a18 18 0 0 0 33 4' },
    { path: 'M51 13v12H39' },
    { path: 'M13 51V39h12' },
  ],
  // A page with a folded corner.
  document: [
    { path: 'M17 8h21l10 10v38H17Z' },
    { path: 'M38 8v10h10' },
    { path: 'M24 31h17M24 40h17M24 49h10' },
  ],
  // A box with a lid.
  archive: [{ rect: [9, 11, 46, 11, 2] }, { path: 'M13 22v30h38V22' }, { path: 'M27 32h10' }],
  // An office block: two columns of windows and a door.
  building: [
    { path: 'M8 56h48' },
    { path: 'M16 56V10h32v46' },
    { path: 'M24 18h4M36 18h4M24 27h4M36 27h4M24 36h4M36 36h4' },
    { path: 'M29 56V46h6v10' },
  ],
  // A plain rounded square, the default.
  box: [{ rect: [12, 12, 40, 40, 8] }],
};

function shape(each: IconShape): SvgNode {
  if ('path' in each) return el('path', { d: each.path });
  if ('dot' in each) {
    const [cx, cy] = each.dot;
    return el('circle', { class: 'dot', cx, cy, r: ICON_DOT });
  }
  if ('circle' in each) {
    const [cx, cy, r] = each.circle;
    return el('circle', { cx, cy, r });
  }
  const [x, y, width, height, r] = each.rect;
  return el('rect', { x, y, width, height, rx: r });
}

/**
 * An icon drawn `size` pixels square with its top left at (x, y). The stroke, caps, joins and colour
 * come from the stylesheet's `icon` class, so the drawing is the same in every theme.
 */
export function icon(name: IconName, x: number, y: number, size: number): SvgNode {
  return el(
    'g',
    {
      class: 'icon',
      'data-icon': name,
      transform: `translate(${String(x)} ${String(y)}) scale(${String(size / ICON_GRID)})`,
    },
    ICONS[name].map(shape),
  );
}
