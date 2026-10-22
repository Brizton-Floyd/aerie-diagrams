// Scenarios as lanes (docs/spec/layout.md, LAYOUT-601 to LAYOUT-607): time runs down the page, with
// one lane per participant and one row per step. Aerie lays it out with its own algorithm; ELK is
// not involved. Space is reserved for every audience's wording, so switching audience moves nothing.
import type { Id } from '../lines/index.ts';
import { lift, type Semantics, type StepRole } from '../model/index.ts';
import { BOX, TEXT_LEFT } from './anatomy.ts';
import {
  boxText,
  closedSize,
  labelRole,
  labelSize,
  reservedText,
  type BoxText,
} from './reserve.ts';
import type { PlacedBoxText, PlacedLine, StructureLayout } from './structure.ts';
import { ROLES, measure, wrap, type RoleName, type TextLine } from './text/measure.ts';
import { round, type Box, type Point } from './types.ts';

/** The spacing of the lanes layout, in pixels. */
export const LANES = {
  /** LAYOUT-605: the least space between two lane headers. */
  headerGap: 32,
  /** LAYOUT-605: the space a step's label keeps from the lanes around it. */
  labelGap: 16,
  /** LAYOUT-605 and LAYOUT-606: how far a self step's loop reaches right of its lane. */
  loop: 24,
  /** LAYOUT-604: a row is its reserved label's height plus this. */
  rowExtra: 16,
  /** LAYOUT-604: the least height of a self step's row. */
  selfRow: 24,
  /** The height of one band, its name line and padding above and below. */
  band: 28,
  /** Padding left of a band's name, and the least space right of it. */
  bandPad: 10,
  /** Space between the lowest band and the headers, and between the headers and the first row. */
  gap: 16,
  /** How far inside its row a step's label and its arrow or loop keep from the row's top and bottom. */
  rowInset: 4,
  /** Space between a self step's loop and its label. */
  loopGap: 4,
} as const;

/** One participant's lane: a header at the top and a line running down below the last row. */
export interface Lane {
  id: Id;
  /** The centre of the lane line. */
  x: number;
  header: Box;
  /** Where the lane line starts (the header's bottom) and ends. */
  top: number;
  bottom: number;
}

/** A drawn ancestor that holds lanes: a strip above its lanes with its name, stacked by depth. */
export interface LaneBand {
  id: Id;
  /** MODEL-002: the element's depth; deeper bands sit lower. */
  depth: number;
  box: Box;
}

/** One step: a horizontal arrow from lane to lane, or a self step's loop on one lane. */
export interface LaneRow {
  /** The step's number, from 1. */
  number: number;
  role: StepRole;
  kind: 'arrow' | 'self';
  /** The lanes of the subject and the object (the same lane for a self step). */
  from: Id;
  to: Id;
  top: number;
  height: number;
  /** An arrow's two ends, or a self step's loop from its start to its end. */
  points: Point[];
  /** The step's reserved label box. */
  label: Box;
  /** Where the step's number badge sits: the start of the arrow or loop. */
  badge: Point;
}

/** One audience's wording of a lanes layout. */
export interface LanesWording {
  audience: Id;
  code: boolean;
  headers: Map<Id, BoxText>;
  bands: Map<Id, TextLine>;
  /** Each step's verb phrase, wrapped, by step number. */
  labels: Map<number, TextLine[]>;
}

/** A scenario laid out as lanes on its stage view at a zoom state. */
export interface LanesLayout {
  scenario: Id;
  view: Id;
  width: number;
  height: number;
  /** Left to right (LAYOUT-602). */
  lanes: Lane[];
  /** Shallowest first, then left to right. */
  bands: LaneBand[];
  /** In step order. */
  rows: LaneRow[];
  /** Every audience's wording, in the model's audience order. */
  wordings: LanesWording[];
}

/** One audience's lanes text, placed (LAYOUT-204): headers like boxes, labels centred. */
export interface PlacedLanesText {
  audience: Id;
  headers: Record<Id, PlacedBoxText>;
  bands: Record<Id, PlacedLine>;
  labels: Record<number, PlacedLine[]>;
}

function wordLanes(
  semantics: Semantics,
  scenario: Id,
  lanes: readonly Id[],
  bands: readonly Id[],
): LanesWording[] {
  return semantics.model.audiences.map((audience) => {
    const headers = new Map<Id, BoxText>();
    for (const id of lanes) {
      const name = semantics.name(id, audience.id);
      headers.set(id, boxText(name, semantics.tagline(id, audience.id), audience.code, null));
    }
    const named = new Map<Id, TextLine>();
    for (const id of bands) {
      const name = semantics.name(id, audience.id);
      named.set(id, { text: name, width: measure(name, ROLES.band) });
    }
    const labels = new Map<number, TextLine[]>();
    for (const step of semantics.steps(scenario, audience.id)) {
      labels.set(step.number, wrap(step.verb, labelRole(audience.code)));
    }
    return { audience: audience.id, code: audience.code, headers, bands: named, labels };
  });
}

/**
 * Lays out a scenario as lanes on the view and zoom state of a structure layout, which must be its
 * stage view (MODEL-404) so every step end has a lift. The structure layout gives the arrangement
 * the lanes keep (LAYOUT-602). The work grows in step with the number of steps and lanes.
 */
export function layoutLanes(
  semantics: Semantics,
  scenario: Id,
  structure: StructureLayout,
): LanesLayout {
  const tree = semantics.tree;
  const view = structure.drawing.view;
  const drawn = new Set(structure.drawing.nodes.map((node) => node.id));
  const boxes = structure.result.boxes;

  // LAYOUT-601: the lifts of every step end, each once.
  const steps = semantics.scenario(scenario).steps.map((step, index) => {
    const from = lift(tree, drawn, step.subject);
    const to = lift(tree, drawn, step.object);
    if (from === null || to === null) {
      throw new Error(
        `Step ${String(index + 1)} of ${scenario} has an end with no lift on ${view}: lay it out on its stage view.`,
      );
    }
    return { number: index + 1, from, to, role: semantics.joins.role(step.subject, step.object) };
  });
  const lanesSet = new Set(steps.flatMap((step) => [step.from, step.to]));

  // LAYOUT-602: the tree of the lanes and their drawn ancestors, children ordered by the centre of
  // their structure box (x, then y, then model order); the lanes are its depth-first order.
  const children = new Map<Id | null, Id[]>();
  const inTree = new Set<Id>();
  for (const id of lanesSet) {
    for (const at of [id, ...tree.ancestors(id)]) {
      if (inTree.has(at)) break;
      inTree.add(at);
      const parent = tree.parent(at);
      const list = children.get(parent) ?? [];
      list.push(at);
      children.set(parent, list);
    }
  }
  const centre = (id: Id): Point => {
    const box = boxes[id];
    return box === undefined
      ? { x: 0, y: 0 }
      : { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const order: Id[] = [];
  const bandIds: Id[] = [];
  const visit = (parent: Id | null): void => {
    const list = [...(children.get(parent) ?? [])].sort((a, b) => {
      const ca = centre(a);
      const cb = centre(b);
      return ca.x - cb.x || ca.y - cb.y || tree.order(a) - tree.order(b);
    });
    for (const id of list) {
      if (lanesSet.has(id)) order.push(id);
      if (children.has(id)) bandIds.push(id);
      visit(id);
    }
  };
  visit(null);

  const wordings = wordLanes(semantics, scenario, order, bandIds);

  // LAYOUT-603: each header is sized like a leaf box (LAYOUT-202), for every audience.
  const headerSize = new Map<Id, { width: number; height: number }>();
  for (const id of order) {
    const { textWidth, lines } = reservedText(wordings.flatMap((w) => w.headers.get(id) ?? []));
    headerSize.set(id, closedSize(textWidth, lines, 'leaf'));
  }
  const bandName = new Map<Id, number>();
  for (const id of bandIds) {
    bandName.set(id, Math.max(0, ...wordings.map((w) => w.bands.get(id)?.width ?? 0)));
  }
  // LAYOUT-604: each step's reserved label, from its verb phrase in every audience.
  const labels = steps.map((step) =>
    labelSize(wordings.map((w) => w.labels.get(step.number) ?? [])),
  );

  // LAYOUT-605: lane centres, left to right.
  const index = new Map(order.map((id, at) => [id, at]));
  const reaching = order.map((): { from: number; width: number }[] => []);
  const selfOn = order.map(() => 0);
  steps.forEach((step, at) => {
    const a = index.get(step.from) ?? 0;
    const b = index.get(step.to) ?? 0;
    const width = labels[at]?.width ?? 0;
    if (a === b) selfOn[a] = Math.max(selfOn[a] ?? 0, LANES.loop + width + LANES.labelGap);
    else reaching[Math.max(a, b)]?.push({ from: Math.min(a, b), width });
  });
  const half = (id: Id | undefined): number => (headerSize.get(id ?? '')?.width ?? 0) / 2;
  // The bands around a lane, innermost first: the lane itself when it holds other lanes, then
  // every ancestor (each holds this lane, so each has a band).
  const bandsAround = (id: Id): Id[] => (children.has(id) ? [id] : []).concat(tree.ancestors(id));
  // Each band spans its lanes' headers and the bands inside it, and is at least as wide as its
  // name. Its extent grows as its lanes are placed; it is closed once its last lane is placed.
  const extent = new Map<Id, { left: number; right: number }>();
  const widen = (band: Id, left: number, rightmost: number): void => {
    const known = extent.get(band);
    extent.set(band, {
      left: Math.min(known?.left ?? left, left),
      right: Math.max(known?.right ?? rightmost, rightmost),
    });
  };
  const closed = new Map<Id, number>();
  const close = (band: Id): number => {
    const known = extent.get(band) ?? { left: 0, right: 0 };
    const value = Math.max(known.right, known.left + (bandName.get(band) ?? 0) + 2 * LANES.bandPad);
    closed.set(band, value);
    const parent = tree.parent(band);
    if (parent !== null) widen(parent, known.left, value);
    return value;
  };
  const xs: number[] = [];
  order.forEach((id, at) => {
    let x = half(id);
    if (at > 0) {
      const previous = xs[at - 1] ?? 0;
      x = previous + half(order[at - 1]) + half(id) + LANES.headerGap;
      for (const step of reaching[at] ?? []) {
        x = Math.max(x, (xs[step.from] ?? 0) + step.width + LANES.labelGap);
      }
      x = Math.max(x, previous + (selfOn[at - 1] ?? 0));
      // A band that ends at the previous lane keeps clear of this lane's header, so its name fits.
      const here = new Set(bandsAround(id));
      for (const band of bandsAround(order[at - 1] ?? id)) {
        if (!here.has(band)) x = Math.max(x, close(band) + LANES.headerGap + half(id));
      }
    }
    xs.push(x);
    for (const band of bandsAround(id)) widen(band, x - half(id), x + half(id));
  });
  const lastLane = order.at(-1);
  if (lastLane !== undefined) for (const band of bandsAround(lastLane)) close(band);

  // Vertical: bands stack by depth above the headers; rows follow the tallest header.
  const levels = bandIds.length === 0 ? 0 : Math.max(...bandIds.map((id) => tree.depth(id))) + 1;
  const headerTop = levels === 0 ? 0 : levels * LANES.band + LANES.gap;
  const tallest = Math.max(0, ...order.map((id) => headerSize.get(id)?.height ?? 0));
  let y = headerTop + tallest + LANES.gap;
  const rows: LaneRow[] = steps.map((step, at) => {
    const label = labels[at] ?? { width: 0, height: 0 };
    const self = step.from === step.to;
    const height = Math.max(label.height + LANES.rowExtra, self ? LANES.selfRow : 0);
    const top = y;
    y += height;
    const from = xs[index.get(step.from) ?? 0] ?? 0;
    const to = xs[index.get(step.to) ?? 0] ?? 0;
    if (self) {
      const high = top + LANES.rowInset;
      const low = top + height - LANES.rowInset;
      const reach = from + LANES.loop;
      return {
        number: step.number,
        role: step.role,
        kind: 'self',
        from: step.from,
        to: step.to,
        top,
        height,
        points: [
          { x: from, y: high },
          { x: reach, y: high },
          { x: reach, y: low },
          { x: from, y: low },
        ],
        label: {
          x: reach + LANES.loopGap,
          y: top + (height - label.height) / 2,
          width: label.width,
          height: label.height,
        },
        badge: { x: from, y: high },
      };
    }
    // LAYOUT-606: the arrow runs along the bottom of the row, its label centred above it.
    const arrow = top + height - LANES.rowInset;
    return {
      number: step.number,
      role: step.role,
      kind: 'arrow',
      from: step.from,
      to: step.to,
      top,
      height,
      points: [
        { x: from, y: arrow },
        { x: to, y: arrow },
      ],
      label: {
        x: (from + to) / 2 - label.width / 2,
        y: top + LANES.rowInset,
        width: label.width,
        height: label.height,
      },
      badge: { x: from, y: arrow },
    };
  });
  const height = y + LANES.gap;

  const lanes: Lane[] = order.map((id, at) => {
    const size = headerSize.get(id) ?? { width: 0, height: 0 };
    const x = xs[at] ?? 0;
    return {
      id,
      x,
      header: { x: x - size.width / 2, y: headerTop, width: size.width, height: size.height },
      top: headerTop + size.height,
      bottom: height,
    };
  });
  const bands: LaneBand[] = bandIds
    .map((id): LaneBand => {
      const left = extent.get(id)?.left ?? 0;
      const depth = tree.depth(id);
      return {
        id,
        depth,
        box: {
          x: left,
          y: depth * LANES.band,
          width: (closed.get(id) ?? left) - left,
          height: LANES.band,
        },
      };
    })
    .sort((a, b) => a.depth - b.depth || a.box.x - b.box.x);

  // LAYOUT-605: as wide as the last header or the last lane's self-step labels, and every band.
  const width = Math.max(
    0,
    ...lanes.map((lane) => lane.header.x + lane.header.width),
    ...rows.map((row) => (row.kind === 'self' ? row.label.x + row.label.width : 0)),
    ...bands.map((band) => band.box.x + band.box.width),
  );

  return {
    scenario,
    view,
    width: round(width),
    height: round(height),
    lanes: lanes.map((lane) => ({
      ...lane,
      x: round(lane.x),
      header: roundBox(lane.header),
      top: round(lane.top),
      bottom: round(lane.bottom),
    })),
    bands: bands.map((band) => ({ ...band, box: roundBox(band.box) })),
    rows: rows.map((row) => ({
      ...row,
      top: round(row.top),
      height: round(row.height),
      points: row.points.map(roundPoint),
      label: roundBox(row.label),
      badge: roundPoint(row.badge),
    })),
    wordings,
  };
}

function roundBox(box: Box): Box {
  return { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) };
}

function roundPoint(at: Point): Point {
  return { x: round(at.x), y: round(at.y) };
}

function placed(text: TextLine, role: RoleName, x: number, y: number): PlacedLine {
  return {
    text: text.text,
    role,
    x: round(x),
    y: round(y),
    width: text.width,
    height: ROLES[role].line,
  };
}

/** One audience's lanes text at its fixed places: headers like leaf boxes, labels centred (LAYOUT-204). */
export function placeLanesText(lanes: LanesLayout, audience: Id): PlacedLanesText {
  const wording = lanes.wordings.find((each) => each.audience === audience);
  if (wording === undefined) throw new Error(`There is no audience ${audience}.`);
  const tagline: RoleName = wording.code ? 'taglineCode' : 'tagline';
  const label: RoleName = wording.code ? 'labelCode' : 'label';
  const headers: Record<Id, PlacedBoxText> = {};
  for (const lane of lanes.lanes) {
    const text = wording.headers.get(lane.id);
    if (text === undefined) continue;
    const left = lane.header.x + TEXT_LEFT;
    const top = lane.header.y + BOX.pad;
    headers[lane.id] = {
      name: placed(text.name, 'name', left, top),
      tagline: text.tagline.map((each, at) =>
        placed(each, tagline, left, top + BOX.nameLine + at * BOX.textLine),
      ),
      chip: null,
    };
  }
  const bands: Record<Id, PlacedLine> = {};
  for (const band of lanes.bands) {
    const text = wording.bands.get(band.id);
    if (text === undefined) continue;
    const line = ROLES.band.line;
    bands[band.id] = placed(
      text,
      'band',
      band.box.x + LANES.bandPad,
      band.box.y + (band.box.height - line) / 2,
    );
  }
  const labels: Record<number, PlacedLine[]> = {};
  for (const row of lanes.rows) {
    const lines = wording.labels.get(row.number) ?? [];
    const box = row.label;
    const top = box.y + (box.height - lines.length * BOX.labelLine) / 2;
    labels[row.number] = lines.map((each, at) =>
      placed(each, label, box.x + (box.width - each.width) / 2, top + at * BOX.labelLine),
    );
  }
  return { audience, headers, bands, labels };
}
