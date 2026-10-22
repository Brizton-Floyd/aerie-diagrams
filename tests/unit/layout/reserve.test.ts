// Box and label sizes and the audience space reserve (docs/spec/layout.md, LAYOUT-201 to
// LAYOUT-205). The small model below gives its `dev` audience code-voice wording, where every
// character is 8.1 px, so the expected sizes can be worked out by hand.
import { describe, expect, it } from 'vitest';
import { DEFAULT_ZOOM } from '../../../src/model/index.ts';
import {
  BOX,
  ROLES,
  chipText,
  layoutGraph,
  measure,
  placeText,
  type LayoutNode,
} from '../../../src/layout/index.ts';
import { LOTTO, layouter, semanticsOf } from './helpers.ts';

const x = (count: number): string => 'x'.repeat(count);
const y = (count: number): string => 'y'.repeat(count);

const RESERVE = semanticsOf(
  [
    'model m: Reserve',
    'audiences plain "Plain" (default), dev "Dev" (code)',
    '',
    'a: A | x',
    `  @dev: | ${x(28)}`,
    'b: B',
    `  @dev: | ${x(29)}`,
    'c: C',
    'box: Box',
    '  p: P',
    '  q: Q',
    '',
    'a calls b',
    `  @dev: ${y(29)}`,
    'b calls c',
    `  @dev: ${y(30)}`,
    'a reads p',
    'a writes q',
    '',
    'view v: V',
    '  show a, b, c, box',
  ].join('\n') + '\n',
);

/** The layout graph node of an element in the view at a zoom state. */
function node(id: string, zoom = DEFAULT_ZOOM): LayoutNode {
  const found = layouter(RESERVE)
    .graph(RESERVE.drawing('v', zoom))
    .nodes.find((each) => each.id === id);
  if (found === undefined) throw new Error(`${id} is not drawn`);
  return found;
}

const TEXT_LEFT = 12 + 22 + 10;

describe('box sizes', () => {
  it('LAYOUT-202 sizes a leaf for its widest text and most tagline lines over every audience', () => {
    // 28 code characters are 227 px on one line: 12 + 22 + 10 + 227 + 12 wide.
    expect(node('a')).toMatchObject({
      open: false,
      width: TEXT_LEFT + 227 + 12,
      height: 24 + 18 + 17,
    });
    // 29 code characters wrap onto two lines of at most 227 px.
    expect(node('b')).toMatchObject({
      open: false,
      width: TEXT_LEFT + 227 + 12,
      height: 24 + 18 + 34,
    });
    // No tagline in any audience: the content is the icon, and the box is at least 150 wide.
    expect(node('c')).toMatchObject({ open: false, width: 150, height: 24 + 22 });
  });

  it('LAYOUT-202 adds the control and the chip line to a closed container', () => {
    const chip = measure(chipText(2), ROLES.chip);
    expect(chipText(1)).toBe('1 part inside');
    expect(chipText(2)).toBe('2 parts inside');
    const closed = RESERVE.scope('v').close(DEFAULT_ZOOM, 'box');
    expect(node('box', closed)).toMatchObject({
      open: false,
      width: Math.max(150, TEXT_LEFT + chip + 18 + 10 + 12),
      height: 24 + 22 + 20,
    });
  });

  it('LAYOUT-202 gives an open container a header and a narrowest width', () => {
    const name = measure('Box', ROLES.name);
    expect(node('box', RESERVE.scope('v').open(DEFAULT_ZOOM, 'box'))).toMatchObject({
      open: true,
      minWidth: TEXT_LEFT + name + 18 + 10 + 12,
      header: 12 + 22 + 6,
    });
    // With taglines, the header grows by a line for each: the engineer reads "Runs as one stack on
    // one machine" in the code voice, 33 characters, which wrap onto two lines.
    const lotto = layouter(LOTTO).graph(LOTTO.drawing('services'));
    const suite = lotto.nodes.find((each) => each.id === 'suite');
    expect(suite).toMatchObject({ open: true, header: 12 + 18 + 2 * 17 + 6 });
  });
});

describe('label sizes', () => {
  it('LAYOUT-203 reserves a label box padded around the widest and most lines of any audience', () => {
    const graph = layouter(RESERVE).graph(RESERVE.drawing('v'));
    const label = (id: string): { width: number; height: number } | undefined =>
      graph.edges.find((edge) => edge.id === id)?.label;
    // 29 code characters are 235 px, within the 240 px label width.
    expect(label('a->b')).toEqual({ width: 235 + 10, height: 17 + 4 });
    // 30 wrap onto two lines; the widest line is 29 characters.
    expect(label('b->c')).toEqual({ width: 235 + 10, height: 34 + 4 });
    // Two relationships merged into one edge: the first verb and " (+1 more)", in either face.
    const merged = 'reads (+1 more)';
    const widest = Math.max(measure(merged, ROLES.label), measure(merged, ROLES.labelCode));
    expect(label('a->box')).toEqual({ width: widest + 10, height: 17 + 4 });
    // Opened, the two relationships are two edges with their own labels.
    const open = layouter(RESERVE).graph(
      RESERVE.drawing('v', RESERVE.scope('v').open(DEFAULT_ZOOM, 'box')),
    );
    expect(open.edges.map((edge) => edge.id)).toEqual(['a->b', 'b->c', 'a->p', 'a->q']);
    expect(open.edges.find((edge) => edge.id === 'a->p')?.label).toEqual({
      width: Math.max(measure('reads', ROLES.label), measure('reads', ROLES.labelCode)) + 10,
      height: 17 + 4,
    });
  });
});

describe('the reserve', () => {
  it('LAYOUT-201 sizes every box and label for the largest wording, so switching audience moves nothing', async () => {
    const lay = layouter(LOTTO);
    let differ = 0;
    for (const view of ['big-picture', 'services', 'engineering']) {
      const drawing = LOTTO.drawing(view);
      const graph = lay.graph(drawing);
      // Graphs sized for one audience alone: the reserve is the largest of them, every time.
      const alone = lay.wordings(drawing).map((wording) => layoutGraph(drawing, [wording]));
      graph.nodes.forEach((each, index) => {
        const sizes = alone.map((one) => one.nodes[index]);
        const most = (pick: (size: LayoutNode) => number): number =>
          Math.max(...sizes.map((size) => (size === undefined ? 0 : pick(size))));
        const width = (size: LayoutNode): number => (size.open ? size.minWidth : size.width);
        const height = (size: LayoutNode): number => (size.open ? size.header : size.height);
        expect(width(each)).toBe(most(width));
        expect(height(each)).toBe(most(height));
        if (new Set(sizes.map((size) => size && width(size))).size > 1) differ += 1;
      });
      graph.edges.forEach((edge, index) => {
        const labels = alone.map((one) => one.edges[index]?.label ?? { width: 0, height: 0 });
        expect(edge.label.width).toBe(Math.max(...labels.map((label) => label.width)));
        expect(edge.label.height).toBe(Math.max(...labels.map((label) => label.height)));
      });
      // Switching audience: the same graph and the same result for every audience.
      const pictures = await Promise.all(
        LOTTO.model.audiences.map((audience) => lay.picture(view, DEFAULT_ZOOM, audience.id)),
      );
      for (const picture of pictures) {
        expect(picture.graph).toEqual(graph);
        expect(picture.result).toEqual(pictures[0]?.result);
      }
    }
    // The audiences' wording really differs, so the reserve is doing work.
    expect(differ).toBeGreaterThan(3);
  });

  it('LAYOUT-204 puts box text from the left at pad + icon + iconGap and centres label text', async () => {
    const closed = RESERVE.scope('v').close(DEFAULT_ZOOM, 'box');
    const layout = await layouter(RESERVE).structure('v', closed);
    const [plain, dev] = layout.wordings;
    if (plain === undefined || dev === undefined) throw new Error('two audiences expected');
    const a = layout.result.boxes['a'];
    const box = layout.result.boxes['box'];
    if (a === undefined || box === undefined) throw new Error('a and box are drawn');
    const text = placeText(layout.result, dev);
    expect(text.audience).toBe('dev');
    expect(text.boxes['a']?.name).toEqual({
      text: 'A',
      role: 'name',
      x: a.x + 44,
      y: a.y + 12,
      width: measure('A', ROLES.name),
      height: 18,
    });
    expect(text.boxes['a']?.tagline).toEqual([
      { text: x(28), role: 'taglineCode', x: a.x + 44, y: a.y + 30, width: 227, height: 17 },
    ]);
    expect(text.boxes['b']?.tagline.map((line) => line.text)).toEqual([x(28), 'x']);
    expect(text.boxes['b']?.tagline[1]?.y).toBe((layout.result.boxes['b']?.y ?? 0) + 12 + 18 + 17);
    // The chip sits on the last line of a closed container.
    expect(text.boxes['box']?.chip).toMatchObject({
      text: '2 parts inside',
      role: 'chip',
      x: box.x + 44,
      y: box.y + box.height - 12 - 20,
    });
    // The plain audience reads the same places in its own face.
    expect(placeText(layout.result, plain).boxes['a']?.tagline).toEqual([
      {
        text: 'x',
        role: 'tagline',
        x: a.x + 44,
        y: a.y + 30,
        width: measure('x', ROLES.tagline),
        height: 17,
      },
    ]);
    // Label text is centred in its label box, across and down.
    const label = layout.result.edges['b->c']?.label;
    if (label === undefined) throw new Error('b->c is drawn');
    const plainLabel = placeText(layout.result, plain).labels['b->c'];
    const calls = measure('calls', ROLES.label);
    expect(plainLabel).toEqual([
      {
        text: 'calls',
        role: 'label',
        x: label.x + (label.width - calls) / 2,
        y: label.y + (label.height - 17) / 2,
        width: calls,
        height: 17,
      },
    ]);
    expect(
      placeText(layout.result, dev).labels['b->c']?.map((line) => [line.text, line.y]),
    ).toEqual([
      [y(29), label.y + 2],
      ['y', label.y + 2 + 17],
    ]);
  });

  it('LAYOUT-205 measures each text role in one face and size, whatever state it is drawn in', async () => {
    // The layout takes a view, a zoom state and an audience, and nothing about selection, hover,
    // focus or playback; every placed line is as wide as its role measures it.
    const picture = await layouter(LOTTO).picture('services', DEFAULT_ZOOM, 'engineer');
    const lines = [
      ...Object.values(picture.text.boxes).flatMap((box) => [
        box.name,
        ...box.tagline,
        ...(box.chip === null ? [] : [box.chip]),
      ]),
      ...Object.values(picture.text.labels).flat(),
    ];
    expect(lines.length).toBeGreaterThan(20);
    for (const line of lines) {
      expect(line.width).toBe(measure(line.text, ROLES[line.role]));
      expect(line.height).toBe(ROLES[line.role].line);
    }
    expect(new Set(Object.values(ROLES).map((role) => typeof role.face))).toEqual(
      new Set(['string']),
    );
    expect(BOX.labelLine).toBe(ROLES.label.line);
  });
});
