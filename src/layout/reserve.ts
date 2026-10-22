// The audience space reserve (docs/spec/layout.md, LAYOUT-201 to LAYOUT-203): every audience's
// wording is measured in its own face, and every box and label is sized for the largest of them, so
// switching audience changes words only and moves nothing.
import type { Id } from '../lines/index.ts';
import type { Drawing, Scene } from '../model/index.ts';
import { BOX, TEXT_LEFT, control } from './anatomy.ts';
import { ROLES, measure, wrap, type TextLine, type TextRole } from './text/measure.ts';
import type { LayoutGraph, LayoutNode } from './types.ts';

/** LOOK-202: the chip of a closed container says how many children it holds. */
export function chipText(inside: number): string {
  return inside === 1 ? '1 part inside' : `${String(inside)} parts inside`;
}

/** LOOK-102: an audience with the `code` flag reads taglines in the monospace face. */
export function taglineRole(code: boolean): TextRole {
  return code ? ROLES.taglineCode : ROLES.tagline;
}

/** LOOK-102: an audience with the `code` flag reads edge labels in the monospace face. */
export function labelRole(code: boolean): TextRole {
  return code ? ROLES.labelCode : ROLES.label;
}

/** One audience's text in one box, measured and wrapped. */
export interface BoxText {
  name: TextLine;
  tagline: TextLine[];
  /** The chip of a closed container, else null. */
  chip: TextLine | null;
}

/** One audience's text for one drawing: every box and every edge label, measured and wrapped. */
export interface Wording {
  audience: Id;
  /** MODEL-105: taglines and labels in the monospace face. */
  code: boolean;
  boxes: Map<Id, BoxText>;
  labels: Map<string, TextLine[]>;
}

/** The text of one box for one audience: names never wrap, taglines wrap (LAYOUT-103). */
export function boxText(
  name: string,
  tagline: string | null,
  code: boolean,
  chip: string | null,
): BoxText {
  return {
    name: { text: name, width: measure(name, ROLES.name) },
    tagline: tagline === null ? [] : wrap(tagline, taglineRole(code)),
    chip: chip === null ? null : { text: chip, width: measure(chip, ROLES.chip) },
  };
}

/** Measures and wraps everything one audience reads in a drawing. */
export function wordScene(scene: Scene): Wording {
  const code = scene.audience.code;
  const boxes = new Map<Id, BoxText>();
  for (const node of scene.nodes) {
    const chip = node.state === 'closed' ? chipText(node.inside) : null;
    boxes.set(node.id, boxText(node.name, node.tagline, code, chip));
  }
  const labels = new Map<string, TextLine[]>();
  for (const edge of scene.edges) labels.set(edge.id, wrap(edge.label, labelRole(code)));
  return { audience: scene.audience.id, code, boxes, labels };
}

/**
 * LAYOUT-202: the widest text of a box over every audience (name, tagline lines and chip), and the
 * most tagline lines any audience needs.
 */
export function reservedText(texts: readonly BoxText[]): { textWidth: number; lines: number } {
  let textWidth = 0;
  let lines = 0;
  for (const text of texts) {
    const widths = [text.name, ...text.tagline, ...(text.chip === null ? [] : [text.chip])];
    for (const line of widths) textWidth = Math.max(textWidth, line.width);
    lines = Math.max(lines, text.tagline.length);
  }
  return { textWidth, lines };
}

/** LAYOUT-202: the content height, the name and tagline lines or the icon, whichever is taller. */
function content(lines: number): number {
  return Math.max(BOX.icon, BOX.nameLine + lines * BOX.textLine);
}

/** LAYOUT-202: the width a box needs for its text, its icon and its control. */
function needed(textWidth: number, container: boolean): number {
  return TEXT_LEFT + textWidth + control(container) + BOX.pad;
}

/** LAYOUT-202: the size of a leaf or closed box. */
export function closedSize(
  textWidth: number,
  lines: number,
  state: 'leaf' | 'closed',
): { width: number; height: number } {
  return {
    width: Math.max(BOX.minWidth, needed(textWidth, state === 'closed')),
    height: 2 * BOX.pad + content(lines) + (state === 'closed' ? BOX.chipLine : 0),
  };
}

/** LAYOUT-202: an open container's narrowest width and the height of its header. */
export function openSize(textWidth: number, lines: number): { minWidth: number; header: number } {
  return {
    minWidth: needed(textWidth, true),
    header: BOX.pad + content(lines) + BOX.headGap,
  };
}

/**
 * LAYOUT-203: an edge label's reserved box, `labelPadX` wider on each side than the widest line and
 * `labelPadY` taller on each side than its lines, the widest and tallest over every audience.
 */
export function labelSize(texts: readonly (readonly TextLine[])[]): {
  width: number;
  height: number;
} {
  let widest = 0;
  let lines = 0;
  for (const text of texts) {
    for (const line of text) widest = Math.max(widest, line.width);
    lines = Math.max(lines, text.length);
  }
  return {
    width: widest + 2 * BOX.labelPadX,
    height: lines * BOX.labelLine + 2 * BOX.labelPadY,
  };
}

/**
 * The layout graph of a drawing (LAYOUT-001), sized for the wording of every audience at once
 * (LAYOUT-201). It depends on the drawing and on all the wordings together, never on which audience
 * is reading (LAYOUT-004).
 */
export function layoutGraph(drawing: Drawing, wordings: readonly Wording[]): LayoutGraph {
  const nodes = drawing.nodes.map((node): LayoutNode => {
    const texts = wordings.flatMap((wording) => wording.boxes.get(node.id) ?? []);
    const { textWidth, lines } = reservedText(texts);
    const base = { id: node.id, parent: node.parent, rim: node.rim };
    if (node.state === 'open') return { ...base, open: true, ...openSize(textWidth, lines) };
    return { ...base, open: false, ...closedSize(textWidth, lines, node.state) };
  });
  const edges = drawing.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: labelSize(wordings.flatMap((wording) => [wording.labels.get(edge.id) ?? []])),
  }));
  return { nodes, edges };
}
