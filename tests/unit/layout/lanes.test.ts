// Scenarios as lanes (docs/spec/layout.md, LAYOUT-601 to LAYOUT-607).
import { describe, expect, it } from 'vitest';
import { DEFAULT_ZOOM, type Semantics } from '../../../src/model/index.ts';
import {
  BOX,
  LANES,
  ROLES,
  closedSize,
  measure,
  layoutLanes,
  placeLanesText,
  reservedText,
  type LanesLayout,
  type StructureLayout,
} from '../../../src/layout/index.ts';
import { LOTTO, layouter, semanticsOf } from './helpers.ts';

const y = (count: number): string => 'y'.repeat(count);

// P and Q at the top level and S and T inside Box; the dev audience reads labels in the code voice.
const SMALL = semanticsOf(
  [
    'model l: Lanes',
    'audiences plain "Plain" (default), dev "Dev" (code)',
    '',
    'p: P',
    'q: Q | Waits for P',
    'box: Box',
    '  s: S',
    '  t: T',
    '',
    'p calls q',
    'q calls s',
    's calls t',
    '',
    'view v: V',
    '  show p, q, box +1',
    '',
    'scenario go: Go',
    '  p asks q',
    `    @dev: ${y(29)}`,
    '  q asks s',
    '  s asks t',
    '  t tells q',
    '  q tells p',
  ].join('\n') + '\n',
);

async function lanesOf(
  semantics: Semantics,
  scenario: string,
  view: string,
  zoom = DEFAULT_ZOOM,
): Promise<LanesLayout> {
  return layouter(semantics).lanes(scenario, view, zoom);
}

const ids = (lanes: LanesLayout): string[] => lanes.lanes.map((lane) => lane.id);

describe('the lanes', () => {
  it('LAYOUT-601 has a lane for each lift of a step end, each once, and self steps on one lane', async () => {
    const open = await lanesOf(SMALL, 'go', 'v');
    expect(ids(open).sort()).toEqual(['p', 'q', 's', 't']);
    expect(open.rows.every((row) => row.kind === 'arrow')).toBe(true);
    // Box closed: S and T lift to Box, so step 3 runs from Box to Box.
    const closed = await lanesOf(SMALL, 'go', 'v', SMALL.scope('v').close(DEFAULT_ZOOM, 'box'));
    expect(ids(closed).sort()).toEqual(['box', 'p', 'q']);
    expect(closed.rows.map((row) => [row.kind, row.from, row.to])).toEqual([
      ['arrow', 'p', 'q'],
      ['arrow', 'q', 'box'],
      ['self', 'box', 'box'],
      ['arrow', 'box', 'q'],
      ['arrow', 'q', 'p'],
    ]);
    // Lotto: on the Big picture, steps 4, 5 and 8 to 11 stay inside the closed Analysis engine.
    const picks = await lanesOf(LOTTO, 'generate-picks', 'big-picture');
    expect(ids(picks).sort()).toEqual(['engine', 'screen-api', 'store', 'user', 'website']);
    expect(picks.rows.filter((row) => row.kind === 'self').map((row) => row.number)).toEqual([
      4, 5, 8, 9, 10, 11,
    ]);
    expect(new Set(picks.rows.filter((row) => row.kind === 'self').map((row) => row.from))).toEqual(
      new Set(['engine']),
    );
  });

  it("LAYOUT-602 keeps the arrangement of the structure view, a container's lanes side by side", async () => {
    for (const zoom of [DEFAULT_ZOOM, LOTTO.scope('services').everythingOpen()]) {
      const structure = await layouter(LOTTO).structure('services', zoom);
      const lanes = layoutLanes(LOTTO, 'generate-picks', structure);
      const centre = (id: string): number => {
        const box = structure.result.boxes[id];
        return box === undefined ? NaN : box.x + box.width / 2;
      };
      // Siblings keep their left-to-right order; the lanes of one container are next to each other.
      const order = ids(lanes);
      for (let i = 0; i + 1 < order.length; i++) {
        const a = order[i] ?? '';
        const b = order[i + 1] ?? '';
        if (LOTTO.tree.parent(a) === LOTTO.tree.parent(b))
          expect(centre(a)).toBeLessThanOrEqual(centre(b));
      }
      for (const container of ['suite', 'engine', 'engine-service', 'store']) {
        const inside = order
          .map((id, index) => (LOTTO.tree.contains(container, id) ? index : -1))
          .filter((index) => index >= 0);
        const [start, end] = [inside[0], inside.at(-1)];
        if (start !== undefined && end !== undefined) expect(end - start + 1).toBe(inside.length);
      }
    }
    // Moving Q's box to the far left and P's to the far right swaps their lanes.
    const structure = await layouter(SMALL).structure('v', DEFAULT_ZOOM);
    const before = ids(layoutLanes(SMALL, 'go', structure));
    expect(before.indexOf('p')).toBeLessThan(before.indexOf('q'));
    const boxes = { ...structure.result.boxes };
    const p = boxes['p'];
    const q = boxes['q'];
    if (!p || !q) throw new Error('p and q are drawn');
    boxes['p'] = { ...p, x: 5000 };
    boxes['q'] = { ...q, x: -5000 };
    const swapped: StructureLayout = { ...structure, result: { ...structure.result, boxes } };
    const after = ids(layoutLanes(SMALL, 'go', swapped));
    expect(after[0]).toBe('q');
    expect(after.at(-1)).toBe('p');
  });

  it('LAYOUT-603 sizes headers like leaf boxes, with bands above them by depth and lines below', async () => {
    const lanes = await lanesOf(
      LOTTO,
      'generate-picks',
      'services',
      LOTTO.scope('services').everythingOpen(),
    );
    for (const lane of lanes.lanes) {
      const texts = lanes.wordings.flatMap((wording) => wording.headers.get(lane.id) ?? []);
      const { textWidth, lines } = reservedText(texts);
      const size = closedSize(textWidth, lines, 'leaf');
      expect(lane.header).toMatchObject(size);
      expect(lane.header.x + lane.header.width / 2).toBe(lane.x);
      expect(lane.top).toBe(lane.header.y + lane.header.height);
      expect(lane.bottom).toBe(lanes.height);
    }
    // Every drawn ancestor holding lanes has a band spanning its lanes, stacked by depth.
    expect(lanes.bands.map((band) => [band.id, band.depth])).toEqual([
      ['suite', 0],
      ['engine', 1],
      ['store', 1],
      ['engine-service', 2],
    ]);
    for (const band of lanes.bands) {
      expect(band.box.y).toBe(band.depth * LANES.band);
      expect(band.box.height).toBe(LANES.band);
      for (const lane of lanes.lanes) {
        if (!LOTTO.tree.contains(band.id, lane.id)) continue;
        expect(lane.header.x).toBeGreaterThanOrEqual(band.box.x);
        expect(lane.header.x + lane.header.width).toBeLessThanOrEqual(band.box.x + band.box.width);
      }
    }
    const headerTop = 3 * LANES.band + LANES.gap;
    expect(lanes.lanes.every((lane) => lane.header.y === headerTop)).toBe(true);
    // A lane line runs on below the last row.
    const last = lanes.rows.at(-1);
    expect(lanes.height).toBe((last?.top ?? 0) + (last?.height ?? 0) + LANES.gap);
  });

  it('LAYOUT-604 gives each step a row as tall as its reserved label plus 16, at least 24 for a self step', async () => {
    const closed = await lanesOf(SMALL, 'go', 'v', SMALL.scope('v').close(DEFAULT_ZOOM, 'box'));
    const [first, second, self] = closed.rows;
    // Step 1: 29 code characters in the dev audience, one line of 235 px.
    expect(first?.label).toMatchObject({
      width: 235 + 2 * BOX.labelPadX,
      height: 17 + 2 * BOX.labelPadY,
    });
    expect(first?.height).toBe(21 + 16);
    expect(second?.top).toBe((first?.top ?? 0) + (first?.height ?? 0));
    expect(self?.height).toBe(Math.max(24, (self?.label.height ?? 0) + 16));
    const picks = await lanesOf(LOTTO, 'generate-picks', 'big-picture');
    for (const row of picks.rows) {
      expect(row.height).toBe(Math.max(row.label.height + 16, row.kind === 'self' ? 24 : 0));
    }
  });

  it('LAYOUT-605 places lane centres left to right, clear of headers and step labels', async () => {
    for (const [semantics, scenario, view, zoom] of [
      [SMALL, 'go', 'v', DEFAULT_ZOOM],
      [SMALL, 'go', 'v', SMALL.scope('v').close(DEFAULT_ZOOM, 'box')],
      [LOTTO, 'generate-picks', 'big-picture', DEFAULT_ZOOM],
      [LOTTO, 'results-poll', 'services', DEFAULT_ZOOM],
    ] as const) {
      const lanes = await lanesOf(semantics, scenario, view, zoom);
      const x = lanes.lanes.map((lane) => lane.x);
      const width = lanes.lanes.map((lane) => lane.header.width);
      const index = new Map(lanes.lanes.map((lane, at) => [lane.id, at]));
      expect(x[0]).toBe((width[0] ?? 0) / 2);
      for (let j = 1; j < x.length; j++) {
        // Each centre is at least the previous plus half of both headers plus 32 ...
        const least = [(x[j - 1] ?? 0) + ((width[j - 1] ?? 0) + (width[j] ?? 0)) / 2 + 32];
        for (const row of lanes.rows) {
          const a = index.get(row.from) ?? 0;
          const b = index.get(row.to) ?? 0;
          // ... and clear of every step label between an earlier lane and this one ...
          if (Math.max(a, b) === j && a !== b)
            least.push((x[Math.min(a, b)] ?? 0) + row.label.width + 16);
          // ... and of the self steps on the lane before it.
          if (a === b && a === j - 1) least.push((x[j - 1] ?? 0) + 24 + row.label.width + 16);
        }
        expect(x[j]).toBeGreaterThanOrEqual(Math.max(...least) - 0.01);
      }
      const ends = [
        ...lanes.lanes.map((lane) => lane.header.x + lane.header.width),
        ...lanes.rows
          .filter((row) => row.kind === 'self')
          .map((row) => row.label.x + row.label.width),
      ];
      expect(lanes.width).toBeGreaterThanOrEqual(Math.max(...ends));
    }
    // Where nothing else pushes, the centres sit exactly at the header rule.
    const plain = await lanesOf(SMALL, 'go', 'v');
    const [a, b] = plain.lanes;
    expect(b?.x).toBe(
      Math.max(
        (a?.x ?? 0) + ((a?.header.width ?? 0) + (b?.header.width ?? 0)) / 2 + 32,
        (a?.x ?? 0) + (plain.rows[0]?.label.width ?? 0) + 16,
      ),
    );
  });

  it('LAYOUT-605 makes a band as wide as its name needs, the next lane clear of it', async () => {
    const named = semanticsOf(
      [
        'model b: Bands',
        'box: A container whose name is far wider than the one part it holds',
        '  part: P',
        'next: N',
        'part calls next',
        'scenario go: Go',
        '  part asks next',
      ].join('\n') + '\n',
    );
    const open = named.scope('overview').everythingOpen();
    const structure = await layouter(named).structure('overview', open);
    // Both sides: as laid out (N left of the container), and with N's box moved far to the right.
    const next = structure.result.boxes['next'];
    if (next === undefined) throw new Error('next is drawn');
    const moved: StructureLayout = {
      ...structure,
      result: {
        ...structure.result,
        boxes: { ...structure.result.boxes, next: { ...next, x: 5000 } },
      },
    };
    const orders: string[][] = [];
    for (const layout of [structure, moved]) {
      const lanes = layoutLanes(named, 'go', layout);
      orders.push(ids(lanes));
      const [band] = lanes.bands;
      const part = lanes.lanes.find((lane) => lane.id === 'part');
      const other = lanes.lanes.find((lane) => lane.id === 'next');
      if (!band || !part || !other) throw new Error('a band and two lanes');
      const name = measure(
        'A container whose name is far wider than the one part it holds',
        ROLES.band,
      );
      expect(band.box.width).toBe(name + 2 * LANES.bandPad);
      expect(band.box.x).toBe(part.header.x);
      // The other lane's header keeps 32 px clear of the band, on whichever side it is.
      const clear =
        other.header.x >= band.box.x + band.box.width + LANES.headerGap ||
        other.header.x + other.header.width + LANES.headerGap <= band.box.x;
      expect(clear).toBe(true);
      expect(lanes.width).toBeGreaterThanOrEqual(band.box.x + band.box.width);
    }
    expect(orders).toEqual([
      ['next', 'part'],
      ['part', 'next'],
    ]);
  });

  it('LAYOUT-606 draws a call or reply as an arrow along the bottom of its row and a self step as a loop', async () => {
    const closed = await lanesOf(SMALL, 'go', 'v', SMALL.scope('v').close(DEFAULT_ZOOM, 'box'));
    const x = new Map(closed.lanes.map((lane) => [lane.id, lane.x]));
    for (const row of closed.rows) {
      const from = x.get(row.from) ?? NaN;
      if (row.kind === 'arrow') {
        const to = x.get(row.to) ?? NaN;
        const bottom = row.top + row.height - LANES.rowInset;
        expect(row.points).toEqual([
          { x: from, y: bottom },
          { x: to, y: bottom },
        ]);
        expect(row.label.x + row.label.width / 2).toBeCloseTo((from + to) / 2, 2);
        expect(row.label.y + row.label.height).toBeLessThanOrEqual(bottom);
        expect(row.badge).toEqual({ x: from, y: bottom });
      } else {
        expect(row.points[0]).toEqual({ x: from, y: row.top + LANES.rowInset });
        expect(Math.max(...row.points.map((at) => at.x))).toBe(from + LANES.loop);
        expect(row.label.x).toBeGreaterThan(from + LANES.loop);
        expect(row.badge).toEqual(row.points[0]);
      }
    }
    // Replies are told apart (MODEL-401): step 4 answers step 3's relationship backwards.
    const picks = await lanesOf(LOTTO, 'generate-picks', 'big-picture');
    expect(picks.rows.map((row) => row.role)).toEqual([
      'call',
      'call',
      'call',
      'call',
      'call',
      'call',
      'reply',
      'reply',
      'call',
      'reply',
      'reply',
      'reply',
      'reply',
      'reply',
    ]);
  });

  it('LAYOUT-607 reserves space for every audience, is deterministic, and grows in step with steps and lanes', async () => {
    const lanes = await lanesOf(LOTTO, 'generate-picks', 'big-picture');
    const structure = await layouter(LOTTO).structure('big-picture', DEFAULT_ZOOM);
    expect(layoutLanes(LOTTO, 'generate-picks', structure)).toEqual(lanes);
    // Every audience's text fits the one layout.
    for (const audience of LOTTO.model.audiences) {
      const text = placeLanesText(lanes, audience.id);
      for (const row of lanes.rows) {
        for (const line of text.labels[row.number] ?? []) {
          expect(line.width).toBeLessThanOrEqual(row.label.width - 2 * BOX.labelPadX);
        }
      }
    }
    // Four times the steps and lanes take about four times as long, not sixteen. The fastest of
    // seven runs is the time least disturbed by other work on the machine.
    const time = (count: number): number => {
      const { semantics, structure: fake } = chain(count);
      const runs: number[] = [];
      for (let run = 0; run < 7; run++) {
        const start = performance.now();
        layoutLanes(semantics, 'long', fake);
        runs.push(performance.now() - start);
      }
      return Math.min(...runs);
    };
    time(50);
    const ratio = time(800) / time(200);
    expect(ratio).toBeLessThan(10);
  });
});

/**
 * A model of `count` elements in a chain and a scenario of `5 * count` steps along it, with a
 * structure layout that places the elements in a row, without running the layout engine.
 */
function chain(count: number): { semantics: Semantics; structure: StructureLayout } {
  const lines = ['model c: Chain'];
  for (let i = 0; i < count; i++) lines.push(`e${String(i)}: E${String(i)}`);
  for (let i = 0; i + 1 < count; i++) lines.push(`e${String(i)} calls e${String(i + 1)}`);
  lines.push('scenario long: Long');
  for (let i = 0; i < 5 * count; i++) {
    const a = i % (count - 1);
    lines.push(`  e${String(a)} asks e${String(a + 1)}`);
  }
  const semantics = semanticsOf(lines.join('\n') + '\n');
  const drawing = semantics.drawing('overview');
  const boxes: StructureLayout['result']['boxes'] = {};
  drawing.nodes.forEach((node, index) => {
    boxes[node.id] = { x: index * 200, y: 0, width: 150, height: 46 };
  });
  return {
    semantics,
    structure: {
      drawing,
      graph: { nodes: [], edges: [] },
      result: { width: count * 200, height: 46, boxes, edges: {} },
      wordings: [],
    },
  };
}
