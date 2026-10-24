# Interaction

How a reader explores a diagram and how an author edits one: wording for the reader, selecting and
the side panel, opening in place, the camera, the navigation sidebar, shared links, Back and Forward
through the reader's visits, scenario playback, presenter-mode walkthroughs, the live split editor and
watch mode. What is drawn is defined in
[model.md](model.md), where it is drawn in [layout.md](layout.md), and how it looks in
[look.md](look.md).

Requirement ids: `INT-nnn`. Conventions are in [overview.md](overview.md#reading-this-spec).

## The screen

- **INT-001** The page has a top bar, a navigation sidebar on the left, the stage with the diagram in
  the middle and the side panel on the right ([look.md](look.md#page-chrome)). There is no audience
  switch to choose first: every reader starts with the plainest wording, and the deeper wording is one
  step away (INT-101, INT-207).
- **INT-002** The page shows one model. A production build carries one or more models; the query
  parameter `model` chooses one by name (`/?model=lotto`), and without it the first is shown. In watch
  mode the model is the author's file (INT-851).
- **INT-003** While the model loads, the stage shows "Loading the diagram". When the model has errors
  and there is no earlier version to show, the stage shows "Aerie can't draw lotto.aerie yet. Fix these
  first:" (with the file's name) and the errors in plain words (INT-806) instead of a diagram.
- **INT-004** Every keyboard shortcut in this document works only when the keyboard focus is not in a
  text field or the editor.

## Wording for the reader

Plain first, more on demand. The model's audiences (LANG-102) are still the levels of wording; the
reader meets them as layers to uncover rather than as a switch to set first.

- **INT-101** The page reads in the **plain wording**: the first audience the model declares, whatever
  its `(default)` flag says (LANG-104). The first picture, a link without `aud`, and a presentation
  without a `for` line all start there.
- **INT-102** The whole diagram can be worded for another audience: by the side panel's "Word the
  whole diagram for Engineer" (INT-207), by the digit key of the audience's position (1 to 6), by a
  link's `aud`, and while presenting by the wording button (INT-106). Every piece of wording on the
  page then changes to that audience's: names, taglines, labels, the side panel, captions, the step
  list and narration. Wording fades out and back in (LOOK-901).
- **INT-103** Nothing moves: no box, line, label or trail changes place or size, and the camera stays
  where it is (RULE-005). The selection, the zoom state, a playing scenario and its current step all
  stay as they were.
- **INT-104** While the diagram is worded for an audience other than the plain one, a chip at the
  stage's top left says "Worded for Engineer" and offers "Back to plain wording", which words it
  plainly again. The chip is not shown while presenting.
- **INT-105** A screen reader hears "Now worded for Engineer" after a change of wording.
- **INT-106** Wording works the same during scenario playback and while presenting, so the presenter
  can change it live in front of the room: the narration bar's wording button names the current
  wording ("Executive wording") and words the presentation for the next audience, round to the first;
  the digit keys work too.

## Selecting and the side panel

- **INT-201** Clicking an element selects it. Clicking it again, clicking empty stage, or pressing Esc
  clears the selection. While a scenario plays or a walkthrough is presented, clicking does not select.
- **INT-202** A selection highlights the selected element, everything inside it, its relationships
  and their other ends, and dims the rest (LOOK-601, LOOK-602). Which relationships count: every drawn
  edge that carries a relationship with an end in the selected element or inside it.
- **INT-203** If the selected element stops being drawn because the reader closes a container around
  it, the selection moves to that container (MODEL-603).
- **INT-204** With nothing selected and nothing playing, the side panel opens on the model's **cover**:
  the kicker "Architecture", the model's title, its description, its size ("19 parts", "3 views",
  "2 scenarios"), and, when the model has a walkthrough, the button "Take the tour" with its number of
  steps, which presents the first walkthrough (INT-701). Then the view: "This view" with its title and
  description; "How to read it" ("Click a box to see what it does and what it talks to. Boxes with a +
  hold more inside: press it, or double-click the box, to open it right here. Rest the pointer on a box
  for a quick look."); and "Watch it work", a button for each scenario with its number of steps.
- **INT-205** With an element selected, the side panel shows, for the current audience:
  1. the kind label (MODEL-005) as the kicker, the icon and name as the title, and the tagline as the
     lead;
  2. the description;
  3. "More technical" (INT-207);
  4. "Connections": every relationship with an end in the element or inside it, in model order, as
     sentences (MODEL-305), each followed by its description if it has one. Relationships of kinds the
     view does not draw follow under "Also connected, not drawn in this view". Every element name in a
     sentence is a link that reveals and selects that element (MODEL-207);
  5. for a container, "Inside (4)" with its number of children: each child's name (a link) and
     tagline, then an "Open it here" or "Close it" button;
  6. "Takes part in": each scenario the element or anything inside it takes part in, with a button that
     plays it and its number of steps.
- **INT-206** Hovering an element's box lights its outline (LOOK-306). Hovering a label shows its full
  sentences (MODEL-305).
- **INT-207** **More technical** uncovers the deeper wording one layer at a time. The audiences after
  the current one, in declared order, are its layers; each holds only what that audience words
  differently from the layer before (its name, its tagline, and its description, or only the
  paragraphs it adds, LANG-303), and an audience that words the element exactly as the one before adds
  no layer. The button reads "More technical" and then "Even more technical", with the next layer's
  name ("Manager wording"); each press opens the next layer below the description, and "Less" closes
  them all. Under the last open layer, "Word the whole diagram for Engineer" words the diagram for that
  audience (INT-102). The page remembers how many layers the reader opened and opens the next element
  as far, for as long as the browser tab lasts. An element worded the same by every later audience has
  no "More technical"; while the diagram is worded for a deeper audience with no layers left, the panel
  says "Worded for Engineer." with a link "Back to the plain wording".
- **INT-208** Resting the pointer on a box for 380 ms shows its **hover card** beside it: the kind label
  (MODEL-005), the first sentence of its description, how each deeper layer names it ("ENGINEER
  core-server · Spring Boot module"), and the hint "Click to read more" (with ", double-click to open
  it" for a container). An open container shows a card only over its header. The card hides when the
  pointer leaves, presses or turns the wheel, and never shows while presenting. It is hidden from
  screen readers, which have the same wording in the side panel.

## Opening in place

- **INT-301** Every drawn container has a round open and close control at the top right of its box: a
  plus when closed, a minus when open, with the tooltip "Open it here" or "Close it".
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
- **INT-352** The camera buttons "Move closer (+)" magnifies by 1.25, "Move back (-)" shrinks by 0.8,
  and "Show everything (0)" fits the whole picture and returns the camera to fit mode, following
  nothing (LAYOUT-404). The keys `+`, `-` and `0` do the same.
- **INT-353** The scale stays between 0.2 and 2.5. The camera is not part of the picture: a shared link
  opens fitted. Back and Forward bring back the camera of a visit (INT-554).
- **INT-354** Selecting an element, by a click, a key or a link in the side panel, gently brings it and
  its connections into view without shrinking the picture (LAYOUT-454). An element reached with the
  keyboard is brought into view the same way, on its own. The browser never scrolls the stage itself;
  only the camera moves the picture.

## The navigation sidebar

- **INT-401** The sidebar lists the model's views, scenarios and walkthroughs under the headings
  "Views", "Scenarios" and "Tours" (readers call a walkthrough a tour), each in declared order and
  titled for the current audience; scenarios and tours show their number of steps ("14 steps"). A
  heading with nothing under it is left out.
- **INT-402** Choosing a view shows it with its default zoom (MODEL-209), clears the selection, stops
  any scenario, and glides from the old picture to the new one (LAYOUT-402), fitting the camera.
- **INT-403** Choosing a scenario plays it (INT-601). Choosing a walkthrough presents it from its first
  step (INT-701).
- **INT-404** The current view, or the playing scenario, is marked. Below the lists, the "Model" footer
  chooses another bundled model or opens "your own .aerie file" (except in watch mode), and at the
  bottom of the sidebar is the "Reduce motion" checkbox (LOOK-903).

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
  | `flow`    | the overview scenario and selected stage/step: `render-model.3`, or `none` when explicitly cleared  |
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
  seconds, "This link is older than the diagram. Showing the closest picture."
- **INT-506** Every visit (INT-551) adds an entry to the browser's history, so Back and Forward step
  between visits. Moving the camera, and moving within a playing scenario or a presented walkthrough,
  replace the current entry.
- **INT-507** The "Copy link" button copies the full address and reads "Link copied" for a moment.
  When the browser refuses the clipboard it reads "Couldn't copy" instead, and a screen reader hears
  "Couldn't copy. Use the address bar." This action is available for unchanged bundled models and
  watch URLs, which supply their model source to a recipient.
- **INT-508** For an opened local file or an edited copy, the same header control says "Share model"
  instead of claiming to copy a usable model link. It opens a named dialog explaining that a link
  does not include this model and offering "Download model" and "Close". Download saves the exact
  current text as a `.aerie` file, including pending or invalid edits, without modifying the
  clipboard. Escape and Close dismiss only the dialog and restore focus to its caller. Discarding
  an edited copy restores ordinary link sharing when its source is a bundled model. Source changes
  update the sharing action immediately, before editor validation finishes. The dialog follows the
  current theme and is keyboard-accessible.

## Back and Forward

Choosing an element can take the camera to another part of the diagram. Back returns the reader to
where they were, as they left it, so they never have to find their place again.

- **INT-551** A **visit** is a picture the reader went to, with the camera where they left it. Every
  change the reader makes to the picture is a new visit: selecting an element (by a click, a key or a
  link in the side panel) or clearing the selection, opening or closing a container, switching the
  audience or the view, starting or ending a scenario or walkthrough, and an address typed by hand.
  Moving the camera alone is not a visit: the current visit keeps the camera wherever the reader
  leaves it, so a run of drags, wheel turns and camera buttons is one visit's camera, never a visit
  each.
- **INT-552** Each visit is one entry in the browser's history (INT-506), so the page's Back and
  Forward, the list of recent visits (INT-555) and the browser's own Back and Forward all move between
  the same visits. A new visit after going back forgets the visits that were ahead, as the browser
  does.
- **INT-553** At the stage's top left are a Back button ("‹") and a Forward button ("›"), with the
  tooltips "Back (Alt+Left)" and "Forward (Alt+Right)". Alt+Left and Alt+Right do the same (INT-004).
  Back on the first visit and Forward on the last are marked unavailable and do nothing.
- **INT-554** Going back or forward shows the visit's exact picture: its view, audience, zoom state,
  selection and side panel, or its scenario at the step it was left on. The picture changes with the
  glide of LAYOUT-402, and the camera returns to where the reader left it, at the same scale, following
  what it followed (LAYOUT-453). A shared link and a reloaded page still open fitted (INT-353).
- **INT-555** Beside the buttons, the list of recent visits names the latest five visits, oldest first,
  with the current one marked; after going back further than those, it names five from the current one
  on, so the visits ahead stay in reach. A visit is named, for the current audience, by its selected
  element, its playing scenario or presented walkthrough, the container opened or closed to reach it,
  or else its view. Choosing a name goes straight to that visit, as several Backs or Forwards would.
  The list names fewer visits when the stage is too narrow for five beside the camera buttons, and
  hides while it would name only one.
- **INT-556** The visits last as long as the browser tab: a reload keeps them, and going back to an
  earlier diagram's entries finds its visits again. Choosing another diagram, or opening a file,
  starts its visits afresh.
- **INT-557** Moving within a playing scenario (its steps, Play, the lanes and a change of wording) or
  a presented walkthrough stays in the same visit; they keep their own controls (INT-605, INT-703).
  While presenting, Back, Forward and the list hide with the rest of the chrome (INT-701).

## Scenario playback

- **INT-601** Starting a scenario clears the selection, moves to its stage view if needed (MODEL-404),
  and shows step 1. The breadcrumb adds the scenario's title, and the camera fits with room for the
  caption bar.
- **INT-602** The side panel shows the kicker "Scenario", its title and description, the controls Back,
  Play (Pause while playing), Next and End, a switch between "On the diagram" and "As lanes", and the
  numbered list of steps. Each step shows "{subject} to {object}" in capitals and its caption.
  The current step is shaded, earlier steps are marked done, and reply steps are in italic. Choosing a
  step jumps to it. The controls stay in view while the list scrolls.
- **INT-603** A step's **caption** is its description for the current audience or, when it has none,
  its sentence (MODEL-104). The caption bar shows "Step 5 of 14" and the caption.
- **INT-604** On the diagram, steps 1 to the current one are drawn as the trail (LAYOUT-501 to
  LAYOUT-504, LOOK-701 to LOOK-705), the current one drawing itself. As lanes, the stage shows the
  lanes layout (LAYOUT-601 to LAYOUT-607) with the current row marked. Switching between the two
  cross-fades; the step stays the same.
- **INT-605** Next and the Right arrow go one step forward; Back and the Left arrow one step back. Play
  and Space advance one step every 2.4 s until the last step, then stop; pressing Play on the last step
  starts again from step 1. End and Esc end the scenario and return to the view, fitted.
- **INT-606** Ending a scenario, switching view, or starting another scenario stops the current one.

## Static flow overview

- **INT-620** "Show flow overview" beside a scenario opens a static, complete numbered trail on
  its stage view. Selecting a number or a step in the side panel explains that step without
  starting playback. Numbers retain the scenario's authored order; ordinary relationships are
  never assigned an inferred chronological order.
- **INT-621** The shared-link key `flow` holds the overview scenario id and selected step, such as
  `flow=render-model.3`. Playback and presentation take precedence over an overview in a link.
  Moving between its steps is one visit; starting or clearing an overview adds a visit. Back,
  Forward and shared links restore its selected step.
- **INT-622** Each overview badge is a keyboard-focusable button, named with its visible step number
  and sentence. Enter and Space select it, and focus is visible. Changing audience or selected step
  moves no boxes. The overview is static and does not animate a trail being drawn.
- **INT-623** The overview panel offers a named flow chooser, the selected step's sentence and
  description, the complete step list, "Follow the steps" (playback from the selected step), and
  "Clear flow" (return to the view). Esc also clears it. The page keeps plain wording first and
  contextual "More technical"; it adds no persistent list of audience levels.

## Presenter-mode walkthroughs

- **INT-701** Presenting a walkthrough fills the screen: Aerie asks for full screen and otherwise fills
  the window. The top bar, sidebar and side panel hide. The stage shows the diagram, a narration bar at
  the bottom (the step's narration for the current audience, LOOK type scale, with "3 of 8" and the
  walkthrough's title), and at its bottom right Back, Next and Exit with the wording button (INT-106)
  below them, which hide after a few seconds without pointer movement and return when it moves. The
  sidebar's "Tours" and the cover's "Take the tour" start a presentation.
- **INT-702** Each step shows its picture (MODEL-501 to MODEL-503) with the glide of LAYOUT-402. A step
  with focus fits the camera to its focus elements with an 80 px margin, never above scale 1.15;
  otherwise the camera fits the whole picture.
- **INT-703** Right arrow, Page Down, Space and Next go forward; Left arrow, Page Up and Back go back
  (MODEL-504 inside scenario steps); Home and End go to the first and last step. Digits and the
  wording button change the wording (INT-106, MODEL-505). Esc, Exit, or leaving full screen ends the presentation.
- **INT-704** While presenting, clicks do not select, open or close; the reader can still magnify and
  move the camera, and the next step fits it again.
- **INT-705** A step without narration shows its view's title, or the scenario step's caption.
- **INT-706** On the last step, Next does nothing, and the narration bar shows "That is the end of the
  tour. Press Exit, or Esc, to explore on your own." under the narration.
- **INT-707** Ending the presentation returns to reading at the same view, zoom and audience, with
  nothing focused and no scenario playing.

## The live split editor

- **INT-801** The "Edit" button opens the split editor: the Lines source of the model on the left,
  where the sidebar was (40% of the window, at least 360 px, with a divider the author can drag), and
  the live diagram and side panel on the right. While editing, the breadcrumb's view title opens a
  menu of views, scenarios and walkthroughs. "Done" closes the editor.
- **INT-802** The editor shows line numbers and colours each line by its kind (keywords, ids,
  rewordings, descriptions, comments, tags and kinds), in JetBrains Mono.
- **INT-803** Pressing Enter keeps the indent, and adds two spaces after a line that opens a block (a
  `model`, `system`, element, `view`, `scenario`, `walkthrough` or walkthrough `step` line). Tab and Shift+Tab
  indent and outdent by two spaces.
- **INT-804** Completion offers: element ids at the start of a sentence, at the end of a sentence, and
  in `show`, `open`, `close` and focus lists; tags after `[` in `show`; views and scenarios after
  `step`; audiences after `@` and `for`; icon names after `icon`; kinds after `kind`; and keywords at
  the start of a line.
- **INT-805** 250 ms after the author stops typing, the text is checked. Without errors, the diagram
  updates with the glide of LAYOUT-402, keeping the view, audience, zoom state and selection wherever
  their ids still exist (MODEL-603).
- **INT-806** With errors, the diagram keeps the last version without errors and says so at the top of
  the stage ("Your last edit has an error, so this is the last version that worked"). Below the editor, an error list shows each
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

## Authored main-flow defaults

- **INT-624** Opening a model or switching to a view with an authored main scenario immediately shows its numbered overview, without starting playback. A bare link restores that view's main flow; `flow=none` preserves an explicitly cleared picture. A link's `flow` step number refers to the selected stage when that scenario has stages. Back and Forward restore the selected stage or the cleared picture.
- **INT-625** A staged overview says "Stage N of M", shows the authored title and description in the current wording, and offers "Follow the full flow". That action starts detailed playback at the selected stage's first detailed step. Stage buttons are named "Stage N: title". Ending playback in a view with a configured main flow returns to its overview, selecting the stage that contains the detailed step (or stage 1 for a different main scenario). No permanent Wording or audience list is added.
- **INT-626** Selecting an overview stage or step brings its visible origin and as many connected parts as fit into view at the current zoom, using the same camera reveal as selecting an element. Folded internal work reveals its containing box. Selecting an already visible origin and its connections moves nothing; changing wording does not move the camera.
- **INT-627** Clicking an element or selecting it with the keyboard from a static flow overview opens its details in the side panel, replacing the overview without changing the view, audience or open containers. Back restores the overview's selected stage and camera. Opening a container with its control keeps the overview active, and its children can then be selected for their details. Selected-element shared links reopen those details. Playback and presenter-mode selection restrictions are unchanged.
