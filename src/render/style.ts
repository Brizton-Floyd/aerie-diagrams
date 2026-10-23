// The Contour stylesheet (docs/spec/look.md), written from the tokens: every colour, stroke, face
// and timing the diagram is drawn with. Drawings carry classes and geometry only, so a theme is a
// set of custom properties and switching it redraws nothing.
import { BADGE_TEXT, DRAWN, FAMILIES, font } from './type.ts';
import { OPACITY, TOKENS, type Theme, type Token } from './tokens.ts';

/** The id of the hatching pattern every drawing defines (LOOK-305). */
export const HATCH_ID = 'aerie-hatch';

/** LOOK-901: the motion timings, in milliseconds, and the glide easing. */
export const MOTION = {
  /** `G`: boxes, containers, the camera, the audience underline. */
  glide: 560,
  ease: 'cubic-bezier(.45,.05,.25,1)',
  /** The wording swap on an audience switch, out and then in. */
  swap: 170,
  /** Dimming and highlighting. */
  dimming: 280,
  /** Hover colours. */
  hover: 250,
  /** The current trail step draws itself. */
  stepDraw: 900,
  /**
   * Scenario autoplay: one step this often. It is the reading pace, not motion, so it is not a
   * custom property and reduced motion keeps it (LOOK-903).
   */
  autoplay: 2400,
  /** The presenter's controls fade out, once the pointer has been still for `presenterIdle`. */
  presenterFade: 300,
  /**
   * How long the pointer stays still before the presenter's controls hide. Like the autoplay pace
   * it is a wait, not motion, so reduced motion keeps it and only the fade goes (LOOK-903).
   */
  presenterIdle: 2500,
} as const;

/** The custom property of a colour token. */
export const tokenVar = (token: Token): string => `var(--aerie-${token})`;

/** LOOK-307: the stage texture tile, six soft contour curves that join up across tile edges. */
export const TEXTURE = {
  width: 520,
  height: 360,
  stroke: 1.2,
  curves: [
    'M0 64C60 40 180 96 260 64S460 88 520 64',
    'M0 98C70 76 170 126 260 98S450 120 520 98',
    'M0 262C80 226 190 296 280 258S440 298 520 262',
    'M0 296C90 262 200 330 290 292S430 330 520 296',
    'M300 168c22-26 82-30 104-2s-6 50-48 50-78-20-56-48Z',
    'M326 170c12-14 48-16 58 0s-6 28-30 28-40-12-28-28Z',
  ],
} as const;

/** LOOK-307: the texture tile of a theme as an SVG data URI. */
export function textureTile(theme: Theme): string {
  const { colors, textureOpacity } = TOKENS[theme];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(TEXTURE.width)}" height="${String(TEXTURE.height)}" ` +
    `fill="none" stroke="${colors.texture}" stroke-opacity="${String(textureOpacity)}" ` +
    `stroke-width="${String(TEXTURE.stroke)}">` +
    TEXTURE.curves.map((d) => `<path d="${d}"/>`).join('') +
    '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function themeBlock(theme: Theme): string {
  const { colors } = TOKENS[theme];
  const lines = (Object.entries(colors) as [Token, string][]).map(
    ([token, value]) => `  --aerie-${token}: ${value};`,
  );
  lines.push(`  --aerie-texture-tile: url("${textureTile(theme)}");`, `  color-scheme: ${theme};`);
  return lines.join('\n');
}

const ms = (value: number): string => `${String(value)}ms`;

const MOTION_ON = [
  `  --aerie-glide: ${ms(MOTION.glide)};`,
  `  --aerie-swap: ${ms(MOTION.swap)};`,
  `  --aerie-dimming: ${ms(MOTION.dimming)};`,
  `  --aerie-hover: ${ms(MOTION.hover)};`,
  `  --aerie-step-draw: ${ms(MOTION.stepDraw)};`,
  `  --aerie-presenter-fade: ${ms(MOTION.presenterFade)};`,
].join('\n');

const MOTION_OFF = MOTION_ON.replace(/\d+ms/g, '0ms');

/**
 * The whole Contour stylesheet. Themes: the light theme is the default, the dark one follows the
 * system's setting (LOOK-002) unless an ancestor's `data-theme` names one. Motion: every duration
 * is zero under the system's reduced-motion setting unless `data-motion="full"`, and always under
 * `data-motion="reduce"` (LOOK-903).
 */
export function contourStyle(): string {
  const v = tokenVar;
  const op = OPACITY;
  const text = Object.values(DRAWN)
    .map(
      (role) =>
        `.aerie .${role.className} { font: ${font(role.face, role.size)}; fill: ${v(role.colour)}; }`,
    )
    .join('\n');
  const bands = [0, 1, 2, 3]
    .map(
      (depth) =>
        `.aerie .depth-${String(depth)} > .shape { fill: ${v(`band-${String(depth)}` as Token)}; }`,
    )
    .join('\n');
  const heads = [0, 1, 2, 3]
    .map(
      (depth) =>
        `.aerie .head.depth-${String(depth)} text { stroke: ${v(`band-${String(depth)}` as Token)}; }`,
    )
    .join('\n');
  const badgeFont = `${String(BADGE_TEXT.weight)} ${String(BADGE_TEXT.size)}px ${FAMILIES[BADGE_TEXT.family] ?? ''}`;
  return `/* Contour (docs/spec/look.md), written by src/render/style.ts from the tokens. */
:root, [data-theme="light"] {
${themeBlock('light')}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${themeBlock('dark')}
  }
}
[data-theme="dark"] {
${themeBlock('dark')}
}
:root {
  --aerie-ease: ${MOTION.ease};
${MOTION_ON}
}
@media (prefers-reduced-motion: reduce) {
  :root:not([data-motion="full"]) {
${MOTION_OFF}
  }
}
[data-motion="reduce"] {
${MOTION_OFF}
}
[data-motion="reduce"] .aerie *,
[data-motion="reduce"] .aerie *::before,
[data-motion="reduce"] .aerie *::after {
  animation-delay: 0ms !important;
  animation-duration: 0ms !important;
  transition-delay: 0ms !important;
  transition-duration: 0ms !important;
}

/* Text: kerning and ligatures off, as measured (LAYOUT-102), and glyphs placed at their exact
   advances with no hinting, so drawn text is as wide as measured on every system. */
.aerie text {
  font-kerning: none; font-variant-ligatures: none; white-space: pre; text-rendering: geometricPrecision;
}
${text}
.aerie .t-label, .aerie .t-label-code {
  stroke: ${v('halo')}; stroke-width: 5px; stroke-linejoin: round; paint-order: stroke fill;
}

/* An open container's header text, over the lines on a halo of its band. */
.aerie .head text { stroke-width: 5px; stroke-linejoin: round; paint-order: stroke fill; }
${heads}
.aerie .head.external text { stroke: ${v('hatch-bg')}; }

/* Shapes (LOOK-301 to LOOK-307). */
.aerie .shape { fill: ${v('paper')}; stroke: ${v('ink')}; stroke-width: 1px; }
.aerie .inner { fill: none; stroke: ${v('contour')}; stroke-width: 1px; }
.aerie .open > .shape { stroke: ${v('contour')}; }
${bands}
.aerie .open > .inner { stroke: ${v('contour-soft')}; stroke-dasharray: 2 3; }
.aerie .person > .shape { stroke-width: 1.4px; }
.aerie .external > .shape { fill: url(#${HATCH_ID}); stroke: ${v('ink')}; stroke-dasharray: 5 3; }
.aerie .hatch-bg { fill: ${v('hatch-bg')}; }
.aerie .hatch-line { stroke: ${v('hatch-line')}; stroke-width: 2px; }
.aerie .icon { fill: none; stroke: ${v('ink')}; stroke-width: 4.2px; stroke-linecap: round; stroke-linejoin: round; }
.aerie .icon .dot { fill: ${v('ink')}; stroke: none; }
.aerie .control circle { fill: ${v('paper')}; stroke: ${v('contour')}; stroke-width: 1px; }
.aerie .control path { fill: none; stroke: ${v('ink')}; stroke-width: 1.5px; stroke-linecap: round; }
.aerie .ring { fill: none; stroke: ${v('accent')}; stroke-width: 2px; display: none; }
.aerie .shape:focus { outline: none; }
.aerie .node:has(> .shape:focus-visible) > .ring { display: inline; }
.aerie .node > * {
  transition: stroke var(--aerie-hover) ease, stroke-width var(--aerie-hover) ease,
    opacity var(--aerie-dimming) ease;
}
.aerie .node:hover > .shape { stroke-width: 1.6px; }
.aerie .node:has(> .shape[role="button"]) { cursor: pointer; }
.aerie .hit { fill: none; stroke: none; pointer-events: all; }

/* Relationships (LOOK-501, LOOK-502). */
.aerie .edge .line { fill: none; stroke: ${v('edge')}; stroke-width: 1.3px; }
.aerie .edge .arrow { fill: none; stroke: ${v('edge')}; stroke-width: 1.6px; stroke-linecap: round; stroke-linejoin: round; }
.aerie .edge, .aerie .label { transition: opacity var(--aerie-dimming) ease; }

/* Selection, focus and the trail's emphasis (LOOK-601 to LOOK-603, LOOK-705). */
.aerie .sel > .shape, .aerie .now > .shape { stroke: ${v('accent')}; stroke-width: 2.2px; }
.aerie .sel > .inner { stroke: ${v('accent')}; stroke-dasharray: none; opacity: 0.5; }
.aerie .rel > .shape { stroke-width: 1.6px; }
.aerie .context > .shape, .aerie .context > .inner, .aerie .context > .control { opacity: ${String(op.context)}; }
.aerie .node.dim > * { opacity: ${String(op.dim)}; }
.aerie .edge.on .line { stroke: ${v('accent')}; stroke-width: 1.8px; }
.aerie .edge.on .arrow { stroke: ${v('accent')}; }
.aerie .label.on text { fill: ${v('accent-ink')}; }
.aerie .edge.dim { opacity: ${String(op['edge-dim'])}; }
.aerie .label.dim, .aerie .head.dim { opacity: ${String(op.dim)}; }
.aerie .head { transition: opacity var(--aerie-dimming) ease; }

/* The scenario trail (LOOK-701 to LOOK-704). It is drawn over everything but answers no pointer,
   so a box or open control under a curve or badge can still be clicked (INT-303). */
.aerie .trail, .aerie .badges { pointer-events: none; }
.aerie .step .curve { fill: none; stroke: ${v('accent')}; stroke-width: 2.4px; stroke-linecap: round; }
.aerie .step .arrow { fill: none; stroke: ${v('accent')}; stroke-width: 2.4px; stroke-linecap: round; stroke-linejoin: round; }
.aerie .step.reply .curve { stroke: ${v('trail-back')}; stroke-width: 2.6px; stroke-dasharray: 1 5; }
.aerie .step.past .curve, .aerie .step.past .arrow { stroke-width: 1.6px; opacity: ${String(op.past)}; }
/* Filled backwards only: once drawn, the curve and arrowhead are in their own resting state, so
   the finished animations end and the page counts as still. */
.aerie .step.now.call .curve {
  stroke-dasharray: 1 1;
  animation: aerie-draw var(--aerie-step-draw) var(--aerie-ease) backwards;
}
.aerie .step.now.call .arrow { animation: aerie-arrive 1ms linear var(--aerie-step-draw) backwards; }
@keyframes aerie-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes aerie-arrive { from { opacity: 0; } to { opacity: 1; } }
.aerie .badge circle { fill: ${v('paper')}; stroke: ${v('accent')}; stroke-width: 1.6px; }
.aerie .badge.now circle { fill: ${v('accent')}; }
.aerie .${BADGE_TEXT.className} { font: ${badgeFont}; fill: ${v(BADGE_TEXT.colour)}; text-anchor: middle; }
.aerie .badge.now .${BADGE_TEXT.className} { font-size: ${String(BADGE_TEXT.currentSize)}px; fill: ${v(BADGE_TEXT.currentColour)}; }

/* Lanes (LOOK-706). */
.aerie .lane-line { fill: none; stroke: ${v('contour')}; stroke-width: 1px; stroke-dasharray: 3 4; }
.aerie .row { fill: none; }
.aerie .row.now { fill: ${v('accent-soft')}; }

/* The stage behind the diagram (LOOK-307). */
.aerie-stage { background-color: ${v('bg')}; background-image: var(--aerie-texture-tile); }
`;
}
