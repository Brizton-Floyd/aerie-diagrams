// Rule checks (docs/spec/layout.md, RULE-001 to RULE-011): what every structure layout and every
// lanes layout must satisfy, for every audience. Each check returns findings in plain words rather
// than throwing, so the rules suite can report every broken rule of a picture at once. A tolerance
// of 0.5 px applies throughout. RULE-005 and RULE-009 compare whole layouts, so the rules suite
// checks them directly.
import type { Id } from '../lines/index.ts';
import { lift, type Semantics } from '../model/index.ts';
import { BOX, TEXT_LEFT, control } from './anatomy.ts';
import type { LanesLayout, PlacedLanesText } from './lanes.ts';
import type { PlacedLine, PlacedText, StructureLayout } from './structure.ts';
import { ROLES, type TextRole } from './text/measure.ts';
import { round, type Box, type LayoutNode, type Point } from './types.ts';

/** The tolerance of every comparison, in pixels. */
export const TOLERANCE = 0.5;

/** One broken rule: its id and what is wrong, naming the elements and edges involved. */
export interface Finding {
  rule: string;
  message: string;
}

const right = (box: Box): number => box.x + box.width;
const bottom = (box: Box): number => box.y + box.height;

/** True when the insides of two boxes overlap by more than the tolerance in both directions. */
export function overlaps(a: Box, b: Box): boolean {
  return (
    Math.min(right(a), right(b)) - Math.max(a.x, b.x) > TOLERANCE &&
    Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y) > TOLERANCE
  );
}

/** True when a point lies on a box's outline. */
export function onOutline(at: Point, box: Box): boolean {
  const withinX = at.x >= box.x - TOLERANCE && at.x <= right(box) + TOLERANCE;
  const withinY = at.y >= box.y - TOLERANCE && at.y <= bottom(box) + TOLERANCE;
  const onSide = Math.abs(at.x - box.x) <= TOLERANCE || Math.abs(at.x - right(box)) <= TOLERANCE;
  const onTop = Math.abs(at.y - box.y) <= TOLERANCE || Math.abs(at.y - bottom(box)) <= TOLERANCE;
  return (onSide && withinY) || (onTop && withinX);
}

/**
 * True when the segment from `a` to `b` passes through the inside of a box shrunk by the
 * tolerance on every side (Liang-Barsky clipping).
 */
export function crossesInside(a: Point, b: Point, box: Box): boolean {
  const left = box.x + TOLERANCE;
  const top = box.y + TOLERANCE;
  const far = right(box) - TOLERANCE;
  const low = bottom(box) - TOLERANCE;
  if (far <= left || low <= top) return false;
  let enter = 0;
  let leave = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const sides: [number, number][] = [
    [-dx, a.x - left],
    [dx, far - a.x],
    [-dy, a.y - top],
    [dy, low - a.y],
  ];
  for (const [p, q] of sides) {
    if (p === 0) {
      if (q <= 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) enter = Math.max(enter, t);
    else leave = Math.min(leave, t);
    if (enter >= leave) return false;
  }
  return true;
}

/** The header of an open container: the strip above its children. */
function headerBox(box: Box, node: LayoutNode): Box | null {
  return node.open ? { x: box.x, y: box.y, width: box.width, height: node.header } : null;
}

/** Everything the checks need about one structure layout. */
class Picture {
  readonly nodes = new Map<Id, LayoutNode>();
  readonly boxes: Record<string, Box>;
  readonly ancestors = new Map<Id, Id[]>();
  /** The drawn elements that are containers, open or closed. */
  readonly containers = new Set<Id>();
  readonly layout: StructureLayout;

  constructor(layout: StructureLayout) {
    this.layout = layout;
    this.boxes = layout.result.boxes;
    for (const node of layout.drawing.nodes) {
      if (node.state !== 'leaf') this.containers.add(node.id);
    }
    for (const node of layout.graph.nodes) {
      this.nodes.set(node.id, node);
      const above =
        node.parent === null ? [] : [node.parent, ...(this.ancestors.get(node.parent) ?? [])];
      this.ancestors.set(node.id, above);
    }
  }

  box(id: Id): Box | undefined {
    return this.boxes[id];
  }

  /** True when `outer` contains `inner` in the drawn tree. */
  holds(outer: Id, inner: Id): boolean {
    return this.ancestors.get(inner)?.includes(outer) ?? false;
  }
}

function describe(box: Box): string {
  return `(${String(box.x)}, ${String(box.y)}, ${String(box.width)} x ${String(box.height)})`;
}

/** RULE-001: two drawn boxes that do not contain each other do not intersect. */
function noOverlaps(picture: Picture, findings: Finding[]): void {
  const ids = [...picture.nodes.keys()];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i] ?? '';
      const b = ids[j] ?? '';
      if (picture.holds(a, b) || picture.holds(b, a)) continue;
      const boxA = picture.box(a);
      const boxB = picture.box(b);
      if (boxA !== undefined && boxB !== undefined && overlaps(boxA, boxB)) {
        findings.push({
          rule: 'RULE-001',
          message: `${a} ${describe(boxA)} overlaps ${b} ${describe(boxB)}`,
        });
      }
    }
  }
}

/** RULE-002: every child lies below its parent's header and `containerPad` from its other sides. */
function childrenInside(picture: Picture, findings: Finding[]): void {
  for (const node of picture.nodes.values()) {
    if (node.parent === null) continue;
    const parent = picture.nodes.get(node.parent);
    const box = picture.box(node.id);
    const outer = picture.box(node.parent);
    if (parent === undefined || box === undefined || outer === undefined) continue;
    const pad = BOX.containerPad;
    const header = parent.open ? parent.header : 0;
    const fits =
      box.x >= outer.x + pad - TOLERANCE &&
      box.y >= outer.y + header - TOLERANCE &&
      right(box) <= right(outer) - pad + TOLERANCE &&
      bottom(box) <= bottom(outer) - pad + TOLERANCE;
    if (!fits) {
      findings.push({
        rule: 'RULE-002',
        message: `${node.id} ${describe(box)} is not inside ${node.parent} ${describe(outer)} below its ${String(header)} px header`,
      });
    }
  }
}

/** RULE-003: one line fits a region, across and down. */
function lineFits(
  line: PlacedLine,
  region: { left: number; right: number; top: number; bottom: number },
): boolean {
  return (
    line.x >= region.left - TOLERANCE &&
    line.x + line.width <= region.right + TOLERANCE &&
    line.y >= region.top - TOLERANCE &&
    line.y + line.height <= region.bottom + TOLERANCE
  );
}

/**
 * RULE-003: for one audience, every name, tagline line and chip fits the width left for text in
 * its box and the height of its box (or of an open container's header); every label line fits its
 * label box less its padding.
 */
function labelsFit(picture: Picture, text: PlacedText, findings: Finding[]): void {
  for (const [id, placed] of Object.entries(text.boxes)) {
    const node = picture.nodes.get(id);
    const box = picture.box(id);
    if (node === undefined || box === undefined) continue;
    const container = picture.containers.has(id);
    const limit = node.open ? box.y + node.header - BOX.headGap : bottom(box) - BOX.pad;
    const region = {
      left: box.x + TEXT_LEFT,
      right: right(box) - BOX.pad - control(container),
      top: box.y + BOX.pad,
      bottom: placed.chip === null ? limit : placed.chip.y,
    };
    for (const line of [placed.name, ...placed.tagline]) {
      if (!lineFits(line, region)) {
        findings.push({
          rule: 'RULE-003',
          message: `${text.audience}: "${line.text}" (${String(line.width)} px) does not fit ${id} ${describe(box)}`,
        });
      }
    }
    if (placed.chip !== null && !lineFits(placed.chip, { ...region, bottom: limit })) {
      findings.push({
        rule: 'RULE-003',
        message: `${text.audience}: the chip "${placed.chip.text}" does not fit ${id} ${describe(box)}`,
      });
    }
  }
  for (const [id, lines] of Object.entries(text.labels)) {
    const box = picture.layout.result.edges[id]?.label;
    if (box === undefined) continue;
    const region = {
      left: box.x + BOX.labelPadX,
      right: right(box) - BOX.labelPadX,
      top: box.y + BOX.labelPadY,
      bottom: bottom(box) - BOX.labelPadY,
    };
    for (const line of lines) {
      if (!lineFits(line, region)) {
        findings.push({
          rule: 'RULE-003',
          message: `${text.audience}: the label line "${line.text}" (${String(line.width)} px) does not fit the label of ${id} ${describe(box)}`,
        });
      }
    }
  }
}

/** RULE-004: no label box meets a leaf or closed box, an open container's header, or another label. */
function labelsClear(picture: Picture, findings: Finding[]): void {
  const labels = Object.entries(picture.layout.result.edges).map(([id, edge]) => ({
    id,
    box: edge.label,
  }));
  for (const [index, label] of labels.entries()) {
    for (const node of picture.nodes.values()) {
      const box = picture.box(node.id);
      if (box === undefined) continue;
      const blocked = node.open ? headerBox(box, node) : box;
      if (blocked !== null && overlaps(label.box, blocked)) {
        findings.push({
          rule: 'RULE-004',
          message: `the label of ${label.id} ${describe(label.box)} meets ${node.open ? 'the header of ' : ''}${node.id} ${describe(blocked)}`,
        });
      }
    }
    for (const other of labels.slice(index + 1)) {
      if (overlaps(label.box, other.box)) {
        findings.push({
          rule: 'RULE-004',
          message: `the label of ${label.id} ${describe(label.box)} meets the label of ${other.id} ${describe(other.box)}`,
        });
      }
    }
  }
}

/**
 * RULE-006: every edge has a route of at least two points from its source's outline to its
 * target's, and every relationship the view carries (MODEL-302) has its edge. The carried
 * relationships are worked out again here from the model, independently of the drawing.
 */
function everyRelationshipDrawn(semantics: Semantics, picture: Picture, findings: Finding[]): void {
  const { graph, result, drawing } = picture.layout;
  for (const edge of graph.edges) {
    const routed = result.edges[edge.id];
    const from = picture.box(edge.source);
    const to = picture.box(edge.target);
    const first = routed?.points[0];
    const last = routed?.points.at(-1);
    if (
      routed === undefined ||
      first === undefined ||
      last === undefined ||
      routed.points.length < 2
    ) {
      findings.push({ rule: 'RULE-006', message: `${edge.id} has no route of two or more points` });
      continue;
    }
    if (from === undefined || !onOutline(first, from)) {
      findings.push({ rule: 'RULE-006', message: `${edge.id} does not start on ${edge.source}` });
    }
    if (to === undefined || !onOutline(last, to)) {
      findings.push({ rule: 'RULE-006', message: `${edge.id} does not end on ${edge.target}` });
    }
  }
  const drawn = new Set(drawing.nodes.map((node) => node.id));
  semantics.model.relationships.forEach((relationship, index) => {
    if (!drawing.kinds.includes(relationship.kind)) return;
    const a = lift(semantics.tree, drawn, relationship.subject);
    const b = lift(semantics.tree, drawn, relationship.object);
    if (a === null || b === null || a === b || picture.holds(a, b) || picture.holds(b, a)) return;
    if (result.edges[`${a}->${b}`] === undefined) {
      findings.push({
        rule: 'RULE-006',
        message: `relationship ${String(index)} (${relationship.subject} to ${relationship.object}) has no edge ${a}->${b}`,
      });
    }
  });
}

/**
 * RULE-007: no edge segment crosses the inside of a leaf or closed box other than its own ends, or
 * an open container's header unless the container is an end or holds one.
 */
function linesGoAround(picture: Picture, findings: Finding[]): void {
  for (const edge of picture.layout.graph.edges) {
    const points = picture.layout.result.edges[edge.id]?.points ?? [];
    const ends = [edge.source, edge.target];
    for (const node of picture.nodes.values()) {
      const box = picture.box(node.id);
      if (box === undefined) continue;
      const related = ends.some((end) => end === node.id || picture.holds(node.id, end));
      let blocked: Box | null;
      if (node.open) blocked = related ? null : headerBox(box, node);
      else blocked = ends.includes(node.id) ? null : box;
      if (blocked === null) continue;
      for (let i = 0; i + 1 < points.length; i++) {
        const a = points[i];
        const b = points[i + 1];
        if (a !== undefined && b !== undefined && crossesInside(a, b, blocked)) {
          findings.push({
            rule: 'RULE-007',
            message: `${edge.id} crosses ${node.open ? 'the header of ' : ''}${node.id} ${describe(blocked)}`,
          });
          break;
        }
      }
    }
  }
}

/** LAYOUT-006: how far, at most, a label box may sit from its route: twice ELK's label spacing. */
export const BESIDE = 8;

/** The shortest distance between a box and a route. */
export function distanceToRoute(box: Box, points: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a === undefined || b === undefined) continue;
    if (crossesInside(a, b, box)) return 0;
    // Routes are horizontal and vertical, so the gap is the gap between two boxes.
    const dx = Math.max(0, box.x - Math.max(a.x, b.x), Math.min(a.x, b.x) - right(box));
    const dy = Math.max(0, box.y - Math.max(a.y, b.y), Math.min(a.y, b.y) - bottom(box));
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

/** Whether a route passes through the inside of a box. */
function onRoute(box: Box, points: readonly Point[]): boolean {
  return points.some((a, i) => {
    const b = points[i + 1];
    return b !== undefined && crossesInside(a, b, box);
  });
}

/** LAYOUT-006: every label box sits beside its route. */
function labelsBeside(picture: Picture, findings: Finding[]): void {
  for (const [id, edge] of Object.entries(picture.layout.result.edges)) {
    const distance = distanceToRoute(edge.label, edge.points);
    if (distance === 0 && onRoute(edge.label, edge.points)) {
      findings.push({
        rule: 'LAYOUT-006',
        message: `the label of ${id} ${describe(edge.label)} lies on its route`,
      });
    } else if (distance > BESIDE + TOLERANCE) {
      findings.push({
        rule: 'LAYOUT-006',
        message: `the label of ${id} ${describe(edge.label)} is ${String(round(distance))} px from its route`,
      });
    }
  }
}

/** RULE-008: every text role on the diagram is at least 13.5 px at scale 1. */
export function textLargeEnough(roles: Readonly<Record<string, TextRole>> = ROLES): Finding[] {
  return Object.entries(roles)
    .filter(([, role]) => role.size < 13.5)
    .map(([name, role]) => ({
      rule: 'RULE-008',
      message: `the ${name} role is ${String(role.size)} px, below 13.5 px`,
    }));
}

/**
 * RULE-001 to RULE-004, RULE-006 and RULE-007 on one structure layout, with RULE-003 for each
 * audience's placed text, and LAYOUT-006 (every node has a box, every label sits beside its route).
 * An empty list means the layout passes.
 */
export function checkStructure(
  semantics: Semantics,
  layout: StructureLayout,
  texts: readonly PlacedText[],
): Finding[] {
  const picture = new Picture(layout);
  const findings: Finding[] = [];
  for (const node of layout.graph.nodes) {
    if (picture.box(node.id) === undefined) {
      findings.push({ rule: 'LAYOUT-006', message: `${node.id} has no box` });
    }
  }
  noOverlaps(picture, findings);
  childrenInside(picture, findings);
  for (const text of texts) labelsFit(picture, text, findings);
  labelsClear(picture, findings);
  everyRelationshipDrawn(semantics, picture, findings);
  linesGoAround(picture, findings);
  labelsBeside(picture, findings);
  return findings;
}

/**
 * RULE-010 and the lanes half of RULE-011 on one lanes layout, with each audience's placed text:
 * headers do not overlap, rows do not overlap, every label fits between the lanes it spans and
 * fits its row, the text of every audience fits the one reserved layout, and every step has its
 * arrow or loop. `steps` is the scenario's number of steps.
 */
export function checkLanes(
  lanes: LanesLayout,
  texts: readonly PlacedLanesText[],
  steps: number,
): Finding[] {
  const findings: Finding[] = [];
  const add = (rule: string, message: string): void => {
    findings.push({ rule, message });
  };
  lanes.lanes.forEach((lane, index) => {
    for (const other of lanes.lanes.slice(index + 1)) {
      if (overlaps(lane.header, other.header)) {
        add('RULE-010', `the header of ${lane.id} overlaps the header of ${other.id}`);
      }
    }
  });
  for (const band of lanes.bands) {
    for (const other of lanes.bands) {
      if (other !== band && other.depth === band.depth && overlaps(band.box, other.box)) {
        add('RULE-010', `the band of ${band.id} overlaps the band of ${other.id}`);
      }
    }
  }
  const x = new Map(lanes.lanes.map((lane, index) => [lane.id, { x: lane.x, index }]));
  let floor = -Infinity;
  const lastRow = lanes.rows.at(-1);
  for (const row of lanes.rows) {
    if (row.top < floor - TOLERANCE)
      add('RULE-010', `row ${String(row.number)} overlaps the row above it`);
    floor = row.top + row.height;
    const label = row.label;
    if (label.y < row.top - TOLERANCE || bottom(label) > row.top + row.height + TOLERANCE) {
      add('RULE-010', `the label of step ${String(row.number)} does not fit its row`);
    }
    const from = x.get(row.from);
    const to = x.get(row.to);
    if (from === undefined || to === undefined) {
      add('RULE-011', `step ${String(row.number)} runs from or to a lane that is not drawn`);
      continue;
    }
    let left: number;
    let rightmost: number;
    if (row.kind === 'arrow') {
      left = Math.min(from.x, to.x);
      rightmost = Math.max(from.x, to.x);
      const [start, end] = row.points;
      const drawn =
        row.points.length === 2 &&
        start !== undefined &&
        end !== undefined &&
        Math.abs(start.x - from.x) <= TOLERANCE &&
        Math.abs(end.x - to.x) <= TOLERANCE &&
        start.y === end.y;
      if (!drawn)
        add('RULE-011', `step ${String(row.number)} has no arrow from ${row.from} to ${row.to}`);
    } else {
      left = from.x;
      rightmost = lanes.lanes[from.index + 1]?.x ?? lanes.width;
      if (row.points.length < 2 || row.points[0]?.x !== from.x) {
        add('RULE-011', `step ${String(row.number)} has no loop on ${row.from}`);
      }
    }
    if (label.x < left - TOLERANCE || right(label) > rightmost + TOLERANCE) {
      add('RULE-010', `the label of step ${String(row.number)} does not fit between its lanes`);
    }
  }
  if (lanes.rows.length !== steps) {
    add('RULE-011', `${String(lanes.rows.length)} rows for ${String(steps)} steps`);
  }
  for (const lane of lanes.lanes) {
    if (lastRow !== undefined && lane.bottom < lastRow.top + lastRow.height - TOLERANCE) {
      add('RULE-010', `the line of ${lane.id} stops above the last row`);
    }
  }
  for (const text of texts) {
    for (const lane of lanes.lanes) {
      const placed = text.headers[lane.id];
      if (placed === undefined) continue;
      const box = lane.header;
      const region = {
        left: box.x + TEXT_LEFT,
        right: right(box) - BOX.pad,
        top: box.y + BOX.pad,
        bottom: bottom(box) - BOX.pad,
      };
      for (const line of [placed.name, ...placed.tagline]) {
        if (!lineFits(line, region)) {
          add('RULE-010', `${text.audience}: "${line.text}" does not fit the header of ${lane.id}`);
        }
      }
    }
    for (const band of lanes.bands) {
      const line = text.bands[band.id];
      const region = {
        left: band.box.x,
        right: right(band.box),
        top: band.box.y,
        bottom: bottom(band.box),
      };
      if (line !== undefined && !lineFits(line, region)) {
        add('RULE-010', `${text.audience}: the band name "${line.text}" does not fit its band`);
      }
    }
    for (const row of lanes.rows) {
      const box = row.label;
      const region = {
        left: box.x + BOX.labelPadX,
        right: right(box) - BOX.labelPadX,
        top: box.y + BOX.labelPadY,
        bottom: bottom(box) - BOX.labelPadY,
      };
      for (const line of text.labels[row.number] ?? []) {
        if (!lineFits(line, region)) {
          add(
            'RULE-010',
            `${text.audience}: the label line "${line.text}" does not fit step ${String(row.number)}`,
          );
        }
      }
    }
  }
  return findings;
}
