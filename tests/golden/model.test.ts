// Goldens of what every view draws (MODEL-302 to MODEL-304): for every committed sample and every
// example file of the spec, each view at the zoom states default, everything open and all closed
// (MODEL-211), with its drawn elements, its edges and their labels for every audience. A change to
// them is deliberate and reviewed (ACC-003): update with `npx vitest run --project golden -u`.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/lines/index.ts';
import { DEFAULT_ZOOM, Semantics, type Zoom } from '../../src/model/index.ts';

const ROOT = join(import.meta.dirname, '../..');
const SOURCES = ['samples', 'docs/spec/examples'].flatMap((dir) =>
  readdirSync(join(ROOT, dir))
    .filter((file) => file.endsWith('.aerie'))
    .map((file) => ({ dir, file })),
);

/** Every view of a model at the three named zoom states, as readable text. */
function describeViews(semantics: Semantics): string {
  const out: string[] = [];
  const audiences = semantics.model.audiences.map((audience) => audience.id);
  for (const view of semantics.views) {
    const scope = semantics.scope(view.id);
    const states: [string, Zoom][] = [
      ['default', DEFAULT_ZOOM],
      ['everything open', scope.everythingOpen()],
      ['all closed', scope.allClosed()],
    ];
    for (const [name, zoom] of states) {
      const drawing = semantics.drawing(view.id, zoom);
      const marks = [...drawing.zoom].map(([id, mark]) => `${id} ${mark}`).join(', ');
      out.push(`view ${view.id}, ${name} (${marks === '' ? 'no changes' : marks})`);
      for (const node of drawing.nodes) {
        const state =
          node.state === 'closed'
            ? ` (closed, ${String(node.inside)} inside)`
            : node.state === 'open'
              ? ` (open${node.partly ? ', partly' : ''})`
              : '';
        out.push(`  ${'  '.repeat(node.depth)}${node.id}${state}`);
      }
      for (const edge of drawing.edges) {
        out.push(`  ${edge.id} carries ${edge.carries.join(', ')}`);
        for (const audience of audiences) {
          out.push(`    ${audience}: ${semantics.label(edge, audience)}`);
        }
      }
      out.push('');
    }
  }
  return out.join('\n');
}

describe('what every view draws', () => {
  it.each(SOURCES)('MODEL-303 the drawn sets and edges of $dir/$file', async ({ dir, file }) => {
    const result = parse(readFileSync(join(ROOT, dir, file), 'utf8'));
    if (result.model === null) {
      throw new Error(`${dir}/${file} has no model`);
    }
    const golden = join(
      import.meta.dirname,
      '__snapshots__/model',
      dir.replace(/\//g, '-'),
      `${file}.txt`,
    );
    await expect(describeViews(new Semantics(result.model))).toMatchFileSnapshot(golden);
  });
});
