// Elements and tags (docs/spec/model.md, MODEL-001 to MODEL-005).
import { describe, expect, it } from 'vitest';
import { InvalidModelError, Semantics, Tree } from '../../../src/model/index.ts';
import { LOTTO, semanticsOf } from './helpers.ts';

const tree = LOTTO.tree;

describe('the containment tree', () => {
  it('MODEL-001 lists elements in model order, the order of the canonical list', () => {
    expect(tree.elements.map((element) => element.id).slice(0, 5)).toEqual([
      'user',
      'suite',
      'website',
      'screen-api',
      'engine',
    ]);
    expect(tree.order('user')).toBe(0);
    expect(tree.order('texas')).toBe(LOTTO.model.elements.length - 1);
    expect(tree.sort(['texas', 'engine', 'user'])).toEqual(['user', 'engine', 'texas']);
  });

  it('MODEL-002 gives children, descendants, ancestors, depth, containers and leaves', () => {
    expect(tree.topLevel().map((element) => element.id)).toEqual(['user', 'suite', 'texas']);
    expect(tree.children('engine').map((element) => element.id)).toEqual([
      'engine-service',
      'strategies',
      'formats',
      'legacy',
    ]);
    expect(tree.descendants('engine').map((element) => element.id)).toEqual([
      'engine-service',
      'request-handling',
      'pick-generation',
      'history-lookup',
      'strategies',
      'formats',
      'legacy',
    ]);
    expect(tree.ancestors('pick-generation')).toEqual(['engine-service', 'engine', 'suite']);
    expect(tree.ancestors('user')).toEqual([]);
    expect(tree.depth('user')).toBe(0);
    expect(tree.depth('pick-generation')).toBe(3);
    expect(tree.top('pick-generation')).toBe('suite');
    expect(tree.top('texas')).toBe('texas');
    expect(tree.isContainer('engine-service')).toBe(true);
    expect(tree.isContainer('pick-generation')).toBe(false);
    expect(tree.contains('suite', 'pick-generation')).toBe(true);
    expect(tree.contains('pick-generation', 'suite')).toBe(false);
    expect(tree.contains('suite', 'suite')).toBe(false);
  });

  it('MODEL-003 puts person and external elements on the rim', () => {
    expect(tree.isRim('user')).toBe(true);
    expect(tree.isRim('texas')).toBe(true);
    expect(tree.isRim('suite')).toBe(false);
    expect(tree.isRim('saved-draws')).toBe(false);
  });

  it('MODEL-004 takes the icon line, else the first tag with a default icon, else box', () => {
    const semantics = semanticsOf(
      [
        'a: A [person]',
        'b: B [external]',
        'c: C [store]',
        'd: D [system]',
        'e: E [service]',
        'f: F [module]',
        'g: G [team service store]',
        'h: H [team]',
        'i: I',
        'j: J [person]',
        '  icon web',
      ].join('\n') + '\n',
    );
    const icons = semantics.tree.elements.map((element) => semantics.tree.icon(element.id));
    expect(icons).toEqual([
      'person',
      'building',
      'cylinder',
      'stack',
      'gear',
      'module',
      'gear',
      'box',
      'box',
      'web',
    ]);
    expect(tree.icon('suite')).toBe('stack');
    expect(tree.icon('saved-draws')).toBe('archive');
  });

  it('MODEL-005 heads the side panel with a kind label, adding the parent for a nested element', () => {
    const semantics = semanticsOf(
      [
        'a: A [person]',
        'b: B [external service]',
        'c: C [data-pipeline]',
        'd: D',
        'e: E [service person]',
        '  f: F [service]',
        '  g: G',
      ].join('\n') + '\n',
    );
    const labels = semantics.tree.elements.map((element) =>
      semantics.kindLabel(element.id, 'manager'),
    );
    expect(labels).toEqual([
      'Person',
      'Outside the system',
      'Data pipeline',
      'Element',
      'Person',
      'Service in E',
      'Element in E',
    ]);
    expect(LOTTO.kindLabel('store', 'manager')).toBe('Service in Lotto suite');
    // The parent's name is read in the reader's audience.
    expect(LOTTO.kindLabel('engine-service', 'exec')).toBe('Module in Number engine');
    expect(LOTTO.kindLabel('engine-service', 'engineer')).toBe('Module in Analysis engine');
  });

  it('MODEL-002 rejects a model whose parents are not listed before their children', () => {
    const model = semanticsOf('a: A\n  b: B\n').model;
    const [a, b] = model.elements;
    if (a === undefined || b === undefined) throw new Error('two elements expected');
    // A cycle, and a parent the model does not have, cannot be listed in a valid order.
    expect(() => new Tree({ ...model, elements: [{ ...a, parent: 'b' }, b] })).toThrow(
      InvalidModelError,
    );
    expect(() => new Tree({ ...model, elements: [a, { ...b, parent: 'nobody' }] })).toThrow(
      InvalidModelError,
    );
    expect(() => new Tree({ ...model, elements: [a, { ...b, id: 'a' }] })).toThrow(
      InvalidModelError,
    );
    expect(
      () => new Semantics({ ...model, relationships: [{ ...rel, subject: 'a', object: 'zz' }] }),
    ).toThrow(InvalidModelError);
  });
});

const rel = {
  subject: 'a',
  verb: { base: 'uses', set: {} },
  object: 'b',
  kind: 'runtime',
  about: { base: null, set: {}, add: {} },
};
