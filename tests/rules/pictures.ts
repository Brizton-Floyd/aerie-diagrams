// The pictures the rule checks, scores and layout goldens cover (docs/spec/layout.md, rule checks):
// every committed sample and spec example, every view, and the zoom states default, everything
// open and all closed (MODEL-211), plus every state one open or close away from the default, so
// each way a reader can first open something in place is covered too.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, type Id } from '../../src/lines/index.ts';
import { DEFAULT_ZOOM, Semantics, type Zoom } from '../../src/model/index.ts';
import { inProcessEngine } from '../../src/layout/elk/in-process.ts';
import { Layouter } from '../../src/layout/index.ts';

const ROOT = join(import.meta.dirname, '../..');

export interface Source {
  /** The file, relative to the repository, such as `samples/lotto.aerie`. */
  path: string;
  /** The file's text. */
  text: string;
  semantics: Semantics;
  layouter: Layouter;
}

/** Every committed sample and every example file of the spec. */
export const SOURCES: Source[] = ['samples', 'docs/spec/examples'].flatMap((dir) =>
  readdirSync(join(ROOT, dir))
    .filter((file) => file.endsWith('.aerie'))
    .sort()
    .map((file) => {
      const path = `${dir}/${file}`;
      const text = readFileSync(join(ROOT, path), 'utf8');
      const result = parse(text);
      if (result.model === null) throw new Error(`${path} has no model`);
      const semantics = new Semantics(result.model);
      return { path, text, semantics, layouter: new Layouter(semantics, inProcessEngine()) };
    }),
);

/** A named zoom state of a view. */
export interface State {
  name: string;
  zoom: Zoom;
}

/**
 * The zoom states tested on a view, each drawing a different set: default, everything open, all
 * closed, then each container of the default drawing opened or closed in place.
 */
export function states(semantics: Semantics, view: Id): State[] {
  const scope = semantics.scope(view);
  const out: State[] = [];
  const seen = new Set<string>();
  const add = (name: string, zoom: Zoom): void => {
    const key = [...semantics.drawn(view, zoom)].join(' ');
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name, zoom });
  };
  add('default', DEFAULT_ZOOM);
  add('everything open', scope.everythingOpen());
  add('all closed', scope.allClosed());
  for (const node of semantics.drawing(view, DEFAULT_ZOOM).nodes) {
    if (node.state === 'open') add(`${node.id} closed`, scope.close(DEFAULT_ZOOM, node.id));
    if (node.state === 'closed') add(`${node.id} opened`, scope.open(DEFAULT_ZOOM, node.id));
  }
  return out;
}

/** Every view of a source with every tested zoom state. */
export function pictures(source: Source): { view: Id; state: State }[] {
  return source.semantics.views.flatMap((view) =>
    states(source.semantics, view.id).map((state) => ({ view: view.id, state })),
  );
}

/** Every scenario of a source on its stage view (MODEL-404, from the first view). */
export function scenarios(source: Source): { scenario: Id; view: Id }[] {
  const { semantics } = source;
  return semantics.model.scenarios.flatMap((scenario) => {
    const view = semantics.stage(scenario.id, semantics.firstView);
    return view === null ? [] : [{ scenario: scenario.id, view }];
  });
}
