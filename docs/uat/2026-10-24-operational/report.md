# Operational UI acceptance report

Date: 2026-10-24. Tested checkout: `main`, commit `60101fa` (merged PR 84).

The exploratory pass confirmed **7 new operational defects, 1 known defect, and 5 usability gaps**.
The most consequential new failures are valid structural edits blanking the diagram and local-file
links opening a different model for the recipient. Existing scripted journeys do not cover these
combinations of actions.

This is an audit artifact. Application code and existing acceptance tests are unchanged.

## Test conditions and coverage

- Interactive testing: Chromium in the in-app browser against the development server at port 4398.
- Desktop viewport: 1280 x 720. Narrow-window probe: 1024 x 768; viewport override reset afterward.
- Models: Aerie, the complex bundled sample, Shapes, and the repository's Team notes example opened
  as a local file. Two disposable editing inputs are included beside this report.
- Both fixture inputs pass `aerie check`: [initial.aerie](initial.aerie) and
  [renamed.aerie](renamed.aerie).
- Automated baseline: all **118 existing browser journeys** passed across two runs. The first run
  passed 112 and rejected six watch-mode starts because the test harness treats stderr warnings as
  fatal. Removing the inherited `NO_COLOR` variable resolved the `NO_COLOR`/`FORCE_COLOR` warning;
  all six watch journeys then passed. This was a harness issue, not six product defects.
- New observations below were reproduced through real UI actions. Source inspection followed the
  reproductions to identify likely repair locations. This was not a load benchmark or a
  cross-browser certification.

### Acceptance matrix

| User operation                                                          | Result             | Evidence or qualification                                                  |
| ----------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------- |
| Open Aerie Big picture with its authored main flow                      | Pass               | Four stage badges and descriptions appear                                  |
| Select stages and jump backward at a manual camera scale                | Pass               | Origin reveal works without resetting scale                                |
| Read an element from the flow overview                                  | Known failure      | Finding 8; prepared fix is outside the tested commit                       |
| Tab to overview badges after magnifying                                 | Fail               | Finding 6                                                                  |
| Activate overview badges with Enter or Space                            | Fail               | Finding 5                                                                  |
| Switch models using keyboard arrows in the model select during playback | Pass               | Select retains the keys; model change succeeds                             |
| Start detailed playback from a selected high-level stage                | Pass               | Detailed range handoff works                                               |
| Advance detailed playback and switch to lanes                           | Pass               | Selected detailed step is retained                                         |
| Open and close containers during exploration and playback               | Pass               | Covered interactively and by existing journeys                             |
| Reopen valid picture links; recover a stale view/step link              | Pass               | Existing journeys pass; stale view displays a notice and a clamped stage   |
| Open an unknown model URL                                               | Fail               | Finding 4                                                                  |
| Copy a local-file diagram link for another reader                       | Fail               | Finding 2                                                                  |
| Return to the previous model with browser Back                          | Fail               | Finding 3                                                                  |
| Open the split editor and make structural changes                       | Fail               | Finding 1                                                                  |
| Keep the last good diagram while text has parser errors                 | Pass               | Existing editor and watch journeys                                         |
| Reload a draft after pressing Done                                      | Usability gap      | Finding 9; draft is retained but not visibly restored until Edit           |
| Format and download edited source                                       | Pass               | Existing editor journeys                                                   |
| Resize the editor with a keyboard                                       | Fail               | Finding 7                                                                  |
| Leave the editor with Escape then Tab                                   | Pass               | Focus moves out of the editor; divider is skipped                          |
| Enter a tour, change wording, advance and exit                          | Pass               | Camera unchanged on wording change; Exit returns focus to the tour control |
| Change theme, reload, and retain selected details                       | Pass               | Light theme and selection persist; original dark theme restored            |
| Read implicit-view model statistics                                     | Usability gap      | Finding 12                                                                 |
| Choose between same-named models                                        | Usability gap      | Finding 11                                                                 |
| Use the application in a narrow desktop window                          | Deferred-scope gap | Finding 10; explicitly outside the current v1 size contract                |
| Discover technical wording while following a high-level flow            | Usability gap      | Finding 13                                                                 |
| Watch a file, recover parser errors/deletion and stop its server        | Pass               | Six watch journeys pass after the environment-only rerun                   |

## New operational defects

### Finding 1: Valid structural edits can blank the diagram (P1)

**Reproduce:** With normal motion enabled, open the complex bundled sample, press Edit, and replace
its text with [initial.aerie](initial.aerie). The panel accepts the new model, but the drawing is
replaced by `Aerie could not draw this picture: There is no element user.`

A smaller reproduction also works: display `initial.aerie` with Reduce motion enabled, turn reduced
motion off, and replace it with [renamed.aerie](renamed.aerie). This changes the element id `a` to
`requester` in both its declaration and relationship. Both inputs check cleanly. The diagram fails
with `There is no element a.` The editor does not report a language error.

**Impact:** Renaming or removing a valid element, a routine authoring operation, can remove the
entire visual feedback loop. The error names something the author deliberately removed and gives
no useful recovery action.

**Expected:** Animate removed elements safely, or replace the drawing when the old model's ids are
absent from the new tree. Valid source should always produce the new diagram.

**Confirmed workaround:** Enable Reduce motion before making the structural edit. The same
replacement then renders successfully. The animation path is therefore load-bearing.

**Repair location:** [transitionPlan](../../../src/layout/transition.ts) calls `tree.ancestors` for an
id present only in the old drawing, using the new tree. [Stage.glide](../../../src/app/stage.ts)
skips this path when reduced motion is enabled. The error card's heading is also partly obscured by
floating camera/wording controls in the captured editor state.

Evidence: [replacement failure](evidence/valid-edit-stale-element.png),
[minimized id-rename failure](evidence/renamed-element-animation-failure.png).

### Finding 2: Copy link reports success for a local model but recipients get another model (P1)

**Reproduce:** Use Open your own .aerie file to open
`skills/aerie/examples/first-file.aerie`. The displayed model is Team notes. Press Copy link.
The clipboard contains only `http://127.0.0.1:4398/`, and the UI reports Link copied. Open the same
route with clean browser storage. It opens the default bundled model, The Lotto suite.

For the clean-storage check, the same local server was accessed through `localhost` instead of
`127.0.0.1`, which isolates browser storage. No model source was supplied to that recipient.

Editing a bundled model has a related problem: Copy link retains the published model's URL even
when the displayed text has been replaced by an entirely different local draft. There is no warning
that the recipient will need that source file or draft.

**Impact:** A reader can confidently send a link that misrepresents what they were looking at.
This is more serious than losing a selection: the recipient sees a different system.

**Expected:** Offer an explicit file-plus-picture sharing path, or clearly warn/disable ordinary
link sharing when the source is local or modified. Preserve the ordinary bundled-model link path.

**Repair location:** [Viewer.open](../../../src/app/viewer.ts) clears the model query for local
files, and `copyLink` copies the address without checking source provenance.

Evidence: [sender's local model](evidence/local-file-copy-link.png),
[recipient's different model](evidence/local-file-recipient-wrong-model.png).

### Finding 3: Browser Back cannot undo a model switch (P2)

**Reproduce:** In a fresh tab, open the Aerie sample. Select stage 3 and wait until its description
is displayed. Choose Shapes in the Model select. Wait for the Shapes heading. Press browser Back.
The clean-tab reproduction returns to `about:blank`, not Aerie stage 3.

In a longer session, Back returned to an older Aerie stage-1 entry, skipping the most recent
stage-3 picture. The per-model Back control is disabled immediately after the model switch.

**Impact:** Readers lose their place when comparing models, and the normal browser recovery action
can take them out of the application.

**Expected:** A deliberate model change should add a browser history entry, while initial loading
and link normalization may replace the current entry. Back should restore the previous model,
picture and camera.

**Repair location:** [Viewer.open](../../../src/app/viewer.ts) unconditionally calls
`history.replaceState`, including when invoked by the Model select. This behavior matches the
current per-model implementation; the operational expectation needs to be reflected in the spec.

Evidence: before switching, the address was
`?model=samples/aerie.aerie#flow=full-flow.3`; after Shapes then Back, the fresh tab was `about:blank`.

### Finding 4: Unknown model URLs silently substitute an unrelated diagram (P2)

**Reproduce:** Open `http://127.0.0.1:4398/?model=missing-model.aerie`.
The app opens the default bundled model and rewrites the address to its real path. No warning or
status message mentions the missing model.

**Impact:** A mistyped, outdated or incorrectly generated link can be mistaken for a successful
load of the intended system. The original requested name is removed from the address.

**Expected:** Explain that the requested model was not found and offer model/file selection.
If a fallback is displayed, label it as a fallback. Stale view/step links already have a useful
notice and provide a consistency model for this behavior.

**Repair location:** [start](../../../src/app/viewer.ts) falls back to `FIRST_SAMPLE` when the query
is unknown, before opening the model.

Evidence: [silent fallback](evidence/unknown-model-silent-fallback.png).

### Finding 5: Activating a stage badge drops keyboard focus to the page (P2)

**Reproduce:** In the Aerie overview, reach a numbered SVG badge and press Enter or Space. The
selected stage updates, but `document.activeElement` becomes `BODY`. Reproduced with both stage 1
and stage 2. Sidebar step-list buttons do not have the same problem.

**Impact:** Keyboard users lose their position after every diagram-badge activation and must
navigate back through unrelated controls to continue.

**Expected:** Keep focus on the corresponding selected badge after redraw. A stage change should
not restart the tab journey.

**Repair location:** [Stage.morph and focus restoration](../../../src/app/stage.ts) replace the badge
layer; the focus identity/restoration code recognizes element nodes, not overview badges.

Evidence: [badge activation](evidence/badge-keyboard-focus-lost.png),
[measured observations](observations.json).

### Finding 6: Tab can focus a stage badge wholly outside the visible stage (P2)

**Reproduce:** Magnify the Aerie diagram four times and select stage 4 from its list. Continue the
keyboard tab sequence from the Diagram reader box to the first stage badge. Focus reaches
Stage 1: Write the model, but its bounds remain above the clipped stage.

The settled focused badge had top `-252.25` and bottom `-214.85`, while the stage's vertical range
was `52` to `720`. Activating the badge brings the stage's origin back into view, but merely focusing
it does not.

**Impact:** A keyboard user cannot see the control they are about to activate. The application
already reveals focused element boxes, so badges behave inconsistently.

**Expected:** Bring focused badges into view without changing camera scale or selecting them.

**Repair location:** The [stage focusin handler](../../../src/app/stage.ts) handles
`.shape:focus-visible`, excluding `.overview-step`.

Evidence: [invisible focused badge](evidence/keyboard-focus-offscreen.png),
[measured bounds](observations.json).

### Finding 7: The editor width divider is pointer-only (P2)

**Reproduce:** Open Edit. The Editor width divider is draggable with a pointer, but is skipped by
keyboard navigation. Its DOM is a `div` with `role="separator"`, no `tabindex` and no current-value
attributes. Attempting keyboard focus/ArrowLeft on that separator fails because it is not focusable.
Escape then Tab can leave the editor, but does not make the divider operable.

**Impact:** Keyboard users cannot reclaim diagram space or increase source width. This matters
most when editing larger models in the already narrow split view.

**Expected:** Provide a focusable, named resizing control with current width and keyboard actions,
or equivalent keyboard-accessible size controls.

**Repair location:** [Session's divider and drag handler](../../../src/app/split.ts) implement only
pointer interaction.

Evidence: [editor and divider](evidence/editor-divider-and-zero-view-count.png),
[DOM observation](observations.json).

## Known defect reconfirmed

### Finding 8: Box clicks do not open details during the default overview (P1, known)

On the tested main commit, clicking Model tools leaves the heading Create a diagram. Clearing the
flow and clicking the same box opens Model tools. The selection guard in
[the model picture API](../../../src/model/picture.ts) excludes overview mode.

This is the defect already addressed by [PR 85](https://github.com/Brizton-Floyd/aerie-diagrams/pull/85)
in the preceding task. That fix is not included in commit `60101fa`; this audit does not claim it as
a newly discovered defect.

Evidence: [main-branch selection failure](evidence/known-overview-box-selection.png).

## Usability gaps and product decisions

### Finding 9: Done hides draft provenance, and reload silently shows the published model (P2)

After replacing the source with Acceptance Test Copy and pressing Done, the app displays that
copy. Reloading shows The Lotto suite again, with no visible explanation. Pressing Edit recovers
the draft. The text was retained; this is not proven data loss.

**Why it matters:** Done can be read as completing/saving the edit, and reload looks like the work
was lost. The model select and copied URL also still identify the published source.

**Improve:** Make the local-draft state visible outside the editor. Offer Resume draft/Published
version and explain what Copy link and Download preserve. Decide whether reload should resume the
visible draft automatically.

Evidence: [edited copy](evidence/valid-edit-stale-element.png),
[reloaded published model](evidence/draft-reload-original.png).
Draft retrieval currently occurs in [the editor session constructor](../../../src/app/split.ts).

### Finding 10: Narrow desktop windows push the details panel off-screen (P2 enhancement)

At 1024 x 768, the page remains 1280 px wide. The details panel spans x=912 to x=1280, leaving only
112 px in view; top-bar actions are also beyond the right edge. Horizontal page scrolling is
required to read or operate them.

This is **explicitly outside the current v1 size contract**, which starts at 1280 x 720. It is not
classified as a regression against that contract. It remains a significant friction point for a
resized laptop window, split-screen work or an embedded browser pane.

**Improve:** Provide a collapsible navigation/details layout, a drawer, or a visible size warning and
recovery path. Preserve access to the selected element's information.

Evidence: [1024 px window](evidence/narrow-window-panel-clipped.png).
Source: [page layout](../../../src/app/page.css), [current scope](../../spec/overview.md).

### Finding 11: Different models have identical chooser labels (P3)

The Model select contains two `lotto.aerie` options. Their values are `samples/lotto.aerie` and
`docs/spec/examples/lotto.aerie`. Opening a local first-file.aerie also produces two indistinguishable
first-file.aerie labels, one local and one bundled.

**Improve:** Label choices with model title and a human-readable origin such as sample, reference
example or local file. Group options where useful.

Source: [model option labels](../../../src/app/viewer.ts) strip the directory from every path.
Evidence: [observed option values](observations.json).

### Finding 12: An implicit Overview is counted as zero views (P3)

Both valid two-element editing inputs show an Overview, while the cover statistics say
`2 parts 0 views`.

**Improve:** Count effective views, or label the statistic as custom/authored views. The current
reader-facing wording contradicts the visible navigation.

Source: [viewPanel statistics](../../../src/app/panel.ts) count `model.views`, while semantics
supplies the implicit view. Evidence: [rendered count and Overview](evidence/editor-divider-and-zero-view-count.png).

### Finding 13: Technical stage wording has no contextual discovery control (P2)

Stage 2 initially says Check its meaning. Its panel offers Follow the full flow, Clear flow and the
step list, but no contextual More technical action. Pressing the unadvertised `3` shortcut changes
the title to Parse and resolve the model, proving deeper authored wording exists.

**Improve:** Expose the existing plain-first, more-on-demand pattern within a stage explanation,
without reinstating a permanent audience list. The current keyboard shortcut can remain an
accelerator, but should not be the only direct route while staying in the overview.

Evidence: [technical stage wording](evidence/technical-stage-no-contextual-control.png),
[plain-stage controls](observations.json).

## Prioritized follow-up

1. Fix valid structural editing (finding 1), and provide safe local/draft sharing (finding 2).
   Keep the already prepared box-details fix (finding 8) in this first usability repair group.
2. Restore keyboard focus/visibility and keyboard resizing (findings 5, 6 and 7).
3. Make model navigation and missing-model recovery trustworthy (findings 3 and 4).
4. Make draft state and model choice unambiguous (findings 9, 11 and 12).
5. Decide on narrow-window support and contextual stage wording (findings 10 and 13).

A further design-dependent observation: after magnifying detailed playback and advancing to step 8,
the current origin extended below the stage (bottom 804.94 versus stage bottom 720), although its
number badge remained visible. A Follow current step or Reveal current step control could help.
This is not included in the defect count because keeping a manually positioned camera is also a
valid product choice. Evidence: [clipped playback origin](evidence/playback-origin-clipped.png).

## Cleanup

Temporary drafts were discarded through the UI, test theme/reduced-motion settings restored, and the
viewport override reset. The user's untracked architecture files were not opened or changed.
