// View resolution and the zoom state (docs/spec/model.md, MODEL-201 to MODEL-211).
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ZOOM,
  defaultPicture,
  openContainer,
  switchView,
  type Drawing,
} from '../../../src/model/index.ts';
import { LOTTO, entries, semanticsOf, zoom } from './helpers.ts';

/** A drawing as the spec's worked example lists it: ids with their state and child count. */
const shown = (drawing: Drawing): string[] =>
  drawing.nodes.map((node) => {
    if (node.state === 'closed') return `${node.id} (closed, ${String(node.inside)} inside)`;
    if (node.state === 'open') return `${node.id} (open${node.partly ? ', partly' : ''})`;
    return node.id;
  });

const NESTED = semanticsOf(
  [
    'a: A [system]',
    '  b: B [service]',
    '    c: C [module]',
    '      d: D',
    '    e: E',
    '  f: F [module]',
    'g: G',
    'view tags: Tags',
    '  show [module]',
    'view deep: Deep',
    '  show a +1',
    'view none: None',
  ].join('\n') + '\n',
);

describe('what a view selects and draws', () => {
  it('MODEL-201 selects element items with their depth, tag items, and top level by default', () => {
    expect([...LOTTO.scope('big-picture').selected]).toEqual([
      'user',
      'suite',
      'website',
      'screen-api',
      'engine',
      'store',
      'texas',
    ]);
    expect([...LOTTO.scope('engineering').selected]).toEqual([
      'screen-api',
      'engine-service',
      'strategies',
      'formats',
      'legacy',
    ]);
    expect([...NESTED.scope('deep').selected]).toEqual(['a', 'b', 'f']);
    expect([...NESTED.scope('none').selected]).toEqual(['a', 'g']);
  });

  it('MODEL-202 and LANG-508 draws the selected elements and their ancestors by default', () => {
    expect([...NESTED.scope('tags').defaults]).toEqual(['a', 'b', 'c', 'f']);
    expect([...LOTTO.scope('engineering').defaults]).toEqual([
      'suite',
      'screen-api',
      'engine',
      'engine-service',
      'strategies',
      'formats',
      'legacy',
    ]);
  });

  it('MODEL-203 draws a container open when a child is drawn, closed otherwise, and partly open', () => {
    expect(shown(LOTTO.drawing('big-picture'))).toEqual([
      'user',
      'suite (open)',
      'website',
      'screen-api',
      'engine (closed, 4 inside)',
      'store (closed, 4 inside)',
      'texas',
    ]);
    expect(shown(LOTTO.drawing('services'))).toEqual([
      'user',
      'suite (open)',
      'website',
      'screen-api',
      'engine (open)',
      'engine-service (closed, 3 inside)',
      'strategies',
      'formats',
      'legacy',
      'store (open)',
      'history-service',
      'updater',
      'reader',
      'saved-draws',
      'texas',
    ]);
    expect(shown(LOTTO.drawing('engineering'))).toEqual([
      'suite (open, partly)',
      'screen-api',
      'engine (open)',
      'engine-service (closed, 3 inside)',
      'strategies',
      'formats',
      'legacy',
    ]);
    expect(shown(NESTED.drawing('tags'))).toEqual([
      'a (open)',
      'b (open, partly)',
      'c (closed, 1 inside)',
      'f',
    ]);
  });

  it('MODEL-204 records the reader changes per container; the empty state is the default', () => {
    expect(entries(DEFAULT_ZOOM)).toEqual([]);
    expect([...LOTTO.drawn('services', DEFAULT_ZOOM)]).toEqual([
      ...LOTTO.scope('services').defaults,
    ]);
    const opened = LOTTO.scope('services').open(DEFAULT_ZOOM, 'engine-service');
    expect(entries(opened)).toEqual([['engine-service', 'open']]);
  });

  it('MODEL-205 builds the drawn set from the top down; top-level elements never change', () => {
    const scope = NESTED.scope('tags');
    expect([...scope.drawn(zoom({ b: 'open' }))]).toEqual(['a', 'b', 'c', 'e', 'f']);
    expect([...scope.drawn(zoom({ b: 'closed' }))]).toEqual(['a', 'b', 'f']);
    // Opening b shows every child of b; c keeps its default state, so d stays hidden.
    expect([...scope.drawn(zoom({ c: 'open' }))]).toEqual(['a', 'b', 'c', 'd', 'f']);
    // g is not in D0, so no zoom state draws it.
    expect([...scope.drawn(zoom({ g: 'open', a: 'open' }))]).toEqual(['a', 'b', 'c', 'f']);
    expect(scope.drawn(zoom({ a: 'closed' })).has('g')).toBe(false);
  });

  it('MODEL-206 opens and closes in place; closing hides all descendants, reopening resets them', () => {
    const scope = NESTED.scope('tags');
    let state = scope.open(DEFAULT_ZOOM, 'c');
    expect([...scope.drawn(state)]).toEqual(['a', 'b', 'c', 'd', 'f']);
    state = scope.close(state, 'a');
    expect(entries(state)).toEqual([['a', 'closed']]);
    expect([...scope.drawn(state)]).toEqual(['a']);
    state = scope.open(state, 'a');
    // Each child is back in its own default state: c is drawn but no longer open.
    expect(entries(state)).toEqual([]);
    expect([...scope.drawn(state)]).toEqual(['a', 'b', 'c', 'f']);
    // Opening a leaf, or something not drawn, changes nothing.
    expect(entries(scope.open(DEFAULT_ZOOM, 'd'))).toEqual([]);
    expect(entries(scope.open(DEFAULT_ZOOM, 'g'))).toEqual([]);
  });

  it('MODEL-207 reveals an element by opening its ancestors from the outermost down', () => {
    const scope = LOTTO.scope('big-picture');
    const state = scope.reveal(DEFAULT_ZOOM, 'pick-generation');
    expect(entries(state)).toEqual([
      ['engine', 'open'],
      ['engine-service', 'open'],
    ]);
    expect(scope.drawn(state).has('pick-generation')).toBe(true);
    expect(scope.revealing(DEFAULT_ZOOM, 'pick-generation').opened).toEqual([
      'engine',
      'engine-service',
    ]);
    // Engineering opens the suite only partly; revealing the website opens it fully.
    const engineering = LOTTO.scope('engineering');
    expect(entries(engineering.reveal(DEFAULT_ZOOM, 'website'))).toEqual([['suite', 'open']]);
    // An element already drawn, or one whose top-level element is not drawn, changes nothing.
    expect(entries(scope.reveal(DEFAULT_ZOOM, 'website'))).toEqual([]);
    expect(entries(engineering.reveal(DEFAULT_ZOOM, 'user'))).toEqual([]);
    // Closed on the way: revealing opens it again.
    const closed = scope.close(DEFAULT_ZOOM, 'suite');
    expect(entries(scope.reveal(closed, 'website'))).toEqual([]);
  });

  it('MODEL-208 keeps the zoom state normalised, so equal drawn sets give equal states', () => {
    const scope = LOTTO.scope('services');
    // `open` on a container whose default already draws every child is dropped.
    expect(entries(scope.normalise(zoom({ engine: 'open' })))).toEqual([]);
    // `closed` on a container the default draws none of is dropped.
    expect(entries(scope.normalise(zoom({ 'engine-service': 'closed' })))).toEqual([]);
    // Entries for containers no longer drawn, leaves and unknown ids are dropped.
    expect(
      entries(
        scope.normalise(
          zoom({ engine: 'closed', 'engine-service': 'open', website: 'open', nowhere: 'open' }),
        ),
      ),
    ).toEqual([['engine', 'closed']]);
    // Entries come out in model order, whatever order they went in.
    const state = scope.normalise(zoom({ store: 'closed', 'engine-service': 'open' }));
    expect(entries(state)).toEqual([
      ['engine-service', 'open'],
      ['store', 'closed'],
    ]);
    expect(entries(scope.normalise(state))).toEqual(entries(state));
    // Normalising never changes the drawn set.
    const raw = zoom({ engine: 'open', 'engine-service': 'open', store: 'open' });
    expect([...scope.drawn(scope.normalise(raw))]).toEqual([...scope.drawn(raw)]);
  });

  it('MODEL-209 switching view starts from the new view default, with an empty zoom state', () => {
    const opened = openContainer(
      LOTTO,
      { ...defaultPicture(LOTTO), view: 'services' },
      'engine-service',
    );
    expect(entries(opened.zoom)).toEqual([['engine-service', 'open']]);
    const switched = switchView(LOTTO, opened, 'big-picture');
    expect(entries(switched.zoom)).toEqual([]);
    expect(entries(switchView(LOTTO, opened, 'services').zoom)).toEqual([]);
  });

  it('MODEL-210 draws only the relationship kinds a view lists', () => {
    const kindsOf = (view: string): string[] =>
      LOTTO.drawing(view).edges.flatMap((edge) =>
        edge.carries.map((index) => LOTTO.model.relationships[index]?.kind ?? ''),
      );
    expect(new Set(kindsOf('services'))).toEqual(new Set(['runtime']));
    expect(new Set(kindsOf('engineering'))).toEqual(new Set(['code']));
    expect(LOTTO.drawing('engineering').kinds).toEqual(['code']);
  });

  it('MODEL-211 names two zoom states: everything open, and all closed', () => {
    const scope = LOTTO.scope('big-picture');
    const open = scope.everythingOpen();
    expect(entries(open)).toEqual([
      ['engine', 'open'],
      ['engine-service', 'open'],
      ['store', 'open'],
    ]);
    expect(scope.drawn(open).size).toBe(LOTTO.model.elements.length);
    const closed = scope.allClosed();
    expect(entries(closed)).toEqual([['suite', 'closed']]);
    expect([...scope.drawn(closed)]).toEqual(['user', 'suite', 'texas']);
    // Engineering never draws the user or Texas, even with everything open.
    expect([
      ...LOTTO.scope('engineering').drawn(LOTTO.scope('engineering').everythingOpen()),
    ]).toEqual(
      LOTTO.tree.elements
        .map((element) => element.id)
        .filter((id) => LOTTO.tree.top(id) === 'suite' || id === 'suite'),
    );
  });

  it('LANG-506 gives a model without views the implicit overview of every top-level element', () => {
    const semantics = semanticsOf('a: A\n  b: B\nc: C\na uses c\n');
    expect(semantics.views.map((view) => view.id)).toEqual(['overview']);
    expect(semantics.viewTitle('overview', 'manager')).toBe('Overview');
    expect(shown(semantics.drawing('overview'))).toEqual(['a (closed, 1 inside)', 'c']);
    expect(semantics.drawing('overview').edges.map((edge) => edge.id)).toEqual(['a->c']);
  });

  it('MODEL-201 an empty model draws nothing in its overview', () => {
    const semantics = semanticsOf('model empty: Nothing yet\n');
    const drawing = semantics.drawing('overview');
    expect(drawing.nodes).toEqual([]);
    expect(drawing.edges).toEqual([]);
    expect(entries(semantics.scope('overview').everythingOpen())).toEqual([]);
  });
});
