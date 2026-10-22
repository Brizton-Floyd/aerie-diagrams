// Rule checks on generated models (generated.ts): every rule the samples are held to, on models made
// from a fixed seed to reach the corners hand-written samples miss. A failure names its seed;
// `generate(seed)` gives the model's Lines source to reproduce it.
import { describe, expect, it } from 'vitest';
import { inProcessEngine } from '../../src/layout/elk/in-process.ts';
import {
  Layouter,
  checkLanes,
  checkStructure,
  placeLanesText,
  placeText,
} from '../../src/layout/index.ts';
import { generatedModels } from './generated.ts';
import { states } from './pictures.ts';

const ENGINE = inProcessEngine();

describe.each(generatedModels(1, 40))('generated model $seed', ({ semantics }) => {
  const layouter = new Layouter(semantics, ENGINE);

  it('RULE-001 to RULE-007 and RULE-009 hold on every view and zoom state', async () => {
    for (const view of semantics.views) {
      for (const state of states(semantics, view.id)) {
        const layout = await layouter.structure(view.id, state.zoom);
        const texts = layout.wordings.map((wording) => placeText(layout.result, wording));
        const where = `${view.id}, ${state.name}`;
        expect(checkStructure(semantics, layout, texts), where).toEqual([]);
        expect(await ENGINE.layout(layout.graph), where).toEqual(layout.result);
      }
    }
  });

  it('RULE-010 and RULE-011 hold on every scenario as lanes', async () => {
    for (const scenario of semantics.model.scenarios) {
      const view = semantics.stage(scenario.id, semantics.firstView);
      if (view === null) continue;
      for (const state of states(semantics, view)) {
        const lanes = await layouter.lanes(scenario.id, view, state.zoom);
        const texts = semantics.model.audiences.map((audience) =>
          placeLanesText(lanes, audience.id),
        );
        expect(
          checkLanes(lanes, texts, scenario.steps.length),
          `${scenario.id}, ${state.name}`,
        ).toEqual([]);
      }
    }
  });
});
