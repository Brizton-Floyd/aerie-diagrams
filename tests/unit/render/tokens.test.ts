// The Contour tokens and contrast (docs/spec/look.md, LOOK-001 to LOOK-013; SCORE-004).
import { describe, expect, it } from 'vitest';
import {
  LINE_PAIRINGS,
  OPACITY,
  TEXT_PAIRINGS,
  THEMES,
  TOKENS,
  bandOf,
  contourStyle,
  contrast,
  lowestTextContrast,
  pairingContrast,
  textureTile,
} from '../../../src/render/index.ts';

// The token table of LOOK-001, as the spec writes it.
const TABLE = `
bg #f3eee2 #1b1d1a
paper #fbf8f0 #24271f
ink #2a2924 #ece5d2
muted #5f594d #b3ac98
rule #cdc2aa #3c3f35
band-0 #ebe6d3 #262923
band-1 #e2e2cb #2b3027
band-2 #d7dcc2 #31372b
band-3 #ccd5b9 #373f2f
contour #7b7156 #9a9680
contour-soft #bdb294 #57584a
edge #4a463c #cfc6ad
accent #b9472a #e9805e
accent-ink #9c3a20 #f0906f
accent-soft #f2d9c9 #4a2c22
on-accent #ffffff #1b1d1a
trail-back #a35c3d #c08068
hatch-bg #f6f1e5 #22241f
hatch-line #e0d5bd #34362e
texture #a08a5a #d8c89a
`;

/** The CSS declarations of the block that starts with `selector {`. */
function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No ${selector} block.`);
  return css.slice(start, css.indexOf('\n}', start));
}

describe('colour tokens', () => {
  it('LOOK-001 the light and dark themes hold the token table, halo the same as bg', () => {
    for (const line of TABLE.trim().split('\n')) {
      const [token = '', light, dark] = line.split(' ');
      expect(TOKENS.light.colors[token as keyof typeof TOKENS.light.colors], token).toBe(light);
      expect(TOKENS.dark.colors[token as keyof typeof TOKENS.dark.colors], token).toBe(dark);
    }
    for (const theme of THEMES) {
      expect(Object.keys(TOKENS[theme].colors)).toHaveLength(TABLE.trim().split('\n').length + 1);
      expect(TOKENS[theme].colors.halo).toBe(TOKENS[theme].colors.bg);
    }
    expect(TOKENS.light.textureOpacity).toBe(0.16);
    expect(TOKENS.dark.textureOpacity).toBe(0.07);
  });

  it('LOOK-001 the stylesheet defines every token for each theme and draws colours only through them', () => {
    const css = contourStyle();
    const light = block(css, ':root, [data-theme="light"]');
    const dark = block(css, '[data-theme="dark"]');
    for (const theme of THEMES) {
      const found = theme === 'light' ? light : dark;
      for (const [token, value] of Object.entries(TOKENS[theme].colors)) {
        expect(found).toContain(`--aerie-${token}: ${String(value)};`);
      }
    }
    // Outside the token blocks (and the texture tiles they hold), no colour is written directly.
    const rules = css
      .split('\n')
      .filter((line) => !/^\s*--aerie-[a-z0-9-]+: /.test(line))
      .join('\n');
    expect(rules.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi) ?? []).toEqual([]);
    for (const used of rules.match(/var\(--aerie-([a-z0-9-]+)\)/g) ?? []) {
      const token = used.slice('var(--aerie-'.length, -1);
      const motion = ['glide', 'swap', 'dimming', 'hover', 'step-draw', 'ease', 'texture-tile'];
      expect(token in TOKENS.light.colors || motion.includes(token), token).toBe(true);
    }
  });

  it('LOOK-001 an open container takes the band of its depth, and deeper levels stay on band-3', () => {
    expect([0, 1, 2, 3, 4, 7].map(bandOf)).toEqual([
      'band-0',
      'band-1',
      'band-2',
      'band-3',
      'band-3',
      'band-3',
    ]);
  });

  it('LOOK-002 the theme follows the system until a data-theme attribute names one', () => {
    const css = contourStyle();
    expect(css).toMatch(
      /@media \(prefers-color-scheme: dark\) \{\n {2}:root:not\(\[data-theme="light"\]\) \{/,
    );
    expect(block(css, '[data-theme="dark"]')).toContain('color-scheme: dark;');
    expect(block(css, ':root, [data-theme="light"]')).toContain('color-scheme: light;');
  });

  it('LOOK-003 the opacity tokens', () => {
    expect(OPACITY).toEqual({ dim: 0.2, context: 0.55, 'edge-dim': 0.14, past: 0.55 });
  });
});

describe('contrast', () => {
  it('LOOK-011 every text colour has at least 4.5 to 1 on every surface it is drawn on, in both themes', () => {
    expect(TEXT_PAIRINGS).toContainEqual({ text: 'on-accent', surface: 'accent' });
    expect(TEXT_PAIRINGS).toContainEqual({ text: 'accent-ink', surface: 'accent-soft' });
    expect(TEXT_PAIRINGS).toContainEqual({ text: 'muted', surface: 'halo' });
    for (const theme of THEMES) {
      for (const pairing of TEXT_PAIRINGS) {
        expect(
          pairingContrast(theme, pairing),
          `${theme} ${pairing.text} on ${pairing.surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('LOOK-011 the lowest is accent-ink on band-3 in the light theme, about 4.54', () => {
    const all = THEMES.flatMap((theme) =>
      TEXT_PAIRINGS.map((pairing) => ({ theme, pairing, ratio: pairingContrast(theme, pairing) })),
    ).sort((a, b) => a.ratio - b.ratio);
    expect(all[0]?.theme).toBe('light');
    expect(all[0]?.pairing).toEqual({ text: 'accent-ink', surface: 'band-3' });
    expect(all[0]?.ratio).toBeCloseTo(4.54, 2);
  });

  it('LOOK-012 lines and shapes a reader needs have at least 3 to 1 against the surface next to them', () => {
    for (const theme of THEMES) {
      for (const pairing of LINE_PAIRINGS) {
        expect(
          pairingContrast(theme, pairing),
          `${theme} ${pairing.text} on ${pairing.surface}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('LOOK-013 only pushed-back things are drawn below full strength, at the opacity tokens', () => {
    const css = contourStyle();
    const opacities = [...css.matchAll(/^(.*)\{[^}]*opacity: ([\d.]+);/gm)].map(
      ([, selector = '', value = '']) => ({ selector: selector.trim(), value: Number(value) }),
    );
    const allowed = new Set<number>([...Object.values(OPACITY), 0.5, 0, 1]);
    for (const { selector, value } of opacities) {
      expect(allowed.has(value), `${selector}: ${String(value)}`).toBe(true);
      if (value < 1 && value !== 0.5) {
        expect(selector, `${selector} is dimmed`).toMatch(/\.(dim|context|past)\b/);
      }
    }
    // LOOK-601: a selected element's inner contour at half opacity is the one other exception.
    expect(css).toContain(
      '.aerie .sel > .inner { stroke: var(--aerie-accent); stroke-dasharray: none; opacity: 0.5; }',
    );
  });

  it('SCORE-004 the lowest text contrast of each theme is at least 4.5', () => {
    expect(lowestTextContrast('light')).toBeGreaterThanOrEqual(4.5);
    expect(lowestTextContrast('dark')).toBeGreaterThanOrEqual(4.5);
    expect(lowestTextContrast('light')).toBe(4.53);
  });

  it('computes WCAG contrast ratios', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#ffffff')).toBe(1);
    expect(() => contrast('red', '#ffffff')).toThrow('not a #rrggbb colour');
  });

  it('LOOK-307 the texture tile is drawn in the texture token at its opacity', () => {
    for (const theme of THEMES) {
      const svg = decodeURIComponent(textureTile(theme).replace('data:image/svg+xml,', ''));
      expect(svg).toContain(`stroke="${TOKENS[theme].colors.texture}"`);
      expect(svg).toContain(`stroke-opacity="${String(TOKENS[theme].textureOpacity)}"`);
    }
  });
});
