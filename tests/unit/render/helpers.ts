// Shared helpers for the renderer tests (docs/spec/look.md).
import type { Id } from '../../../src/lines/index.ts';
import { DEFAULT_ZOOM, type Semantics, type Zoom } from '../../../src/model/index.ts';
import {
  classes,
  renderPicture,
  walk,
  type RenderOptions,
  type SvgNode,
} from '../../../src/render/index.ts';
import { LOTTO, layouter, read, semanticsOf } from '../layout/helpers.ts';

export { LOTTO, layouter, read, semanticsOf };

/** The committed sample of every shape and icon. */
export const SHAPES = semanticsOf(read('samples/shapes.aerie'));

/** A view drawn for an audience at a zoom state. */
export async function draw(
  semantics: Semantics,
  view: Id,
  audience: Id,
  zoom: Zoom = DEFAULT_ZOOM,
  options: RenderOptions = {},
): Promise<SvgNode> {
  const picture = await layouter(semantics).picture(view, zoom, audience);
  return renderPicture(semantics, picture, options);
}

/** Every element of a drawing with a class, in drawing order. */
export function withClass(root: SvgNode, name: string): SvgNode[] {
  return [...walk(root)].filter((node) => classes(node).includes(name));
}

/** The group drawn for an element or edge id, of a kind (`node`, `head`, `edge`, `label`). */
export function group(root: SvgNode, kind: string, id: string): SvgNode {
  const found = withClass(root, kind).find((node) => node.attrs['data-id'] === id);
  if (found === undefined) throw new Error(`No ${kind} ${id} is drawn.`);
  return found;
}

/** The first child element of a tag, or with a class. */
export function child(node: SvgNode, match: string): SvgNode {
  const found = node.children.find(
    (each): each is SvgNode =>
      typeof each !== 'string' && (each.tag === match || classes(each).includes(match)),
  );
  if (found === undefined) throw new Error(`No ${match} in ${node.tag}.`);
  return found;
}

/** A translation's numbers. */
export function translation(node: SvgNode): { x: number; y: number } {
  const match = /^translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(String(node.attrs['transform']));
  if (match === null) throw new Error('Not translated.');
  return { x: Number(match[1]), y: Number(match[2]) };
}
