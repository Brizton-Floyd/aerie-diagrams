// The Signal colour and opacity tokens (docs/spec/look.md, LOOK-001 to LOOK-013): the only colours
// Aerie draws with, for the dark theme (the default) and the light theme (for bright rooms,
// projectors and print), and the contrast arithmetic that holds them to the spec (SCORE-004).

/** The two themes; dark is the default (LOOK-002). */
export const THEMES = ['dark', 'light'] as const;

export type Theme = (typeof THEMES)[number];

/** LOOK-002: the theme a reader sees until they pick one. */
export const DEFAULT_THEME: Theme = 'dark';

/** LOOK-001: the colour tokens, by name, as `#rrggbb`. */
export interface Palette {
  /** The stage behind the diagram. */
  bg: string;
  /** Boxes, the top bar, sidebar, side panel and the stage's floating bars. */
  surface: string;
  /** Names and main text. */
  ink: string;
  /** Taglines, secondary text. */
  muted: string;
  /** Hairlines in the page chrome (decoration only). */
  rule: string;
  /** Box outlines. */
  outline: string;
  /** The outline of the box under the pointer. */
  'outline-hover': string;
  /** Open containers at depth 0, 1, 2, and 3 or deeper. */
  'band-0': string;
  'band-1': string;
  'band-2': string;
  'band-3': string;
  /** Open container outlines. */
  frame: string;
  /** Relationship lines and arrows. */
  edge: string;
  /** The pill behind a relationship label. */
  pill: string;
  /** The violet: filled controls, a selected line, the current step's badge. */
  accent: string;
  /** Violet text and lines: the selection outline, the trail, chips and kickers. */
  'accent-ink': string;
  /** A violet wash: the current step's row, a selected label's pill. */
  'accent-soft': string;
  /** Text on an `accent` fill. */
  'on-accent': string;
  /** The live colour: the current trail step and the light that flows along selected lines. */
  live: string;
  /** Reply steps on the trail. */
  'trail-back': string;
  /** The ground of an outside system. */
  'hatch-bg': string;
  /** The hatching of an outside system. */
  'hatch-line': string;
  /** Violet light around the selection, the trail and lit controls (decoration only). */
  glow: string;
  /** The dot grid on the stage (decoration only). */
  grid: string;
  /** The light at the top of the stage and in an open container's corner (decoration only). */
  dawn: string;
  /** The colour of every shadow, mixed down to a part of itself (decoration only). */
  shadow: string;
  /** The two ends of the gradient on the tour button, both under `on-accent` text. */
  'cta-from': string;
  'cta-to': string;
}

export type Token = keyof Palette;

/**
 * LOOK-001: the token table. Dark is an instrument panel at night: near-black with a blue cast,
 * hairline structure, violet light for what matters and cyan for what is live. Light is the same
 * panel in daylight: white cards on a cool grey stage, with deeper violet and cyan so lines and
 * text keep their contrast.
 */
export const TOKENS: Record<Theme, Palette> = {
  dark: {
    bg: '#090b10',
    surface: '#11141b',
    ink: '#eceef4',
    muted: '#9ba3b5',
    rule: '#1f2430',
    outline: '#677189',
    'outline-hover': '#8a93a8',
    'band-0': '#0e1117',
    'band-1': '#12161f',
    'band-2': '#161b26',
    'band-3': '#1a202d',
    frame: '#66708a',
    edge: '#6c768c',
    pill: '#141823',
    accent: '#6a59f4',
    'accent-ink': '#ada4ff',
    'accent-soft': '#1d1a3d',
    'on-accent': '#ffffff',
    live: '#22c8e6',
    'trail-back': '#38d6c4',
    'hatch-bg': '#0d0f15',
    'hatch-line': '#181c26',
    glow: '#7b6bff',
    grid: '#1c2130',
    dawn: '#232a4a',
    shadow: '#000000',
    'cta-from': '#5f4dff',
    'cta-to': '#3a60f2',
  },
  light: {
    bg: '#f3f4f8',
    surface: '#ffffff',
    ink: '#11141b',
    muted: '#535b6d',
    rule: '#e1e4ec',
    outline: '#737b8f',
    'outline-hover': '#5a6275',
    'band-0': '#f7f8fb',
    'band-1': '#f0f2f7',
    'band-2': '#e9ecf3',
    'band-3': '#e3e7ef',
    frame: '#747c90',
    edge: '#737b90',
    pill: '#ffffff',
    accent: '#5a48e6',
    'accent-ink': '#4a38d4',
    'accent-soft': '#ece9ff',
    'on-accent': '#ffffff',
    live: '#0a7f9e',
    'trail-back': '#0b7a6e',
    'hatch-bg': '#f7f8fb',
    'hatch-line': '#e4e7ef',
    glow: '#6a59f4',
    grid: '#d3d8e3',
    dawn: '#e2deff',
    shadow: '#8a92ab',
    'cta-from': '#5a48e6',
    'cta-to': '#3557e0',
  },
};

/** LOOK-003: the opacity tokens. */
export const OPACITY = {
  /** An element or label pushed back. */
  dim: 0.22,
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

const SURFACES: Token[] = [
  'bg',
  'surface',
  'band-0',
  'band-1',
  'band-2',
  'band-3',
  'pill',
  'accent-soft',
];

/**
 * LOOK-011: every text colour on every surface it is drawn on: `ink`, `muted` and `accent-ink` on
 * `bg`, `surface`, every band, `pill` and `accent-soft`; `on-accent` on `accent` and on both ends
 * of the tour button's gradient.
 */
export const TEXT_PAIRINGS: readonly Pairing[] = [
  ...(['ink', 'muted', 'accent-ink'] as const).flatMap((text) =>
    SURFACES.map((surface) => ({ text, surface })),
  ),
  { text: 'on-accent', surface: 'accent' },
  { text: 'on-accent', surface: 'cta-from' },
  { text: 'on-accent', surface: 'cta-to' },
];

/**
 * LOOK-012: lines and shapes a reader needs, against the surfaces next to them: box outlines in
 * `outline`, open container outlines in `frame`, relationship lines in `edge`, a selected line in
 * `accent`, the selection outline and the trail in `accent-ink`, and the current step in `live`.
 */
export const LINE_PAIRINGS: readonly Pairing[] = [
  ...(['outline', 'frame', 'edge', 'accent', 'accent-ink', 'live', 'trail-back'] as const).flatMap(
    (text) =>
      (['bg', 'surface', 'band-0', 'band-1', 'band-2', 'band-3'] as const).map((surface) => ({
        text,
        surface,
      })),
  ),
  { text: 'outline', surface: 'hatch-bg' },
];

/** The contrast of one pairing in a theme. */
export function pairingContrast(theme: Theme, pairing: Pairing): number {
  const colors = TOKENS[theme];
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
