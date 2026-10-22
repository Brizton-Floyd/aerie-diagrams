// The ELK adapter (docs/spec/layout.md, LAYOUT-002 and LAYOUT-301 to LAYOUT-306): turns Aerie's
// layout graph into one ELK graph, runs the unmodified `elkjs` engine, and reads the result back in
// Aerie's terms. Only this folder knows ELK exists.
import type { ELK, ElkExtendedEdge, ElkNode, ElkPoint } from 'elkjs/lib/elk-api.js';
import { BOX } from '../anatomy.ts';
import {
  round,
  type Box,
  type LayoutEdge,
  type LayoutEngine,
  type LayoutGraph,
  type LayoutResult,
  type Point,
} from '../types.ts';

/** ELK's graph shape, for tests that read the graph the adapter sends. */
export type { ElkNode };

/** The id of the ELK root graph. Element ids are lowercase words (LANG-008), so it never clashes. */
export const ROOT_ID = '(root)';

/** LAYOUT-301: the options on the root of every ELK graph. */
export const ROOT_OPTIONS: Readonly<Record<string, string>> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.spacing.nodeNodeBetweenLayers': '30',
  'elk.spacing.nodeNode': '26',
  'elk.spacing.edgeNode': '14',
  'elk.spacing.edgeEdge': '12',
  'elk.spacing.edgeLabel': '4',
  'elk.json.shapeCoords': 'ROOT',
  'elk.json.edgeCoords': 'ROOT',
};

/**
 * LAYOUT-302: the options of an open container: padding around its children below its header, and
 * a minimum size of `minWidth` by `header + 30`. With `INCLUDE_CHILDREN` and the `DOWN` direction,
 * ELK reads a nested container's minimum in its own rotated frame, width for height, so the adapter
 * writes the pair the other way round to get the size the spec asks for.
 */
export function containerOptions(minWidth: number, header: number): Record<string, string> {
  const pad = String(BOX.containerPad);
  return {
    'elk.padding': `[top=${String(header)},left=${pad},bottom=${pad},right=${pad}]`,
    'elk.nodeSize.constraints': 'MINIMUM_SIZE',
    'elk.nodeSize.minimum': `(${String(header + 30)}, ${String(minWidth)})`,
  };
}

/** LAYOUT-303: people and outside systems sit on the top rank of their container. */
export const RIM_OPTIONS: Readonly<Record<string, string>> = {
  'elk.layered.layering.layerConstraint': 'FIRST',
};

/**
 * LAYOUT-303: the rim nodes that go on the top rank. ELK cannot put both ends of an edge on the
 * first rank of one container (it fails, or places the edge's label away from it), so rim nodes are
 * constrained in model order, skipping any that an edge joins, directly or through what they hold,
 * to one already constrained in the same container. The skipped one ranks below it.
 */
export function topRank(graph: LayoutGraph): Set<string> {
  const parentOf = new Map(graph.nodes.map((node) => [node.id, node.parent]));
  const rim = new Set(graph.nodes.filter((node) => node.rim).map((node) => node.id));
  const path = (id: string): string[] => {
    const out = [id];
    for (let at = parentOf.get(id) ?? null; at !== null; at = parentOf.get(at) ?? null) {
      out.unshift(at);
    }
    return out;
  };
  // Each edge joins the two children of its ends' lowest common container that hold the ends.
  const joined = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    const from = path(edge.source);
    const to = path(edge.target);
    let at = 0;
    while (from[at] !== undefined && from[at] === to[at]) at += 1;
    const a = from[at];
    const b = to[at];
    if (a === undefined || b === undefined || !rim.has(a) || !rim.has(b)) continue;
    joined.set(a, (joined.get(a) ?? new Set()).add(b));
    joined.set(b, (joined.get(b) ?? new Set()).add(a));
  }
  const top = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.rim) continue;
    if ([...(joined.get(node.id) ?? [])].some((other) => top.has(other))) continue;
    top.add(node.id);
  }
  return top;
}

/** LAYOUT-304: options that place a label are set on the label itself, where ELK reads them. */
export const LABEL_OPTIONS: Readonly<Record<string, string>> = {
  'elk.edgeLabels.placement': 'CENTER',
};

/**
 * The ELK graph for a layout graph: nodes nested under their parents in model order, and each edge
 * in its lowest common container, in the order of the layout graph. Every label carries its reserved
 * size and a non-empty text, the edge id, which never depends on the audience (LAYOUT-304).
 */
export function elkGraph(graph: LayoutGraph): ElkNode {
  const root: ElkNode = {
    id: ROOT_ID,
    layoutOptions: { ...ROOT_OPTIONS },
    children: [],
    edges: [],
  };
  const byId = new Map<string, ElkNode>();
  const parentOf = new Map<string, string | null>();
  const top = topRank(graph);
  for (const node of graph.nodes) {
    const elk: ElkNode = { id: node.id };
    const options: Record<string, string> = {};
    if (node.open) {
      Object.assign(options, containerOptions(node.minWidth, node.header));
      elk.children = [];
      elk.edges = [];
    } else {
      elk.width = node.width;
      elk.height = node.height;
    }
    if (top.has(node.id)) Object.assign(options, RIM_OPTIONS);
    if (Object.keys(options).length > 0) elk.layoutOptions = options;
    const parent = node.parent === null ? root : byId.get(node.parent);
    if (parent === undefined) {
      throw new Error(`${node.id} is listed before its parent ${String(node.parent)}.`);
    }
    (parent.children ??= []).push(elk);
    byId.set(node.id, elk);
    parentOf.set(node.id, node.parent);
  }
  const ancestors = (id: string): string[] => {
    const out: string[] = [];
    for (let at = parentOf.get(id) ?? null; at !== null; at = parentOf.get(at) ?? null) {
      out.push(at);
    }
    return out;
  };
  for (const edge of graph.edges) {
    const above = new Set(ancestors(edge.target));
    const common = ancestors(edge.source).find((id) => above.has(id));
    const container = (common === undefined ? undefined : byId.get(common)) ?? root;
    (container.edges ??= []).push(elkEdge(edge));
  }
  return root;
}

function elkEdge(edge: LayoutEdge): ElkExtendedEdge {
  return {
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
    labels: [
      {
        text: edge.id,
        width: edge.label.width,
        height: edge.label.height,
        layoutOptions: { ...LABEL_OPTIONS },
      },
    ],
  };
}

const point = (at: ElkPoint): Point => ({ x: at.x, y: at.y });

/** The route of a laid-out edge: its sections joined, start to end, with repeated points dropped. */
function route(edge: ElkExtendedEdge): Point[] {
  const points: Point[] = [];
  for (const section of edge.sections ?? []) {
    for (const at of [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]) {
      const last = points.at(-1);
      if (last?.x !== at.x || last.y !== at.y) points.push(point(at));
    }
  }
  return points;
}

/** How close, at most, two points of a route may be before they count as one. */
const JOG = 0.5;

const near = (a: number, b: number): boolean => Math.abs(a - b) < JOG;

/**
 * ELK routes every edge as horizontal and vertical segments, but where a route crosses a container
 * border its points can disagree by a fraction of a pixel, which would draw as a slight slant. This
 * straightens such jogs: points that nearly coincide are merged, each segment is read as horizontal
 * or vertical by its longer side, segments on one straight run are merged, and every segment is
 * aligned to the point before it. The first and last points only slide along the outline they lie
 * on, so the route still starts on its source and ends on its target (LAYOUT-006).
 */
export function straighten(points: readonly Point[], source: Box, target: Box): Point[] {
  const out: Point[] = [];
  for (const at of points) {
    const last = out.at(-1);
    if (last !== undefined && near(last.x, at.x) && near(last.y, at.y)) {
      if (out.length > 1 && at === points.at(-1)) out[out.length - 1] = { ...at };
      continue;
    }
    out.push({ ...at });
  }
  const vertical = (a: Point, b: Point): boolean => Math.abs(b.x - a.x) <= Math.abs(b.y - a.y);
  for (let i = 1; i < out.length - 1;) {
    const a = out[i - 1];
    const b = out[i];
    const c = out[i + 1];
    if (a === undefined || b === undefined || c === undefined) break;
    if (vertical(a, b) === vertical(b, c)) out.splice(i, 1);
    else i += 1;
  }
  const last = out.length - 1;
  for (let i = 0; i < last; i++) {
    const a = out[i];
    const b = out[i + 1];
    if (a === undefined || b === undefined) continue;
    const axis = vertical(a, b) ? 'x' : 'y';
    if (a[axis] === b[axis]) continue;
    if (i + 1 < last) {
      b[axis] = a[axis];
    } else if (i > 0) {
      a[axis] = b[axis];
    } else {
      // One segment from outline to outline: keep whichever end the other box also spans.
      const span = (box: Box, at: number): boolean =>
        axis === 'x'
          ? at >= box.x && at <= box.x + box.width
          : at >= box.y && at <= box.y + box.height;
      if (span(target, a[axis])) b[axis] = a[axis];
      else if (span(source, b[axis])) a[axis] = b[axis];
    }
  }
  return out;
}

function roundBox(box: Box): Box {
  return { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) };
}

/**
 * Reads ELK's laid-out graph back as a layout result, every number rounded (LAYOUT-003). Shapes
 * and edges are in root coordinates (LAYOUT-301).
 */
export function layoutResult(graph: LayoutGraph, laidOut: ElkNode): LayoutResult {
  const boxes: Record<string, Box> = {};
  const edges: LayoutResult['edges'] = {};
  const elkEdges = new Map<string, ElkExtendedEdge>();
  const visit = (node: ElkNode): void => {
    for (const edge of node.edges ?? []) elkEdges.set(edge.id, edge);
    for (const child of node.children ?? []) {
      boxes[child.id] = roundBox({
        x: child.x ?? 0,
        y: child.y ?? 0,
        width: child.width ?? 0,
        height: child.height ?? 0,
      });
      visit(child);
    }
  };
  visit(laidOut);
  for (const edge of graph.edges) {
    const found = elkEdges.get(edge.id);
    const label = found?.labels?.[0];
    if (found === undefined || label === undefined) {
      throw new Error(`ELK returned no route for ${edge.id}.`);
    }
    const source = boxes[edge.source];
    const target = boxes[edge.target];
    const points =
      source === undefined || target === undefined
        ? route(found)
        : straighten(route(found), source, target);
    edges[edge.id] = {
      points: points.map((at) => ({ x: round(at.x), y: round(at.y) })),
      label: roundBox({
        x: label.x ?? 0,
        y: label.y ?? 0,
        width: label.width ?? 0,
        height: label.height ?? 0,
      }),
    };
  }
  return { width: round(laidOut.width ?? 0), height: round(laidOut.height ?? 0), boxes, edges };
}

/** A `LayoutEngine` that runs ELK, in process or in a Web Worker, behind Aerie's interface. */
export class ElkLayoutEngine implements LayoutEngine {
  private readonly elk: Pick<ELK, 'layout'>;

  constructor(elk: Pick<ELK, 'layout'>) {
    this.elk = elk;
  }

  async layout(graph: LayoutGraph): Promise<LayoutResult> {
    return layoutResult(graph, await this.elk.layout(elkGraph(graph)));
  }
}
