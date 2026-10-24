// The Signal tokens and contrast (docs/spec/look.md, LOOK-001 to LOOK-014; SCORE-004).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  LINE_PAIRINGS,
  OPACITY,
  TEXT_PAIRINGS,
  THEMES,
  TOKENS,
  bandOf,
  contrast,
  lowestTextContrast,
  pairingContrast,
  signalStyle,
} from '../../../src/render/index.ts';

const ROOT = join(import.meta.dirname, '../../..');

// The token table of LOOK-001, as the spec writes it: dark, then light.
const TABLE = `
bg #090b10 #f3f4f8
surface #11141b #ffffff
ink #eceef4 #11141b
muted #9ba3b5 #535b6d
rule #1f2430 #e1e4ec
outline #677189 #737b8f
outline-hover #8a93a8 #5a6275
band-0 #0e1117 #f7f8fb
band-1 #12161f #f0f2f7
band-2 #161b26 #e9ecf3
band-3 #1a202d #e3e7ef
frame #66708a #747c90
edge #6c768c #737b90
pill #141823 #ffffff
accent #6a59f4 #5a48e6
accent-ink #ada4ff #4a38d4
accent-soft #1d1a3d #ece9ff
on-accent #ffffff #ffffff
live #22c8e6 #0a7f9e
trail-back #38d6c4 #0b7a6e
hatch-bg #0d0f15 #f7f8fb
hatch-line #181c26 #e4e7ef
glow #7b6bff #6a59f4
grid #1c2130 #d3d8e3
dawn #232a4a #e2deff
shadow #000000 #8a92ab
cta-from #5f4dff #5a48e6
cta-to #3a60f2 #3557e0
`;

/** The CSS declarations of the block that starts with `selector {`. */
function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No ${selector} block.`);
  return css.slice(start, css.indexOf('\n}', start));
}

/** The custom properties a CSS text uses, without their `--aerie-` prefix. */
const used = (css: string): string[] =>
  (css.match(/var\(--aerie-([a-z0-9-]+)\)/g) ?? []).map((each) =>
    each.slice('var(--aerie-'.length, -1),
  );

const MOTION_NAMES = [
  'glide',
  'swap',
  'dimming',
  'hover',
  'step-draw',
  'arrive-step',
  'peek',
  'presenter-fade',
  'ease',
];

describe('colour tokens', () => {
  it('LOOK-001 the dark and light themes hold the token table', () => {
    const rows = TABLE.trim().split('\n');
    for (const line of rows) {
      const [token = '', dark, light] = line.split(' ');
      expect(TOKENS.dark[token as keyof typeof TOKENS.dark], token).toBe(dark);
      expect(TOKENS.light[token as keyof typeof TOKENS.light], token).toBe(light);
    }
    for (const theme of THEMES) expect(Object.keys(TOKENS[theme])).toHaveLength(rows.length);
  });

  it('LOOK-001 the stylesheet defines every token for each theme and draws colours only through them', () => {
    const css = signalStyle();
    const dark = block(css, ':root, [data-theme="dark"]');
    const light = block(css, '[data-theme="light"]');
    for (const theme of THEMES) {
      const found = theme === 'dark' ? dark : light;
      for (const [token, value] of Object.entries(TOKENS[theme])) {
        expect(found).toContain(`--aerie-${token}: ${String(value)};`);
      }
    }
    // Outside the token blocks, no colour is written directly.
    const rules = css
      .split('\n')
      .filter((line) => !/^\s*--aerie-[a-z0-9-]+: /.test(line))
      .join('\n');
    expect(rules.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi) ?? []).toEqual([]);
    for (const token of used(rules)) {
      expect(token in TOKENS.dark || MOTION_NAMES.includes(token), token).toBe(true);
    }
  });

  it('LOOK-001 the page chrome colours only through the tokens, mixed with each other', () => {
    const page = readFileSync(join(ROOT, 'src/app/page.css'), 'utf8');
    expect(page.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi) ?? []).toEqual([]);
    for (const token of used(page)) {
      expect(token in TOKENS.dark || MOTION_NAMES.includes(token), token).toBe(true);
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

  it('LOOK-002 dark is the default; data-theme="light" picks the light theme, and printing always uses it', () => {
    expect(DEFAULT_THEME).toBe('dark');
    const css = signalStyle();
    expect(css).not.toContain('prefers-color-scheme');
    expect(block(css, ':root, [data-theme="dark"]')).toContain('color-scheme: dark;');
    expect(block(css, '[data-theme="light"]')).toContain('color-scheme: light;');
    const print = block(css, '@media print');
    expect(print).toContain(':root, [data-theme] {');
    for (const [token, value] of Object.entries(TOKENS.light) as [string, string][]) {
      expect(print).toContain(`--aerie-${token}: ${value};`);
    }
    // The print block comes after both themes, so it wins over a chosen one.
    expect(css.indexOf('@media print')).toBeGreaterThan(css.indexOf('[data-theme="light"] {'));
  });

  it('LOOK-003 the opacity tokens', () => {
    expect(OPACITY).toEqual({ dim: 0.22, context: 0.55, 'edge-dim': 0.14, past: 0.55 });
  });
});

describe('contrast', () => {
  it('LOOK-011 every text colour has at least 4.5 to 1 on every surface it is drawn on, in both themes', () => {
    expect(TEXT_PAIRINGS).toContainEqual({ text: 'on-accent', surface: 'accent' });
    expect(TEXT_PAIRINGS).toContainEqual({ text: 'accent-ink', surface: 'accent-soft' });
    expect(TEXT_PAIRINGS).toContainEqual({ text: 'muted', surface: 'pill' });
    expect(TEXT_PAIRINGS).toContainEqual({ text: 'on-accent', surface: 'cta-to' });
    for (const theme of THEMES) {
      for (const pairing of TEXT_PAIRINGS) {
        expect(
          pairingContrast(theme, pairing),
          `${theme} ${pairing.text} on ${pairing.surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('LOOK-011 the lowest is on-accent on accent in the dark theme, about 4.83', () => {
    const all = THEMES.flatMap((theme) =>
      TEXT_PAIRINGS.map((pairing) => ({ theme, pairing, ratio: pairingContrast(theme, pairing) })),
    ).sort((a, b) => a.ratio - b.ratio);
    expect(all[0]?.theme).toBe('dark');
    expect(all[0]?.pairing).toEqual({ text: 'on-accent', surface: 'accent' });
    expect(all[0]?.ratio).toBeCloseTo(4.83, 2);
  });

  it('LOOK-012 lines and shapes a reader needs have at least 3 to 1 against the surface next to them', () => {
    for (const line of ['outline', 'frame', 'edge', 'accent', 'accent-ink', 'live', 'trail-back']) {
      expect(LINE_PAIRINGS.some((pairing) => pairing.text === line)).toBe(true);
    }
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
    const css = signalStyle();
    const opacities = [...css.matchAll(/^(.*)\{[^}]*(?<![a-z-])opacity: ([\d.]+);/gm)].map(
      ([, selector = '', value = '']) => ({ selector: selector.trim(), value: Number(value) }),
    );
    expect(opacities.length).toBeGreaterThan(0);
    for (const { selector, value } of opacities) {
      // An animation fades from nothing to full strength; that is motion, not dimming.
      if (selector.startsWith('@keyframes')) continue;
      expect(value < 1, selector).toBe(true);
      expect(Object.values(OPACITY) as number[], selector).toContain(value);
      expect(selector, `${selector} is dimmed`).toMatch(/\.(dim|context|past)\b/);
    }
  });

  it('SCORE-004 the lowest text contrast of each theme is at least 4.5', () => {
    expect(lowestTextContrast('light')).toBeGreaterThanOrEqual(4.5);
    expect(lowestTextContrast('dark')).toBeGreaterThanOrEqual(4.5);
    expect(lowestTextContrast('dark')).toBe(4.82);
  });

  it('computes WCAG contrast ratios', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#ffffff')).toBe(1);
    expect(() => contrast('red', '#ffffff')).toThrow('not a #rrggbb colour');
  });
});
