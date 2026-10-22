// The ELK graph the adapter sends, option by option, and how it reads ELK's answer back
// (docs/spec/layout.md, LAYOUT-301 to LAYOUT-306).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LABEL_OPTIONS,
  RIM_OPTIONS,
  ROOT_ID,
  ROOT_OPTIONS,
  containerOptions,
  elkGraph,
  straighten,
  topRank,
  type ElkNode,
} from '../../../src/layout/elk/adapter.ts';
import { DEFAULT_ZOOM } from '../../../src/model/index.ts';
import { ROOT, LOTTO, layouter, read, semanticsOf } from './helpers.ts';

/** Every node of an ELK graph below the root, by id. */
function elkNodes(root: ElkNode): Map<string, ElkNode> {
  const out = new Map<string, ElkNode>();
  const visit = (node: ElkNode): void => {
    for (const child of node.children ?? []) {
      out.set(child.id, child);
      visit(child);
    }
  };
  visit(root);
  return out;
}

/** The option table under LAYOUT-301 in layout.md, as option name to value. */
function specOptions(): Record<string, string> {
  const text = read('docs/spec/layout.md');
  const table = text.slice(text.indexOf('**LAYOUT-301**'), text.indexOf('**LAYOUT-302**'));
  const out: Record<string, string> = {};
  for (const line of table.split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim());
    const [, names = '', value = ''] = cells;
    if (!names.startsWith('`')) continue;
    for (const name of names.split(' and ')) out[name.replace(/`/g, '')] = value.replace(/`/g, '');
  }
  return out;
}

const SERVICES = layouter(LOTTO).graph(LOTTO.drawing('services'));

describe('the ELK graph', () => {
  it('LAYOUT-301 sends one graph per picture with the layered top-down options on its root', () => {
    const graph = elkGraph(SERVICES);
    expect(graph.id).toBe(ROOT_ID);
    expect(graph.layoutOptions).toEqual({
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.spacing.nodeNodeBetweenLayers': '30',
      'elk.spacing.nodeNode': '26',
      'elk.spacing.edgeNode': '14',
      'elk.spacing.edgeEdge': '12',
      'elk.spacing.edgeLabel': '4',
      'elk.json.shapeCoords': 'ROOT',
      'elk.json.edgeCoords': 'ROOT',
    });
    // Elements nest under their parents in model order; each edge sits in its ends' lowest common
    // container, in the order of the layout graph.
    const nodes = elkNodes(graph);
    expect(graph.children?.map((child) => child.id)).toEqual(['user', 'suite', 'texas']);
    expect(nodes.get('suite')?.children?.map((child) => child.id)).toEqual([
      'website',
      'screen-api',
      'engine',
      'store',
    ]);
    expect(graph.edges?.map((edge) => edge.id)).toEqual(['user->website', 'updater->texas']);
    expect(nodes.get('suite')?.edges?.map((edge) => edge.id)).toEqual([
      'website->screen-api',
      'screen-api->engine-service',
      'engine-service->history-service',
    ]);
    expect(nodes.get('store')?.edges?.map((edge) => edge.id)).toEqual([
      'history-service->saved-draws',
      'updater->reader',
      'reader->saved-draws',
      'updater->history-service',
    ]);
    // A leaf or closed box carries its size and no children.
    const website = SERVICES.nodes.find((node) => node.id === 'website');
    expect(nodes.get('website')).toMatchObject({
      width: website && !website.open ? website.width : -1,
      height: website && !website.open ? website.height : -1,
    });
    expect(nodes.get('website')?.children).toBeUndefined();
  });

  it('LAYOUT-302 pads each open container around its children, below its header, at its least size', async () => {
    const nodes = elkNodes(elkGraph(SERVICES));
    for (const node of SERVICES.nodes) {
      if (!node.open) continue;
      // ELK reads a nested container's minimum width for height in the top-down direction, so the
      // pair is written the other way round.
      expect(nodes.get(node.id)?.layoutOptions).toEqual({
        'elk.padding': `[top=${String(node.header)},left=18,bottom=18,right=18]`,
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `(${String(node.header + 30)}, ${String(node.minWidth)})`,
      });
      expect(nodes.get(node.id)?.width).toBeUndefined();
    }
    expect(containerOptions(200, 47)).toEqual({
      'elk.padding': '[top=47,left=18,bottom=18,right=18]',
      'elk.nodeSize.constraints': 'MINIMUM_SIZE',
      'elk.nodeSize.minimum': '(77, 200)',
    });
    // A container whose header is wider than its one small child is as wide as its header needs,
    // and at least 30 px taller than its header, at every depth.
    const narrow = semanticsOf(
      [
        'model n: Narrow',
        'outer: Outer | A tagline long enough to be wider than the box inside it',
        '  inner: Inner | Another tagline that needs more room than its part',
        '    part: P',
        '  other: O',
      ].join('\n') + '\n',
    );
    const zoom = narrow.scope('overview').everythingOpen();
    const { graph, result } = await layouter(narrow).structure('overview', zoom);
    for (const node of graph.nodes) {
      const box = result.boxes[node.id];
      if (!node.open || box === undefined) continue;
      expect(box.width, node.id).toBeGreaterThanOrEqual(node.minWidth);
      expect(box.height, node.id).toBeGreaterThanOrEqual(node.header + 30);
      expect(node.minWidth, node.id).toBeGreaterThan(150 + 2 * 18);
    }
  });

  it('LAYOUT-303 puts people and outside systems on the top rank of their container', async () => {
    const nodes = elkNodes(elkGraph(SERVICES));
    expect(RIM_OPTIONS).toEqual({ 'elk.layered.layering.layerConstraint': 'FIRST' });
    expect(nodes.get('user')?.layoutOptions).toEqual(RIM_OPTIONS);
    expect(nodes.get('texas')?.layoutOptions).toEqual(RIM_OPTIONS);
    expect(nodes.get('website')?.layoutOptions).toBeUndefined();
    for (const view of ['big-picture', 'services']) {
      const { result } = await layouter(LOTTO).structure(view, DEFAULT_ZOOM);
      const { user, texas, suite } = result.boxes;
      if (!user || !texas || !suite) throw new Error('user, texas and suite are drawn');
      // One rank: the two overlap down the page, and both lie above the system.
      expect(Math.max(user.y, texas.y)).toBeLessThan(
        Math.min(user.y + user.height, texas.y + texas.height),
      );
      expect(Math.max(user.y + user.height, texas.y + texas.height)).toBeLessThan(suite.y);
    }
  });

  it('LAYOUT-303 constrains only the first of two rim elements an edge joins in one container', async () => {
    const joined = semanticsOf(
      [
        'model j: Joined',
        'buyer: Buyer [person]',
        'bank: Bank [external]',
        'clerk: Clerk [person]',
        '  desk: Desk',
        'shop: Shop',
        '  courier: Courier [external]',
        '  till: Till',
        'buyer pays through bank',
        'bank pays out to desk',
        'courier delivers to buyer',
        'courier reads till',
      ].join('\n') + '\n',
    );
    const graph = layouter(joined).graph(
      joined.drawing('overview', joined.scope('overview').everythingOpen()),
    );
    // Buyer and Bank are joined directly, Bank and Clerk through Desk: Buyer is first in model
    // order, so Bank is not constrained, and Clerk, joined only to Bank, is. Courier is the only
    // rim element inside Shop; its edge to Buyer joins Shop and Buyer, not two rim elements.
    expect([...topRank(graph)]).toEqual(['buyer', 'clerk', 'courier']);
    const sent = elkNodes(elkGraph(graph));
    expect(sent.get('bank')?.layoutOptions).toBeUndefined();
    expect(sent.get('courier')?.layoutOptions).toEqual(RIM_OPTIONS);
    // ELK lays it out, and the joined pair is drawn top to bottom.
    const { result } = await layouter(joined).structure(
      'overview',
      joined.scope('overview').everythingOpen(),
    );
    const buyer = result.boxes['buyer'];
    const bank = result.boxes['bank'];
    if (!buyer || !bank) throw new Error('buyer and bank are drawn');
    expect(buyer.y + buyer.height).toBeLessThan(bank.y);
  });

  it('LAYOUT-304 sends every label with its reserved size, a text and its own placement options', () => {
    const graph = elkGraph(SERVICES);
    const edges = [graph, ...elkNodes(graph).values()].flatMap((node) => node.edges ?? []);
    expect(edges).toHaveLength(SERVICES.edges.length);
    for (const edge of SERVICES.edges) {
      const sent = edges.find((each) => each.id === edge.id);
      expect(sent?.sources).toEqual([edge.source]);
      expect(sent?.targets).toEqual([edge.target]);
      expect(sent?.layoutOptions).toBeUndefined();
      expect(sent?.labels).toEqual([
        {
          text: edge.id,
          width: edge.label.width,
          height: edge.label.height,
          layoutOptions: LABEL_OPTIONS,
        },
      ]);
    }
    expect(LABEL_OPTIONS).toEqual({ 'elk.edgeLabels.placement': 'CENTER' });
  });

  it('LAYOUT-305 pins elkjs to an exact version, unpatched, with its licence and source in the notices', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    const pinned = pkg.dependencies['elkjs'] ?? '';
    expect(pinned).toMatch(/^\d+\.\d+\.\d+$/);
    const lock = JSON.parse(read('package-lock.json')) as {
      packages: Record<string, { version: string }>;
    };
    expect(lock.packages['node_modules/elkjs']?.version).toBe(pinned);
    const installed = JSON.parse(read('node_modules/elkjs/package.json')) as { version: string };
    expect(installed.version).toBe(pinned);
    // Never patched: no patch tooling and no patches folder.
    expect(existsSync(join(ROOT, 'patches'))).toBe(false);
    expect(read('package.json')).not.toMatch(/patch-package|postinstall/);
    const notices = read('THIRD_PARTY_NOTICES.md');
    expect(notices).toContain(`elkjs ${pinned}`);
    expect(notices).toContain('Eclipse Public License - v 2.0');
    expect(notices).toContain('https://github.com/kieler/elkjs');
    expect(notices).toContain('https://www.eclipse.org/legal/epl-2.0/');
  });

  it('LAYOUT-306 starts from the configuration the spec lists, so changing it is a deliberate spec change', () => {
    expect(ROOT_OPTIONS).toEqual(specOptions());
    expect(Object.keys(specOptions())).toHaveLength(13);
  });
});

describe('reading routes back', () => {
  const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
  const user = box(103, 12, 200, 60);
  const website = box(103.33, 218, 200, 60);

  it('LAYOUT-006 straightens sub-pixel jogs so routes stay horizontal and vertical, ends on their boxes', () => {
    // One straight run that ELK bent by a third of a pixel at a container border.
    expect(
      straighten(
        [
          { x: 203, y: 72 },
          { x: 203.33, y: 153 },
          { x: 203.33, y: 218 },
        ],
        user,
        website,
      ),
    ).toEqual([
      { x: 203, y: 72 },
      { x: 203, y: 218 },
    ]);
    // A jog next to the end: the inner point moves, the end stays on its box.
    expect(
      straighten(
        [
          { x: 10, y: 0 },
          { x: 10, y: 50 },
          { x: 60.4, y: 50 },
          { x: 60, y: 100 },
        ],
        box(0, -20, 20, 20),
        box(40, 100, 40, 20),
      ),
    ).toEqual([
      { x: 10, y: 0 },
      { x: 10, y: 50 },
      { x: 60, y: 50 },
      { x: 60, y: 100 },
    ]);
    // A jog in the middle: the later point follows the earlier one.
    expect(
      straighten(
        [
          { x: 0, y: 0 },
          { x: 0, y: 10 },
          { x: 30, y: 10 },
          { x: 30.5, y: 40 },
          { x: 80, y: 40 },
          { x: 80, y: 60 },
        ],
        box(-10, -10, 20, 10),
        box(70, 60, 20, 10),
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 30, y: 10 },
      { x: 30, y: 40 },
      { x: 80, y: 40 },
      { x: 80, y: 60 },
    ]);
    // A bend a fraction of a pixel from the end is merged into it.
    expect(
      straighten(
        [
          { x: 0, y: 0 },
          { x: 0, y: 50 },
          { x: 0.4, y: 50.3 },
        ],
        box(-10, -10, 20, 10),
        box(-10, 50.3, 20, 10),
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 50.3 },
    ]);
    // Real corners are kept as they are.
    const corners = [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 20 },
    ];
    expect(straighten(corners, box(-5, -5, 10, 5), box(5, 20, 10, 5))).toEqual(corners);
  });
});
