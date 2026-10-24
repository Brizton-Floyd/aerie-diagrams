// Model semantics (docs/spec/model.md): what a canonical model means, as pure TypeScript with no
// DOM or Node dependency. Layout, drawing, interaction and links build on this API.
//
// How the slices after A3 use it:
//
//   const semantics = new Semantics(model);            // once per model; checks its references
//   const picture = defaultPicture(semantics);         // MODEL-602, or normalisePicture(link)
//   const drawing = semantics.drawing(picture.view, picture.zoom);
//   // drawing.nodes and drawing.edges are the same for every audience: lay them out once, and
//   // reserve space for the wording of every audience in semantics.model.audiences:
//   const scenes = semantics.model.audiences.map((a) => semantics.scene(drawing, a.id));
//
// - `Drawing` (audience-independent): the drawn elements in model order, parents first, each a
//   leaf, an open container (maybe open partly) or a closed one with its child count; and the
//   drawn edges in MODEL-303 order, each with the relationships it carries.
// - `Scene` (one audience): the drawing with names, taglines, kind labels, descriptions, edge
//   labels with " (+N more)", and each carried relationship's own sentence.
// - Zoom: `semantics.scope(view)` opens, closes, reveals and normalises zoom states; the picture
//   functions do the same for a whole picture and keep it normalised (MODEL-603).
// - Scenarios: `semantics.stage`, `semantics.steps` (worded steps with replies and captions) and
//   `semantics.trail` (lines and folded loops on the current drawn set, visited and current).
// - Walkthroughs: `semantics.walkPictures` (the picture of every step) and `semantics.narration`;
//   `present`, `presentForward` and `presentBack` move through a presentation.
// - `check(source)`: the parser's diagnostics plus the model stage's (E604, E703).
export { check, modelDiagnostics } from './check.ts';
export { drawnEdges, lift, type DrawnEdge } from './lift.ts';
export {
  closeContainer,
  defaultPicture,
  normalisePicture,
  openContainer,
  overview,
  play,
  present,
  presentBack,
  presentForward,
  presentStep,
  reveal,
  select,
  stop,
  switchAudience,
  switchView,
  type Activity,
  type Dropped,
  type Picture,
} from './picture.ts';
export { Joins, participants, type StepRole, type Trail, type TrailStep } from './scenarios.ts';
export {
  Semantics,
  type CarriedRelationship,
  type DrawnNode,
  type Drawing,
  type ResolvedStep,
  type Scene,
  type SceneEdge,
  type SceneNode,
  type WalkPicture,
} from './semantics.ts';
export { InvalidModelError, Tree } from './tree.ts';
export {
  DEFAULT_ZOOM,
  OVERVIEW,
  ViewScope,
  type DrawnSet,
  type DrawnState,
  type Zoom,
  type ZoomMark,
} from './views.ts';
export { proseFor, sentence, wordsFor } from './words.ts';
