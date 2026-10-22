// The narrow layout interface (docs/spec/layout.md, LAYOUT-001): the product lays out structure
// views only through `LayoutEngine`. Nothing outside the ELK adapter (src/layout/elk/) knows which
// engine runs behind it, so another engine is one more implementation of this interface.

export interface LayoutEngine {
  layout(graph: LayoutGraph): Promise<LayoutResult>;
}

/** What one picture asks the engine to place. It never depends on the audience (LAYOUT-004). */
export interface LayoutGraph {
  /** Drawn elements in model order, parents before children. */
  nodes: LayoutNode[];
  /** Drawn edges in the order of MODEL-303. */
  edges: LayoutEdge[];
}

/**
 * A leaf or closed box has a fixed size. An open container is sized by the engine around its
 * children, at least `minWidth` wide, with its children below a `header` of that height.
 */
export type LayoutNode =
  | { id: string; parent: string | null; rim: boolean; open: false; width: number; height: number }
  | {
      id: string;
      parent: string | null;
      rim: boolean;
      open: true;
      minWidth: number;
      header: number;
    };

export interface LayoutEdge {
  /** "a->b" (MODEL-303). */
  id: string;
  source: string;
  target: string;
  /** The label's reserved size (LAYOUT-203). */
  label: { width: number; height: number };
}

export interface LayoutResult {
  width: number;
  height: number;
  /** Every node, in picture coordinates, origin at the top left. */
  boxes: Record<string, Box>;
  edges: Record<string, { points: Point[]; label: Box }>;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** LAYOUT-003: every number in a result is rounded to two decimal places. Never returns -0. */
export function round(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}
