// Goldens of the drawn SVG (docs/spec/look.md; ACC-005): for every committed sample and every
// example file of the spec, each view in each audience at its default zoom state, and each
// scenario at its last step on its stage view, as a trail and as lanes. Numbers are rounded to two
// decimal places and ids are the model's, so a golden changes only when the drawing does. A change
// is deliberate and reviewed (ACC-003): update with `npx vitest run --project golden -u`.
//
// Drawings carry classes and geometry only; colours, strokes and faces live in the stylesheet, so
// both themes share one drawing and the themes are covered by the stylesheet's own golden
// (`signal.css`, which holds both token sets). Each golden is a standalone SVG file that names
// that stylesheet, so it can be opened in a browser to look at.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ZOOM } from '../../src/model/index.ts';
import { trailShapes } from '../../src/layout/index.ts';
import {
  signalStyle,
  renderLanes,
  renderPicture,
  toMarkup,
  type SvgNode,
} from '../../src/render/index.ts';
import { SOURCES, scenarios } from '../rules/pictures.ts';

const DIR = join(import.meta.dirname, '__snapshots__/render');

/** A drawing as a standalone, indented SVG file that names the Signal stylesheet golden. */
function file(root: SvgNode, depth: number): string {
  const sheet = `${'../'.repeat(depth)}signal.css`;
  return `<?xml-stylesheet href="${sheet}" type="text/css"?>\n${toMarkup(root, '  ')}\n`;
}

describe('render goldens', () => {
  it('LOOK-001 the Signal stylesheet, with the tokens of both themes', async () => {
    await expect(signalStyle()).toMatchFileSnapshot(join(DIR, 'signal.css'));
  });

  it.each(SOURCES)('LOOK-201 to LOOK-503 every view of $path in every audience', async (source) => {
    const { semantics, layouter } = source;
    const folder = source.path.replace(/\//g, '-');
    for (const view of semantics.views) {
      for (const audience of semantics.model.audiences) {
        const picture = await layouter.picture(view.id, DEFAULT_ZOOM, audience.id);
        await expect(file(renderPicture(semantics, picture), 1)).toMatchFileSnapshot(
          join(DIR, folder, `${view.id}.${audience.id}.svg`),
        );
      }
    }
  });

  it.each(SOURCES)(
    'LOOK-701 to LOOK-706 every scenario of $path at its last step, as a trail and as lanes',
    async (source) => {
      const { semantics, layouter } = source;
      const folder = source.path.replace(/\//g, '-');
      const audience = semantics.model.defaultAudience;
      for (const { scenario, view } of scenarios(source)) {
        const last = semantics.scenario(scenario).steps.length;
        const picture = await layouter.picture(view, DEFAULT_ZOOM, audience);
        const trail = semantics.trail(scenario, view, DEFAULT_ZOOM, last);
        const drawn = renderPicture(semantics, picture, {
          trail: trailShapes(picture.result, trail),
          focus: { kind: 'trail', visited: trail.visited, current: trail.current },
        });
        await expect(file(drawn, 1)).toMatchFileSnapshot(
          join(DIR, folder, `${scenario}.trail.svg`),
        );
        const lanes = await layouter.lanes(scenario, view, DEFAULT_ZOOM);
        await expect(file(renderLanes(semantics, lanes, audience, last), 1)).toMatchFileSnapshot(
          join(DIR, folder, `${scenario}.lanes.svg`),
        );
      }
    },
  );
});
