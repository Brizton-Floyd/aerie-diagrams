// Rule checks on every structure layout (docs/spec/layout.md, RULE-001 to RULE-009): every sample,
// every view, every tested zoom state (pictures.ts) and every audience.
import { describe, expect, it } from 'vitest';
import { inProcessEngine } from '../../src/layout/elk/in-process.ts';
import { Layouter, checkStructure, textLargeEnough } from '../../src/layout/index.ts';
import { SOURCES, pictures } from './pictures.ts';

describe.each(SOURCES)('$path', (source) => {
  const { semantics, layouter } = source;
  const audiences = semantics.model.audiences.map((audience) => audience.id);

  describe.each(pictures(source))('$view, $state.name', ({ view, state }) => {
    it('RULE-001 to RULE-004, RULE-006 and RULE-007 hold for every audience', async () => {
      const layout = await layouter.structure(view, state.zoom);
      const texts = await Promise.all(
        audiences.map(
          async (audience) => (await layouter.picture(view, state.zoom, audience)).text,
        ),
      );
      expect(checkStructure(semantics, layout, texts)).toEqual([]);
    });

    it('RULE-005 and SCOPE-003 switching audience moves nothing', async () => {
      const [first, ...others] = await Promise.all(
        audiences.map((audience) =>
          new Layouter(semantics, layouter.engine).picture(view, state.zoom, audience),
        ),
      );
      for (const other of others) {
        expect(other.graph).toEqual(first?.graph);
        expect(other.result).toEqual(first?.result);
      }
    });

    it('RULE-009 laying out the same graph twice, on a fresh engine too, gives equal results', async () => {
      const { graph, result } = await layouter.structure(view, state.zoom);
      expect(await layouter.engine.layout(graph)).toEqual(result);
      expect(await inProcessEngine().layout(structuredClone(graph))).toEqual(result);
    });
  });
});

it('RULE-008 every text role on the diagram is at least 13.5 px', () => {
  expect(textLargeEnough()).toEqual([]);
});
