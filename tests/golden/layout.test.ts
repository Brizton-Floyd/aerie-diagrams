// Goldens of layout results (docs/spec/layout.md, LAYOUT-003): for every committed sample and every
// example file of the spec, each view at every tested zoom state (tests/rules/pictures.ts) with its
// layout graph (the reserved sizes), boxes, routes and label boxes; and every scenario's lanes on
// its stage view. A change to them is deliberate and reviewed (ACC-003): update with
// `npx vitest run --project golden -u`.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Box, LanesLayout, Point, StructureLayout } from '../../src/layout/index.ts';
import { SOURCES, pictures, scenarios, states } from '../rules/pictures.ts';

const box = (at: Box): string =>
  `${String(at.x)}, ${String(at.y)}, ${String(at.width)} x ${String(at.height)}`;
const point = (at: Point): string => `${String(at.x)},${String(at.y)}`;

function describeStructure(layout: StructureLayout): string[] {
  const out: string[] = [];
  const { graph, result } = layout;
  out.push(`  size ${String(result.width)} x ${String(result.height)}`);
  for (const node of graph.nodes) {
    const depth = '  '.repeat(layout.drawing.nodes.find((each) => each.id === node.id)?.depth ?? 0);
    const size = node.open
      ? `open, at least ${String(node.minWidth)} wide, header ${String(node.header)}`
      : `${String(node.width)} x ${String(node.height)}`;
    const at = result.boxes[node.id];
    out.push(
      `  ${depth}${node.id} (${size}${node.rim ? ', rim' : ''}): ${at === undefined ? 'no box' : box(at)}`,
    );
  }
  for (const edge of graph.edges) {
    const routed = result.edges[edge.id];
    if (routed === undefined) {
      out.push(`  ${edge.id}: no route`);
      continue;
    }
    out.push(`  ${edge.id}: ${routed.points.map(point).join(' ')}`);
    out.push(`    label ${box(routed.label)}`);
  }
  return out;
}

function describeLanes(lanes: LanesLayout): string[] {
  const out: string[] = [`  size ${String(lanes.width)} x ${String(lanes.height)}`];
  for (const band of lanes.bands)
    out.push(`  band ${band.id}, depth ${String(band.depth)}: ${box(band.box)}`);
  for (const lane of lanes.lanes) {
    out.push(
      `  lane ${lane.id} at ${String(lane.x)}: header ${box(lane.header)}, line ${String(lane.top)} to ${String(lane.bottom)}`,
    );
  }
  for (const row of lanes.rows) {
    out.push(
      `  step ${String(row.number)} ${row.role} ${row.kind} ${row.from}->${row.to}, row ${String(row.top)} + ${String(row.height)}: ${row.points.map(point).join(' ')}`,
    );
    out.push(`    label ${box(row.label)}, badge ${point(row.badge)}`);
  }
  return out;
}

describe('layout goldens', () => {
  it.each(SOURCES)('LAYOUT-003 the layouts of $path', async (source) => {
    const out: string[] = [];
    for (const { view, state } of pictures(source)) {
      const layout = await source.layouter.structure(view, state.zoom);
      const marks = [...layout.drawing.zoom].map(([id, mark]) => `${id} ${mark}`).join(', ');
      out.push(`view ${view}, ${state.name} (${marks === '' ? 'no changes' : marks})`);
      out.push(...describeStructure(layout), '');
    }
    for (const { scenario, view } of scenarios(source)) {
      for (const state of states(source.semantics, view)) {
        const lanes = await source.layouter.lanes(scenario, view, state.zoom);
        out.push(`scenario ${scenario} as lanes on ${view}, ${state.name}`);
        out.push(...describeLanes(lanes), '');
      }
    }
    const golden = join(
      import.meta.dirname,
      '__snapshots__/layout',
      `${source.path.replace(/\//g, '-')}.txt`,
    );
    await expect(out.join('\n')).toMatchFileSnapshot(golden);
  });
});
