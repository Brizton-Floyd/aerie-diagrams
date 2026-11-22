import { describe, expect, it } from 'vitest';
import { readFragment, writeFragment } from '../../../src/app/link.ts';
import {
  defaultPicture,
  explore,
  endExploration,
  normalisePicture,
  openContainer,
  closeContainer,
  select,
  switchAudience,
  switchView,
  play,
  overview,
  present,
  type Picture,
} from '../../../src/model/index.ts';
import { read, semanticsOf } from './helpers.ts';

const semantics = semanticsOf(read('tests/fixtures/exploration.aerie'));
const start = defaultPicture(semantics);
const draw = (picture: Picture) => semantics.drawing(picture.view, picture.zoom, picture.exploring);
const explored = explore(semantics, start, 'engine');

describe('exploring a part', () => {
  it('MODEL-212 shows immediate children and closed outside neighbours, with all boundary connections', () => {
    const drawing = draw(explored);
    expect(drawing.nodes.map((n) => n.id)).toEqual([
      'web',
      'engine',
      'api',
      'jobs',
      'store',
      'remote',
    ]);
    expect(drawing.nodes.filter((n) => n.state === 'open').map((n) => n.id)).toEqual(['engine']);
    expect(drawing.nodes.filter((n) => n.parent === null).map((n) => n.id)).toEqual([
      'web',
      'engine',
      'store',
      'remote',
    ]);
    expect(drawing.edges.map((edge) => [edge.id, edge.carries])).toEqual([
      ['web->api', [0]],
      ['api->store', [1]],
      ['jobs->store', [2]],
      ['remote->api', [4]],
    ]);
    expect(
      draw(explore(semantics, switchView(semantics, start, 'dependencies'), 'engine')).edges.map(
        (edge) => edge.carries,
      ),
    ).toEqual([[5]]);
  });

  it('MODEL-212 opening, closing, revealing and nested exploration stay inside their roots', () => {
    const open = openContainer(semantics, explored, 'api');
    expect(draw(open).nodes.map((n) => n.id)).toContain('handler');
    expect(draw(open).nodes.map((n) => n.id)).not.toContain('unrelated');
    const closed = closeContainer(semantics, select(semantics, open, 'handler'), 'api');
    expect(closed.activity).toEqual({ kind: 'selected', element: 'api' });
    expect(draw(closed).nodes.map((n) => n.id)).not.toContain('handler');
    const nested = explore(semantics, open, 'api');
    expect(draw(nested).nodes.map((n) => n.id)).toEqual([
      'web',
      'api',
      'handler',
      'store',
      'remote',
    ]);
    const outside = select(semantics, nested, 'primary');
    expect(outside.exploring).toBe('api');
    expect(draw(outside).nodes.map((n) => n.id)).toContain('primary');
    expect(select(semantics, nested, 'unrelated').exploring).toBeUndefined();
  });

  it('MODEL-213 preserves scope across wording and links, normalises stale scopes and keeps old links', () => {
    const deep = switchAudience(semantics, openContainer(semantics, explored, 'api'), 'engineer');
    expect(draw(deep)).toEqual(draw(openContainer(semantics, explored, 'api')));
    const fragment = writeFragment(semantics, deep);
    expect(fragment).toContain('explore=engine');
    expect(readFragment(semantics, fragment)).toEqual({ picture: deep, dropped: [] });
    expect(writeFragment(semantics, readFragment(semantics, fragment).picture)).toBe(fragment);
    expect(readFragment(semantics, '#sel=engine').picture.exploring).toBeUndefined();
    expect(readFragment(semantics, '#explore=gone&open=api').dropped).toEqual([
      { part: 'exploration', id: 'gone' },
    ]);
    expect(readFragment(semantics, '#explore=screen').picture.exploring).toBeUndefined();
    expect(
      normalisePicture(semantics, { ...deep, view: 'gone' }).picture.exploring,
    ).toBeUndefined();
    expect(explore(semantics, start, 'screen')).toEqual(start);
    expect(explore(semantics, start, 'gone')).toEqual(start);
    expect(endExploration(semantics, deep).audience).toBe('engineer');
    expect(endExploration(semantics, deep).exploring).toBeUndefined();
  });

  it('MODEL-213 flows, tours and view changes leave exploration so every step can be drawn', () => {
    for (const picture of [
      play(semantics, explored, 'request'),
      overview(semantics, explored, 'request'),
      present(semantics, explored, 'tour'),
      switchView(semantics, explored, 'dependencies'),
    ]) {
      expect(picture.exploring).toBeUndefined();
      expect(draw(picture).nodes.map((n) => n.id)).toContain('suite');
    }
    const playing = play(semantics, start, 'request');
    expect(explore(semantics, playing, 'engine')).toEqual(playing);
  });
});
