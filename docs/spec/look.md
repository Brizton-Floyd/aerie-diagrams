# Look: the Contour visual system

Aerie looks like **Contour**: the system as surveyed terrain seen from above (decision
[0005](../decisions/0005-contour-look.md)). Paper and ink; containers are contour bands that deepen as
the reader goes inward; outside systems are hatched like land off the edge of the map; a scenario is a
red trail with numbered waypoints; the wording reads like a printed guide. This document is the full
set of tokens and drawing rules. Sizes are CSS pixels at camera scale 1.

Requirement ids: `LOOK-nnn`. Conventions are in [overview.md](overview.md#reading-this-spec).

## Colour

- **LOOK-001** Colours come only from these tokens. The light theme is the paper map; the dark theme is
  the night map. Both are part of v1.

  | Token          | Light                    | Dark                    | Used for                                                 |
  | -------------- | ------------------------ | ----------------------- | -------------------------------------------------------- |
  | `bg`           | `#f3eee2`                | `#1b1d1a`               | the stage behind the diagram                             |
  | `paper`        | `#fbf8f0`                | `#24271f`               | boxes, the top bar, sidebar, side panel and caption bar  |
  | `ink`          | `#2a2924`                | `#ece5d2`               | names, main text, box outlines                           |
  | `muted`        | `#5f594d`                | `#b3ac98`               | taglines, secondary text                                 |
  | `rule`         | `#cdc2aa`                | `#3c3f35`               | dividing lines in the page chrome (decoration only)      |
  | `band-0`       | `#ebe6d3`                | `#262923`               | an open container at depth 0                             |
  | `band-1`       | `#e2e2cb`                | `#2b3027`               | an open container at depth 1                             |
  | `band-2`       | `#d7dcc2`                | `#31372b`               | an open container at depth 2                             |
  | `band-3`       | `#ccd5b9`                | `#373f2f`               | an open container at depth 3 or deeper                   |
  | `contour`      | `#7b7156`                | `#9a9680`               | open container outlines                                  |
  | `contour-soft` | `#bdb294`                | `#57584a`               | the dotted inner contour line (decoration only)          |
  | `edge`         | `#4a463c`                | `#cfc6ad`               | relationship lines and arrows                            |
  | `halo`         | same as `bg`             | same as `bg`            | the halo behind label text                               |
  | `accent`       | `#b9472a`                | `#e9805e`               | the survey red: selection, the trail, the audience thumb |
  | `accent-ink`   | `#9c3a20`                | `#f0906f`               | text in the survey red                                   |
  | `accent-soft`  | `#f2d9c9`                | `#4a2c22`               | the current step's row                                   |
  | `on-accent`    | `#ffffff`                | `#1b1d1a`               | text on an `accent` fill                                 |
  | `trail-back`   | `#a35c3d`                | `#c08068`               | reply steps on the trail                                 |
  | `hatch-bg`     | `#f6f1e5`                | `#22241f`               | the ground of an outside system                          |
  | `hatch-line`   | `#e0d5bd`                | `#34362e`               | the hatching of an outside system                        |
  | `texture`      | `#a08a5a` at 16% opacity | `#d8c89a` at 7% opacity | the faint contour lines on the stage                     |

- **LOOK-002** The theme follows the system's light or dark setting until the reader picks one with
  the theme button; the choice is remembered on that device. The theme is not part of a shared link.
- **LOOK-003** Opacity tokens: `dim` 0.2 (an element or label pushed back), `context` 0.55 (the frame
  of a container that holds something in focus), `edge-dim` 0.14 (a line pushed back), `past` 0.55 (an
  earlier step on the trail).

### Contrast

- **LOOK-011** Every text colour has a contrast ratio of at least 4.5 to 1 on every surface it is
  drawn on, in both themes: `ink`, `muted` and `accent-ink` on `bg`, `paper`, every band and
  `accent-soft`; `on-accent` on `accent`. Label text counts as drawn on `halo`. The tokens above meet
  this; the lowest is `accent-ink` on `band-3` in the light theme (4.54).
- **LOOK-012** Lines and shapes a reader needs (box outlines, open container outlines, relationship
  lines, the trail, the selection outline) have at least 3 to 1 against the surface next to them.
- **LOOK-013** Dimmed things (LOOK-003) are exempt while dimmed: dimming is how focus is shown, and the
  side panel always carries the full wording.

## Type

- **LOOK-101** Three families, all under the SIL Open Font License: **Source Serif 4** for wording,
  **Source Sans 3** for names and the interface, and **Source Code Pro** for the code voice and code.
  The fonts are bundled with Aerie and served with it, never fetched from a font service, and their
  licences ship in the third-party notices.
- **LOOK-102** An audience with the `code` flag (LANG-105) reads taglines, labels, descriptions,
  captions and narration in Source Code Pro, at the sizes the type scale gives for the code voice.
  Names stay in Source Sans 3 for every audience. Code spans in descriptions are Source Code Pro for
  everyone.
- **LOOK-103** All wording on the diagram is at least 13.5 px before any fitting (RULE-008). The only
  smaller text is the number in a step badge.

### Type scale

| Role                      | Face and style                                        | Size and weight                         | Line  | Wraps at  |
| ------------------------- | ----------------------------------------------------- | --------------------------------------- | ----- | --------- |
| element name              | Source Sans 3                                         | 14 px, 600                              | 18 px | never     |
| tagline                   | Source Serif 4                                        | 13.5 px, 400                            | 17 px | 230 px    |
| tagline, code voice       | Source Code Pro                                       | 13.5 px, 400                            | 17 px | 230 px    |
| chip ("3 parts inside")   | Source Serif 4 italic, `accent-ink`                   | 13.5 px, 400                            | 20 px | never     |
| edge label                | Source Serif 4 italic                                 | 13.5 px, 400                            | 17 px | 240 px    |
| edge label, code voice    | Source Code Pro                                       | 13.5 px, 400                            | 17 px | 240 px    |
| lanes band name           | Source Sans 3                                         | 13.5 px, 600                            | 18 px | never     |
| step badge number         | Source Serif 4                                        | 11 px, 600; 13 px when current          | -     | -         |
| caption                   | Source Serif 4                                        | 19 px, 400                              | 1.35  | the bar   |
| caption, code voice       | Source Code Pro                                       | 17 px, 400                              | 1.4   | the bar   |
| caption step count        | Source Serif 4, `accent-ink`                          | 26 px, 600, with "/14" at 14 px `muted` | -     | -         |
| presenter narration       | Source Serif 4                                        | 28 px, 400                              | 1.35  | the bar   |
| presenter narration, code | Source Code Pro                                       | 24 px, 400                              | 1.4   | the bar   |
| side panel kicker         | Source Sans 3 capitals, `accent-ink`, tracked 0.14 em | 11.5 px, 600                            | -     | -         |
| side panel title          | Source Serif 4                                        | 23 px, 600                              | 1.2   | the panel |
| side panel lead           | Source Serif 4 (code voice 16 px Source Code Pro)     | 18 px, 400                              | 1.45  | the panel |
| side panel text           | Source Serif 4 (code voice 14 px Source Code Pro)     | 15 px, 400                              | 1.5   | the panel |
| section heading           | Source Sans 3 capitals, `muted`, tracked 0.14 em      | 11.5 px, 600                            | -     | -         |
| sidebar heading           | Source Sans 3 capitals, `muted`, tracked 0.14 em      | 12 px, 600                              | -     | -         |
| sidebar item              | Source Serif 4                                        | 15 px, 400                              | -     | the bar   |
| audience tab              | Source Sans 3                                         | 14 px, 600                              | -     | never     |
| "Written for"             | Source Serif 4 italic, `muted`                        | 14 px, 400                              | -     | never     |
| wordmark "Aerie"          | Source Serif 4                                        | 21 px, 600                              | -     | never     |
| buttons                   | Source Sans 3                                         | 13 px, 600                              | -     | never     |
| editor text               | Source Code Pro                                       | 13.5 px, 400                            | 20 px | never     |

## Box anatomy

- **LOOK-201** The metrics the layout uses to size boxes (LAYOUT-202):

  | Metric         | Value | Meaning                                                                     |
  | -------------- | ----- | --------------------------------------------------------------------------- |
  | `pad`          | 12    | inner padding of a box                                                      |
  | `icon`         | 22    | icon size; the icon's top left is at (`pad`, `pad`)                         |
  | `iconGap`      | 10    | space between the icon and the text                                         |
  | `nameLine`     | 18    | the name's line; its baseline is 14 below the top of the line               |
  | `textLine`     | 17    | each tagline line; baselines 14 below the top of each line                  |
  | `chipLine`     | 20    | the chip line at the bottom of a closed container                           |
  | `toggle`       | 18    | the open and close control, a circle at the top right, `pad` from the edges |
  | `toggleGap`    | 10    | space kept between text and the control                                     |
  | `headGap`      | 6     | space between an open container's header text and its children              |
  | `minWidth`     | 150   | the narrowest a leaf or closed box may be                                   |
  | `containerPad` | 18    | padding between an open container's edge and its children                   |
  | `inset`        | 5     | how far inside the outline the inner contour line runs                      |
  | `labelPadX`    | 5     | label padding, left and right                                               |
  | `labelPadY`    | 2     | label padding, top and bottom                                               |
  | `labelLine`    | 17    | each label line                                                             |

- **LOOK-202** Text in a box is left-aligned from `pad + icon + iconGap`: the name on the first line,
  the tagline below it, and, in a closed container, the chip on the last line. The chip says how many
  children the container holds: "1 part inside", "3 parts inside".

## Shapes

- **LOOK-301** A leaf is a paper card: `paper` fill, 1 px `ink` outline, 4 px corners.
- **LOOK-302** A closed container is a paper card with 8 px corners, a 1 px `ink` outline, a solid
  1 px `contour` inner line `inset` from the edge, the chip, and the open control showing a plus.
- **LOOK-303** An open container is a contour band: filled with the band of its depth (`band-0` to
  `band-3`, deeper levels stay on `band-3`), a 1 px `contour` outline, 18 px corners, a dotted
  (`2 3`) `contour-soft` inner line `inset` from the edge, its header at the top, and the control
  showing a minus. Its header text is drawn above relationship lines, on a 5 px halo of its band,
  so a line that crosses the header (RULE-007 allows it) never cuts through the words.
- **LOOK-304** A `person` is a pill: corners as round as its height allows (up to 30 px), a 1.4 px
  `ink` outline.
- **LOOK-305** An `external` element is hatched: filled with 45 degree `hatch-line` lines, 2 px wide
  every 7 px, on `hatch-bg`, with a 1 px `ink` outline dashed `5 3`.
- **LOOK-306** On hover a box's outline thickens to 1.6 px; on keyboard focus it gets a 2 px `accent`
  focus ring 2 px outside the outline.
- **LOOK-307** The stage behind the diagram carries a faint texture of contour lines in `texture`,
  drawn by Aerie as a repeating tile about 520 x 360 px of six soft curves at 1.2 px.

## Icons

- **LOOK-401** Icons are Aerie's own line drawings on a 64-unit grid: strokes only, round caps and
  joins, dots drawn as small filled circles, a stroke of 4.2 units (about 1.4 px at 22 px), in `ink`.
- **LOOK-402** The v1 set, by name: `person` (head and shoulders), `stack` (three stacked layers),
  `web` (a browser window with code brackets), `api` (a block with lines in and an arrow out), `gear`
  (a cog), `module` (a cube), `route` (a point with an arrow leaving it), `dice` (a die showing five),
  `search` (a magnifying glass), `books` (books on a shelf), `grid` (a table), `monitor` (a screen on a
  stand), `cylinder` (a storage drum), `history` (a clock with an arrow turning back), `refresh` (two
  arrows chasing round), `document` (a page with a folded corner), `archive` (a box with a lid),
  `building` (an office block), and `box` (a plain rounded square, the default).

## Relationships

- **LOOK-501** A relationship line is a 1.3 px `edge` stroke along its route, with each corner rounded
  to 9 px (less where a segment is shorter than 18 px), ending in an open chevron arrowhead 12 px long,
  stroked 1.6 px with round caps.
- **LOOK-502** A label is its text with no box: italic serif (or the code voice), in `ink`, over a
  5 px halo of `halo` drawn behind the letters so lines and bands do not cut through them.
- **LOOK-503** Hovering a label shows its full sentence (MODEL-305) as a tooltip.

## Selection and focus

- **LOOK-601** A selected element gets a 2.2 px `accent` outline, and its inner contour line turns
  `accent` at half opacity. Its relationships turn `accent` (1.8 px, with an `accent` arrowhead) and
  their labels `accent-ink`. Their other ends keep full strength with a 1.6 px outline.
- **LOOK-602** Elements inside the selected element keep full strength. The containers around the
  selected element and around its related elements keep their text, and their frames drop to
  `context`. Everything else drops to `dim`, and other lines to `edge-dim`.
- **LOOK-603** Walkthrough focus looks like selection, applied to every focused element at once.

## Scenario trail

- **LOOK-701** A call step is a 2.4 px `accent` curve with round caps and a chevron arrowhead. The
  current step draws itself from its start to its end in 900 ms.
- **LOOK-702** A reply step is a 2.6 px `trail-back` dotted curve (dashes `1 5`, round caps). It
  appears whole rather than drawing itself.
- **LOOK-703** Earlier steps stay on the map, thinner (1.6 px) and at `past`.
- **LOOK-704** Each step has a numbered badge: a circle of radius 9 with a `paper` fill, a 1.6 px
  `accent` outline and its number in `accent-ink`. The current step's badge has radius 12, an `accent`
  fill and its number in `on-accent`.
- **LOOK-705** The current step's two elements get a 2.2 px `accent` outline. Elements visited so far
  keep full strength, the containers around them drop to `context`, everything else to `dim`, and
  relationship lines to `edge-dim`.
- **LOOK-706** In lanes, headers and bands use the box and band looks above, lane lines are 1 px
  `contour` dashed `3 4`, arrows and badges follow LOOK-701 to LOOK-704, and the current step's row is
  tinted `accent-soft`.

## Page chrome

- **LOOK-801** The page is a grid: a 58 px top bar across the whole width; below it a 214 px sidebar
  on the left, the stage in the middle and a 344 px side panel on the right. Aerie v1 is designed for
  windows from 1280 x 720 up.
- **LOOK-802** The top bar is `paper` with a 3 px double `rule` line below. From the left: the logo
  and the wordmark "Aerie"; the breadcrumb (model title, a slash, the view title, and while a scenario
  plays, a slash and its title); then, on the right, the label "Written for" with the audience tabs
  (104 px each, `muted`, the current one `ink`, with a 3 px `accent` underline that glides to it); then
  the buttons "Copy link", "Edit" and the theme button ("Dark" or "Light").
- **LOOK-803** The sidebar is `paper` with a `rule` line on its right. Its headings are "Views",
  "Scenarios" and "Walkthroughs". The current item has a `band-1` background and a 3 px `accent` bar on
  its left. Scenario items start with a small `accent` play triangle. At the bottom is the "Reduce
  motion" checkbox.
- **LOOK-804** The side panel is `paper` with a `rule` line on its left and 22 px padding. Sections are
  separated by `rule` lines. Names in sentences are links in Source Sans 3 600, underlined in
  `contour-soft`, turning `accent` on hover. Verb phrases in sentences are italic. Buttons are outlined
  1 px `ink` with 3 px corners and turn `ink` with `paper` text on hover; the scenario Play button is
  filled `accent` with `on-accent` text.
- **LOOK-805** The caption bar sits at the bottom of the stage, 24 px from its sides and 18 px from its
  bottom: `paper`, a 1 px `rule` border with a 4 px `accent` left edge, the step count, then the text.
- **LOOK-806** The camera buttons (plus, minus and "Fit all") sit at the stage's top right: small `paper`
  buttons with a `rule` border.
- **LOOK-807** The logo is three nested, slightly irregular closed contours, like a hill seen from
  above, stroked in `ink`, with a small `accent` dot near the summit.
- **LOOK-808** Back and Forward (INT-553) sit at the stage's top left, 14 px from its edges, as small
  `paper` buttons with a `rule` border like the camera buttons; one that leads nowhere has `muted`
  arrows. After them the recent visits (INT-555) are one `paper` bar with a `rule` border: each name
  112 px wide in Source Sans 3 13 px `muted`, cut short with an ellipsis (its full name in the
  tooltip), separated by a small `muted` chevron, and the current one `ink`, 600, on `band-1`. The stage's
  notice sits below them.

## Motion

- **LOOK-901** Motion is an unhurried glide. The timings:

  | Motion                                                           | Timing                                              | Easing                        |
  | ---------------------------------------------------------------- | --------------------------------------------------- | ----------------------------- |
  | glide `G`: boxes, containers, the camera, the audience underline | 560 ms                                              | `cubic-bezier(.45,.05,.25,1)` |
  | new elements fade in                                             | start at `0.4 G`, last `0.7 G`                      | ease                          |
  | leaving elements shrink and fade                                 | `0.5 G`                                             | ease                          |
  | lines and labels fade in after a change                          | start at `G + 60 ms`, last `0.6 G`                  | ease                          |
  | wording swap on an audience switch                               | 170 ms out, then 170 ms in                          | ease                          |
  | side panel content swap                                          | 170 ms out, then 170 ms in                          | ease                          |
  | dimming and highlighting                                         | 280 ms                                              | ease                          |
  | hover colours                                                    | 250 ms                                              | ease                          |
  | the current trail step draws itself                              | 900 ms                                              | `cubic-bezier(.45,.05,.25,1)` |
  | scenario autoplay                                                | one step every 2400 ms                              | -                             |
  | presenter controls hide                                          | after 2500 ms without pointer movement, 300 ms fade | ease                          |
  | "Link copied" confirmation                                       | 1400 ms                                             | -                             |

- **LOOK-902** Persisting things glide; new things fade in; nothing bounces or overshoots.
- **LOOK-903** **Reduced motion** sets every duration and delay above to zero: changes appear at once,
  the trail is drawn whole, wording swaps in place, and the camera jumps. The autoplay pace is not
  motion: Play still advances one step every 2400 ms. It is on when the system asks for reduced
  motion, until the reader changes the "Reduce motion" checkbox; the choice is remembered on that
  device.
