// The drawing code of the Contour renderer (docs/spec/look.md): type, box anatomy, shapes, icons,
// relationships, and the selection and focus marks.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ICON_NAMES } from '../../../src/lines/index.ts';
import { DEFAULT_ZOOM } from '../../../src/model/index.ts';
import { BOX, ROLES, TEXT_LEFT } from '../../../src/layout/index.ts';
import {
  DRAWN,
  BADGE_TEXT,
  ICONS,
  ICON_GRID,
  TEXTURE,
  chevron,
  classes,
  contourStyle,
  cornerOf,
  emphasis,
  font,
  roundedRoute,
  textOf,
  toMarkup,
  walk,
  type SvgNode,
} from '../../../src/render/index.ts';
import {
  LOTTO,
  SHAPES,
  child,
  draw,
  group,
  layouter,
  read,
  semanticsOf,
  translation,
  withClass,
} from './helpers.ts';

const ROOT = join(import.meta.dirname, '../../..');
const css = contourStyle();

/** The declarations of the stylesheet rule for an exact selector. */
function rule(selector: string): string {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`No rule for ${selector}.`);
  return css.slice(at + selector.length + 2, css.indexOf('}', at)).trim();
}

const texts = (root: SvgNode): SvgNode[] => [...walk(root)].filter((node) => node.tag === 'text');

describe('type', () => {
  it('LOOK-101 draws in Source Serif 4, Source Sans 3 and Source Code Pro, bundled and credited', () => {
    expect(font('sans-600', 14)).toBe('600 14px "Source Sans 3", system-ui, sans-serif');
    expect(font('serif-400-italic', 13.5)).toBe(
      'italic 400 13.5px "Source Serif 4", Georgia, serif',
    );
    expect(font('code-400', 13.5)).toBe('400 13.5px "Source Code Pro", ui-monospace, monospace');
    // The page serves the font files itself (main.ts imports them from the Fontsource packages),
    // never from a font service, and the licences ship in the third-party notices.
    const main = read('src/main.ts');
    for (const family of ['source-sans-3', 'source-serif-4', 'source-code-pro']) {
      expect(main).toContain(`import '@fontsource/${family}/`);
    }
    expect(main + read('index.html') + css).not.toMatch(
      /fonts\.googleapis|fonts\.gstatic|https?:\/\//,
    );
    const notices = readFileSync(join(ROOT, 'THIRD_PARTY_NOTICES.md'), 'utf8');
    for (const name of [
      'Source Serif 4',
      'Source Sans 3',
      'Source Code Pro',
      'SIL Open Font License 1.1',
    ]) {
      expect(notices).toContain(name);
    }
  });

  it('LOOK-101 the type scale: each drawn role in its face, size and colour', () => {
    expect(rule('.aerie .t-name')).toBe(`font: ${font('sans-600', 14)}; fill: var(--aerie-ink);`);
    expect(rule('.aerie .t-tagline')).toBe(
      `font: ${font('serif-400', 13.5)}; fill: var(--aerie-muted);`,
    );
    expect(rule('.aerie .t-tagline-code')).toBe(
      `font: ${font('code-400', 13.5)}; fill: var(--aerie-muted);`,
    );
    expect(rule('.aerie .t-chip')).toBe(
      `font: ${font('serif-400-italic', 13.5)}; fill: var(--aerie-accent-ink);`,
    );
    expect(rule('.aerie .t-label')).toBe(
      `font: ${font('serif-400-italic', 13.5)}; fill: var(--aerie-ink);`,
    );
    expect(rule('.aerie .t-label-code')).toBe(
      `font: ${font('code-400', 13.5)}; fill: var(--aerie-ink);`,
    );
    expect(rule('.aerie .t-band')).toBe(`font: ${font('sans-600', 13.5)}; fill: var(--aerie-ink);`);
    // LAYOUT-102: drawn as measured, with kerning and ligatures off.
    expect(rule('.aerie text')).toContain('font-kerning: none; font-variant-ligatures: none;');
  });

  it('LOOK-102 the code audience reads taglines and labels in Source Code Pro; names stay in Source Sans 3', async () => {
    const engineer = await draw(LOTTO, 'services', 'engineer');
    const manager = await draw(LOTTO, 'services', 'manager');
    const roles = (root: SvgNode): Set<string> =>
      new Set(texts(root).map((node) => String(node.attrs['class'])));
    expect([...roles(engineer)].sort()).toEqual([
      't-chip',
      't-label-code',
      't-name',
      't-tagline-code',
    ]);
    expect([...roles(manager)].sort()).toEqual(['t-chip', 't-label', 't-name', 't-tagline']);
    const website = group(engineer, 'node', 'website');
    expect(texts(website).map(textOf)).toEqual(['Website', 'lotto-options-ui, Angular 21']);
  });

  it('LOOK-103 all wording is at least 13.5 px; only the step badge number is smaller', () => {
    for (const role of Object.values(DRAWN)) expect(role.size).toBeGreaterThanOrEqual(13.5);
    expect(BADGE_TEXT.size).toBe(11);
    expect(BADGE_TEXT.currentSize).toBe(13);
    expect(rule('.aerie .t-badge')).toBe(
      'font: 600 11px "Source Serif 4", Georgia, serif; fill: var(--aerie-accent-ink); text-anchor: middle;',
    );
  });
});

describe('box anatomy', () => {
  it('LOOK-201 text starts at pad + icon + iconGap, the name baseline 14 below the first line, the icon at (pad, pad)', async () => {
    const root = await draw(LOTTO, 'big-picture', 'manager');
    const website = group(root, 'node', 'website');
    const [name, tagline] = texts(website);
    expect(TEXT_LEFT).toBe(44);
    expect(name?.attrs).toMatchObject({ class: 't-name', x: 44, y: BOX.pad + 14 });
    expect(tagline?.attrs).toMatchObject({ x: 44, y: BOX.pad + BOX.nameLine + 14 });
    expect(child(website, 'icon').attrs['transform']).toBe('translate(12 12) scale(0.34375)');
    expect(ROLES.name.line).toBe(BOX.nameLine);
  });

  it('LOOK-202 a closed container ends with the chip, "N parts inside", on its last line', async () => {
    const root = await draw(LOTTO, 'big-picture', 'manager');
    const engine = group(root, 'node', 'engine');
    const chip = texts(engine).at(-1);
    const height = Number(child(engine, 'shape').attrs['height']);
    expect(chip?.attrs['class']).toBe('t-chip');
    expect(chip && textOf(chip)).toBe('4 parts inside');
    expect(chip?.attrs['y']).toBe(height - BOX.pad - BOX.chipLine + DRAWN.chip.baseline);
    const shapes = await draw(SHAPES, 'shapes', 'manager');
    expect(
      textOf(texts(group(shapes, 'node', 'shed')).at(-1) ?? group(shapes, 'node', 'shed')),
    ).toBe('2 parts inside');
  });
});

describe('shapes', () => {
  it('LOOK-301 a leaf is a paper card with a 1 px ink outline and 4 px corners', async () => {
    const root = await draw(LOTTO, 'big-picture', 'manager');
    const website = group(root, 'node', 'website');
    expect(classes(website)).toEqual(['node', 'leaf']);
    expect(child(website, 'shape').attrs['rx']).toBe(4);
    expect(rule('.aerie .shape')).toBe(
      'fill: var(--aerie-paper); stroke: var(--aerie-ink); stroke-width: 1px;',
    );
  });

  it('LOOK-302 a closed container: 8 px corners, a solid contour line inset 5 px, the chip and a plus', async () => {
    const root = await draw(LOTTO, 'big-picture', 'manager');
    const engine = group(root, 'node', 'engine');
    expect(classes(engine)).toEqual(['node', 'closed']);
    const shape = child(engine, 'shape');
    expect(shape.attrs['rx']).toBe(8);
    expect(child(engine, 'inner').attrs).toMatchObject({
      x: 5,
      y: 5,
      width: Number(shape.attrs['width']) - 10,
      height: Number(shape.attrs['height']) - 10,
      rx: 3,
    });
    expect(rule('.aerie .inner')).toBe(
      'fill: none; stroke: var(--aerie-contour); stroke-width: 1px;',
    );
    const control = child(engine, 'control');
    expect(control.attrs['transform']).toBe(
      `translate(${String(Number(shape.attrs['width']) - 21)} 21)`,
    );
    expect(child(control, 'circle').attrs['r']).toBe(9);
    expect(child(control, 'path').attrs['d']).toBe('M-4 0H4M0-4V4');
  });

  it('LOOK-303 an open container is a band of its depth with 18 px corners, a dotted inner line and a minus', async () => {
    const root = await draw(SHAPES, 'shapes', 'manager');
    const depths = ['ground', 'ridge', 'crest', 'summit', 'peak'].map((id) =>
      classes(group(root, 'node', id)),
    );
    expect(depths).toEqual([
      ['node', 'open', 'depth-0'],
      ['node', 'open', 'depth-1'],
      ['node', 'open', 'depth-2'],
      ['node', 'open', 'depth-3'],
      ['node', 'open', 'depth-3'],
    ]);
    const ground = group(root, 'node', 'ground');
    expect(child(ground, 'shape').attrs['rx']).toBe(18);
    expect(child(ground, 'inner').attrs['rx']).toBe(13);
    expect(child(child(ground, 'control'), 'path').attrs['d']).toBe('M-4 0H4');
    expect(rule('.aerie .open > .shape')).toBe('stroke: var(--aerie-contour);');
    expect(rule('.aerie .depth-2 > .shape')).toBe('fill: var(--aerie-band-2);');
    expect(rule('.aerie .open > .inner')).toBe(
      'stroke: var(--aerie-contour-soft); stroke-dasharray: 2 3;',
    );
    // Its header text is drawn above the lines, on a halo of its band.
    const head = group(root, 'head', 'ground');
    expect(classes(head)).toEqual(['head', 'depth-0']);
    expect(translation(head)).toEqual(translation(ground));
    expect(texts(head).map(textOf)).toEqual(['Ground', 'An open container at depth 0']);
    expect(texts(ground)).toEqual([]);
    expect(rule('.aerie .head.depth-0 text')).toBe('stroke: var(--aerie-band-0);');
    const layers = root.children.filter((each): each is SvgNode => typeof each !== 'string');
    expect(layers.map((each) => each.attrs['class'] ?? each.tag)).toEqual([
      'defs',
      'boxes',
      'edges',
      'heads',
      'labels',
    ]);
  });

  it('LOOK-304 a person is a pill with a 1.4 px ink outline', async () => {
    const root = await draw(LOTTO, 'big-picture', 'manager');
    const user = group(root, 'node', 'user');
    expect(classes(user)).toEqual(['node', 'leaf', 'person']);
    const height = Number(child(user, 'shape').attrs['height']);
    expect(child(user, 'shape').attrs['rx']).toBe(Math.min(30, height / 2));
    expect(cornerOf({ state: 'leaf', person: true, external: false, depth: 0 }, 100)).toBe(30);
    expect(rule('.aerie .person > .shape')).toBe('stroke-width: 1.4px;');
  });

  it('LOOK-305 an external element is hatched at 45 degrees, 2 px lines every 7 px, with a dashed ink outline', async () => {
    const root = await draw(LOTTO, 'big-picture', 'manager');
    expect(classes(group(root, 'node', 'texas'))).toEqual(['node', 'leaf', 'external']);
    const pattern = [...walk(root)].find((node) => node.tag === 'pattern');
    expect(pattern && toMarkup(pattern)).toBe(
      '<pattern id="aerie-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
        '<rect class="hatch-bg" width="7" height="7"/><path class="hatch-line" d="M0 0V7"/></pattern>',
    );
    expect(rule('.aerie .external > .shape')).toBe(
      'fill: url(#aerie-hatch); stroke: var(--aerie-ink); stroke-dasharray: 5 3;',
    );
    expect(rule('.aerie .hatch-bg')).toBe('fill: var(--aerie-hatch-bg);');
    expect(rule('.aerie .hatch-line')).toBe('stroke: var(--aerie-hatch-line); stroke-width: 2px;');
  });

  it('LOOK-306 hover thickens the outline to 1.6 px; keyboard focus shows a 2 px accent ring 2 px outside', async () => {
    const root = await draw(LOTTO, 'big-picture', 'manager');
    const website = group(root, 'node', 'website');
    const shape = child(website, 'shape');
    expect(child(website, 'ring').attrs).toEqual({
      class: 'ring',
      x: -3,
      y: -3,
      width: Number(shape.attrs['width']) + 6,
      height: Number(shape.attrs['height']) + 6,
      rx: 7,
    });
    expect(rule('.aerie .node:hover > .shape')).toBe('stroke-width: 1.6px;');
    expect(rule('.aerie .ring')).toBe(
      'fill: none; stroke: var(--aerie-accent); stroke-width: 2px; display: none;',
    );
    expect(rule('.aerie .node:has(> .shape:focus-visible) > .ring')).toBe('display: inline;');
  });

  it('LOOK-307 the stage texture is a 520 x 360 tile of six soft curves at 1.2 px that join across its edges', () => {
    expect(TEXTURE.width).toBe(520);
    expect(TEXTURE.height).toBe(360);
    expect(TEXTURE.stroke).toBe(1.2);
    expect(TEXTURE.curves).toHaveLength(6);
    // A curve that crosses the tile starts and ends at the same height, leaving and arriving at
    // the same slope, so neighbouring tiles join without a step.
    for (const curve of TEXTURE.curves.filter((d) => d.startsWith('M0 '))) {
      const numbers = curve.match(/-?[\d.]+/g)?.map(Number) ?? [];
      const [x0 = 0, y0 = 0, c1x = 0, c1y = 0] = numbers;
      const [c2x = 0, c2y = 0, x1 = 0, y1 = 0] = numbers.slice(-4);
      expect([x0, x1]).toEqual([0, 520]);
      expect(y1).toBe(y0);
      expect((c1y - y0) / (c1x - x0)).toBeCloseTo((y1 - c2y) / (x1 - c2x), 6);
    }
    expect(rule('.aerie-stage')).toBe(
      'background-color: var(--aerie-bg); background-image: var(--aerie-texture-tile);',
    );
  });
});

describe('icons', () => {
  it('LOOK-401 icons are stroked line drawings on a 64-unit grid, 4.2 units wide, in ink, round caps and joins', async () => {
    expect(ICON_GRID).toBe(64);
    expect(rule('.aerie .icon')).toBe(
      'fill: none; stroke: var(--aerie-ink); stroke-width: 4.2px; stroke-linecap: round; stroke-linejoin: round;',
    );
    expect(rule('.aerie .icon .dot')).toBe('fill: var(--aerie-ink); stroke: none;');
    // Every coordinate stays on the grid, clear of the stroke's edge.
    for (const [name, shapes] of Object.entries(ICONS)) {
      for (const shape of shapes) {
        const box =
          'rect' in shape
            ? shape.rect
            : 'circle' in shape
              ? shape.circle
              : 'dot' in shape
                ? shape.dot
                : [];
        for (const value of box.slice(0, 2)) expect(value, name).toBeGreaterThanOrEqual(2);
      }
    }
    const root = await draw(LOTTO, 'big-picture', 'manager');
    expect(child(group(root, 'node', 'engine'), 'icon').attrs['data-icon']).toBe('gear');
  });

  it('LOOK-402 the v1 set has a drawing for every icon name, and only those', async () => {
    expect(Object.keys(ICONS)).toEqual([...ICON_NAMES]);
    for (const name of ICON_NAMES) expect(ICONS[name].length, name).toBeGreaterThan(0);
    const root = await draw(SHAPES, 'icon-set', 'manager');
    const drawn = withClass(root, 'icon').map((node) => node.attrs['data-icon']);
    for (const name of ICON_NAMES) expect(drawn, name).toContain(name);
  });
});

describe('relationships', () => {
  it('LOOK-501 a route is a 1.3 px edge stroke with corners rounded to 9 px, ending in a 12 px chevron', async () => {
    expect(
      roundedRoute([
        { x: 0, y: 0 },
        { x: 0, y: 100 },
        { x: 50, y: 100 },
      ]),
    ).toBe('M0 0L0 91Q0 100 9 100L50 100');
    // A segment shorter than 18 px rounds its corners to half its length.
    expect(
      roundedRoute([
        { x: 0, y: 0 },
        { x: 0, y: 50 },
        { x: 10, y: 50 },
        { x: 10, y: 100 },
      ]),
    ).toBe('M0 0L0 45Q0 50 5 50L5 50Q10 50 10 55L10 100');
    expect(chevron({ x: 0, y: 100 }, { x: 0, y: 0 })).toBe('M-5 88L0 100L5 88');
    expect(rule('.aerie .edge .line')).toBe(
      'fill: none; stroke: var(--aerie-edge); stroke-width: 1.3px;',
    );
    expect(rule('.aerie .edge .arrow')).toBe(
      'fill: none; stroke: var(--aerie-edge); stroke-width: 1.6px; stroke-linecap: round; stroke-linejoin: round;',
    );
    const root = await draw(LOTTO, 'big-picture', 'manager');
    const edge = group(root, 'edge', 'website->screen-api');
    expect(
      edge.children.map((each) => (typeof each === 'string' ? each : each.attrs['class'])),
    ).toEqual(['line', 'arrow']);
  });

  it('LOOK-502 a label is its text with no box, italic serif or the code voice, over a 5 px halo', async () => {
    const root = await draw(LOTTO, 'big-picture', 'manager');
    const label = group(root, 'label', 'website->screen-api');
    expect(
      label.children.filter((each) => typeof each !== 'string').map((each) => each.tag),
    ).toEqual(['title', 'text']);
    expect(textOf(child(label, 'text'))).toBe('gets screen data from');
    expect(rule('.aerie .t-label, .aerie .t-label-code')).toBe(
      'stroke: var(--aerie-halo); stroke-width: 5px; stroke-linejoin: round; paint-order: stroke fill;',
    );
  });

  it('LOOK-503 a label carries its full sentence for the hover tooltip, one per carried relationship', async () => {
    const root = await draw(LOTTO, 'big-picture', 'exec');
    expect(textOf(child(group(root, 'label', 'website->screen-api'), 'title'))).toBe(
      'Website works through Website back end.',
    );
    const merged = semanticsOf(
      [
        'shop: Shop',
        '  cart: Cart',
        '  till: Till',
        'bank: Bank',
        'cart asks for prices from bank',
        'till takes payments through bank',
        'view all: All',
        '  show shop, bank',
        '',
      ].join('\n'),
    );
    const mergedRoot = await draw(merged, 'all', 'manager');
    const label = group(mergedRoot, 'label', 'shop->bank');
    expect(textOf(child(label, 'text'))).toBe('asks for prices from (+1 more)');
    expect(textOf(child(label, 'title'))).toBe(
      'Cart asks for prices from Bank.\nTill takes payments through Bank.',
    );
  });
});

describe('selection and focus', () => {
  it('LOOK-601 a selected element is outlined in accent; its lines turn accent and their other ends thicken', async () => {
    const root = await draw(LOTTO, 'big-picture', 'manager', DEFAULT_ZOOM, {
      focus: { kind: 'select', ids: ['screen-api'] },
    });
    expect(classes(group(root, 'node', 'screen-api'))).toContain('sel');
    expect(classes(group(root, 'node', 'website'))).toContain('rel');
    expect(classes(group(root, 'node', 'engine'))).toContain('rel');
    expect(classes(group(root, 'edge', 'website->screen-api'))).toContain('on');
    expect(classes(group(root, 'label', 'website->screen-api'))).toContain('on');
    expect(rule('.aerie .sel > .shape, .aerie .now > .shape')).toBe(
      'stroke: var(--aerie-accent); stroke-width: 2.2px;',
    );
    expect(rule('.aerie .rel > .shape')).toBe('stroke-width: 1.6px;');
    expect(rule('.aerie .edge.on .line')).toBe('stroke: var(--aerie-accent); stroke-width: 1.8px;');
    expect(rule('.aerie .edge.on .arrow')).toBe('stroke: var(--aerie-accent);');
    expect(rule('.aerie .label.on text')).toBe('fill: var(--aerie-accent-ink);');
  });

  it('LOOK-602 containers around keep their text with frames at context; the rest dims and other lines drop to edge-dim', async () => {
    const root = await draw(LOTTO, 'big-picture', 'manager', DEFAULT_ZOOM, {
      focus: { kind: 'select', ids: ['screen-api'] },
    });
    expect(classes(group(root, 'node', 'suite'))).toContain('context');
    expect(classes(group(root, 'head', 'suite'))).toContain('context');
    expect(classes(group(root, 'node', 'user'))).toContain('dim');
    expect(classes(group(root, 'edge', 'user->website'))).toContain('dim');
    expect(
      rule('.aerie .context > .shape, .aerie .context > .inner, .aerie .context > .control'),
    ).toBe('opacity: 0.55;');
    expect(rule('.aerie .node.dim > *')).toBe('opacity: 0.2;');
    expect(rule('.aerie .edge.dim')).toBe('opacity: 0.14;');
    // Elements inside the selected element keep full strength.
    const drawing = LOTTO.drawing('big-picture', LOTTO.scope('big-picture').everythingOpen());
    const marks = emphasis(LOTTO.tree, drawing, { kind: 'select', ids: ['engine'] });
    expect(marks.nodes.get('engine')).toBe('sel');
    expect(marks.nodes.get('pick-generation')).toBe('full');
    expect(marks.nodes.get('suite')).toBe('context');
  });

  it('LOOK-603 walkthrough focus looks like selection, on every focused element at once', () => {
    const drawing = LOTTO.drawing('big-picture');
    const marks = emphasis(LOTTO.tree, drawing, { kind: 'select', ids: ['website', 'store'] });
    expect(marks.nodes.get('website')).toBe('sel');
    expect(marks.nodes.get('store')).toBe('sel');
    expect(marks.nodes.get('screen-api')).toBe('rel');
    expect(marks.nodes.get('suite')).toBe('context');
    expect(marks.edges.get('website->screen-api')).toBe('on');
    const none = emphasis(LOTTO.tree, drawing, { kind: 'none' });
    expect(new Set(none.nodes.values())).toEqual(new Set(['plain']));
    expect(new Set(none.edges.values())).toEqual(new Set(['plain']));
  });
});

describe('selecting a container', () => {
  it('INT-202 the lines of a selected container are every drawn edge with an end in it or inside it', async () => {
    // In Services the Analysis engine is open: its lines run to and from what is drawn inside it.
    const root = await draw(LOTTO, 'services', 'manager', DEFAULT_ZOOM, {
      focus: { kind: 'select', ids: ['engine'] },
    });
    const drawing = LOTTO.drawing('services');
    const inside = (id: string): boolean => id === 'engine' || LOTTO.tree.contains('engine', id);
    const lines = drawing.edges.filter((edge) => inside(edge.source) || inside(edge.target));
    expect(lines.length).toBeGreaterThan(1);
    for (const edge of drawing.edges) {
      const on = lines.includes(edge);
      expect(classes(group(root, 'edge', edge.id)), edge.id).toContain(on ? 'on' : 'dim');
    }
    // The other ends outside it are related; the elements inside it keep full strength.
    expect(classes(group(root, 'node', 'screen-api'))).toContain('rel');
    expect(classes(group(root, 'node', 'engine-service'))).toContain('full');
    expect(classes(group(root, 'node', 'user'))).toContain('dim');
  });
});

describe('the page a reader explores', () => {
  /** The button a box is on the page: its outline. */
  const button = (root: SvgNode, id: string): SvgNode => child(group(root, 'node', id), 'shape');

  it('INT-901 and INT-903 every box can be focused in model order and is announced with its name and tagline', async () => {
    const root = await draw(LOTTO, 'services', 'engineer', DEFAULT_ZOOM, {
      interactive: true,
      focus: { kind: 'select', ids: ['website'] },
    });
    expect(root.attrs['role']).toBe('group');
    const nodes = withClass(root, 'node');
    expect(nodes.map((node) => node.attrs['data-id'])).toEqual(
      LOTTO.drawing('services').nodes.map((node) => node.id),
    );
    // The outline is the box's button; its text is drawn beside it, hidden from screen readers,
    // which hear the button's name instead.
    for (const node of nodes) {
      const shape = child(node, 'shape');
      expect(shape.attrs['tabindex']).toBe(0);
      expect(shape.attrs['role']).toBe('button');
      for (const text of node.children.filter(
        (each) => typeof each !== 'string' && each.tag === 'text',
      ))
        expect(typeof text !== 'string' && text.attrs['aria-hidden']).toBe('true');
    }
    const website = button(root, 'website');
    expect(website.attrs['aria-label']).toBe('Website: lotto-options-ui, Angular 21');
    expect(website.attrs['aria-pressed']).toBe('true');
    expect(button(root, 'user').attrs['aria-pressed']).toBe('false');
    // A box without a tagline for the audience is announced with its name alone.
    const plain = semanticsOf('a: A\nb: B | Bee\n');
    const bare = await draw(plain, 'overview', 'manager', DEFAULT_ZOOM, { interactive: true });
    expect(button(bare, 'a').attrs['aria-label']).toBe('A');
    expect(button(bare, 'b').attrs['aria-label']).toBe('B: Bee');
  });

  it('INT-903 containers say whether they are open; lines, labels and header text are hidden from screen readers', async () => {
    const root = await draw(LOTTO, 'services', 'manager', DEFAULT_ZOOM, { interactive: true });
    expect(button(root, 'suite').attrs['aria-expanded']).toBe('true');
    expect(button(root, 'engine-service').attrs['aria-expanded']).toBe('false');
    expect(toMarkup(group(root, 'node', 'website'))).not.toContain('aria-expanded');
    for (const layer of ['edges', 'heads', 'labels']) {
      expect(withClass(root, layer)[0]?.attrs['aria-hidden'], layer).toBe('true');
    }
    // A plain drawing, as a file, is one image with no focusable parts.
    const still = await draw(LOTTO, 'services', 'manager');
    expect(still.attrs['role']).toBe('img');
    expect(toMarkup(still)).not.toContain('tabindex');
  });

  it('INT-301 the open and close control has its tooltip', async () => {
    const root = await draw(LOTTO, 'services', 'manager', DEFAULT_ZOOM, { interactive: true });
    const tip = (id: string): string =>
      textOf(child(child(group(root, 'node', id), 'control'), 'title'));
    expect(tip('engine-service')).toBe('Open in place');
    expect(tip('suite')).toBe('Close in place');
  });

  it('INT-206 each label has its reserved space to hover, which shows its full sentences', async () => {
    const lay = await layouter(LOTTO).picture('services', DEFAULT_ZOOM, 'manager');
    const root = await draw(LOTTO, 'services', 'manager', DEFAULT_ZOOM, { interactive: true });
    const label = group(root, 'label', 'website->screen-api');
    const hit = child(label, 'hit');
    const box = lay.result.edges['website->screen-api']?.label;
    expect(hit.attrs).toMatchObject({
      x: box?.x,
      y: box?.y,
      width: box?.width,
      height: box?.height,
    });
    expect(textOf(child(label, 'title'))).toBe('Website gets screen data from Screen API.');
    expect(rule('.aerie .hit')).toBe('fill: none; stroke: none; pointer-events: all;');
  });
});

describe('themes', () => {
  it('LOOK-001 one drawing serves both themes; a standalone drawing embeds the stylesheet and names its theme', async () => {
    const plain = toMarkup(await draw(LOTTO, 'services', 'manager'));
    const dark = await draw(LOTTO, 'services', 'manager', DEFAULT_ZOOM, {
      theme: 'dark',
      standalone: true,
    });
    expect(plain).not.toContain('data-theme');
    expect(plain).not.toContain('<style');
    expect(dark.attrs['data-theme']).toBe('dark');
    const style = child(dark, 'style');
    expect(textOf(style)).toBe(css);
    const rest = {
      ...dark,
      attrs: { ...dark.attrs, 'data-theme': null },
      children: dark.children.filter((each) => each !== style),
    };
    expect(toMarkup(rest)).toBe(plain);
  });
});
