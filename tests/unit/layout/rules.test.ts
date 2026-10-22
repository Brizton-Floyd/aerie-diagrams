// The rule checks themselves (docs/spec/layout.md, RULE-001 to RULE-011): each one passes a good
// layout and catches the fault it names when a layout is broken on purpose. The rules suite then
// runs them over every sample.
import { describe, expect, it } from 'vitest';
import { DEFAULT_ZOOM } from '../../../src/model/index.ts';
import {
  ROLES,
  checkLanes,
  checkStructure,
  crossesInside,
  onOutline,
  overlaps,
  placeLanesText,
  placeText,
  textLargeEnough,
  type Finding,
  type LanesLayout,
  type StructureLayout,
} from '../../../src/layout/index.ts';
import { LOTTO, layouter } from './helpers.ts';

const lay = layouter(LOTTO);
const SERVICES = await lay.structure('services', DEFAULT_ZOOM);
const LANES_LAYOUT = await lay.lanes('generate-picks', 'big-picture', DEFAULT_ZOOM);

/** A copy of the Services layout to break. */
const copy = (): StructureLayout => structuredClone(SERVICES);

/** The rule checks of a structure layout, with every audience's text placed in it. */
function check(layout: StructureLayout): Finding[] {
  const texts = layout.wordings.map((wording) => placeText(layout.result, wording));
  return checkStructure(LOTTO, layout, texts);
}

const rules = (findings: Finding[]): string[] => [...new Set(findings.map((each) => each.rule))];

function box(
  layout: StructureLayout,
  id: string,
): { x: number; y: number; width: number; height: number } {
  const found = layout.result.boxes[id];
  if (found === undefined) throw new Error(`${id} has no box`);
  return found;
}

describe('geometry', () => {
  it('RULE-001 tells overlapping boxes from boxes that only touch, within 0.5 px', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(overlaps(a, { x: 9, y: 9, width: 10, height: 10 })).toBe(true);
    expect(overlaps(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    expect(overlaps(a, { x: 9.6, y: 0, width: 10, height: 10 })).toBe(false);
    expect(overlaps(a, { x: 20, y: 20, width: 1, height: 1 })).toBe(false);
  });

  it('RULE-006 finds a point on a box outline, within 0.5 px', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(onOutline({ x: 5, y: 0 }, a)).toBe(true);
    expect(onOutline({ x: 10.4, y: 5 }, a)).toBe(true);
    expect(onOutline({ x: 5, y: 5 }, a)).toBe(false);
    expect(onOutline({ x: 5, y: 11 }, a)).toBe(false);
  });

  it('RULE-007 finds a segment through the inside of a box, not one along its side', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(crossesInside({ x: 5, y: -5 }, { x: 5, y: 15 }, a)).toBe(true);
    expect(crossesInside({ x: 0, y: -5 }, { x: 0, y: 15 }, a)).toBe(false);
    expect(crossesInside({ x: -5, y: 5 }, { x: -1, y: 5 }, a)).toBe(false);
    expect(crossesInside({ x: 2, y: 2 }, { x: 3, y: 3 }, a)).toBe(true);
  });
});

describe('structure rule checks', () => {
  it('RULE-001 to RULE-007 pass a good layout', () => {
    expect(check(SERVICES)).toEqual([]);
  });

  it('RULE-001 catches two boxes that overlap', () => {
    const layout = copy();
    layout.result.boxes['texas'] = { ...box(layout, 'user') };
    const findings = check(layout).filter((each) => each.rule === 'RULE-001');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toMatch(/^user .* overlaps texas/);
  });

  it('RULE-002 catches a child outside its parent or in its header', () => {
    const layout = copy();
    const suite = box(layout, 'suite');
    layout.result.boxes['website'] = { ...box(layout, 'website'), y: suite.y + 5 };
    expect(check(layout).find((each) => each.rule === 'RULE-002')?.message).toMatch(
      /^website .* is not inside suite/,
    );
    const outside = copy();
    outside.result.boxes['saved-draws'] = { ...box(outside, 'saved-draws'), x: -500 };
    expect(rules(check(outside))).toContain('RULE-002');
  });

  it('RULE-003 catches a name, tagline or label that does not fit its space', () => {
    const narrow = copy();
    narrow.result.boxes['website'] = { ...box(narrow, 'website'), width: 120 };
    const findings = check(narrow).filter((each) => each.rule === 'RULE-003');
    // Every audience's text is checked: the engineer's tagline is the widest.
    expect(
      findings.some((each) => each.message.startsWith('engineer: "lotto-options-ui, Angular 21"')),
    ).toBe(true);
    expect(findings.some((each) => each.message.startsWith('exec: '))).toBe(true);
    const short = copy();
    short.result.boxes['website'] = { ...box(short, 'website'), height: 30 };
    expect(rules(check(short))).toContain('RULE-003');
    const label = copy();
    const edge = label.result.edges['website->screen-api'];
    if (edge === undefined) throw new Error('website->screen-api is drawn');
    edge.label = { ...edge.label, width: 20 };
    expect(check(label).find((each) => each.rule === 'RULE-003')?.message).toMatch(
      /label line .* does not fit the label of website->screen-api/,
    );
  });

  it('RULE-004 catches a label that meets a box, a header or another label', () => {
    const onBox = copy();
    const edge = onBox.result.edges['user->website'];
    if (edge === undefined) throw new Error('user->website is drawn');
    edge.label = { ...edge.label, x: box(onBox, 'texas').x, y: box(onBox, 'texas').y };
    expect(
      check(onBox).some((each) => each.rule === 'RULE-004' && each.message.includes('meets texas')),
    ).toBe(true);
    const onHeader = copy();
    const header = onHeader.result.edges['user->website'];
    const suite = box(onHeader, 'suite');
    if (header === undefined) throw new Error('user->website is drawn');
    header.label = {
      ...header.label,
      x: suite.x + suite.width - header.label.width - 2,
      y: suite.y + 2,
    };
    expect(check(onHeader).some((each) => each.message.includes('meets the header of suite'))).toBe(
      true,
    );
    const onLabel = copy();
    const one = onLabel.result.edges['user->website'];
    const two = onLabel.result.edges['website->screen-api'];
    if (one === undefined || two === undefined) throw new Error('both edges are drawn');
    two.label = { ...one.label };
    expect(
      check(onLabel).some((each) =>
        each.message.includes('meets the label of website->screen-api'),
      ),
    ).toBe(true);
  });

  it('RULE-006 catches a missing route, a route off its ends, and a carried relationship with no edge', () => {
    const missing = copy();
    delete missing.result.edges['updater->reader'];
    const findings = check(missing).filter((each) => each.rule === 'RULE-006');
    expect(findings.map((each) => each.message)).toEqual([
      'updater->reader has no route of two or more points',
      'relationship 9 (updater to reader) has no edge updater->reader',
    ]);
    const off = copy();
    const edge = off.result.edges['website->screen-api'];
    if (edge === undefined) throw new Error('website->screen-api is drawn');
    edge.points = edge.points.map((at) => ({ x: at.x + 300, y: at.y }));
    expect(
      check(off)
        .filter((each) => each.rule === 'RULE-006')
        .map((each) => each.message),
    ).toEqual([
      'website->screen-api does not start on website',
      'website->screen-api does not end on screen-api',
    ]);
    const lost = copy();
    delete lost.result.boxes['legacy'];
    expect(rules(check(lost))).toContain('LAYOUT-006');
  });

  it('RULE-007 catches a line through a box or an unrelated header', () => {
    const through = copy();
    const edge = through.result.edges['user->website'];
    const texas = box(through, 'texas');
    if (edge === undefined) throw new Error('user->website is drawn');
    const [start, end] = [edge.points[0], edge.points.at(-1)];
    if (start === undefined || end === undefined) throw new Error('a route has ends');
    edge.points = [
      start,
      { x: start.x, y: texas.y + 10 },
      { x: texas.x + texas.width + 5, y: texas.y + 10 },
      { x: texas.x + texas.width + 5, y: end.y },
      end,
    ];
    expect(
      check(through).some(
        (each) => each.rule === 'RULE-007' && each.message.includes('crosses texas'),
      ),
    ).toBe(true);
    const header = copy();
    const inner = header.result.edges['updater->reader'];
    const engine = box(header, 'engine');
    if (inner === undefined) throw new Error('updater->reader is drawn');
    const from = inner.points[0];
    if (from === undefined) throw new Error('a route has ends');
    inner.points = [
      from,
      { x: from.x, y: engine.y + 5 },
      { x: engine.x + 30, y: engine.y + 5 },
      ...inner.points.slice(1),
    ];
    expect(
      check(header).some((each) => each.message.includes('crosses the header of engine')),
    ).toBe(true);
  });

  it('LAYOUT-006 catches a label far from its route', () => {
    const far = copy();
    const edge = far.result.edges['user->website'];
    if (edge === undefined) throw new Error('user->website is drawn');
    edge.label = { ...edge.label, x: edge.label.x - 40 };
    expect(check(far).find((each) => each.rule === 'LAYOUT-006')?.message).toMatch(
      /^the label of user->website .* px from its route$/,
    );
  });

  it('LAYOUT-006 catches a label lying on its own route', () => {
    const on = copy();
    const edge = on.result.edges['user->website'];
    const [a, b] = edge?.points ?? [];
    if (edge === undefined || a === undefined || b === undefined)
      throw new Error('user->website is drawn');
    const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    edge.label = {
      ...edge.label,
      x: middle.x - edge.label.width / 2,
      y: middle.y - edge.label.height / 2,
    };
    expect(check(on).find((each) => each.rule === 'LAYOUT-006')?.message).toMatch(
      /^the label of user->website .* lies on its route$/,
    );
  });

  it('RULE-008 holds every text role at 13.5 px or more and catches a smaller one', () => {
    expect(textLargeEnough()).toEqual([]);
    expect(textLargeEnough({ ...ROLES, tiny: { ...ROLES.label, size: 12 } })).toEqual([
      { rule: 'RULE-008', message: 'the tiny role is 12 px, below 13.5 px' },
    ]);
  });
});

describe('lanes rule checks', () => {
  const lanesCopy = (): LanesLayout => structuredClone(LANES_LAYOUT);
  const lanesCheck = (lanes: LanesLayout): Finding[] =>
    checkLanes(
      lanes,
      LOTTO.model.audiences.map((audience) => placeLanesText(lanes, audience.id)),
      14,
    );

  it('RULE-010 and RULE-011 pass a good lanes layout', () => {
    expect(lanesCheck(LANES_LAYOUT)).toEqual([]);
  });

  it('RULE-010 catches overlapping headers and rows, and labels that do not fit', () => {
    const headers = lanesCopy();
    const [first, second] = headers.lanes;
    if (first === undefined || second === undefined) throw new Error('two lanes at least');
    second.header = { ...second.header, x: first.header.x + 10 };
    expect(
      lanesCheck(headers).some((each) => each.message.includes(`header of ${first.id} overlaps`)),
    ).toBe(true);
    const rows = lanesCopy();
    const row = rows.rows[3];
    if (row === undefined) throw new Error('fourteen rows');
    row.top -= 20;
    expect(
      lanesCheck(rows).some((each) => each.message === 'row 4 overlaps the row above it'),
    ).toBe(true);
    const wide = lanesCopy();
    const label = wide.rows[0];
    if (label === undefined) throw new Error('fourteen rows');
    label.label = { ...label.label, x: wide.width };
    expect(
      lanesCheck(wide).some(
        (each) => each.message === 'the label of step 1 does not fit between its lanes',
      ),
    ).toBe(true);
    const narrow = lanesCopy();
    const header = narrow.lanes[0];
    if (header === undefined) throw new Error('lanes');
    header.header = { ...header.header, width: 60 };
    expect(
      lanesCheck(narrow).some((each) =>
        each.message.includes(`does not fit the header of ${header.id}`),
      ),
    ).toBe(true);
  });

  it('RULE-011 catches a step with no arrow or loop', () => {
    const missing = lanesCopy();
    missing.rows.splice(2, 1);
    expect(lanesCheck(missing)).toContainEqual({
      rule: 'RULE-011',
      message: '13 rows for 14 steps',
    });
    const bent = lanesCopy();
    const row = bent.rows[0];
    if (row === undefined) throw new Error('fourteen rows');
    row.points = [row.points[0] ?? { x: 0, y: 0 }];
    expect(lanesCheck(bent).some((each) => each.rule === 'RULE-011')).toBe(true);
  });
});
