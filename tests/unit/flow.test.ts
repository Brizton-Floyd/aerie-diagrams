import { describe, expect, it } from 'vitest';
import {
  defaultPicture,
  normalisePicture,
  openContainer,
  overview,
  select,
  switchAudience,
  switchView,
} from '../../src/model/index.ts';
import { readFragment, writeFragment } from '../../src/app/link.ts';
import { visitKey, visitName } from '../../src/app/visits.ts';
import { Layouter, trailShapes } from '../../src/layout/index.ts';
import { inProcessEngine } from '../../src/layout/elk/in-process.ts';
import { renderPicture, textOf, walk } from '../../src/render/index.ts';
import { read, semanticsOf } from './model/helpers.ts';

const semantics = semanticsOf(read('tests/fixtures/aerie-flow.aerie'));
const start = defaultPicture(semantics);

describe('static flow overviews', () => {
  it('MODEL-605 normalises overview steps, rejects unknown scenarios and retains ordinary defaults', () => {
    expect(start.activity).toEqual({ kind: 'reading' });
    const shown = overview(semantics, start, 'full-flow', 99);
    expect(shown.activity).toEqual({ kind: 'overview', scenario: 'full-flow', step: 8 });
    expect(overview(semantics, start, 'full-flow', Number.NaN).activity).toMatchObject({ step: 1 });
    expect(overview(semantics, start, 'full-flow', -3).activity).toMatchObject({ step: 1 });
    const missing = normalisePicture(semantics, {
      ...shown,
      activity: { kind: 'overview', scenario: 'missing', step: 1 },
    });
    expect(missing.dropped).toEqual([{ part: 'scenario', id: 'missing' }]);
    expect(missing.picture.activity).toEqual({ kind: 'reading' });
  });

  it('MODEL-605 INT-627 preserves the overview through opening and wording, and replaces it when an element is selected', () => {
    const shown = overview(semantics, start, 'full-flow', 5);
    const opened = openContainer(semantics, shown, 'picture');
    expect(opened.activity).toEqual(shown.activity);
    expect(switchAudience(semantics, opened, 'engineer').activity).toEqual(shown.activity);
    const selected = select(semantics, opened, 'author');
    expect(selected.activity).toEqual({ kind: 'selected', element: 'author' });
    expect(selected.zoom).toEqual(opened.zoom);
    const fragment = writeFragment(semantics, selected);
    expect(readFragment(semantics, fragment).picture).toEqual(selected);
    expect(visitKey(selected, fragment)).not.toBe(
      visitKey(opened, writeFragment(semantics, opened)),
    );
    expect(switchView(semantics, opened, 'inside').activity).toEqual({ kind: 'reading' });
    const narrow = semanticsOf(
      'a: A\nb: B\na calls b\nview narrow: Narrow\n  show a\nview full: Full\n  show a, b\nscenario request: Request\n  a calls b\n',
    );
    expect(overview(narrow, defaultPicture(narrow), 'request').view).toBe('full');
  });

  it('INT-621 round trips selected steps and keeps one visit for step changes', () => {
    const first = overview(semantics, start, 'full-flow', 2);
    const next = overview(semantics, first, 'full-flow', 6);
    const fragment = writeFragment(semantics, next);
    expect(fragment).toBe('#flow=full-flow.6');
    expect(readFragment(semantics, fragment)).toEqual({ picture: next, dropped: [] });
    expect(visitKey(first, writeFragment(semantics, first))).toBe(visitKey(next, fragment));
    expect(visitKey(start, '')).not.toBe(visitKey(next, fragment));
    expect(visitName(semantics, { fragment, about: null, camera: null }, 'exec')).toContain(
      'overview',
    );
    expect(
      readFragment(semantics, '#flow=full-flow.4&play=full-flow.2').picture.activity,
    ).toMatchObject({ kind: 'playing', step: 2 });
    expect(readFragment(semantics, '#flow=missing.4').dropped).toEqual([
      { part: 'scenario', id: 'missing' },
    ]);
  });

  it('INT-620 INT-622 renders every numbered step as a named static control without moving boxes', async () => {
    const layouter = new Layouter(semantics, inProcessEngine());
    const laid = await layouter.picture(start.view, start.zoom, 'exec');
    const steps = semantics.steps('full-flow', 'exec');
    const trail = trailShapes(
      laid.result,
      semantics.trail('full-flow', start.view, start.zoom, steps.length),
    );
    const drawing = (step: number) =>
      renderPicture(semantics, laid, {
        trail,
        interactive: true,
        overview: { step, sentences: steps.map((each) => each.sentence) },
      });
    const nodes = [...walk(drawing(3))];
    const controls = nodes.filter((node) => String(node.attrs['class']).includes('overview-step'));
    expect(controls.map((node) => textOf(node))).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(controls.map((node) => node.attrs['role'])).toEqual(Array<string>(8).fill('button'));
    expect(controls.every((node) => node.attrs['tabindex'] === 0)).toBe(true);
    expect(controls[2]?.attrs['aria-label']).toBe(`Step 3: ${steps[2]?.sentence ?? ''}`);
    expect(controls.filter((node) => node.attrs['aria-current'] === 'step').map(textOf)).toEqual([
      '3',
    ]);
    expect(
      nodes
        .filter((node) => node.attrs['class'] === 'curve')
        .every((node) => node.attrs['pathLength'] == null),
    ).toBe(true);
    const boxes = (step: number) =>
      [...walk(drawing(step))].filter((node) =>
        String(node.attrs['class']).split(' ').includes('node'),
      );
    expect(boxes(3)).toEqual(boxes(6));
    const technical = await layouter.picture(start.view, start.zoom, 'engineer');
    expect(technical.result).toEqual(laid.result);
  });
});
