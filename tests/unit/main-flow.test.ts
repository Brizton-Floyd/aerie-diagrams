import { describe, expect, it } from 'vitest';
import {
  check,
  defaultPicture,
  normalisePicture,
  openContainer,
  stop,
  switchAudience,
  switchView,
  Semantics,
} from '../../src/model/index.ts';
import { completionsAt, format, parse, print } from '../../src/lines/index.ts';
import { readFragment, writeFragment } from '../../src/app/link.ts';
import { Layouter, overviewShapes } from '../../src/layout/index.ts';
import { inProcessEngine } from '../../src/layout/elk/in-process.ts';
import { renderPicture, toMarkup, walk } from '../../src/render/index.ts';
import { read } from './model/helpers.ts';

const source = read('samples/aerie.aerie');
const model = check(source).model;
if (model === null) throw new Error('Aerie sample must check cleanly.');
const semantics = new Semantics(model);

describe('authored main flows', () => {
  it('LANG-509 LANG-608 LANG-609 LANG-610 preserves main-flow bindings, ranges, wording and punctuation through formatting and printing', () => {
    expect(check(source).diagnostics).toEqual([]);
    expect(model.views[0]?.mainScenario).toBe('full-flow');
    expect(model.scenarios[0]?.stages?.map((stage) => [stage.from, stage.to])).toEqual([
      [1, 1],
      [2, 4],
      [5, 7],
      [8, 8],
    ]);
    expect(parse(print(model)).model).toEqual(model);
    const fixture = read('tests/unit/lines/examples/LANG-509-main-flow.aerie');
    const checked = parse(fixture);
    expect(checked.diagnostics).toEqual([]);
    expect(format(fixture).text).toBe(fixture);
    expect(parse(format(fixture).text).model).toEqual(checked.model);
    expect(parse(print(checked.model ?? model)).model).toEqual(checked.model);
    expect(checked.model?.scenarios[0]?.stages?.[0]?.title.base).toBe('Ask,then wait');
    expect(checked.sourceMap['/views/0/mainScenario']).toMatchObject({ line: 6, column: 12 });
    expect(checked.sourceMap['/scenarios/0/stages/0/title']).toMatchObject({
      line: 10,
      column: 11,
    });
    const plain = parse('flow: Flow\nstage: Stage\nflow calls stage\n').model;
    expect(plain?.elements.map((element) => element.id)).toEqual(['flow', 'stage']);
    expect(Object.keys(plain?.views[0] ?? {})).not.toContain('mainScenario');
    expect(JSON.stringify(plain)).not.toContain('stages');
  });

  it('E504 E505 E605 E606 diagnoses unknown bindings, incompatible views and invalid stage ranges with source locations', () => {
    for (const [file, id, line, column] of [
      ['E504-main-scenario', 'E504', 6, 12],
      ['E505-main-scenario-view', 'E505', 6, 12],
      ['E605-stage-range', 'E605', 6, 8],
      ['E606-stage-coverage', 'E606', 7, 8],
    ] as const) {
      const checked = check(read(`tests/unit/lines/examples/${file}.aerie`));
      expect(checked.model).toBeNull();
      expect(checked.diagnostics).toHaveLength(1);
      expect(checked.diagnostics[0]).toMatchObject({ id, line, column });
    }
    const fixture = read('tests/unit/lines/examples/LANG-509-main-flow.aerie');
    for (const range of ['0', '2-1', '1.5', '1-999', '999999999999999999999']) {
      expect(
        check(fixture.replace('step 1:', `step ${range}:`)).diagnostics.map((each) => each.id),
      ).toContain('E605');
    }
    expect(
      check(fixture.replace('step 2:', 'step 1:')).diagnostics.map((each) => each.id),
    ).toContain('E606');
    expect(
      check(
        fixture.replace('  scenario request', '  scenario request\n  scenario request'),
      ).diagnostics.map((each) => each.id),
    ).toContain('E504');
    expect(
      check(
        fixture.replace('  scenario request', '  scenario request: Extra title'),
      ).diagnostics.map((each) => each.id),
    ).toContain('E504');
  });

  it('MODEL-606 MODEL-607 INT-624 numbers authored stages, retains their detailed ranges and restores configured view defaults', () => {
    const picture = defaultPicture(semantics);
    expect(picture.activity).toEqual({ kind: 'overview', scenario: 'full-flow', step: 1 });
    const steps = semantics.overviewSteps('full-flow', 'exec');
    expect(steps.map((step) => [step.number, step.from, step.to, step.sentence])).toEqual([
      [1, 1, 1, 'Write the model'],
      [2, 2, 4, 'Check its meaning'],
      [3, 5, 7, 'Build the picture'],
      [4, 8, 8, 'Explore the diagram'],
    ]);
    expect(semantics.overviewSteps('full-flow', 'engineer')[1]?.sentence).toBe(
      'Parse and resolve the model',
    );
    const selected = {
      ...picture,
      activity: { kind: 'overview' as const, scenario: 'full-flow', step: 3 },
    };
    const opened = openContainer(semantics, selected, 'picture');
    expect(opened.activity).toEqual(selected.activity);
    expect(switchAudience(semantics, opened, 'engineer').activity).toEqual(selected.activity);
    expect(
      normalisePicture(semantics, { ...selected, activity: { ...selected.activity, step: 8 } })
        .picture.activity,
    ).toMatchObject({ step: 4 });
    const inside = switchView(semantics, selected, 'inside');
    expect(inside.activity).toEqual({ kind: 'reading' });
    expect(switchView(semantics, inside, 'big-picture')).toEqual(picture);
    const bothSource =
      source.replace(
        '  show author, aerie +2, reader',
        '  show author, aerie +2, reader\n  scenario quick',
      ) + '\nscenario quick: A quick check\n  author writes the model in editor\n';
    const bothModel = check(bothSource).model;
    if (bothModel === null) throw new Error('Both configured views must check cleanly.');
    const both = new Semantics(bothModel);
    const otherDefault = switchView(both, defaultPicture(both), 'inside');
    expect(otherDefault.activity).toEqual({ kind: 'overview', scenario: 'quick', step: 1 });
    expect(writeFragment(both, otherDefault)).toBe('#view=inside');
    expect(readFragment(both, '#view=inside').picture).toEqual(otherDefault);
    expect(
      semantics
        .overviewTrail('full-flow', picture.view, picture.zoom)
        .steps.map((step) => step.number),
    ).toEqual([1, 2, 3, 4]);
  });

  it('INT-624 shares default stages, selected stages and explicit clears without losing authored defaults', () => {
    const picture = defaultPicture(semantics);
    expect(writeFragment(semantics, picture)).toBe('');
    expect(readFragment(semantics, '').picture).toEqual(picture);
    const selected = {
      ...picture,
      activity: { kind: 'overview' as const, scenario: 'full-flow', step: 3 },
    };
    expect(writeFragment(semantics, selected)).toBe('#flow=full-flow.3');
    expect(readFragment(semantics, '#flow=full-flow.3').picture).toEqual(selected);
    const cleared = stop(semantics, selected);
    expect(writeFragment(semantics, cleared)).toBe('#flow=none');
    expect(readFragment(semantics, '#flow=none').picture).toEqual(cleared);
    expect(readFragment(semantics, '#view=inside').picture.activity).toEqual({ kind: 'reading' });
    expect(readFragment(semantics, '#flow=none&sel=author').picture.activity).toEqual({
      kind: 'selected',
      element: 'author',
    });
  });

  it('LAYOUT-506 INT-625 places four named stage badges on routed connections without moving the architecture', async () => {
    const layouter = new Layouter(semantics, inProcessEngine());
    const picture = defaultPicture(semantics);
    const laid = await layouter.picture(picture.view, picture.zoom, 'exec');
    const trail = semantics.overviewTrail('full-flow', picture.view, picture.zoom);
    const shapes = overviewShapes(laid, trail);
    expect(shapes).toHaveLength(4);
    expect(shapes.every((shape) => shape.kind === 'curve' && shape.route !== undefined)).toBe(true);
    const steps = semantics.overviewSteps('full-flow', 'exec');
    const drawing = renderPicture(semantics, laid, {
      trail: shapes,
      interactive: true,
      overview: { step: 1, unit: 'Stage', sentences: steps.map((step) => step.sentence) },
    });
    const controls = [...walk(drawing)].filter(
      (node) => node.attrs['role'] === 'button' && node.attrs['data-step'] !== undefined,
    );
    expect(controls.map((node) => node.attrs['aria-label'])).toEqual([
      'Stage 1: Write the model',
      'Stage 2: Check its meaning',
      'Stage 3: Build the picture',
      'Stage 4: Explore the diagram',
    ]);
    expect(toMarkup(drawing)).not.toContain('pathLength=');
    const technical = await layouter.picture(picture.view, picture.zoom, 'engineer');
    expect(overviewShapes(technical, trail)).toEqual(shapes);
    for (let i = 0; i < shapes.length; i++) {
      const badge = shapes[i]?.badge;
      if (badge === undefined) throw new Error('Missing badge');
      const shape = shapes[i];
      if (shape?.kind === 'curve')
        expect(shape.route).toEqual(laid.result.edges[`${shape.from}->${shape.to}`]?.points);
      expect(Number(drawing.attrs['width'])).toBeGreaterThanOrEqual(badge.x + 12);
      expect(Number(drawing.attrs['height'])).toBeGreaterThanOrEqual(badge.y + 12);
      for (const other of shapes.slice(i + 1))
        expect(Math.hypot(badge.x - other.badge.x, badge.y - other.badge.y)).toBeGreaterThanOrEqual(
          32,
        );
      for (const node of laid.drawing.nodes.filter((node) => node.state !== 'open')) {
        const box = laid.result.boxes[node.id];
        if (box === undefined) continue;
        expect(
          badge.x + 12 > box.x &&
            badge.x - 12 < box.x + box.width &&
            badge.y + 12 > box.y &&
            badge.y - 12 < box.y + box.height,
        ).toBe(false);
      }
      for (const { label } of Object.values(laid.result.edges)) {
        expect(
          badge.x + 12 > label.x &&
            badge.x - 12 < label.x + label.width &&
            badge.y + 12 > label.y &&
            badge.y - 12 < label.y + label.height,
        ).toBe(false);
      }
    }
    // Repeated uses of one visible connection retain distinct stage numbers and badge positions.
    const repeated = overviewShapes(laid, {
      ...trail,
      steps: [trail.steps[0], trail.steps[0]].flatMap((step, index) =>
        step === undefined ? [] : [{ ...step, number: index + 1 }],
      ),
    });
    expect(repeated[0]?.badge).not.toEqual(repeated[1]?.badge);
    const replyModel = check(read('tests/unit/lines/examples/LANG-509-main-flow.aerie')).model;
    if (replyModel === null) throw new Error('Reply model must check cleanly.');
    const reply = new Semantics(replyModel);
    const replyPicture = defaultPicture(reply);
    const replyLayout = await new Layouter(reply, inProcessEngine()).picture(
      replyPicture.view,
      replyPicture.zoom,
      'manager',
    );
    const replyShapes = overviewShapes(
      replyLayout,
      reply.overviewTrail('request', replyPicture.view, replyPicture.zoom),
    );
    const [call, answer] = replyShapes;
    expect(answer?.role).toBe('reply');
    if (call?.kind !== 'curve' || answer?.kind !== 'curve')
      throw new Error('Expected routed call and reply.');
    expect(answer.route).toEqual([...(call.route ?? [])].reverse());
  });

  it('LANG-509 LANG-608 completes view scenario references and keeps stage-range editing contextual', () => {
    const text =
      'a: A\nb: B\nview big: Big\n  scenario \nscenario request: Request\n  a calls b\n  step \n';
    expect(completionsAt(text, 4, 11)?.options.map((option) => option.label)).toEqual(['request']);
    expect(completionsAt(text, 7, 7)).toBeNull();
  });
});
