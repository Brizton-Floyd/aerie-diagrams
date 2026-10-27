# Look: the Signal visual system

Aerie looks like **Signal**: an instrument panel at night (decision
[0007](../decisions/0007-signal-look.md)). Hairline cards rest on a near-black stage with a blue
cast; light is used only for what the reader is doing: violet for the selection and the trail, and
a cyan "live" light for the current step and the lines in play. Signal is dark by default and has a
light theme, the same panel in daylight, for bright rooms, projectors and print. This document is
the full set of tokens and drawing rules. Sizes are CSS pixels at camera scale 1.

Requirement ids: `LOOK-nnn`. Conventions are in [overview.md](overview.md#reading-this-spec).

## Colour

- **LOOK-001** Colours come only from these tokens. Both themes are part of v1.

  | Token           | Dark      | Light     | Used for                                                                   |
  | --------------- | --------- | --------- | -------------------------------------------------------------------------- |
  | `bg`            | `#090b10` | `#f3f4f8` | the stage behind the diagram, the top bar and the sidebar                  |
  | `surface`       | `#11141b` | `#ffffff` | boxes, the side panel, the stage's floating bars                           |
  | `ink`           | `#eceef4` | `#11141b` | names and main text                                                        |
  | `muted`         | `#9ba3b5` | `#535b6d` | taglines, labels, secondary text                                           |
  | `rule`          | `#1f2430` | `#e1e4ec` | the outline of a label's pill (decoration only)                            |
  | `outline`       | `#677189` | `#737b8f` | box outlines                                                               |
  | `outline-hover` | `#8a93a8` | `#5a6275` | the outline of the box under the pointer                                   |
  | `band-0`        | `#0e1117` | `#f7f8fb` | an open container at depth 0                                               |
  | `band-1`        | `#12161f` | `#f0f2f7` | an open container at depth 1                                               |
  | `band-2`        | `#161b26` | `#e9ecf3` | an open container at depth 2                                               |
  | `band-3`        | `#1a202d` | `#e3e7ef` | an open container at depth 3 or deeper                                     |
  | `frame`         | `#66708a` | `#747c90` | open container outlines                                                    |
  | `edge`          | `#6c768c` | `#737b90` | relationship lines and arrows                                              |
  | `pill`          | `#141823` | `#ffffff` | the pill behind a relationship label                                       |
  | `accent`        | `#6a59f4` | `#5a48e6` | the violet: a selected line, the current badge, filled controls            |
  | `accent-ink`    | `#ada4ff` | `#4a38d4` | violet text and lines: the selection outline, the trail, chips, kickers    |
  | `accent-soft`   | `#1d1a3d` | `#ece9ff` | a violet wash: a selected label's pill, the editor's selection             |
  | `on-accent`     | `#ffffff` | `#ffffff` | text on `accent` and on the tour button's gradient                         |
  | `live`          | `#22c8e6` | `#0a7f9e` | the current trail step, the light flowing along selected lines, focus      |
  | `trail-back`    | `#38d6c4` | `#0b7a6e` | reply steps on the trail                                                   |
  | `hatch-bg`      | `#0d0f15` | `#f7f8fb` | the ground of an outside system                                            |
  | `hatch-line`    | `#181c26` | `#e4e7ef` | the hatching of an outside system                                          |
  | `glow`          | `#7b6bff` | `#6a59f4` | violet light around the selection, the trail and lit controls (decoration) |
  | `grid`          | `#1c2130` | `#d3d8e3` | the dot grid on the stage (decoration only)                                |
  | `dawn`          | `#232a4a` | `#e2deff` | the light at the top of the stage and in an open container (decoration)    |
  | `shadow`        | `#000000` | `#8a92ab` | every shadow, mixed down to a part of itself (decoration only)             |
  | `cta-from`      | `#5f4dff` | `#5a48e6` | the start of the tour button's gradient                                    |
  | `cta-to`        | `#3a60f2` | `#3557e0` | the end of the tour button's gradient                                      |

  The page mixes tokens with each other and with transparency (`color-mix`) for hairlines, washes,
  glass and light; it never writes a colour of its own.

- **LOOK-002** Dark is the default. The theme button in the top bar (a sun in the dark theme, a moon
  in the light one, named "Switch to the light theme" or "Switch to the dark theme") switches between
  them; the choice is remembered on that device. The theme is not part of a shared link. Switching
  redraws nothing: the drawing is the same, only the tokens change.
- **LOOK-003** Opacity tokens: `dim` 0.22 (an element or label pushed back), `context` 0.55 (the frame
  of a container that holds something in focus), `edge-dim` 0.14 (a line pushed back), `past` 0.55 (an
  earlier step on the trail).

### Contrast

- **LOOK-011** Every text colour has a contrast ratio of at least 4.5 to 1 on every surface it is
  drawn on, in both themes: `ink`, `muted` and `accent-ink` on `bg`, `surface`, every band, `pill` and
  `accent-soft`; `on-accent` on `accent`, `cta-from` and `cta-to`. The tokens above meet this; the
  lowest is `on-accent` on `accent` in the dark theme (4.83).
- **LOOK-012** Lines and shapes a reader needs (box outlines, open container outlines, relationship
  lines, a selected line, the selection outline, the trail, the current step and reply steps) have at
  least 3 to 1 against the surface next to them, in both themes.
- **LOOK-013** Dimmed things (LOOK-003) are exempt while dimmed: dimming is how focus is shown, and the
  side panel always carries the full wording. So is the light (`glow`, `dawn`, `grid`, `shadow`), which
  never carries meaning on its own.
- **LOOK-014** Every picture of the page passes an automated accessibility audit with no problems in
  both themes (SCORE-005).

## Type

- **LOOK-101** Two families, both under the SIL Open Font License: **Inter** for names, wording and
  the interface, and **JetBrains Mono** for the code voice, code, and metadata (kickers, counts and
  step labels). The fonts are bundled with Aerie and served with it, never fetched from a font
  service, and their licences ship in the third-party notices.
- **LOOK-102** An audience with the `code` flag (LANG-105) reads taglines, labels, descriptions,
  captions and narration in JetBrains Mono, at the sizes the type scale gives for the code voice.
  Names stay in Inter for every audience. Code spans in descriptions are JetBrains Mono for everyone.
- **LOOK-103** All wording on the diagram is at least 13.5 px before any fitting (RULE-008). The only
  smaller text is the number in a step badge.

### Type scale

| Role                     | Face and style                                         | Size and weight                | Line  | Wraps at  |
| ------------------------ | ------------------------------------------------------ | ------------------------------ | ----- | --------- |
| element name             | Inter                                                  | 14 px, 600                     | 18 px | never     |
| tagline                  | Inter, `muted`                                         | 13.5 px, 400                   | 17 px | 230 px    |
| tagline, code voice      | JetBrains Mono, `muted`                                | 13.5 px, 400                   | 17 px | 230 px    |
| chip ("3 parts inside")  | Inter, `accent-ink`                                    | 13.5 px, 500                   | 20 px | never     |
| edge label               | Inter, `muted`                                         | 13.5 px, 500                   | 17 px | 240 px    |
| edge label, code voice   | JetBrains Mono, `muted`                                | 13.5 px, 400                   | 17 px | 240 px    |
| lanes band name          | Inter                                                  | 13.5 px, 600                   | 18 px | never     |
| step badge number        | Inter                                                  | 11 px, 600; 13 px when current | -     | -         |
| caption                  | Inter                                                  | 15 px, 400                     | 1.45  | the bar   |
| caption, code voice      | JetBrains Mono                                         | 13.5 px, 400                   | 1.45  | the bar   |
| caption step count       | JetBrains Mono, `accent-ink`, on a pill                | 12 px, 500                     | -     | never     |
| presenter narration      | Inter, names in it 700 `accent-ink`                    | 27 px, 500                     | 1.32  | the bar   |
| presenter narration code | JetBrains Mono                                         | 23 px, 400                     | 1.4   | the bar   |
| narration step count     | JetBrains Mono, `accent-ink`, on a pill                | 11.5 px, 500                   | -     | never     |
| side panel kicker        | JetBrains Mono capitals, `accent-ink`, tracked 0.04 em | 11 px, 500                     | -     | -         |
| side panel title         | Inter, tracked -0.022 em                               | 22 px, 600                     | 1.2   | the panel |
| cover title              | Inter, tracked -0.035 em                               | 30 px, 700                     | 1.08  | the panel |
| side panel lead          | Inter (code voice 13 px JetBrains Mono)                | 15 px, 400                     | 1.55  | the panel |
| side panel text          | Inter (code voice 13 px JetBrains Mono)                | 14 px, 400                     | 1.6   | the panel |
| section heading          | JetBrains Mono capitals, `muted`, tracked 0.04 em      | 11 px, 500                     | -     | -         |
| sidebar heading          | Inter capitals, `muted`, tracked 0.06 em               | 11 px, 500                     | -     | -         |
| sidebar item             | Inter                                                  | 13.5 px, 500                   | 1.3   | the bar   |
| counts ("14 steps")      | JetBrains Mono, `muted`                                | 11 px, 400                     | -     | never     |
| wordmark "Aerie"         | Inter, tracked -0.02 em                                | 16 px, 600                     | -     | never     |
| breadcrumb               | Inter, `muted`; the current part `ink` 600             | 13.5 px, 500                   | -     | never     |
| buttons                  | Inter                                                  | 13 px, 500                     | -     | never     |
| editor text              | JetBrains Mono                                         | 13.5 px, 400                   | 20 px | never     |

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
  | `labelPadX`    | 5     | label padding, left and right                                               |
  | `labelPadY`    | 2     | label padding, top and bottom                                               |
  | `labelLine`    | 17    | each label line                                                             |

- **LOOK-202** Text in a box is left-aligned from `pad + icon + iconGap`: the name on the first line,
  the tagline below it, and, in a closed container, the chip on the last line. The chip says how many
  children the container holds: "1 part inside", "3 parts inside".

## Shapes

- **LOOK-301** A leaf is a hairline card: `surface` fill, 1 px `outline`, 8 px corners, resting on the
  stage with a soft shadow (a 1 px `shadow` line at 80% below it and an 18 px `shadow` blur at 55%,
  8 px down).
- **LOOK-302** A closed container is a card like a leaf with 10 px corners, the chip, and the open
  control showing a plus. The control is a circle of `band-1` with a 1 px `outline` and a 1.4 px
  `ink` sign; on hover it turns `accent-ink` on a `glow` wash.
- **LOOK-303** An open container is a band: filled with the band of its depth (`band-0` to `band-3`,
  deeper levels stay on `band-3`), a 1 px `frame` outline, 14 px corners, a deep soft shadow (40 px at
  60%, 70% from depth 1), the **dawn** (a faint `dawn` light from its top left corner, a radial
  gradient from 90% to nothing), its header at the top, and the control showing a minus. Its header
  text is drawn above relationship lines, on a 5 px halo of its band, so a line that crosses the
  header (RULE-007 allows it) never cuts through the words.
- **LOOK-304** A `person` is a pill: corners as round as its height allows (up to 30 px), a 1.4 px
  `outline`.
- **LOOK-305** An `external` element is hatched: filled with 45 degree `hatch-line` lines, 2 px wide
  every 7 px, on `hatch-bg`, with a 1 px `outline` dashed `4 4`.
- **LOOK-306** On hover a card's outline turns `outline-hover` and a soft `glow` light gathers round
  it; an open container's outline thickens to 1.6 px. On keyboard focus a box gets a 2 px `live`
  focus ring 2 px outside the outline; the page's own controls get a 2 px `accent-ink` outline.
- **LOOK-307** The stage behind the diagram is `bg` with a dot grid in `grid` (1 px dots every 22 px)
  under the dawn, a `dawn` light falling from just above its top centre.

## Icons

- **LOOK-401** Icons are Aerie's own line drawings on a 64-unit grid: strokes only, round caps and
  joins, dots drawn as small filled circles, a stroke of 3.6 units (about 1.2 px at 22 px), in
  `accent-ink`. Each icon sits on its own **tile**: a square 5 px larger than the icon on every side,
  8 px corners, filled with `glow` at 14% and outlined with `glow` at 34%.
- **LOOK-402** The v1 set, by name: `person` (head and shoulders), `stack` (three stacked layers),
  `web` (a browser window with code brackets), `api` (a block with lines in and an arrow out), `gear`
  (a cog), `module` (a cube), `route` (a point with an arrow leaving it), `dice` (a die showing five),
  `search` (a magnifying glass), `books` (books on a shelf), `grid` (a table), `monitor` (a screen on a
  stand), `cylinder` (a storage drum), `history` (a clock with an arrow turning back), `refresh` (two
  arrows chasing round), `document` (a page with a folded corner), `archive` (a box with a lid),
  `building` (an office block), and `box` (a plain rounded square, the default).

## Relationships

- **LOOK-501** A relationship line is a 1.2 px `edge` stroke along its route, with each corner rounded
  to 9 px (less where a segment is shorter than 18 px), ending in an open chevron arrowhead 12 px long,
  stroked 1.5 px with round caps.
- **LOOK-502** A label sits on a **pill**: a `pill` rectangle with a 1 px `rule` outline, reaching 7 px
  past its words on each side and 2 px above and below, its corners as round as its height allows up
  to 10 px. The pill fits the words placed for the current audience, not the space the layout keeps
  for the widest one, so it never looks empty; switching audience changes only the pill's width.
- **LOOK-503** Hovering a label shows its full sentence (MODEL-305) as a tooltip.

## Selection and focus

- **LOOK-601** A selected element gets a 1.5 px `accent-ink` outline with a bloom of `glow` light
  round it (a 1 px glow at 90% and a 22 px glow at 45%). Its relationships turn `accent` (1.6 px,
  glowing, with an `accent-ink` arrowhead), a small `live` light flows along each of them (2 px dashes
  32 px apart, moving the length of one gap every `2.4 G`, without end while selected), and their
  labels turn `accent-ink` on an `accent-soft` pill outlined in `glow`. Their other ends keep full
  strength with a 1.2 px outline of `accent-ink` at 70%.
- **LOOK-602** Elements inside the selected element keep full strength. The containers around the
  selected element and around its related elements keep their text, and their frames drop to
  `context`. Everything else drops to `dim`, and other lines to `edge-dim`.
- **LOOK-603** Walkthrough focus looks like selection, applied to every focused element at once.

## Scenario trail

- **LOOK-701** A call step is a 2 px `accent-ink` curve with round caps and a chevron arrowhead,
  glowing faintly. The current step is drawn in `live` at 2.6 px with a stronger glow, and draws itself
  from its start to its end in 900 ms.
- **LOOK-702** A reply step is a 2.6 px `trail-back` dotted curve (dashes `1 6`, round caps). It
  appears whole rather than drawing itself.
- **LOOK-703** Earlier steps stay on the diagram, thinner (1.6 px) and at `past`.
- **LOOK-704** Each step has a numbered badge: a circle of radius 9 with a `surface` fill, a 1.2 px
  `accent-ink` outline and its number in `accent-ink`. The current step's badge has radius 12, an
  `accent` fill, a 1.5 px `live` outline, a `glow` light, and its number in `on-accent`; its outline
  pings twice as it arrives (a ring that closes in from 10 px over `1.6 G`).
- **LOOK-705** The current step's two elements get the selection's outline and light (LOOK-601).
  Elements visited so far keep full strength, the containers around them drop to `context`,
  everything else to `dim`, and relationship lines to `edge-dim`.
- **LOOK-706** In lanes, headers and bands use the box and band looks above, lane lines are 1 px
  `frame` at 55% dashed `2 5`, arrows and badges follow LOOK-701 to LOOK-704, and the current step's
  row is tinted with `accent` at 14%.

## Page chrome

The chrome is built from hairlines (`ink` at 9% and 14%), washes (`ink` at 4% and 7%) and **glass**
(`surface` at 78% over a 14 px blur). Shadows (`lift`) are `shadow` at 60% to 80% in the dark theme
and at 28% to 40% in the light one.

- **LOOK-801** The page is a grid: a 52 px top bar across the whole width; below it a 232 px sidebar
  on the left, the stage in the middle and a 368 px side panel on the right. Aerie v1 is designed for
  windows from 1280 x 720 up.
- **LOOK-802** The top bar is `bg` with a hairline below. From the left: the logo and the wordmark
  "Aerie", a hairline divider, the breadcrumb (model title, a slash, the view title, and while a
  scenario plays, a slash and its title); then, on the right, "Find element" (108 px), "Copy link"
  (the one solid button: `ink` with `bg` text, 100 px wide), "Export" (64 px), "Edit" (64 px),
  "Export HTML" (112 px), and the theme button (30 px square). Other buttons are
  30 px high with a hairline border, a wash and 7 px corners.
- **LOOK-803** The sidebar is `bg` with a hairline on its right. Its headings are "Views", "Scenarios"
  and "Tours". Each item is 32 px or taller with 7 px corners; the current one is lit with a wash and a
  hairline. A view starts with a small square mark, filled `accent` with a `glow` light when current; a
  scenario with a small `live` play triangle; a tour with a small `accent-ink` screen. Scenarios and
  tours end with their number of steps. Below the lists, a footer holds "Model" with the model picker
  and the link "Open your own .aerie file"; at the bottom is the "Reduce motion" checkbox.
- **LOOK-804** The side panel is `surface` at 55% over `bg`, with a hairline on its left and 24 px
  padding. Sections are separated by hairlines. Its content arrives from a 6 px blur and 8 px below.
  Names in sentences are links in Inter 500, underlined in `accent-ink` at 45%, turning `accent-ink`
  on hover. Verb phrases in sentences are italic. Buttons are hairline buttons as in the top bar; the
  scenario Play button has the tour button's gradient with `on-accent` text.
- **LOOK-805** The caption bar sits at the bottom of the stage, 24 px from its sides and 18 px from its
  bottom, 70 px high: glass with a hairline border, 14 px corners, a deep `lift`, and a line of light
  along its top edge (`glow` fading into `live`). It holds the step count on a `glow` pill, then the
  text.
- **LOOK-806** The camera buttons (move closer, move back and show everything, as icons) sit at the
  stage's top right, 16 px in, as one glass group of 32 x 30 px buttons.
- **LOOK-807** The logo is three nested, slightly irregular closed outlines, like a hill seen from
  above, stroked in `ink` and lit with a `glow` light, with a small `accent` dot near the summit.
- **LOOK-808** Back and Forward (INT-553) sit at the stage's top left, 14 px from its edges, as glass
  buttons 34 x 28 px with 8 px corners; one that leads nowhere has `muted` arrows. After them the
  recent visits (INT-555) are one glass bar: each name 112 px wide in Inter 13 px `muted`, cut short
  with an ellipsis (its full name in the tooltip), separated by a small `muted` chevron, and the
  current one `ink`, 600, on a wash. The stage's notice sits below them.
- **LOOK-809** The **cover** (INT-204) heads the side panel with nothing selected: a violet and cyan
  aurora (`glow` at 30% and `live` at 14%) over an 18 px dot grid on `bg`, the kicker "Architecture",
  the model's title in the cover title face, its description, stat chips in the counts face on a wash
  ("19 parts", "3 views", "2 scenarios"), and the tour button: 44 px high, 9 px corners, a 135 degree
  gradient from `cta-from` to `cta-to` with `on-accent` text, a `glow` light, its step count on a pill,
  and a light that sweeps across it on hover.
- **LOOK-810** The **hover card** (INT-208) is glass (`surface` at 88% over an 18 px blur), 300 px
  wide, with 12 px corners and a deep `lift`, placed 14 px beside the box (to its right where it
  fits, else to its left). It fades and slides 6 px into place over `--aerie-peek`.
- **LOOK-811** **More technical** (INT-207) is a 40 px hairline button with a violet chevron, the next
  layer's name on the right in the counts face; it glows violet on hover. Each layer it opens is a lit
  card with 10 px corners: the first a `glow` wash at 7% with a `glow` hairline at 22%, the next a
  `live` wash at 6% with a `live` hairline. A layer unfolds from 8 px above as it opens.
- **LOOK-812** The **wording chip** (INT-104) is a glass pill at the stage's top left below Back and
  Forward: "Worded for Engineer" in Inter 13 px 600, and a "Back to plain wording" button on a wash.
  It drops 6 px into place as it appears.
- **LOOK-813** The narration bar (INT-701) is the caption bar's glass at the bottom of the stage,
  152 px high, with the right end kept for the presenter's controls: Back, Next (the tour button's
  gradient) and Exit, each 74 x 34 px, in a 12 px group on `bg` at 70%, with the dashed wording button
  (INT-106) across the row below them.
- **LOOK-814** Printed, the page uses the light theme, drops the dot grid and every shadow, and leaves
  out the sidebar, the top bar's buttons and the stage's controls, so the diagram and the side panel
  fill the page.

## Motion

- **LOOK-901** Motion is quick, then settles long. The timings:

  | Motion                                      | Timing                                                 | Easing                      |
  | ------------------------------------------- | ------------------------------------------------------ | --------------------------- |
  | glide `G`: boxes, containers and the camera | 520 ms                                                 | `cubic-bezier(.16,1,.3,1)`  |
  | new elements fade in                        | start at `0.4 G`, last `0.7 G`                         | ease                        |
  | leaving elements shrink and fade            | `0.5 G`                                                | ease                        |
  | lines and labels fade in after a change     | start at `G + 60 ms`, last `0.6 G`                     | ease                        |
  | wording swap on an audience change          | 170 ms out, then 170 ms in                             | ease                        |
  | side panel content swap                     | 170 ms out, then 170 ms in; content arrives in `0.9 G` | ease, then the glide easing |
  | dimming and highlighting                    | 280 ms                                                 | ease                        |
  | hover colours and light                     | 250 ms                                                 | ease                        |
  | the hover card appears                      | 180 ms                                                 | the glide easing            |
  | the light flowing along a selected line     | one gap every `2.4 G`, without end                     | linear                      |
  | the current trail step draws itself         | 900 ms                                                 | the glide easing            |
  | the current badge pings                     | `1.6 G`, twice                                         | the glide easing            |
  | scenario autoplay                           | one step every 2400 ms                                 | -                           |
  | presenter controls hide                     | after 2500 ms without pointer movement, 300 ms fade    | ease                        |
  | "Link copied" confirmation                  | 1400 ms                                                | -                           |

- **LOOK-902** Persisting things glide; new things fade in; nothing bounces or overshoots.
- **LOOK-903** **Reduced motion** sets every duration and delay above to zero: changes appear at once,
  the trail is drawn whole, wording swaps in place, the camera jumps, and the flowing light and the
  ping stand still. The autoplay pace is not motion: Play still advances one step every 2400 ms. It is
  on when the system asks for reduced motion, until the reader changes the "Reduce motion" checkbox;
  the choice is remembered on that device.
- **LOOK-904** A model's first drawing arrives once: its cards fade up 8 px out of the dark row by
  row in reading order, each row 45 ms after the one above, over `1.3 G`; then its lines and labels
  fade in over `1.2 G`. Later changes never replay it.
