// The lines for checking against the code change no drawing (docs/spec/model.md, MODEL-006; and
// LANG-751): every sample and spec example, with a system root, a code line under every element and
// an ignore line for every pair of related elements added, draws exactly as it does without them, for every
// view, tested zoom state, audience, scenario and walkthrough step.
import { describe, expect, it } from 'vitest';
import { parse, type Model } from '../../src/lines/index.ts';
import { DEFAULT_ZOOM, Semantics } from '../../src/model/index.ts';
import { Layouter } from '../../src/layout/index.ts';
import { renderPicture, toMarkup } from '../../src/render/index.ts';
import { SOURCES, pictures, scenarios, type Source } from './pictures.ts';

/** The source's model written again with every kind of line drift reads. */
function withDriftLines(source: Source): Model {
  const model = source.semantics.model;
  const parsed = parse(source.text);
  const lines = source.text.split('\n');
  // From the last element up, so earlier line numbers stay put.
  const elementLines = model.elements
    .map((element, index) => ({ element, line: parsed.sourceMap[`/elements/${String(index)}`] }))
    .sort((a, b) => (b.line?.line ?? 0) - (a.line?.line ?? 0));
  for (const { element, line } of elementLines) {
    if (line === undefined) throw new Error(`${element.id} has no line`);
    const indent = ' '.repeat(line.column - 1 + 2);
    lines.splice(line.line, 0, `${indent}code npm:drift-${element.id} compose:${element.id}`);
  }
  lines.push('system', '  repo .', '  repo ../neighbour', '  compose ../neighbour/compose.yaml');
  const pairs = new Set(
    model.relationships.map(({ subject, object }) => `${subject} to ${object}`),
  );
  for (const pair of pairs) lines.push(`ignore drift ${pair} - meant`);
  const result = parse(lines.join('\n'));
  expect(result.diagnostics.filter((found) => found.severity === 'error')).toEqual([]);
  if (result.model === null) throw new Error(`${source.path} with drift lines has no model`);
  return result.model;
}

describe.each(SOURCES)('$path', (source) => {
  const plain = source.semantics;
  const model = withDriftLines(source);
  const drifted = new Semantics(model);
  const layouter = new Layouter(drifted, source.layouter.engine);
  const audiences = plain.model.audiences.map((audience) => audience.id);

  it('MODEL-006 the model differs only in its system, code and ignores', () => {
    expect(model.system).not.toBeNull();
    const pairs = new Set(
      plain.model.relationships.map((each) => `${each.subject} ${each.object}`),
    );
    expect(model.ignores.length).toBe(pairs.size);
    expect(model.elements.every((element) => element.code.length === 2)).toBe(true);
    const stripped: Model = {
      ...model,
      system: null,
      elements: model.elements.map((element) => ({ ...element, code: [] })),
      ignores: [],
    };
    expect(stripped).toEqual(plain.model);
  });

  it.each(pictures(source))(
    'MODEL-006 LANG-751 $view, $state.name draws the same for every audience',
    async ({ view, state }) => {
      expect(drifted.drawing(view, state.zoom)).toEqual(plain.drawing(view, state.zoom));
      for (const audience of audiences) {
        const before = await source.layouter.picture(view, state.zoom, audience);
        const after = await layouter.picture(view, state.zoom, audience);
        expect(after).toEqual(before);
        expect(toMarkup(renderPicture(drifted, after), '')).toBe(
          toMarkup(renderPicture(plain, before), ''),
        );
      }
    },
  );

  it('MODEL-006 scenarios and walkthroughs play the same', () => {
    for (const { scenario, view } of scenarios(source)) {
      for (const audience of audiences) {
        expect(drifted.steps(scenario, audience)).toEqual(plain.steps(scenario, audience));
      }
      const last = plain.scenario(scenario).steps.length;
      expect(drifted.trail(scenario, view, DEFAULT_ZOOM, last)).toEqual(
        plain.trail(scenario, view, DEFAULT_ZOOM, last),
      );
    }
    for (const walkthrough of plain.model.walkthroughs) {
      expect(drifted.walkPictures(walkthrough.id)).toEqual(plain.walkPictures(walkthrough.id));
    }
  });
});
