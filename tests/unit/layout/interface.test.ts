// The layout interface (docs/spec/layout.md, LAYOUT-001 to LAYOUT-006): the narrow engine seam,
// the lint rule that keeps ELK behind it, determinism and rounding, audience independence, the
// Web Worker engine, and the shape of every result.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULT_ZOOM } from '../../../src/model/index.ts';
import { workerEngine } from '../../../src/layout/elk/worker.ts';
import {
  BESIDE,
  Layouter,
  distanceToRoute,
  layoutGraph,
  onOutline,
  round,
  type LayoutEngine,
  type LayoutGraph,
  type LayoutResult,
} from '../../../src/layout/index.ts';
import {
  ENGINE,
  LOTTO,
  ROOT,
  layouter,
  numbers,
  threadWorker,
  twoPlaces,
  type ThreadWorker,
} from './helpers.ts';

/** An engine that records what it is asked and places every box at the origin. */
class RecordingEngine implements LayoutEngine {
  readonly graphs: LayoutGraph[] = [];

  layout(graph: LayoutGraph): Promise<LayoutResult> {
    this.graphs.push(graph);
    const boxes: LayoutResult['boxes'] = {};
    for (const node of graph.nodes) {
      boxes[node.id] = node.open
        ? { x: 0, y: 0, width: node.minWidth, height: node.header + 30 }
        : { x: 0, y: 0, width: node.width, height: node.height };
    }
    const edges: LayoutResult['edges'] = {};
    for (const edge of graph.edges) {
      edges[edge.id] = {
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
        ],
        label: { x: 0, y: 0, ...edge.label },
      };
    }
    return Promise.resolve({ width: 1, height: 1, boxes, edges });
  }
}

/** Every .ts and .js file of a folder, recursively, relative to the repository. */
function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) return sources(path);
    return /\.(?:ts|js)$/.test(name) ? [path] : [];
  });
}

describe('the layout interface', () => {
  it('LAYOUT-001 lays out a structure view only through the LayoutEngine interface', async () => {
    const engine = new RecordingEngine();
    const layout = await new Layouter(LOTTO, engine).structure('services', DEFAULT_ZOOM);
    expect(engine.graphs).toHaveLength(1);
    const [graph] = engine.graphs;
    // Drawn elements in model order, parents before children; edges in MODEL-303 order.
    expect(graph?.nodes.map((node) => node.id)).toEqual(layout.drawing.nodes.map((n) => n.id));
    expect(graph?.edges.map((edge) => edge.id)).toEqual(layout.drawing.edges.map((e) => e.id));
    const seen = new Set<string>();
    for (const node of graph?.nodes ?? []) {
      if (node.parent !== null) expect(seen.has(node.parent)).toBe(true);
      seen.add(node.id);
    }
    expect(graph?.edges.find((edge) => edge.id === 'website->screen-api')).toMatchObject({
      source: 'website',
      target: 'screen-api',
    });
  });

  it('LAYOUT-002 only the ELK adapter imports elkjs, and a lint rule enforces it', async () => {
    const importers = ['src', 'tests', 'scripts']
      .flatMap(sources)
      .filter((path) =>
        /from ['"]elkjs|import\(['"]elkjs/.test(readFileSync(join(ROOT, path), 'utf8')),
      );
    expect(importers.length).toBeGreaterThan(0);
    for (const path of importers) expect(path.startsWith(join('src', 'layout', 'elk'))).toBe(true);

    const eslint = new ESLint({ cwd: ROOT });
    const restricts = async (path: string): Promise<boolean> => {
      const config = (await eslint.calculateConfigForFile(path)) as {
        rules?: Record<
          string,
          [string, { paths?: { name: string }[]; patterns?: { group?: string[] }[] }]
        >;
      };
      const options = config.rules?.['no-restricted-imports']?.[1];
      return (
        (options?.paths ?? []).some((each) => each.name === 'elkjs') &&
        (options?.patterns ?? []).some((each) => each.group?.includes('elkjs/*') === true)
      );
    };
    for (const path of [
      'src/main.ts',
      'src/lines/parse.ts',
      'src/model/semantics.ts',
      'src/layout/structure.ts',
      'src/layout/text/measure.ts',
      'src/cli/aerie.ts',
      'tests/unit/layout/interface.test.ts',
      'scripts/font-metrics.ts',
    ]) {
      expect(await restricts(path), path).toBe(true);
    }
    expect(await restricts('src/layout/elk/adapter.ts')).toBe(false);
  });

  it('LAYOUT-003 gives the same result for the same graph, every number to two places', async () => {
    const graph = layouter(LOTTO).graph(LOTTO.drawing('services'));
    const first = await ENGINE.layout(graph);
    const again = await ENGINE.layout(structuredClone(graph));
    expect(again).toEqual(first);
    const all = numbers(first);
    expect(all.length).toBeGreaterThan(100);
    expect(all.every(twoPlaces)).toBe(true);
    expect(Object.is(round(-0.001), 0)).toBe(true);
    expect(round(12.3456)).toBe(12.35);
  });

  it('LAYOUT-004 builds one layout graph for every audience', async () => {
    const drawing = LOTTO.drawing('services');
    const lay = layouter(LOTTO);
    const wordings = lay.wordings(drawing);
    expect(wordings.map((wording) => wording.audience)).toEqual(['exec', 'manager', 'engineer']);
    // The graph is the same whichever audience comes first: no audience is special.
    const graph = lay.graph(drawing);
    expect(layoutGraph(drawing, [...wordings].reverse())).toEqual(graph);
    expect(
      layoutGraph(
        drawing,
        [wordings[2], wordings[0], wordings[1]].flatMap((w) => w ?? []),
      ),
    ).toEqual(graph);
    const pictures = await Promise.all(
      LOTTO.model.audiences.map((audience) => lay.picture('services', DEFAULT_ZOOM, audience.id)),
    );
    for (const picture of pictures) {
      expect(picture.graph).toEqual(pictures[0]?.graph);
      expect(picture.result).toEqual(pictures[0]?.result);
    }
  });

  it('LAYOUT-401 opening in place lays the picture out again from scratch, its lines lifted anew', async () => {
    const lay = layouter(LOTTO);
    const scope = LOTTO.scope('services');
    const before = await lay.structure('services', DEFAULT_ZOOM);
    const opened = scope.open(DEFAULT_ZOOM, 'engine-service');
    const after = await lay.structure('services', opened);
    // The same as a fresh layout of the new zoom state: nothing is carried over from the old one.
    expect((await new Layouter(LOTTO, ENGINE).structure('services', opened)).result).toEqual(
      after.result,
    );
    // The line from the Screen API now ends at Request handling (JOURNEY-002).
    expect(Object.keys(before.result.edges)).toContain('screen-api->engine-service');
    expect(Object.keys(after.result.edges)).toContain('screen-api->request-handling');
    expect(Object.keys(after.result.edges)).not.toContain('screen-api->engine-service');
    for (const part of ['request-handling', 'pick-generation', 'history-lookup']) {
      expect(after.result.boxes[part]).toBeDefined();
    }
    // Closing it again gives back the first picture exactly.
    const closed = await lay.structure('services', scope.close(opened, 'engine-service'));
    expect(closed.result).toEqual(before.result);
  });

  describe('the Web Worker engine', () => {
    const started: { url: string | undefined; worker: ThreadWorker }[] = [];
    afterAll(() => {
      for (const each of started) each.worker.terminate();
    });

    it('LAYOUT-005 runs ELK in a worker in the browser, with the same result as in process', async () => {
      const engine = workerEngine((url) => {
        const worker = threadWorker(url ?? '');
        started.push({ url, worker });
        return worker as unknown as Worker;
      });
      const graph = layouter(LOTTO).graph(LOTTO.drawing('services'));
      const inWorker = await engine.layout(graph);
      expect(started).toHaveLength(1);
      expect(started[0]?.url).toMatch(/elkjs\/lib\/elk-worker\.min\.js$/);
      expect(inWorker).toEqual(await ENGINE.layout(graph));
    });
  });

  it('LAYOUT-006 gives every node a box and every edge a route from outline to outline', async () => {
    for (const view of ['big-picture', 'services', 'engineering']) {
      const scope = LOTTO.scope(view);
      for (const zoom of [DEFAULT_ZOOM, scope.everythingOpen(), scope.allClosed()]) {
        const { graph, result } = await layouter(LOTTO).structure(view, zoom);
        expect(Object.keys(result.boxes).sort()).toEqual(graph.nodes.map((node) => node.id).sort());
        for (const edge of graph.edges) {
          const routed = result.edges[edge.id];
          const from = result.boxes[edge.source];
          const to = result.boxes[edge.target];
          if (!from || !to || !routed) throw new Error(`${edge.id} is missing`);
          expect(routed.points.length).toBeGreaterThanOrEqual(2);
          const first = routed.points[0];
          const last = routed.points.at(-1);
          if (!first || !last) throw new Error(`${edge.id} has no route`);
          expect(onOutline(first, from), `${edge.id} starts on ${edge.source}`).toBe(true);
          expect(onOutline(last, to), `${edge.id} ends on ${edge.target}`).toBe(true);
          // Beside the route: no farther from it than twice ELK's label spacing.
          expect(distanceToRoute(routed.label, routed.points), edge.id).toBeLessThanOrEqual(BESIDE);
          expect(routed.label).toMatchObject(edge.label);
        }
      }
    }
  });
});
