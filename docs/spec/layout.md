# Layout

How Aerie places what a view draws: the narrow layout interface, the split of work between the ELK
engine and Aerie's own code, text measuring and the audience space reserve, what happens when a reader
opens or closes something in place, the two scenario layouts (the trail and the lanes), and the rule
checks and readability scores that guard all of it.

Requirement ids: `LAYOUT-nnn`, `RULE-nnn` for rule checks, `SCORE-nnn` for readability scores.
Conventions are in [overview.md](overview.md#reading-this-spec). Sizes are CSS pixels at camera scale 1.

## Who does what

Structure views are laid out by ELK (the `elkjs` package), used unmodified behind Aerie's own
interface (decision [0004](../decisions/0004-elk-hybrid-layout.md)). Everything that makes the layout
Aerie's is Aerie's own code:

| ELK does                                                   | Aerie does                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| layering, crossing reduction and placement of boxes        | choosing what is drawn: views, zoom state, lifting and merging (model.md) |
| sizing open containers around their children, with padding | measuring and wrapping text, sizing every box and label                   |
| routing edges as horizontal and vertical segments          | reserving space for every audience's wording                              |
| placing edge labels                                        | rim placement of people and outside systems (through an ELK option)       |
|                                                            | the open and close transitions, the camera and fitting                    |
|                                                            | the whole scenario layout: the trail on the map and the lanes             |
|                                                            | rule checks and readability scores                                        |

## The layout interface

- **LAYOUT-001** The product lays out structure views only through this interface. Nothing outside
  the ELK adapter knows ELK exists.

```ts
interface LayoutEngine {
  layout(graph: LayoutGraph): Promise<LayoutResult>;
}

interface LayoutGraph {
  nodes: LayoutNode[]; // drawn elements in model order, parents before children
  edges: LayoutEdge[]; // drawn edges in the order of MODEL-303
}

type LayoutNode =
  | { id: string; parent: string | null; rim: boolean; open: false; width: number; height: number }
  | {
      id: string;
      parent: string | null;
      rim: boolean;
      open: true;
      minWidth: number;
      header: number;
    };

interface LayoutEdge {
  id: string; // "a->b" (MODEL-303)
  source: string;
  target: string;
  label: { width: number; height: number };
}

interface LayoutResult {
  width: number;
  height: number;
  boxes: Record<string, Box>; // every node, in picture coordinates, origin at the top left
  edges: Record<string, { points: Point[]; label: Box }>;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}
```

- **LAYOUT-002** Only the ELK adapter (`src/layout/elk/`) imports `elkjs`; a lint rule enforces it.
  Swapping in another engine later means writing another `LayoutEngine` and nothing else.
- **LAYOUT-003** Layout is deterministic: the same graph gives the same result, in the browser and in
  Node. Every number in a result is rounded to two decimal places before anything uses it.
- **LAYOUT-004** The layout graph never depends on the audience (LAYOUT-201), so one layout serves
  every audience.
- **LAYOUT-005** In the browser, layout runs in a Web Worker so the page stays responsive. In tests it
  runs in the same process.
- **LAYOUT-006** Every node has a box. Every edge has at least two points; the first lies on the
  source's box outline and the last on the target's, and the label box sits beside the route.

## Measuring and wrapping text

- **LAYOUT-101** Text is measured from the glyph advance widths in Aerie's bundled font files, not by
  asking the browser, so a layout is the same in Node, in every browser and on every system. The width
  of a string is the sum of its advance widths at the font size, rounded up to a whole pixel. A
  character the bundled fonts lack counts one em.
- **LAYOUT-102** Kerning and ligatures are off when measuring and when drawing, so drawn text is as
  wide as measured text.
- **LAYOUT-103** The font, size and wrap width of each text role are set in
  [look.md](look.md#type-scale). Taglines wrap at the tagline width and edge labels at the label width.
  Names never wrap.
- **LAYOUT-104** Wrapping is greedy: words are added to a line while the line fits. A word wider than
  the wrap width on its own is split after the last `/`, `.`, `-`, `_`, `:` or `,` that fits, or before
  an upper-case letter that follows a lower-case one, or failing those after the last character that
  fits. Text is never cut short and never ends in an ellipsis.

## Sizes and the audience space reserve

Box anatomy and metric names (`pad`, `icon`, `iconGap`, and so on) are defined in
[look.md](look.md#box-anatomy).

- **LAYOUT-201** Every size is the largest the wording of any audience needs. Switching audience then
  changes words only and moves nothing, on every view and at every zoom. The reserve is always on in
  v1.
- **LAYOUT-202** For an element, let `textWidth` be the widest of: its name, every tagline line and
  the closed-container chip ("3 parts inside"), over every audience, each measured in that audience's
  face; and let `lines` be the most tagline lines any audience needs (0 when no audience has a
  tagline). Then, with `control = toggle + toggleGap` for a container and 0 for a leaf:
  - `content = max(icon, nameLine + lines * textLine)`;
  - a leaf or closed box is `width = max(minWidth, pad + icon + iconGap + textWidth + control + pad)`
    and `height = 2 * pad + content`, plus `chipLine` for a closed container;
  - an open container has `header = pad + content + headGap` and
    `minWidth = pad + icon + iconGap + textWidth + control + pad`.
- **LAYOUT-203** An edge label's text is its label (MODEL-304) for each audience, wrapped at the label
  width in that audience's face. Its box is `labelPadX` wider on each side than the widest line and
  `labelPadY` taller on each side than its lines (`lines * labelLine`). The reserved box is the widest
  and tallest over every audience.
- **LAYOUT-204** Drawn text sits at fixed places in its reserved space: box text from the left at
  `pad + icon + iconGap`, label text centred in its label box.
- **LAYOUT-205** No state style (selection, hover, focus, playback) changes the size or face of text,
  because the reserve was measured for one weight. Emphasis is shown with colour and strokes.

## ELK configuration

- **LAYOUT-301** The adapter sends one ELK graph per picture, with these options on the root:

  | Option                                           | Value              |
  | ------------------------------------------------ | ------------------ |
  | `elk.algorithm`                                  | `layered`          |
  | `elk.direction`                                  | `DOWN`             |
  | `elk.hierarchyHandling`                          | `INCLUDE_CHILDREN` |
  | `elk.edgeRouting`                                | `ORTHOGONAL`       |
  | `elk.layered.nodePlacement.strategy`             | `NETWORK_SIMPLEX`  |
  | `elk.layered.considerModelOrder.strategy`        | `NODES_AND_EDGES`  |
  | `elk.layered.spacing.nodeNodeBetweenLayers`      | `30`               |
  | `elk.spacing.nodeNode`                           | `26`               |
  | `elk.spacing.edgeNode`                           | `14`               |
  | `elk.spacing.edgeEdge`                           | `12`               |
  | `elk.spacing.edgeLabel`                          | `4`                |
  | `elk.json.shapeCoords` and `elk.json.edgeCoords` | `ROOT`             |

- **LAYOUT-302** Each open container gets these options, where `containerPad` is 18:
  - `elk.padding`: `[top=<header>, left=18, bottom=18, right=18]`;
  - `elk.nodeSize.constraints`: `MINIMUM_SIZE`;
  - `elk.nodeSize.minimum`: at least `<minWidth>` wide and `<header + 30>` tall. With
    `INCLUDE_CHILDREN` and `DOWN`, ELK reads a nested container's minimum width for height, so the
    adapter writes the pair as `(<header + 30>, <minWidth>)`.
- **LAYOUT-303** Each rim node (MODEL-003) gets `elk.layered.layering.layerConstraint: FIRST`, so
  people and outside systems sit on the top rank of their container, above the system. Top-down
  layout keeps a long chain readable: a label costs its height, not its width. ELK cannot put both
  ends of an edge on one rank, so rim nodes get the constraint in model order, skipping any that an
  edge joins, directly or through elements inside them, to one that already has it in the same
  container.
- **LAYOUT-304** Every edge label is sent with its reserved width and height and a non-empty `text`
  (ELK ignores a label without text). Options that place a label are set on the label itself, where
  ELK reads them.
- **LAYOUT-305** `elkjs` is pinned to an exact version and never patched. Its licence (EPL-2.0) and a
  link to its source ship with Aerie in a third-party notices file.
- **LAYOUT-306** This table is the starting configuration. Changing it is a deliberate change: it moves
  goldens and screenshots, which are reviewed, and must not make any readability score worse.

## Opening and closing in place

- **LAYOUT-401** Opening or closing a container, switching view, or a live update from the editor
  computes the new drawn set, edges and layout from scratch. Stability comes from keeping model order
  and from ELK's model-order option, not from editing the old layout.
- **LAYOUT-402** The change animates in three overlapping parts, matching elements by id (timings in
  [look.md](look.md#motion); `G` is the glide time):
  1. elements in both pictures glide from their old box to their new box over `G`, and edges and
     labels disappear at once;
  2. elements that are new are placed at their new box and fade in, starting at `0.4 G` and lasting
     `0.7 G`; elements that leave shrink toward the middle of their nearest drawn ancestor's header
     and fade out over `0.5 G`;
  3. the new edges and labels fade in, starting at `G + 60 ms` and lasting `0.6 G`.
- **LAYOUT-403** Changes never interleave: a change that arrives during a transition first finishes
  the current one at once, then starts.
- **LAYOUT-404** The camera is in **fit mode** at first and after the reader presses Fit. In fit mode,
  every layout change fits the whole picture on screen (LAYOUT-451), gliding with the elements. Once
  the reader magnifies or pans, the camera is in **free mode**: opening or closing a container then
  keeps that container's top-left corner at the same place on screen at the same scale. Switching view
  always fits and returns to fit mode.

### Fitting

- **LAYOUT-451** Fitting scales the picture to fill the stage less a 34 px margin on every side and,
  while a caption bar shows, less 92 px at the bottom. The scale is never more than 1.15. The picture is
  centred across, and centred down with its top at least 34 px from the top of the stage.
- **LAYOUT-452** The reader can magnify between 0.2 and 2.5 times
  ([interaction.md](interaction.md#the-camera)).

## Scenarios on the map: the trail

A scenario plays on the structure view itself, at the reader's current zoom (MODEL-405). Its trail is
drawn over the layout; it never moves a box.

- **LAYOUT-501** A step between two different lifts is a quadratic curve. With `a` and `z` the centres
  of the two boxes, `d = z - a` and `len = |d|`, the control point is the midpoint of `a` and `z`
  pushed sideways by `bend = min(64, 0.24 * len)`, to the left of the direction of travel as seen on
  screen. A call and its reply therefore bow to opposite sides and never lie on top of each other.
- **LAYOUT-502** Each end of the curve is where the line from the box's centre toward the control
  point leaves the box grown by 5 px on every side.
- **LAYOUT-503** The step's number badge sits at the curve's middle point, `(p0 + 2c + p2) / 4`.
- **LAYOUT-504** A folded step (MODEL-405) is a small loop on the right edge of its box. The k-th
  folded step drawn on one box sits at `y = top + 16 + ((k - 1) mod slots) * 22`, with
  `slots = max(1, floor((height - 16) / 22))`, starting and ending 5 px above and below that line at
  `x = right + 3` and bulging 26 px to the right. Its badge sits 20 px to the right of `x`.
- **LAYOUT-505** The trail is redrawn from the current lifts whenever the zoom changes during
  playback.

## Scenarios as lanes

The second way to read a scenario puts time down the page: one lane per participant, one row per step.
Aerie lays it out with its own algorithm; ELK is not involved.

- **LAYOUT-601** The lanes are the lifts of all step ends in the stage view's current drawn set, each
  once. A step whose ends lift to the same element is a **self step** on that lane.
- **LAYOUT-602** Lanes keep the arrangement of the structure view, so the reader finds each part where
  they left it: build the tree of the lanes and their drawn ancestors; order the children of each node
  by the x of their box centre in the structure layout (then by y, then by model order); the lanes are
  the depth-first order of that tree. The lanes of one container are always next to each other.
- **LAYOUT-603** Each lane has a header box at the top, sized and drawn like a leaf box (LAYOUT-202).
  Above the headers, each drawn ancestor that holds lanes has a band spanning its lanes with its name;
  bands stack by depth. A lane line runs down from each header to below the last row.
- **LAYOUT-604** Each step is one row, in order. A row is as tall as the step's reserved label
  (LAYOUT-203, using the step's verb phrase) plus 16 px, and at least 24 px for a self step.
- **LAYOUT-605** Lane centres are placed left to right. The first is at half its header's width. Each
  next one is the furthest right of these: the previous centre plus half of both headers plus 32 px;
  and, for each step between an earlier lane `i` and this lane, lane `i`'s centre plus that step's
  reserved label width plus 16 px. A self step on the previous lane also needs the previous centre plus
  24 px plus its label width plus 16 px. A band is at least as wide as its name needs, and the first
  lane after a band keeps its header 32 px clear of it. The lanes picture is as wide as the right
  edge of the last header, the end of the last lane's self-step labels or the right edge of a band,
  whichever is furthest.
- **LAYOUT-606** A call or reply is a horizontal arrow at the bottom of its row, from the subject's
  lane to the object's, with its label centred above it and its number badge at its start. A self step
  is a loop to the right of its lane, its label to the right of the loop.
- **LAYOUT-607** The lanes layout reserves space for every audience like the structure layout, so
  switching audience moves nothing. It is deterministic, and its cost grows in step with the number of
  steps and lanes.

## Rule checks

Rule checks run in the `rules` suite on every committed sample, for every view, every audience and the
zoom states default, everything open and all closed (MODEL-211), and for every scenario's lanes on its
stage view at those zoom states. A tolerance of 0.5 px applies to every comparison.

- **RULE-001** No overlaps: two drawn boxes that do not contain each other do not intersect.
- **RULE-002** Children inside parents: every drawn child lies inside its parent's box, below the
  parent's header and at least `containerPad` from its other sides.
- **RULE-003** Labels fit: for every audience, every name, tagline line and chip fits the width left
  for text in its box, and every label line fits its label box less its padding; the lines fit the
  height.
- **RULE-004** Labels stay clear: no edge label box meets a leaf or closed box, an open container's
  header, or another label box.
- **RULE-005** Switching audience moves nothing: the layout graph and the layout result are equal for
  every audience.
- **RULE-006** Every relationship is drawn: every edge's route has at least two points, starts on its
  source box and ends on its target box, and every carried relationship (MODEL-302) has its edge.
- **RULE-007** Lines go around: no edge segment crosses the inside of a leaf or closed box other than
  its own ends, or an open container's header unless the container is an end or holds one.
- **RULE-008** Text is large enough: every text role on the diagram is at least 13.5 px at scale 1,
  except the numbers in step badges.
- **RULE-009** Layout is deterministic: laying out the same graph twice gives equal results.
- **RULE-010** Lanes are tidy: headers do not overlap, rows do not overlap, every label fits between
  the lanes it spans, and switching audience moves nothing.
- **RULE-011** Every scenario step is drawn: at every zoom state tested, each step has a curve or a
  loop on the trail and an arrow or a loop in the lanes.

## Readability scores

Scores are measured in the same states as the rule checks and kept in a committed baseline. A check
fails when any score gets worse than its baseline; a better score passes and asks for the baseline to
be updated in the same change, so improvements are kept.

- **SCORE-001** Edge crossings: the number of points where two edge routes cross. Lower is better.
- **SCORE-002** Bends: the number of corners in all edge routes. Lower is better.
- **SCORE-003** Fit scale: the scale at which the picture fits a 1920 x 1080 window with the sidebar
  and side panel showing. Higher is better, because text on screen is larger.
- **SCORE-004** Contrast: the lowest contrast ratio of any text colour on any surface it is drawn on,
  for each theme ([look.md](look.md#contrast)). Higher is better, and it never falls below 4.5.
- **SCORE-005** Accessibility: the number of problems an automated accessibility audit finds in each
  picture in the browser. Lower is better, and the target is 0.

## Performance

- **LAYOUT-901** Targets, measured and reported by the rules suite but not used to fail it: laying out
  any Lotto picture takes under 50 ms, and a picture of 100 boxes under 150 ms, on the CI machine; a
  transition keeps 60 frames a second on the Lotto sample.
