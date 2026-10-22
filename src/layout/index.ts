// Layout (docs/spec/layout.md): where everything a view draws goes, as pure TypeScript that runs the
// same in Node, in the browser and in a Web Worker. It builds on the model (src/model/index.ts).
//
// How the slices after A4 use it:
//
//   const engine = workerEngine();                    // browser (elk/worker.ts); Node: inProcessEngine()
//   const layouter = new Layouter(semantics, engine);  // once per model
//   const picture = await layouter.picture(view, zoom, audience);
//   // picture.result: every box, route and label box (LayoutResult), the same for every audience;
//   // picture.text: the audience's names, taglines, chips and labels at their places (LAYOUT-204).
//   const lanes = await layouter.lanes(scenario, stageView, zoom);
//   const lanesText = placeLanesText(lanes, audience);
//
// - The engine is behind `LayoutEngine` (LAYOUT-001); only src/layout/elk/ imports `elkjs`
//   (LAYOUT-002, enforced by lint). The engines live in their own modules so the browser bundle
//   never pulls in the in-process ELK: import `inProcessEngine` from './elk/in-process.ts' and
//   `workerEngine` from './elk/worker.ts'.
// - Opening, closing or switching view lays the picture out again from scratch (LAYOUT-401); the
//   layouter keeps recent layouts, so switching audience or going back costs nothing.
// - Text is measured from the bundled fonts (text/measure.ts). Draw it with `DRAWN_TEXT_STYLE`
//   (kerning and ligatures off, LAYOUT-102) in the face `faceOf(ROLES[role].face)` gives.
// - `checkStructure`, `checkLanes` and `scores` are the rule checks and readability scores the
//   rules suite runs on every sample.
export { BOX, TEXT_LEFT, control } from './anatomy.ts';
export {
  LANES,
  layoutLanes,
  placeLanesText,
  type Lane,
  type LaneBand,
  type LaneRow,
  type LanesLayout,
  type LanesWording,
  type PlacedLanesText,
} from './lanes.ts';
export {
  boxText,
  chipText,
  closedSize,
  labelRole,
  labelSize,
  layoutGraph,
  openSize,
  reservedText,
  taglineRole,
  wordScene,
  type BoxText,
  type Wording,
} from './reserve.ts';
export {
  BESIDE,
  TOLERANCE,
  checkLanes,
  checkStructure,
  crossesInside,
  distanceToRoute,
  onOutline,
  overlaps,
  textLargeEnough,
  type Finding,
} from './rules.ts';
export {
  PAGE,
  REFERENCE_STAGE,
  better,
  bends,
  crossings,
  fitScale,
  scores,
  segmentsCross,
  worse,
  type Scores,
} from './scores.ts';
export {
  Layouter,
  placeText,
  type PictureLayout,
  type PlacedBoxText,
  type PlacedLine,
  type PlacedText,
  type StructureLayout,
} from './structure.ts';
export {
  DRAWN_TEXT_STYLE,
  ROLES,
  faceOf,
  measure,
  wrap,
  type FaceName,
  type RoleName,
  type TextLine,
  type TextRole,
} from './text/measure.ts';
export {
  round,
  type Box,
  type LayoutEdge,
  type LayoutEngine,
  type LayoutGraph,
  type LayoutNode,
  type LayoutResult,
  type Point,
} from './types.ts';
