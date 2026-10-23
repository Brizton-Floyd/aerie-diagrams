// Drawing a structure view in the Contour look (docs/spec/look.md): boxes and contour bands with
// their icons and text, relationship lines with chevrons and sentence labels, and a static scenario
// trail. The drawing is a plain SVG tree of classes and geometry; colours, strokes and faces come
// from the stylesheet (style.ts), so one drawing serves both themes.
import type { IconName, Id } from '../lines/index.ts';
import type { Semantics } from '../model/index.ts';
import {
  BOX,
  type Box,
  type PictureLayout,
  type PlacedBoxText,
  type PlacedLine,
  type TrailShape,
} from '../layout/index.ts';
import { emphasis, type EdgeMark, type Focus, type NodeMark } from './emphasis.ts';
import { icon } from './icons.ts';
import { chevron, roundedRoute } from './route.ts';
import { HATCH_ID, contourStyle } from './style.ts';
import { el, num, path, translate, type SvgNode } from './svg.ts';
import { BADGE_TEXT, DRAWN } from './type.ts';
import type { Theme } from './tokens.ts';

/** LOOK-301 to LOOK-305: corner radii, and the badge sizes of LOOK-704. */
export const SHAPE = {
  leafCorner: 4,
  closedCorner: 8,
  openCorner: 18,
  /** A person is a pill, its corners as round as its height allows, up to this. */
  personCorner: 30,
  /** LOOK-306: the focus ring's gap outside the outline, plus half its 2 px stroke. */
  ringOffset: 3,
  badge: 9,
  currentBadge: 12,
  /** LOOK-305: the hatching's spacing. */
  hatch: 7,
} as const;

/** What a picture shows besides its boxes and lines. */
export interface RenderOptions {
  /** What is in focus (LOOK-601 to LOOK-603, LOOK-705); nothing by default. */
  focus?: Focus;
  /** A playing scenario's trail up to its current step, the last one (LOOK-701 to LOOK-704). */
  trail?: readonly TrailShape[];
  /** Sets the drawing's own theme; by default it follows the page's. */
  theme?: Theme;
  /** Embeds the stylesheet so the SVG stands alone, as a file. */
  standalone?: boolean;
  /**
   * Draws for the page a reader explores (INT-901 to INT-903): every box can be focused and is
   * announced with its name and tagline, containers say whether they are open, the open and close
   * control has its tooltip (INT-301), and each label has a box to hover (INT-206). Lines, labels
   * and header text are hidden from screen readers, which hear the relationships as sentences
   * from the page instead.
   */
  interactive?: boolean;
}

/** What a reader's assistive technology hears for one box (INT-903). */
export interface Spoken {
  label: string;
  selected: boolean;
}

/** How a box is drawn, from its state and its element's tags. */
export interface BoxLook {
  state: 'leaf' | 'closed' | 'open';
  person: boolean;
  external: boolean;
  depth: number;
}

/** LOOK-301 to LOOK-304: the corner radius of a box. */
export function cornerOf(look: BoxLook, height: number): number {
  if (look.state === 'open') return SHAPE.openCorner;
  if (look.person) return Math.min(SHAPE.personCorner, height / 2);
  return look.state === 'closed' ? SHAPE.closedCorner : SHAPE.leafCorner;
}

/** The classes of a box's group. */
function boxClasses(look: BoxLook, mark: NodeMark): string {
  const out = ['node', look.state];
  if (look.state === 'open') out.push(`depth-${String(Math.min(3, look.depth))}`);
  if (look.person) out.push('person');
  if (look.external) out.push('external');
  if (mark !== 'plain') out.push(mark);
  return out.join(' ');
}

/** One placed line of text, drawn relative to an origin (LAYOUT-204). */
export function textLine(line: PlacedLine, origin: { x: number; y: number }): SvgNode {
  const role = DRAWN[line.role];
  return el(
    'text',
    {
      class: role.className,
      x: line.x - origin.x,
      y: line.y - origin.y + role.baseline,
      'data-width': line.width,
    },
    [line.text],
  );
}

/** INT-301: the tooltip of the open and close control. */
export const TOGGLE_TIP = { open: 'Open in place', close: 'Close in place' } as const;

/** LOOK-302 and LOOK-303: the open and close control, a circle at the top right. */
function toggle(width: number, open: boolean, tip: boolean): SvgNode {
  const radius = BOX.toggle / 2;
  const arm = 4;
  return el(
    'g',
    {
      class: 'control',
      transform: translate(width - BOX.pad - radius, BOX.pad + radius),
    },
    [
      tip && el('title', {}, [open ? TOGGLE_TIP.close : TOGGLE_TIP.open]),
      el('circle', { r: radius }),
      el('path', {
        d: open
          ? path('M', -arm, 0, 'H', arm)
          : path('M', -arm, 0, 'H', arm, 'M', 0, -arm, 'V', arm),
      }),
    ],
  );
}

/**
 * One box (LOOK-201 to LOOK-306): its shape, the inner contour of a container, the focus ring, the
 * icon, the text placed for the audience, and a container's control. Drawn at the origin and moved
 * into place with a translation, so a later glide moves the whole group.
 */
export function drawBox(
  id: Id,
  box: Box,
  look: BoxLook,
  iconName: IconName,
  text: PlacedBoxText | undefined,
  mark: NodeMark,
  spoken: Spoken | null = null,
): SvgNode {
  const corner = cornerOf(look, box.height);
  const inset = BOX.inset;
  const ring = SHAPE.ringOffset;
  const container = look.state !== 'leaf';
  return el(
    'g',
    {
      class: boxClasses(look, mark),
      'data-id': id,
      transform: translate(box.x, box.y),
    },
    [
      // On the page, the outline is the box's button: focusable, named and announced (INT-903).
      // Its text is drawn beside it rather than inside it, so a screen reader hears it once.
      el('rect', {
        class: 'shape',
        width: box.width,
        height: box.height,
        rx: corner,
        ...(spoken === null
          ? {}
          : {
              tabindex: 0,
              role: 'button',
              'aria-label': spoken.label,
              'aria-pressed': spoken.selected ? 'true' : 'false',
              'aria-expanded': container ? String(look.state === 'open') : null,
            }),
      }),
      container &&
        el('rect', {
          class: 'inner',
          x: inset,
          y: inset,
          width: box.width - 2 * inset,
          height: box.height - 2 * inset,
          rx: Math.max(0, corner - inset),
        }),
      el('rect', {
        class: 'ring',
        x: -ring,
        y: -ring,
        width: box.width + 2 * ring,
        height: box.height + 2 * ring,
        rx: corner + ring,
      }),
      icon(iconName, BOX.pad, BOX.pad, BOX.icon),
      ...(look.state === 'open' ? [] : boxLines(text, box, spoken !== null)),
      container && toggle(box.width, look.state === 'open', spoken !== null),
    ],
  );
}

/** A box's text lines, relative to the box; hidden from screen readers, which hear the button. */
function boxLines(text: PlacedBoxText | undefined, box: Box, hidden = false): SvgNode[] {
  if (text === undefined) return [];
  const lines = [
    textLine(text.name, box),
    ...text.tagline.map((line) => textLine(line, box)),
    ...(text.chip === null ? [] : [textLine(text.chip, box)]),
  ];
  if (hidden) for (const line of lines) line.attrs['aria-hidden'] = 'true';
  return lines;
}

/**
 * An open container's header text. Lines may cross a container's header when it holds one of
 * their ends (RULE-007), so the header text is drawn above the lines, on a halo of its band, and
 * a line never cuts through it (as LOOK-502 keeps labels clear). Its group sits where the box does.
 */
export function drawHead(
  id: Id,
  box: Box,
  look: BoxLook,
  text: PlacedBoxText | undefined,
  mark: NodeMark,
): SvgNode {
  const out = ['head', `depth-${String(Math.min(3, look.depth))}`];
  if (look.external) out.push('external');
  if (mark !== 'plain') out.push(mark);
  return el(
    'g',
    { class: out.join(' '), 'data-id': id, transform: translate(box.x, box.y) },
    boxLines(text, box),
  );
}

/** LOOK-305: the hatching outside systems are filled with. */
export function hatchPattern(): SvgNode {
  const size = SHAPE.hatch;
  return el(
    'pattern',
    {
      id: HATCH_ID,
      width: size,
      height: size,
      patternUnits: 'userSpaceOnUse',
      patternTransform: 'rotate(45)',
    },
    [
      el('rect', { class: 'hatch-bg', width: size, height: size }),
      el('path', { class: 'hatch-line', d: path('M', 0, 0, 'V', size) }),
    ],
  );
}

const edgeClass = (base: string, mark: EdgeMark): string =>
  mark === 'plain' ? base : `${base} ${mark}`;

/** The trail's curves and its badges, drawn above everything else (LOOK-701 to LOOK-704). */
export function drawTrail(shapes: readonly TrailShape[]): SvgNode[] {
  const last = shapes.at(-1)?.number ?? 0;
  const curves = shapes.map((shape) => {
    const current = shape.number === last;
    const call = shape.role === 'call';
    const d =
      shape.kind === 'curve'
        ? path(
            'M',
            shape.start.x,
            shape.start.y,
            'Q',
            shape.control.x,
            shape.control.y,
            shape.end.x,
            shape.end.y,
          )
        : path(
            'M',
            shape.start.x,
            shape.start.y,
            'C',
            shape.controls[0].x,
            shape.controls[0].y,
            shape.controls[1].x,
            shape.controls[1].y,
            shape.end.x,
            shape.end.y,
          );
    const from = shape.kind === 'curve' ? shape.control : shape.controls[1];
    return el(
      'g',
      {
        class: `step ${shape.role} ${current ? 'now' : 'past'}`,
        'data-step': shape.number,
      },
      [
        // The current call step draws itself along a path one unit long (LOOK-701).
        el('path', { class: 'curve', d, pathLength: current && call ? 1 : null }),
        // LOOK-702: a reply is a dotted line with no arrowhead.
        call && el('path', { class: 'arrow', d: chevron(shape.end, from) }),
      ],
    );
  });
  const badges = shapes.map((shape) => {
    const current = shape.number === last;
    return el(
      'g',
      {
        class: current ? 'badge now' : 'badge',
        'data-step': shape.number,
        transform: translate(shape.badge.x, shape.badge.y),
      },
      [
        el('circle', { r: current ? SHAPE.currentBadge : SHAPE.badge }),
        el(
          'text',
          {
            class: BADGE_TEXT.className,
            y: current ? BADGE_TEXT.currentBaseline : BADGE_TEXT.baseline,
          },
          [String(shape.number)],
        ),
      ],
    );
  });
  return [el('g', { class: 'trail' }, curves), el('g', { class: 'badges' }, badges)];
}

/** The root of a drawing: its size, its accessible name, the hatching and, standing alone, the style. */
export function drawingRoot(
  size: { width: number; height: number },
  label: string,
  data: Record<string, string>,
  options: RenderOptions,
  layers: readonly SvgNode[],
): SvgNode {
  const interactive = options.interactive === true;
  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      class: 'aerie',
      viewBox: `0 0 ${num(size.width)} ${num(size.height)}`,
      width: size.width,
      height: size.height,
      overflow: 'visible',
      // A drawing a reader explores is a group of focusable boxes, not one image.
      role: interactive ? 'group' : 'img',
      'aria-label': label,
      'data-theme': options.theme,
      ...data,
    },
    [
      options.standalone === true && el('style', {}, [contourStyle()]),
      el('defs', {}, [hatchPattern()]),
      ...layers,
    ],
  );
}

/**
 * A structure picture for its audience (docs/spec/look.md). Boxes come in model order, parents
 * first, so children sit on their containers' bands; lines are drawn over the boxes, open
 * containers' header text and labels over the lines, and the trail over everything.
 */
export function renderPicture(
  semantics: Semantics,
  picture: PictureLayout,
  options: RenderOptions = {},
): SvgNode {
  const { drawing, result, text, audience } = picture;
  const scene = semantics.scene(drawing, audience);
  const marks = emphasis(semantics.tree, drawing, options.focus ?? { kind: 'none' });
  const interactive = options.interactive === true;
  const worded = new Map(scene.nodes.map((node) => [node.id, node]));
  const heads: SvgNode[] = [];
  const boxes = drawing.nodes.flatMap((node) => {
    const box = result.boxes[node.id];
    if (box === undefined) return [];
    const tags = semantics.tree.get(node.id).tags;
    const look: BoxLook = {
      state: node.state,
      person: tags.includes('person'),
      external: tags.includes('external'),
      depth: node.depth,
    };
    const mark = marks.nodes.get(node.id) ?? 'plain';
    if (node.state === 'open') heads.push(drawHead(node.id, box, look, text.boxes[node.id], mark));
    const words = worded.get(node.id);
    const spoken: Spoken | null =
      interactive && words !== undefined
        ? {
            label: words.tagline === null ? words.name : `${words.name}: ${words.tagline}`,
            selected: mark === 'sel',
          }
        : null;
    return [drawBox(node.id, box, look, node.icon, text.boxes[node.id], mark, spoken)];
  });
  const lines: SvgNode[] = [];
  const labels: SvgNode[] = [];
  for (const edge of scene.edges) {
    const route = result.edges[edge.id];
    if (route === undefined) continue;
    const mark = marks.edges.get(edge.id) ?? 'plain';
    const tip = route.points.at(-1);
    const before = route.points.at(-2);
    lines.push(
      el('g', { class: edgeClass('edge', mark), 'data-id': edge.id }, [
        el('path', { class: 'line', d: roundedRoute(route.points) }),
        tip !== undefined &&
          before !== undefined &&
          el('path', { class: 'arrow', d: chevron(tip, before) }),
      ]),
    );
    const placed = text.labels[edge.id] ?? [];
    if (placed.length === 0) continue;
    labels.push(
      el('g', { class: edgeClass('label', mark), 'data-id': edge.id }, [
        // LOOK-503: hovering a label shows its full sentence, one per carried relationship.
        el('title', {}, [edge.relationships.map((each) => each.sentence).join('\n')]),
        // INT-206: on the page, the whole space reserved for the label can be hovered.
        interactive &&
          el('rect', {
            class: 'hit',
            x: route.label.x,
            y: route.label.y,
            width: route.label.width,
            height: route.label.height,
          }),
        ...placed.map((line) => textLine(line, { x: 0, y: 0 })),
      ]),
    );
  }
  const title = semantics.title(audience);
  const label = title === null ? scene.title : `${title}: ${scene.title}`;
  const hidden = interactive ? 'true' : null;
  return drawingRoot(
    result,
    label,
    { 'data-view': drawing.view, 'data-audience': audience },
    options,
    [
      el('g', { class: 'boxes' }, boxes),
      el('g', { class: 'edges', 'aria-hidden': hidden }, lines),
      el('g', { class: 'heads', 'aria-hidden': hidden }, heads),
      el('g', { class: 'labels', 'aria-hidden': hidden }, labels),
      ...(options.trail === undefined || options.trail.length === 0
        ? []
        : drawTrail(options.trail)),
    ],
  );
}
