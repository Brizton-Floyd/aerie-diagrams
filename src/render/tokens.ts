// The Contour colour and opacity tokens (docs/spec/look.md, LOOK-001 to LOOK-013): the only colours
// Aerie draws with, for the light theme (the paper map) and the dark theme (the night map), and the
// contrast arithmetic that holds them to the spec (SCORE-004).

/** The two themes; both are part of v1 (LOOK-001). */
export const THEMES = ['light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];

/** LOOK-001: the colour tokens, by name, as `#rrggbb`. */
export interface Palette {
  /** The stage behind the diagram. */
  bg: string;
  /** Boxes, the top bar, sidebar, side panel and caption bar. */
  paper: string;
  /** Names, main text, box outlines. */
  ink: string;
  /** Taglines, secondary text. */
  muted: string;
  /** Dividing lines in the page chrome (decoration only). */
  rule: string;
  /** Open containers at depth 0, 1, 2, and 3 or deeper. */
  'band-0': string;
  'band-1': string;
  'band-2': string;
  'band-3': string;
  /** Open container outlines. */
  contour: string;
  /** The dotted inner contour line (decoration only). */
  'contour-soft': string;
  /** Relationship lines and arrows. */
  edge: string;
  /** The halo behind label text: the same as `bg`. */
  halo: string;
  /** The survey red: selection, the trail, the audience thumb. */
  accent: string;
  /** Text in the survey red. */
  'accent-ink': string;
  /** The current step's row. */
  'accent-soft': string;
  /** Text on an `accent` fill. */
  'on-accent': string;
  /** Reply steps on the trail. */
  'trail-back': string;
  /** The ground of an outside system. */
  'hatch-bg': string;
  /** The hatching of an outside system. */
  'hatch-line': string;
  /** The faint contour lines on the stage, drawn at `textureOpacity`. */
  texture: string;
}

export type Token = keyof Palette;

/** One theme's colours and the opacity its stage texture is drawn at. */
export interface ThemeTokens {
  colors: Palette;
  textureOpacity: number;
}

/** LOOK-001: the token table. */
export const TOKENS: Record<Theme, ThemeTokens> = {
  light: {
    colors: {
      bg: '#f3eee2',
      paper: '#fbf8f0',
      ink: '#2a2924',
      muted: '#5f594d',
      rule: '#cdc2aa',
      'band-0': '#ebe6d3',
      'band-1': '#e2e2cb',
      'band-2': '#d7dcc2',
      'band-3': '#ccd5b9',
      contour: '#7b7156',
      'contour-soft': '#bdb294',
      edge: '#4a463c',
      halo: '#f3eee2',
      accent: '#b9472a',
      'accent-ink': '#9c3a20',
      'accent-soft': '#f2d9c9',
      'on-accent': '#ffffff',
      'trail-back': '#a35c3d',
      'hatch-bg': '#f6f1e5',
      'hatch-line': '#e0d5bd',
      texture: '#a08a5a',
    },
    textureOpacity: 0.16,
  },
  dark: {
    colors: {
      bg: '#1b1d1a',
      paper: '#24271f',
      ink: '#ece5d2',
      muted: '#b3ac98',
      rule: '#3c3f35',
      'band-0': '#262923',
      'band-1': '#2b3027',
      'band-2': '#31372b',
      'band-3': '#373f2f',
      contour: '#9a9680',
      'contour-soft': '#57584a',
      edge: '#cfc6ad',
      halo: '#1b1d1a',
      accent: '#e9805e',
      'accent-ink': '#f0906f',
      'accent-soft': '#4a2c22',
      'on-accent': '#1b1d1a',
      'trail-back': '#c08068',
      'hatch-bg': '#22241f',
      'hatch-line': '#34362e',
      texture: '#d8c89a',
    },
    textureOpacity: 0.07,
  },
};

/** LOOK-003: the opacity tokens. */
export const OPACITY = {
  /** An element or label pushed back. */
  dim: 0.2,
  /** The frame of a container that holds something in focus. */
  context: 0.55,
  /** A line pushed back. */
  'edge-dim': 0.14,
  /** An earlier step on the trail. */
  past: 0.55,
} as const;

/** LOOK-001: the open container band of a depth; deeper levels stay on `band-3`. */
export function bandOf(depth: number): Token {
  const band = Math.min(3, Math.max(0, Math.floor(depth)));
  return `band-${String(band)}` as Token;
}

function channel(hex: string, at: number): number {
  const value = parseInt(hex.slice(at, at + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** The relative luminance of a `#rrggbb` colour, as WCAG 2 defines it. */
export function luminance(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`${hex} is not a #rrggbb colour.`);
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/** The WCAG 2 contrast ratio of two colours, from 1 to 21. */
export function contrast(one: string, two: string): number {
  const a = luminance(one);
  const b = luminance(two);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** A text colour on a surface it is drawn on. */
export interface Pairing {
  text: Token;
  surface: Token;
}

const SURFACES: Token[] = ['bg', 'paper', 'band-0', 'band-1', 'band-2', 'band-3', 'accent-soft'];

/**
 * LOOK-011: every text colour on every surface it is drawn on: `ink`, `muted` and `accent-ink` on
 * `bg`, `paper`, every band and `accent-soft`; `on-accent` on `accent`. Label text is drawn on
 * `halo`, which is `bg`.
 */
export const TEXT_PAIRINGS: readonly Pairing[] = [
  ...(['ink', 'muted', 'accent-ink'] as const).flatMap((text) =>
    [...SURFACES, 'halo' as const].map((surface) => ({ text, surface })),
  ),
  { text: 'on-accent', surface: 'accent' },
];

/**
 * LOOK-012: lines and shapes a reader needs, against the surfaces next to them: box outlines in
 * `ink`, open container outlines in `contour`, relationship lines in `edge`, and the trail and
 * the selection outline in `accent`.
 */
export const LINE_PAIRINGS: readonly Pairing[] = [
  ...(['ink', 'contour', 'edge', 'accent'] as const).flatMap((text) =>
    ['bg', 'paper', 'band-0', 'band-1', 'band-2', 'band-3'].map((surface) => ({
      text,
      surface: surface as Token,
    })),
  ),
  { text: 'ink', surface: 'hatch-bg' },
];

/** The contrast of one pairing in a theme. */
export function pairingContrast(theme: Theme, pairing: Pairing): number {
  const colors = TOKENS[theme].colors;
  return contrast(colors[pairing.text], colors[pairing.surface]);
}

/**
 * SCORE-004: the lowest contrast ratio of any text colour on any surface it is drawn on, in a
 * theme, to two decimal places (rounded down, so a score never claims more than it has).
 */
export function lowestTextContrast(theme: Theme): number {
  const lowest = Math.min(...TEXT_PAIRINGS.map((pairing) => pairingContrast(theme, pairing)));
  return Math.floor(lowest * 100) / 100;
}
