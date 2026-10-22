// Lifting relationships to what a reader can see (docs/spec/model.md, MODEL-301 to MODEL-306),
// with every row of the worked example's tables for every audience.
import { describe, expect, it } from 'vitest';
import type { Id } from '../../../src/lines/index.ts';
import { DEFAULT_ZOOM, lift, type Semantics, type Zoom } from '../../../src/model/index.ts';
import { LOTTO, reading, semanticsOf, specTables } from './helpers.ts';

const TABLES = specTables();

/** The rows of the worked-example table under the heading that starts with `title`. */
function table(title: string): string[][] {
  const found = [...TABLES].find(([heading]) => heading.startsWith(title));
  if (found === undefined) throw new Error(`model.md has no table under ${title}`);
  return found[1];
}

const MERGED = semanticsOf(
  [
    'a: A',
    '  a1: A one',
    '  a2: A two [part]',
    'b: B',
    '  b1: B one',
    'c: C',
    'a1 fetches draw history from b1',
    '  @engineer: POSTs /history to',
    'a2 reads b',
    'b1 calls back a1',
    'a1 asks a2',
    'b calls c',
    'c calls a',
    'view outside: Outside',
    '  show a, b, c',
    'view inside: Inside',
    '  show a +1, b +1, c',
    'view part: Part',
    '  show [part], b',
  ].join('\n') + '\n',
);

describe('lifting', () => {
  it('MODEL-301 lifts an element to itself, its nearest drawn ancestor, or nothing', () => {
    const drawn = LOTTO.drawn('big-picture');
    expect(lift(LOTTO.tree, drawn, 'website')).toBe('website');
    expect(lift(LOTTO.tree, drawn, 'pick-generation')).toBe('engine');
    const engineering = LOTTO.drawn('engineering');
    expect(lift(LOTTO.tree, engineering, 'pick-generation')).toBe('engine-service');
    expect(lift(LOTTO.tree, engineering, 'website')).toBe('suite');
    expect(lift(LOTTO.tree, engineering, 'user')).toBeNull();
  });

  it('MODEL-302 carries a relationship between its lifts unless they are missing, equal or nested', () => {
    const big = LOTTO.drawing('big-picture');
    const carried = new Set(big.edges.flatMap((edge) => edge.carries));
    const index = (subject: Id, object: Id): number =>
      LOTTO.model.relationships.findIndex(
        (relationship) => relationship.subject === subject && relationship.object === object,
      );
    // Both ends inside the closed Analysis engine, or inside the closed Results store.
    expect(carried.has(index('request-handling', 'pick-generation'))).toBe(false);
    expect(carried.has(index('reader', 'saved-draws'))).toBe(false);
    expect(carried.has(index('screen-api', 'request-handling'))).toBe(true);
    // One lift containing the other: with a open partly, a1 asks a2 lifts to a and a2.
    const partly = MERGED.drawing('part');
    expect(partly.nodes.map((node) => [node.id, node.partly])).toEqual([
      ['a', true],
      ['a2', false],
      ['b', false],
    ]);
    expect(partly.edges.map((edge) => edge.id)).toEqual(['a->b', 'a2->b', 'b->a']);
    expect(MERGED.drawing('inside').edges.some((edge) => edge.id === 'a1->a2')).toBe(true);
    // Neither end has a lift: the user is not in Engineering.
    expect(LOTTO.drawing('engineering').edges.some((edge) => edge.source === 'user')).toBe(false);
  });

  it('MODEL-303 draws one edge per ordered pair, ordered by first relationship, with id a->b', () => {
    const closed = MERGED.drawing('outside');
    expect(closed.edges.map((edge) => [edge.id, edge.carries])).toEqual([
      ['a->b', [0, 1]],
      ['b->a', [2]],
      ['b->c', [4]],
      ['c->a', [5]],
    ]);
    // The same pair keeps its id across zoom states and audiences.
    const open = MERGED.drawing('inside');
    expect(open.edges.map((edge) => edge.id)).toEqual([
      'a1->b1',
      'a2->b',
      'b1->a1',
      'a1->a2',
      'b->c',
      'c->a',
    ]);
    for (const audience of ['exec', 'engineer']) {
      expect(MERGED.scene(closed, audience).edges.map((edge) => edge.id)).toEqual(
        closed.edges.map((edge) => edge.id),
      );
    }
  });

  it('MODEL-304 labels an edge with its first verb phrase and " (+N more)"', () => {
    const closed = MERGED.drawing('outside');
    const [first] = closed.edges;
    if (first === undefined) throw new Error('an edge expected');
    expect(MERGED.label(first, 'manager')).toBe('fetches draw history from (+1 more)');
    expect(MERGED.label(first, 'engineer')).toBe('POSTs /history to (+1 more)');
    expect(MERGED.scene(closed, 'manager').edges.map((edge) => edge.label)).toEqual([
      'fetches draw history from (+1 more)',
      'calls back',
      'calls',
      'calls',
    ]);
  });

  it('MODEL-305 gives each carried relationship its own sentence, never the lifted names', () => {
    const scene = MERGED.scene(MERGED.drawing('outside'), 'engineer');
    expect(scene.edges[0]?.relationships.map((each) => each.sentence)).toEqual([
      'A one POSTs /history to B one.',
      'A two reads B.',
    ]);
    const big = LOTTO.scene(LOTTO.drawing('big-picture'), 'exec');
    expect(big.edges[2]?.relationships.map((each) => each.sentence)).toEqual([
      'Website back end asks for numbers from Request handling.',
    ]);
  });

  it('MODEL-306 every carried relationship has an edge, and only one', () => {
    for (const view of MERGED.views) {
      for (const state of [DEFAULT_ZOOM, MERGED.scope(view.id).everythingOpen()]) {
        expectEveryCarriedDrawn(MERGED, view.id, state);
      }
    }
  });

  it('MODEL-303 draws relationship cycles as separate edges in each direction', () => {
    const semantics = semanticsOf(
      'a: A\nb: B\nc: C\na calls b\nb calls c\nc calls a\nb answers a\n',
    );
    expect(semantics.drawing('overview').edges.map((edge) => edge.id)).toEqual([
      'a->b',
      'b->c',
      'c->a',
      'b->a',
    ]);
  });

  it('MODEL-302 a relationship inside one container is drawn only once the container opens', () => {
    const semantics = semanticsOf('box: Box\n  x: X\n  y: Y\nx calls y\n');
    const scope = semantics.scope('overview');
    expect(semantics.drawing('overview').edges).toEqual([]);
    expect(semantics.drawing('overview', scope.open(DEFAULT_ZOOM, 'box')).edges).toEqual([
      { id: 'x->y', source: 'x', target: 'y', carries: [0] },
    ]);
  });
});

describe('the worked example: Lotto', () => {
  const AUDIENCES = LOTTO.model.audiences.map((audience) => audience.id);
  const views: [string, string][] = [
    ['Big picture', 'big-picture'],
    ['Services', 'services'],
    ['Engineering', 'engineering'],
  ];

  it.each(views)('MODEL-304 the %s table, row by row, for every audience', (title, view) => {
    const rows = table(title);
    const drawing = LOTTO.drawing(view);
    expect(drawing.edges).toHaveLength(rows.length);
    AUDIENCES.forEach((audience, column) => {
      const read = drawing.edges.map((edge) => reading(LOTTO, edge, audience));
      expect(read).toEqual(rows.map((row) => row[column]));
    });
  });

  it('MODEL-302 the Big picture edges each carry one relationship', () => {
    const drawing = LOTTO.drawing('big-picture');
    expect(drawing.edges.map((edge) => edge.carries.length)).toEqual([1, 1, 1, 1, 1]);
  });

  it('MODEL-304 the Engineering view title reads differently for executives', () => {
    expect(AUDIENCES.map((audience) => LOTTO.viewTitle('engineering', audience))).toEqual([
      'How the code is organised',
      'Engineering: code modules',
      'Engineering: code modules',
    ]);
  });

  it('MODEL-306 every view, audience and zoom state draws every carried relationship once', () => {
    for (const view of LOTTO.views) {
      for (const state of zoomStates(LOTTO, view.id)) {
        const drawing = LOTTO.drawing(view.id, state);
        expectEveryCarriedDrawn(LOTTO, view.id, drawing.zoom);
        // Every drawn element's parent is drawn, in model order.
        const ids = drawing.nodes.map((node) => node.id);
        expect(ids).toEqual(LOTTO.tree.sort([...ids]));
        for (const node of drawing.nodes) {
          if (node.parent !== null) expect(ids).toContain(node.parent);
        }
        // Wording never changes what is drawn (RULE-005).
        for (const audience of AUDIENCES) {
          const scene = LOTTO.scene(drawing, audience);
          expect(scene.nodes.map((node) => node.id)).toEqual(ids);
          expect(scene.edges.map((edge) => [edge.id, edge.carries])).toEqual(
            drawing.edges.map((edge) => [edge.id, edge.carries]),
          );
          for (const edge of scene.edges) {
            const more = edge.carries.length - 1;
            expect(edge.label).toBe(
              (edge.relationships[0]?.verb ?? '') + (more > 0 ? ` (+${String(more)} more)` : ''),
            );
          }
        }
      }
    }
  });
});

/** Default, everything open, all closed, and each drawn container opened and closed from default. */
function zoomStates(semantics: Semantics, view: string): Zoom[] {
  const scope = semantics.scope(view);
  const states = [DEFAULT_ZOOM, scope.everythingOpen(), scope.allClosed()];
  for (const id of scope.drawn(DEFAULT_ZOOM)) {
    if (!semantics.tree.isContainer(id)) continue;
    states.push(scope.open(DEFAULT_ZOOM, id), scope.close(DEFAULT_ZOOM, id));
  }
  return states;
}

/** MODEL-302 and MODEL-306 checked from first principles for one view and zoom state. */
function expectEveryCarriedDrawn(semantics: Semantics, view: string, state: Zoom): void {
  const drawing = semantics.drawing(view, state);
  const drawn = semantics.drawn(view, state);
  const tree = semantics.tree;
  const owner = new Map<number, string>();
  drawing.edges.forEach((edge, position) => {
    expect(edge.id).toBe(`${edge.source}->${edge.target}`);
    expect(drawn.has(edge.source) && drawn.has(edge.target)).toBe(true);
    expect(tree.contains(edge.source, edge.target) || tree.contains(edge.target, edge.source)).toBe(
      false,
    );
    expect(edge.carries).toEqual([...edge.carries].sort((a, b) => a - b));
    const previous = drawing.edges[position - 1];
    if (previous !== undefined) {
      expect(edge.carries[0] ?? 0).toBeGreaterThan(previous.carries[0] ?? 0);
    }
    for (const index of edge.carries) {
      expect(owner.has(index)).toBe(false);
      owner.set(index, edge.id);
    }
  });
  semantics.model.relationships.forEach((relationship, index) => {
    const a = lift(tree, drawn, relationship.subject);
    const b = lift(tree, drawn, relationship.object);
    const carried =
      drawing.kinds.includes(relationship.kind) &&
      a !== null &&
      b !== null &&
      a !== b &&
      !tree.contains(a, b) &&
      !tree.contains(b, a);
    expect(owner.get(index)).toBe(carried ? `${a}->${b}` : undefined);
  });
}
