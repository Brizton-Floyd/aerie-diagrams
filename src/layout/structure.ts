// Structure views: from a view and a zoom state to boxes, routes and placed text (docs/spec/layout.md).
// The model decides what is drawn (views, zoom, lifting and merging); this module measures every
// audience's wording, reserves space for the largest, asks the layout engine to place the result,
// and puts each audience's text at its fixed place in the reserved space.
import type { Id } from '../lines/index.ts';
import type { Drawing, Semantics, Zoom } from '../model/index.ts';
import { BOX, TEXT_LEFT } from './anatomy.ts';
import { layoutLanes, type LanesLayout } from './lanes.ts';
import { layoutGraph, wordScene, type Wording } from './reserve.ts';
import { ROLES, type RoleName, type TextLine } from './text/measure.ts';
import {
  round,
  type Box,
  type LayoutEngine,
  type LayoutGraph,
  type LayoutResult,
} from './types.ts';

/** What a view draws at a zoom state, laid out once for every audience (LAYOUT-004). */
export interface StructureLayout {
  drawing: Drawing;
  graph: LayoutGraph;
  result: LayoutResult;
  /** Every audience's measured wording, in the model's audience order. */
  wordings: Wording[];
}

/** One line of text at its place in the picture: `x` is its left and `y` the top of its line. */
export interface PlacedLine {
  text: string;
  role: RoleName;
  x: number;
  y: number;
  width: number;
  /** The height of the role's line. */
  height: number;
}

/** A box's text for one audience: the name, the tagline lines and a closed container's chip. */
export interface PlacedBoxText {
  name: PlacedLine;
  tagline: PlacedLine[];
  chip: PlacedLine | null;
}

/** One audience's text, placed in the reserved space (LAYOUT-204). */
export interface PlacedText {
  audience: Id;
  boxes: Record<Id, PlacedBoxText>;
  labels: Record<string, PlacedLine[]>;
}

/** A picture laid out for its audience: the shared structure layout and the audience's text. */
export interface PictureLayout extends StructureLayout {
  audience: Id;
  text: PlacedText;
}

function line(text: TextLine, role: RoleName, x: number, y: number): PlacedLine {
  return {
    text: text.text,
    role,
    x: round(x),
    y: round(y),
    width: text.width,
    height: ROLES[role].line,
  };
}

/**
 * LAYOUT-204: box text from the left at `pad + icon + iconGap`, the name on the first line, the
 * tagline below it and a closed container's chip on the last line; label text centred in its label
 * box. Text sits at the same place for every audience, inside the space reserved for all of them.
 */
export function placeText(result: LayoutResult, wording: Wording): PlacedText {
  const tagline: RoleName = wording.code ? 'taglineCode' : 'tagline';
  const label: RoleName = wording.code ? 'labelCode' : 'label';
  const boxes: Record<Id, PlacedBoxText> = {};
  for (const [id, text] of wording.boxes) {
    const box = result.boxes[id];
    if (box === undefined) continue;
    const left = box.x + TEXT_LEFT;
    const top = box.y + BOX.pad;
    boxes[id] = {
      name: line(text.name, 'name', left, top),
      tagline: text.tagline.map((each, index) =>
        line(each, tagline, left, top + BOX.nameLine + index * BOX.textLine),
      ),
      chip:
        text.chip === null
          ? null
          : line(text.chip, 'chip', left, box.y + box.height - BOX.pad - BOX.chipLine),
    };
  }
  const labels: Record<string, PlacedLine[]> = {};
  for (const [id, lines] of wording.labels) {
    const box: Box | undefined = result.edges[id]?.label;
    if (box === undefined) continue;
    const top = box.y + (box.height - lines.length * BOX.labelLine) / 2;
    labels[id] = lines.map((each, index) =>
      line(each, label, box.x + (box.width - each.width) / 2, top + index * BOX.labelLine),
    );
  }
  return { audience: wording.audience, boxes, labels };
}

/** How many structure layouts a layouter keeps, so switching audience or going back is instant. */
const KEEP = 16;

/**
 * Lays out the pictures of one model. Opening or closing in place, switching view or a new model
 * computes the drawn set, edges and layout from scratch (LAYOUT-401); the engine is deterministic
 * (LAYOUT-003), so recent layouts are kept and reused for the same view and zoom state. Layouts are
 * shared between callers: treat them as read-only.
 */
export class Layouter {
  readonly semantics: Semantics;
  readonly engine: LayoutEngine;
  private readonly kept = new Map<string, Promise<StructureLayout>>();
  /** Each kept structure layout's scenario lanes, so stepping or rewording reuses them. */
  private readonly keptLanes = new WeakMap<StructureLayout, Map<Id, LanesLayout>>();

  constructor(semantics: Semantics, engine: LayoutEngine) {
    this.semantics = semantics;
    this.engine = engine;
  }

  /** Every audience's wording of a drawing, in the model's audience order. */
  wordings(drawing: Drawing): Wording[] {
    return this.semantics.model.audiences.map((audience) =>
      wordScene(this.semantics.scene(drawing, audience.id)),
    );
  }

  /** The layout graph of a drawing, sized for every audience (LAYOUT-201). */
  graph(drawing: Drawing): LayoutGraph {
    return layoutGraph(drawing, this.wordings(drawing));
  }

  /** A view at a zoom state, laid out for every audience at once. */
  structure(view: Id, zoom: Zoom): Promise<StructureLayout> {
    const drawing = this.semantics.drawing(view, zoom);
    const key = [view, ...[...drawing.zoom].map(([id, mark]) => `${id}=${mark}`)].join('\n');
    let found = this.kept.get(key);
    if (found === undefined) {
      found = this.compute(drawing);
      // A failed layout is not kept, so the next request tries again.
      found.catch(() => this.kept.delete(key));
      if (this.kept.size >= KEEP) {
        const oldest = this.kept.keys().next().value;
        if (oldest !== undefined) this.kept.delete(oldest);
      }
    } else {
      this.kept.delete(key);
    }
    this.kept.set(key, found);
    return found;
  }

  /**
   * A scenario as lanes on a view at a zoom state (LAYOUT-601), which must be the scenario's stage
   * view (MODEL-404). The lanes keep the arrangement of that view's structure layout, and are kept
   * with it: the same scenario on the same structure layout is the same lanes layout.
   */
  async lanes(scenario: Id, view: Id, zoom: Zoom): Promise<LanesLayout> {
    const structure = await this.structure(view, zoom);
    let kept = this.keptLanes.get(structure);
    if (kept === undefined) {
      kept = new Map();
      this.keptLanes.set(structure, kept);
    }
    let found = kept.get(scenario);
    if (found === undefined) {
      found = layoutLanes(this.semantics, scenario, structure);
      kept.set(scenario, found);
    }
    return found;
  }

  /** A picture's view, zoom state and audience, laid out with the audience's text in place. */
  async picture(view: Id, zoom: Zoom, audience: Id): Promise<PictureLayout> {
    const structure = await this.structure(view, zoom);
    const wording = structure.wordings.find((each) => each.audience === audience);
    if (wording === undefined) throw new Error(`There is no audience ${audience}.`);
    return { ...structure, audience, text: placeText(structure.result, wording) };
  }

  private async compute(drawing: Drawing): Promise<StructureLayout> {
    const wordings = this.wordings(drawing);
    const graph = layoutGraph(drawing, wordings);
    const result = await this.engine.layout(graph);
    return { drawing, graph, result, wordings };
  }
}
