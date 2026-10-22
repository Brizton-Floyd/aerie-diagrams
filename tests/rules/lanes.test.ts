// Rule checks on every lanes layout (docs/spec/layout.md, RULE-010 and the lanes half of RULE-011):
// every scenario of every sample on its stage view, at that view's tested zoom states.
import { describe, expect, it } from 'vitest';
import { checkLanes, placeLanesText } from '../../src/layout/index.ts';
import { SOURCES, scenarios, states } from './pictures.ts';

describe.each(SOURCES)('$path', (source) => {
  const { semantics, layouter } = source;

  describe.each(scenarios(source))('$scenario on $view', ({ scenario, view }) => {
    const steps = semantics.scenario(scenario).steps.length;

    it.each(states(semantics, view))(
      'RULE-010 and RULE-011 the lanes are tidy and draw every step, $name',
      async ({ zoom }) => {
        const lanes = await layouter.lanes(scenario, view, zoom);
        const texts = semantics.model.audiences.map((audience) =>
          placeLanesText(lanes, audience.id),
        );
        expect(checkLanes(lanes, texts, steps)).toEqual([]);
        expect(await layouter.lanes(scenario, view, zoom)).toEqual(lanes);
      },
    );
  });
});
