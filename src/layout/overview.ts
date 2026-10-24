// Authored stages use the existing routed connections, with room for their numbered badges.
import type { Trail } from '../model/index.ts';
import type { PictureLayout } from './structure.ts';
import { trailShapes, type TrailShape } from './trail.ts';
import type { Box, Point } from './types.ts';

const RADIUS = 16;

export function overviewShapes(picture: PictureLayout, trail: Trail): TrailShape[] {
  const { result, graph, drawing } = picture;
  const obstacles: Box[] = Object.values(result.edges).map((edge) => edge.label);
  for (const node of drawing.nodes) {
    const box = result.boxes[node.id];
    if (box === undefined) continue;
    const graphNode = graph.nodes.find((each) => each.id === node.id);
    obstacles.push(
      node.state === 'open' && graphNode?.open === true
        ? { ...box, height: graphNode.header }
        : box,
    );
  }
  const shapes = trailShapes(result, trail);
  const occupied: Point[] = shapes.flatMap((shape) =>
    shape.kind === 'loop' ||
    (result.edges[`${shape.from}->${shape.to}`] === undefined &&
      result.edges[`${shape.to}->${shape.from}`] === undefined)
      ? [shape.badge]
      : [],
  );
  return shapes.map((shape, index) => {
    if (shape.kind === 'loop') {
      return shape;
    }
    const forward = result.edges[`${shape.from}->${shape.to}`];
    const reverse = result.edges[`${shape.to}->${shape.from}`];
    const edge = forward ?? reverse;
    if (edge === undefined) {
      return shape;
    }
    const route = forward === undefined ? [...edge.points].reverse() : edge.points;
    const segments = route
      .slice(1)
      .flatMap((end, i) => {
        const start = route[i];
        return start === undefined
          ? []
          : [{ start, end, length: Math.hypot(end.x - start.x, end.y - start.y) }];
      })
      .sort((a, b) => b.length - a.length);
    const candidates = segments.flatMap(({ start, end }) =>
      [0.5, 0.25, 0.75, 0.125, 0.875].map((t) => ({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      })),
    );
    for (let i = 0; i < 12; i++) {
      candidates.push({
        x: edge.label.x + edge.label.width + RADIUS + 4,
        y:
          edge.label.y +
          edge.label.height / 2 +
          (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * RADIUS * 2,
      });
    }
    const fallback = { x: result.width + RADIUS * 2, y: RADIUS + index * RADIUS * 2 };
    while (
      occupied.some((other) => Math.hypot(fallback.x - other.x, fallback.y - other.y) < RADIUS * 2)
    )
      fallback.y += RADIUS * 2;
    const badge =
      candidates.find(
        (point) =>
          point.x >= RADIUS &&
          point.y >= RADIUS &&
          !obstacles.some(
            (box) =>
              point.x + RADIUS > box.x &&
              point.x - RADIUS < box.x + box.width &&
              point.y + RADIUS > box.y &&
              point.y - RADIUS < box.y + box.height,
          ) &&
          !occupied.some((other) => Math.hypot(point.x - other.x, point.y - other.y) < RADIUS * 2),
      ) ?? fallback;
    occupied.push(badge);
    return {
      ...shape,
      route,
      start: route[0] ?? shape.start,
      end: route.at(-1) ?? shape.end,
      badge,
    };
  });
}
