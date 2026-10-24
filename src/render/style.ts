// The Signal stylesheet (docs/spec/look.md), written from the tokens: every colour, stroke, face
// and timing the diagram is drawn with. Drawings carry classes and geometry only, so a theme is a
// set of custom properties and switching it redraws nothing.
import { ICON_STROKE } from './icons.ts';
import { BADGE_TEXT, DRAWN, FAMILIES, font } from './type.ts';
import { OPACITY, TOKENS, type Theme, type Token } from './tokens.ts';

/** The id of the hatching pattern every drawing defines (LOOK-305). */
export const HATCH_ID = 'aerie-hatch';

/** The id of the dawn's gradient every drawing defines (LOOK-303). */
export const DAWN_ID = 'aerie-dawn';

/** LOOK-901: the motion timings, in milliseconds, and the glide easing. */
export const MOTION = {
  /** `G`: boxes, containers and the camera. */
  glide: 520,
  /** An exponential ease-out: quick, then a long settle. */
  ease: 'cubic-bezier(.16,1,.3,1)',
  /** The wording swap on an audience switch, out and then in. */
  swap: 170,
  /** Dimming and highlighting. */
  dimming: 280,
  /** Hover colours. */
  hover: 250,
  /** The current trail step draws itself. */
  stepDraw: 900,
  /** The first drawing of a model: each row of boxes starts this much after the one above. */
  arriveStep: 45,
  /** The hover card fades and slides in. */
  peek: 180,
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

/** A colour token mixed down to a part of itself, for light, shadows and washes. */
export const tokenMix = (token: Token, percent: number): string =>
  `color-mix(in srgb, ${tokenVar(token)} ${String(percent)}%, transparent)`;

function themeBlock(theme: Theme): string {
  const lines = (Object.entries(TOKENS[theme]) as [Token, string][]).map(
    ([token, value]) => `  --aerie-${token}: ${value};`,
  );
  lines.push(`  color-scheme: ${theme};`);
  return lines.join('\n');
}

const indent = (text: string): string => text.replace(/^/gm, '  ');

const ms = (value: number): string => `${String(value)}ms`;

const MOTION_ON = [
  `  --aerie-glide: ${ms(MOTION.glide)};`,
  `  --aerie-swap: ${ms(MOTION.swap)};`,
  `  --aerie-dimming: ${ms(MOTION.dimming)};`,
  `  --aerie-hover: ${ms(MOTION.hover)};`,
  `  --aerie-step-draw: ${ms(MOTION.stepDraw)};`,
  `  --aerie-arrive-step: ${ms(MOTION.arriveStep)};`,
  `  --aerie-peek: ${ms(MOTION.peek)};`,
  `  --aerie-presenter-fade: ${ms(MOTION.presenterFade)};`,
].join('\n');

const MOTION_OFF = MOTION_ON.replace(/\d+ms/g, '0ms');

/**
 * The whole Signal stylesheet. Themes: dark is the default, `data-theme="light"` on an ancestor
 * picks the light theme (LOOK-002), and printing always uses the light one. Motion: every duration
 * is zero under the system's reduced-motion setting unless `data-motion="full"`, and always under
 * `data-motion="reduce"` (LOOK-903).
 */
export function signalStyle(): string {
  const v = tokenVar;
  const mix = tokenMix;
  const op = OPACITY;
  const text = Object.values(DRAWN)
    .map(
      (role) =>
        `.aerie .${role.className} { font: ${font(role.face, role.size)}; fill: ${v(role.colour)}; }`,
    )
    .join('\n');
  const depths = [0, 1, 2, 3];
  const bands = depths
    .map(
      (depth) =>
        `.aerie .depth-${String(depth)} > .shape { fill: ${v(`band-${String(depth)}` as Token)}; }`,
    )
    .join('\n');
  const heads = depths
    .map(
      (depth) =>
        `.aerie .head.depth-${String(depth)} text { stroke: ${v(`band-${String(depth)}` as Token)}; }`,
    )
    .join('\n');
  const badgeFont = `${String(BADGE_TEXT.weight)} ${String(BADGE_TEXT.size)}px ${FAMILIES[BADGE_TEXT.family] ?? ''}`;
  const glow = (near: number, far: number): string =>
    `drop-shadow(0 0 1px ${mix('glow', near)}) drop-shadow(0 0 ${String(far)}px ${mix('glow', near / 2)})`;
  return `/* Signal (docs/spec/look.md), written by src/render/style.ts from the tokens. */
:root, [data-theme="dark"] {
${themeBlock('dark')}
}
[data-theme="light"] {
${themeBlock('light')}
}
@media print {
  :root, [data-theme] {
${indent(themeBlock('light'))}
  }
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

/* An open container's header text, over the lines on a halo of its band (LOOK-303). */
.aerie .head text { stroke-width: 5px; stroke-linejoin: round; paint-order: stroke fill; }
${heads}
.aerie .head.external text { stroke: ${v('hatch-bg')}; }

/* Shapes (LOOK-301 to LOOK-307): hairline cards that rest on the dark with a soft shadow. */
.aerie .shape { fill: ${v('surface')}; stroke: ${v('outline')}; stroke-width: 1px; }
.aerie .open > .shape { stroke: ${v('frame')}; }
${bands}
.aerie .person > .shape { stroke-width: 1.4px; }
.aerie .external > .shape { fill: url(#${HATCH_ID}); stroke-dasharray: 4 4; }
.aerie .hatch-bg { fill: ${v('hatch-bg')}; }
.aerie .hatch-line { stroke: ${v('hatch-line')}; stroke-width: 2px; }
.aerie .node:not(.open) > .shape {
  filter: drop-shadow(0 1px 0 ${mix('shadow', 80)}) drop-shadow(0 8px 18px ${mix('shadow', 55)});
}
.aerie .open > .shape { filter: drop-shadow(0 18px 40px ${mix('shadow', 60)}); }
.aerie .open.depth-1 > .shape, .aerie .open.depth-2 > .shape, .aerie .open.depth-3 > .shape {
  filter: drop-shadow(0 18px 40px ${mix('shadow', 70)});
}
.aerie .dawn { fill: url(#${DAWN_ID}); pointer-events: none; }
.aerie .dawn-0 { stop-color: ${v('dawn')}; stop-opacity: 0.9; }
.aerie .dawn-1 { stop-color: ${v('dawn')}; stop-opacity: 0.22; }
.aerie .dawn-2 { stop-color: ${v('dawn')}; stop-opacity: 0; }
.aerie .icon-tile { fill: ${mix('glow', 14)}; stroke: ${mix('glow', 34)}; stroke-width: 1px; }
.aerie .icon { fill: none; stroke: ${v('accent-ink')}; stroke-width: ${String(ICON_STROKE)}px; stroke-linecap: round; stroke-linejoin: round; }
.aerie .icon .dot { fill: ${v('accent-ink')}; stroke: none; }
.aerie .control circle { fill: ${v('band-1')}; stroke: ${v('outline')}; stroke-width: 1px; }
.aerie .control path { fill: none; stroke: ${v('ink')}; stroke-width: 1.4px; stroke-linecap: round; }
.aerie .node:hover > .control circle { stroke: ${v('accent-ink')}; fill: ${mix('glow', 22)}; }
.aerie .ring { fill: none; stroke: ${v('live')}; stroke-width: 2px; display: none; }
.aerie .shape:focus { outline: none; }
.aerie .node:has(> .shape:focus-visible) > .ring { display: inline; }
.aerie .node > * {
  transition: stroke var(--aerie-hover) ease, stroke-width var(--aerie-hover) ease,
    opacity var(--aerie-dimming) ease;
}
.aerie .node:not(.open):hover > .shape { stroke: ${v('outline-hover')}; filter: ${glow(60, 16)}; }
.aerie .node.open:hover > .shape { stroke-width: 1.6px; }
.aerie .node:has(> .shape[role="button"]) { cursor: pointer; }
.aerie .hit { fill: none; stroke: none; pointer-events: all; }

/* The first drawing of a model: cards fade up out of the dark in reading order, then the lines. */
.aerie.arriving .boxes > .node > *, .aerie.arriving .heads > .head > * {
  animation: aerie-rise calc(var(--aerie-glide) * 1.3) var(--aerie-ease) backwards;
  animation-delay: calc(var(--aerie-arrive-step) * var(--order, 0));
}
.aerie.arriving .edges, .aerie.arriving .labels {
  animation: aerie-fade calc(var(--aerie-glide) * 1.2) ease backwards;
  animation-delay: calc(var(--aerie-arrive-step) * var(--count, 6) + var(--aerie-glide) * 0.5);
}
@keyframes aerie-rise { from { opacity: 0; translate: 0 8px; } to { opacity: 1; translate: 0 0; } }
@keyframes aerie-fade { from { opacity: 0; } to { opacity: 1; } }

/* Relationships (LOOK-501, LOOK-502): thin and quiet, each label on a pill. */
.aerie .edge .line { fill: none; stroke: ${v('edge')}; stroke-width: 1.2px; }
.aerie .edge .arrow { fill: none; stroke: ${v('edge')}; stroke-width: 1.5px; stroke-linecap: round; stroke-linejoin: round; }
.aerie .edge .flow { fill: none; stroke: none; pointer-events: none; }
.aerie .edge, .aerie .label { transition: opacity var(--aerie-dimming) ease; }
.aerie .pill {
  fill: ${v('pill')}; stroke: ${v('rule')}; stroke-width: 1px;
  transition: fill var(--aerie-hover) ease, stroke var(--aerie-hover) ease;
}

/* Selection, focus and the trail's emphasis (LOOK-601 to LOOK-603, LOOK-705): a violet edge with
   a bloom of light; the selection's lines glow and carry a light that flows along them. */
.aerie .node.sel > .shape, .aerie .node.now > .shape, .aerie .node.sel:hover > .shape, .aerie .node.now:hover > .shape {
  stroke: ${v('accent-ink')}; stroke-width: 1.5px; filter: ${glow(90, 22)};
}
.aerie .rel > .shape { stroke: ${mix('accent-ink', 70)}; stroke-width: 1.2px; }
.aerie .context > .shape, .aerie .context > .dawn, .aerie .context > .control { opacity: ${String(op.context)}; }
.aerie .node.dim > * { opacity: ${String(op.dim)}; }
.aerie .edge.on .line { stroke: ${v('accent')}; stroke-width: 1.6px; filter: drop-shadow(0 0 4px ${mix('glow', 70)}); }
.aerie .edge.on .arrow { stroke: ${v('accent-ink')}; }
.aerie .edge.on .flow {
  stroke: ${v('live')}; stroke-width: 2px; stroke-linecap: round; stroke-dasharray: 2 30;
  animation: aerie-flow calc(var(--aerie-glide) * 2.4) linear infinite;
}
@keyframes aerie-flow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -32; } }
.aerie .label.on .pill { stroke: ${mix('glow', 60)}; fill: ${v('accent-soft')}; }
.aerie .label.on text { fill: ${v('accent-ink')}; }
.aerie .edge.dim { opacity: ${String(op['edge-dim'])}; }
.aerie .label.dim, .aerie .head.dim { opacity: ${String(op.dim)}; }
.aerie .head { transition: opacity var(--aerie-dimming) ease; }

/* The scenario trail (LOOK-701 to LOOK-704): violet steps, the current one drawn in live light.
   It is drawn over everything but answers no pointer, so a box or open control under a curve or
   badge can still be clicked (INT-303). */
.aerie .trail, .aerie .badges { pointer-events: none; }
.aerie .overview-step { pointer-events: all; cursor: pointer; }
.aerie .overview-step:focus-visible { outline: none; }
.aerie .overview-step:focus-visible circle { stroke: ${v('live')}; stroke-width: 3px; }
.aerie .overview-trail .step.now.call .curve { animation: none; stroke-dasharray: none; stroke-dashoffset: 0; }
.aerie .step .curve, .aerie .step .arrow {
  fill: none; stroke: ${v('accent-ink')}; stroke-width: 2px; stroke-linecap: round; stroke-linejoin: round;
  filter: drop-shadow(0 0 3px ${mix('glow', 60)});
}
.aerie .step.now .curve, .aerie .step.now .arrow {
  stroke: ${v('live')}; stroke-width: 2.6px; filter: drop-shadow(0 0 5px ${mix('live', 75)});
}
.aerie .step.reply .curve { stroke: ${v('trail-back')}; stroke-width: 2.6px; stroke-dasharray: 1 6; }
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
.aerie .badge circle { fill: ${v('surface')}; stroke: ${v('accent-ink')}; stroke-width: 1.2px; }
.aerie .badge.now circle {
  fill: ${v('accent')}; stroke: ${v('live')}; stroke-width: 1.5px;
  filter: drop-shadow(0 0 8px ${mix('glow', 80)});
  animation: aerie-ping calc(var(--aerie-glide) * 1.6) var(--aerie-ease) 2;
}
@keyframes aerie-ping { 0% { stroke-width: 10px; stroke-opacity: 0; } 30% { stroke-opacity: 0.5; } 100% { stroke-width: 1.5px; stroke-opacity: 1; } }
.aerie .${BADGE_TEXT.className} { font: ${badgeFont}; fill: ${v(BADGE_TEXT.colour)}; text-anchor: middle; }
.aerie .badge.now .${BADGE_TEXT.className} { font-size: ${String(BADGE_TEXT.currentSize)}px; fill: ${v(BADGE_TEXT.currentColour)}; }

/* Lanes (LOOK-706). */
.aerie .lane-line { fill: none; stroke: ${mix('frame', 55)}; stroke-width: 1px; stroke-dasharray: 2 5; }
.aerie .row { fill: none; }
.aerie .row.now { fill: ${mix('accent', 14)}; }

/* The stage behind the diagram (LOOK-307): a dot grid under a dawn at the top. */
.aerie-stage {
  background-color: ${v('bg')};
  background-image:
    radial-gradient(ellipse 70% 55% at 50% -12%, ${mix('dawn', 95)}, transparent 70%),
    radial-gradient(circle at 1px 1px, ${v('grid')} 1px, transparent 1.4px);
  background-size: auto, 22px 22px;
}`;
}
