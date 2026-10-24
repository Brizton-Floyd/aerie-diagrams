// The Signal renderer (docs/spec/look.md): draws a laid-out picture as SVG in the Signal look, as
// pure TypeScript that runs the same in Node and in the browser. It builds on the language, the
// model and the layout (src/lines/index.ts, src/model/index.ts, src/layout/index.ts).
//
// How the slices after A5 use it:
//
//   const picture = await layouter.picture(view, zoom, audience);
//   const svg = renderPicture(semantics, picture, { focus, trail });   // an SvgNode tree
//   stage.innerHTML = toMarkup(svg);                                   // or walk the tree
//   // once per page: a <style> with signalStyle(); the theme is `data-theme` on an ancestor
//   // ("light", else dark), reduced motion is `data-motion="reduce"`.
//
// - Drawings carry classes and geometry only. Every colour, stroke width, face and timing is in the
//   stylesheet, written from the tokens (tokens.ts, style.ts), so a theme switch redraws nothing.
// - Box groups (`g.node`, `data-id`) are translated into place, so a glide can move a whole group.
//   Their state is in classes: `leaf`, `closed`, `open depth-N`, `person`, `external`, and the
//   focus marks of emphasis.ts (`sel`, `rel`, `now`, `full`, `context`, `dim`). An open
//   container's header text is its own group (`g.head`, same `data-id`) above the lines.
// - Text elements carry their measured width as `data-width`; drawn text keeps kerning and
//   ligatures off (LAYOUT-102), so the browser draws them exactly that wide.
// - `interactive: true` draws for the page a reader explores (INT-901 to INT-903): focusable boxes
//   announced with their name and tagline, the control's tooltip, and a hover box for each label.
// - The trail on the map comes from `trailShapes` (src/layout/trail.ts); `renderLanes` draws a
//   scenario's lanes.
export { emphasis, type EdgeMark, type Emphasis, type Focus, type NodeMark } from './emphasis.ts';
export { ICONS, ICON_GRID, ICON_STROKE, icon, type IconShape } from './icons.ts';
export { LANE_SHAPE, renderLanes, scenarioTitle } from './lanes.ts';
export {
  SHAPE,
  cornerOf,
  drawBox,
  drawHead,
  drawTrail,
  renderPicture,
  textLine,
  TOGGLE_TIP,
  type BoxLook,
  type RenderOptions,
  type Spoken,
} from './picture.ts';
export { ROUTE, chevron, roundedRoute } from './route.ts';
export { DAWN_ID, HATCH_ID, MOTION, signalStyle, tokenMix, tokenVar } from './style.ts';
export {
  classes,
  el,
  escape,
  num,
  path,
  textOf,
  toMarkup,
  translate,
  walk,
  type SvgNode,
  type Value,
} from './svg.ts';
export {
  DEFAULT_THEME,
  LINE_PAIRINGS,
  OPACITY,
  TEXT_PAIRINGS,
  THEMES,
  TOKENS,
  bandOf,
  contrast,
  lowestTextContrast,
  luminance,
  pairingContrast,
  type Pairing,
  type Palette,
  type Theme,
  type Token,
} from './tokens.ts';
export { BADGE_TEXT, DRAWN, FAMILIES, font, type DrawnRole } from './type.ts';
