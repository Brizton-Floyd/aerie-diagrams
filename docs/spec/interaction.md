# Interaction

How a reader explores a diagram and how an author edits one: the audience switch, selecting and the
side panel, opening in place, the camera, the navigation sidebar, shared links, scenario playback,
presenter-mode walkthroughs, the live split editor and watch mode. What is drawn is defined in
[model.md](model.md), where it is drawn in [layout.md](layout.md), and how it looks in
[look.md](look.md).

Requirement ids: `INT-nnn`. Conventions are in [overview.md](overview.md#reading-this-spec).

## The screen

- **INT-001** The page has a top bar, a navigation sidebar on the left, the stage with the diagram in
  the middle and the side panel on the right ([look.md](look.md#page-chrome)). The audience switch is
  in the top bar and is always visible, in every mode.
- **INT-002** The page shows one model. A production build carries one or more models; the query
  parameter `model` chooses one by name (`/?model=lotto`), and without it the first is shown. In watch
  mode the model is the author's file (INT-851).
- **INT-003** While the model loads, the stage shows "Loading the diagram". When the model has errors
  and there is no earlier version to show, the stage shows the errors in plain words (INT-806) instead
  of a diagram.
- **INT-004** Every keyboard shortcut in this document works only when the keyboard focus is not in a
  text field or the editor.

## The audience switch

- **INT-101** The switch shows one tab per audience, in declared order, labelled with the audience's
  display name, after the words "Written for". The current audience's tab is marked, with an
  underline that glides to it.
- **INT-102** Choosing a tab, or pressing the digit key of its position (1 to 6), switches the
  audience. Every piece of wording on the page changes to that audience's: names, taglines, labels,
  the side panel, captions, the step list and narration. Wording fades out and back in (LOOK-901).
- **INT-103** Nothing moves: no box, line, label or trail changes place or size, and the camera stays
  where it is (RULE-005). The selection, the zoom state, a playing scenario and its current step all
  stay as they were.
- **INT-104** The switch works the same during scenario playback and while presenting, so the
  presenter can change the audience live in front of the room.
- **INT-105** The tabs form an accessible tab list, and a screen reader hears "Now written for
  Engineer" after a switch.

## Selecting and the side panel

- **INT-201** Clicking an element selects it. Clicking it again, clicking empty stage, or pressing Esc
  clears the selection. While a scenario plays or a walkthrough is presented, clicking does not select.
- **INT-202** A selection highlights the selected element, everything inside it, its relationships
  and their other ends, and dims the rest (LOOK-601, LOOK-602). Which relationships count: every drawn
  edge that carries a relationship with an end in the selected element or inside it.
- **INT-203** If the selected element stops being drawn because the reader closes a container around
  it, the selection moves to that container (MODEL-603).
- **INT-204** With nothing selected and nothing playing, the side panel describes the view: the kicker
  "View", its title, its description, a short "Read it" note ("Click any box to see what it does and
  how it connects. Use the round button on a box to open it in place. Switch who it is written for at
  the top; nothing moves."), and a "Play a scenario" list with a button for each scenario.
- **INT-205** With an element selected, the side panel shows, for the current audience:
  1. the kind label (MODEL-005) as the kicker, the icon and name as the title, and the tagline as the
     lead;
  2. the description;
  3. "At every level": the name and tagline for each audience, the current one shaded;
  4. "Connections": every relationship with an end in the element or inside it, in model order, as
     sentences (MODEL-305), each followed by its description if it has one. Relationships of kinds the
     view does not draw follow under "Not drawn in this view". Every element name in a sentence is a
     link that reveals and selects that element (MODEL-207);
  5. for a container, "Inside": each child's name (a link) and tagline, then an "Open in place" or
     "Close in place" button;
  6. "In scenarios": each scenario the element or anything inside it takes part in, with a button that
     plays it.
- **INT-206** Hovering an element's box thickens its outline. Hovering a label shows its full sentences
  (MODEL-305).

## Opening in place

- **INT-301** Every drawn container has a round open and close control at the top right of its box: a
  plus when closed, a minus when open, with the tooltip "Open in place" or "Close in place".
- **INT-302** Clicking the control, double-clicking the box, or using the side panel's button opens or
  closes the container (MODEL-206). The picture changes with the glide of LAYOUT-402, and the camera
  follows LAYOUT-404: it comes closer to the container and its neighbours at a readable scale instead
  of shrinking the whole picture (LAYOUT-453), and closing returns it toward where it was
  (LAYOUT-455).
- **INT-303** Opening and closing are allowed during scenario playback: the trail is redrawn at the new
  zoom (LAYOUT-505) and nothing else changes. They are not offered while presenting.
- **INT-304** There is no global depth control: depth changes only by opening and closing in place, by
  switching view, or by a walkthrough step.

## The camera

The camera only magnifies and moves the picture on screen. It is separate from zoom, which changes
depth.

- **INT-351** The wheel magnifies around the pointer. Dragging the stage moves the picture; a drag
  shorter than 4 px is a click.
- **INT-352** The camera buttons magnify by 1.25, shrink by 0.8, and "Fit all" fits the whole picture
  and returns the camera to fit mode, following nothing (LAYOUT-404). The keys `+`, `-` and `0` do the
  same.
- **INT-353** The scale stays between 0.2 and 2.5. The camera is not part of the picture: a shared link
  opens fitted.
- **INT-354** Selecting an element, by a click, a key or a link in the side panel, gently brings it and
  its connections into view without shrinking the picture (LAYOUT-454). An element reached with the
  keyboard is brought into view the same way, on its own. The browser never scrolls the stage itself;
  only the camera moves the picture.

## The navigation sidebar

- **INT-401** The sidebar lists the model's views, scenarios and walkthroughs under the headings
  "Views", "Scenarios" and "Walkthroughs", each in declared order and titled for the current audience.
  A heading with nothing under it is left out.
- **INT-402** Choosing a view shows it with its default zoom (MODEL-209), clears the selection, stops
  any scenario, and glides from the old picture to the new one (LAYOUT-402), fitting the camera.
- **INT-403** Choosing a scenario plays it (INT-601). Choosing a walkthrough presents it from its first
  step (INT-701).
- **INT-404** The current view, or the playing scenario, is marked. At the bottom of the sidebar is the
  "Reduce motion" checkbox (LOOK-903).

## Shared links

A link reopens the exact picture (MODEL-601): the same view, audience, zoom, selection, and scenario or
walkthrough step.

- **INT-501** The page's address always shows the current picture. The path and the `model` query
  parameter name the diagram; the fragment after `#` holds the picture, as `key=value` pairs joined by
  `&`, in this order, each left out when it has its default value:

  | Key       | Value                                                                                               |
  | --------- | --------------------------------------------------------------------------------------------------- |
  | `view`    | the view id                                                                                         |
  | `aud`     | the audience id                                                                                     |
  | `open`    | ids of containers opened by the reader (zoom state `open`), comma-separated, in model order         |
  | `closed`  | ids of containers closed by the reader (zoom state `closed`), comma-separated, in model order       |
  | `sel`     | the selected element's id                                                                           |
  | `play`    | the playing scenario's id and current step: `generate-picks.9`                                      |
  | `lanes`   | `1` when the scenario is shown as lanes                                                             |
  | `present` | the walkthrough's id and step: `tour.3`; inside a scenario step, also the scenario step: `tour.7.9` |

- **INT-502** The fragment is built from the normalised picture (MODEL-603), so one picture always has
  one fragment, and the default picture has none. While presenting, the fragment holds only `aud` and
  `present`, because the walkthrough decides the rest (MODEL-501); a link's `aud` wins over the `for`
  line of the step it opens at.
- **INT-503** Examples:
  - `#view=services&aud=engineer&open=engine-service&sel=pick-generation`
  - `#aud=exec&play=generate-picks.9&lanes=1`
  - `#present=tour.7.9`
- **INT-504** Ids are written as they are; commas and dots are not encoded. Unknown keys are ignored.
- **INT-505** Opening a link shows its picture directly, without a glide. A part that no longer fits
  the model (a view, element or step that is gone) is dropped (MODEL-603), and the stage shows, for six
  seconds, "Part of this link no longer matches the diagram, so Aerie is showing the closest picture."
- **INT-506** Choosing a view, and starting or ending a scenario or walkthrough, adds an entry to the
  browser's history, so Back and Forward step between them. Other changes replace the current entry.
- **INT-507** The "Copy link" button copies the full address and reads "Link copied" for a moment.

## Scenario playback

- **INT-601** Starting a scenario clears the selection, moves to its stage view if needed (MODEL-404),
  and shows step 1. The breadcrumb adds the scenario's title, and the camera fits with room for the
  caption bar.
- **INT-602** The side panel shows the kicker "Scenario", its title and description, the controls Back,
  Play (Pause while playing), Next and Done, a switch between "On the map" and "As lanes", and the
  numbered list of steps. Each step shows "{subject} to {object}" in small capitals and its caption.
  The current step is shaded, earlier steps are marked done, and reply steps are in italic. Choosing a
  step jumps to it. The controls stay in view while the list scrolls.
- **INT-603** A step's **caption** is its description for the current audience or, when it has none,
  its sentence (MODEL-104). The caption bar shows the step number, "/" and the number of steps, and the
  caption.
- **INT-604** On the map, steps 1 to the current one are drawn as the trail (LAYOUT-501 to
  LAYOUT-504, LOOK-701 to LOOK-705), the current one drawing itself. As lanes, the stage shows the
  lanes layout (LAYOUT-601 to LAYOUT-607) with the current row marked. Switching between the two
  cross-fades; the step stays the same.
- **INT-605** Next and the Right arrow go one step forward; Back and the Left arrow one step back. Play
  and Space advance one step every 2.4 s until the last step, then stop; pressing Play on the last step
  starts again from step 1. Done and Esc end the scenario and return to the view, fitted.
- **INT-606** Ending a scenario, switching view, or starting another scenario stops the current one.

## Presenter-mode walkthroughs

- **INT-701** Presenting a walkthrough fills the screen: Aerie asks for full screen and otherwise fills
  the window. The sidebar and side panel hide. The stage shows the diagram, a narration bar at the
  bottom (the step's narration for the current audience, LOOK type scale, with "3 / 8" and the
  walkthrough's title), the audience tabs at the top right, and Back, Next and Exit at the bottom right,
  which hide after a few seconds without pointer movement and return when it moves.
- **INT-702** Each step shows its picture (MODEL-501 to MODEL-503) with the glide of LAYOUT-402. A step
  with focus fits the camera to its focus elements with an 80 px margin, never above scale 1.15;
  otherwise the camera fits the whole picture.
- **INT-703** Right arrow, Page Down, Space and Next go forward; Left arrow, Page Up and Back go back
  (MODEL-504 inside scenario steps); Home and End go to the first and last step. Digits switch the
  audience (MODEL-505). Esc, Exit, or leaving full screen ends the presentation.
- **INT-704** While presenting, clicks do not select, open or close; the reader can still magnify and
  move the camera, and the next step fits it again.
- **INT-705** A step without narration shows its view's title, or the scenario step's caption.
- **INT-706** On the last step, Next does nothing, and the narration bar shows "End of the
  walkthrough" under the narration.
- **INT-707** Ending the presentation returns to reading at the same view, zoom and audience, with
  nothing focused and no scenario playing.

## The live split editor

- **INT-801** The "Edit" button opens the split editor: the Lines source of the model on the left,
  where the sidebar was (40% of the window, at least 360 px, with a divider the author can drag), and
  the live diagram and side panel on the right. While editing, the breadcrumb's view title opens a
  menu of views, scenarios and walkthroughs. "Done" closes the editor.
- **INT-802** The editor shows line numbers and colours each line by its kind (keywords, ids,
  rewordings, descriptions, comments, tags and kinds), in Source Code Pro.
- **INT-803** Pressing Enter keeps the indent, and adds two spaces after a line that opens a block (a
  `model`, element, `view`, `scenario`, `walkthrough` or walkthrough `step` line). Tab and Shift+Tab
  indent and outdent by two spaces.
- **INT-804** Completion offers: element ids at the start of a sentence, at the end of a sentence, and
  in `show`, `open`, `close` and focus lists; tags after `[` in `show`; views and scenarios after
  `step`; audiences after `@` and `for`; icon names after `icon`; kinds after `kind`; and keywords at
  the start of a line.
- **INT-805** 250 ms after the author stops typing, the text is checked. Without errors, the diagram
  updates with the glide of LAYOUT-402, keeping the view, audience, zoom state and selection wherever
  their ids still exist (MODEL-603).
- **INT-806** With errors, the diagram keeps the last version without errors and says so at the top of
  the stage ("Showing the last version without errors"). Below the editor, an error list shows each
  diagnostic as "Line 12, column 5: " and its message (LANG-903), errors before warnings. Choosing one
  moves the cursor to it. In the text, each diagnostic is underlined with a wavy line (`accent` for
  errors, `muted` for warnings) and marked in the margin, and hovering shows its message. Warnings never
  stop the diagram from updating.
- **INT-807** The "Format" button and Shift+Alt+F run the formatter (LANG-931) on the text.
- **INT-808** The editor works on a copy of the model in the page. The text is kept on the device
  between visits until the author chooses "Discard changes". "Download" saves it as a `.aerie` file.
  The diagram shows the copy from the moment the editor opens until the page is reloaded; a page
  opened afresh shows the published model until the author presses "Edit" again. Shared links always
  describe the published model, not the author's copy.

## Watch mode

For authors who write in their own editor.

- **INT-851** `aerie watch <file>` starts a small server on `127.0.0.1` only (port 4310, or the one
  given with `--port`; `--port 0` takes any free port), prints its address, opens it in the browser
  (unless `--no-open`) and shows the file's diagram. It serves the built page (`npm run build`) and
  answers only requests addressed to `127.0.0.1` or `localhost`, so a web page elsewhere cannot read
  the file.
- **INT-852** Each time the file is saved (changes within 100 ms count as one), Aerie checks it and
  sends the result to every open page. A page updates exactly as the split editor does (INT-805 and
  INT-806), keeping the reader's picture, and shows the error list over the stage when there are
  errors.
- **INT-853** The terminal prints the diagnostics of every check in the `aerie check` format
  (LANG-962), then "Updated." or "Showing the last version without errors.", or, while no version of
  the file has been without errors, "There is nothing to show until the errors are fixed."
- **INT-854** When the file cannot be read (it was moved or deleted), the page keeps the last picture
  and says, for example, "Aerie cannot read lotto.aerie: there is no file with that name any more."
  It recovers when the file comes back.
- **INT-855** In watch mode the page has no "Edit" button: the author's own editor is the editor.
  Ctrl+C in the terminal stops the server.

## Accessibility and keyboard

- **INT-901** Every control and every drawn element can be reached with Tab, in a sensible order: the
  top bar, the sidebar, the diagram (elements in model order), then the side panel. Focus is always
  visible (LOOK-306).
- **INT-902** On a focused element, Enter selects it, and `o` opens or closes it when it is a
  container.
- **INT-903** Each element is announced with its name and tagline, and containers say whether they are
  open. After the diagram, a list hidden from sight but read by screen readers gives every drawn
  relationship as a sentence for the current audience.
- **INT-904** Scenario captions and walkthrough narration are announced as they change.
- **INT-905** Reduced motion (LOOK-903) applies everywhere motion is described in this document.
