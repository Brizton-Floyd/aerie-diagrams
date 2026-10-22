# Acceptance

The definition of done ([AGENTS.md](../../AGENTS.md#definition-of-done)) made concrete: which test
suite proves which requirement, slice by slice, and the browser journeys on the Lotto sample. Aerie is
only ever compared with Aerie: every golden, screenshot and score here is Aerie's own.

Requirement ids: `ACC-nnn` for acceptance rules and `JOURNEY-nnn` for browser journeys. Conventions
are in [overview.md](overview.md#reading-this-spec).

## Rules for every slice

- **ACC-001** A slice is done when `npm run check` passes locally and in CI, its read log is committed
  ([AGENTS.md](../../AGENTS.md#read-logs)), and every requirement it owns (tables below) is proved by
  at least one test.
- **ACC-002** A test that proves a requirement names its id at the start of its title, for example
  `it('LANG-013 splits a sentence into subject, verb phrase and objects', ...)` or
  `test('JOURNEY-001 switching audience moves nothing', ...)`. The docs check fails on a cited id that
  this spec does not define.
- **ACC-003** Goldens and screenshots change only on purpose. A change that moves them says so in its
  description, and the reviewer looks at the difference.
- **ACC-004** Readability scores never get worse (SCORE-001 to SCORE-005). An improvement updates the
  committed baseline in the same change.
- **ACC-005** The five suites keep their roles: `unit` for pure logic, `rules` for rule checks and
  scores over layouts, `golden` for snapshots of Aerie's own outputs, `screenshots` for pixels, and
  `journeys` for a reader's path through the production build.
- **ACC-006** Screenshot baselines are shared by every platform. Screenshot runs hide text glyphs (a
  test-only style makes text transparent), so pixels compare shapes, colours and positions while
  goldens and rule checks cover the text. A slice may replace this with one pinned rendering
  environment, as long as `npm run check` stays the one command everywhere.

## Samples and fixtures

- **ACC-011** `samples/` holds the models Aerie is tested on. Slice A2 adds `samples/lotto.aerie`, a
  copy of [examples/lotto.aerie](examples/lotto.aerie). Slice A11 replaces it with the version drafted
  with the Aerie skill and re-baselines on purpose.
- **ACC-012** Language fixtures live in `tests/unit/lines/examples/`: for each requirement, one or more
  `<id>-<what>.aerie` files with either the expected canonical model (`<same name>.json`) or the
  expected diagnostics (`<same name>.diagnostics.json`: id, severity, message, and span, LANG-901).
- **ACC-013** The examples in [examples/](examples/) are fixtures too: parsing `shop.aerie` gives
  `shop.json` byte for byte, and both example files are already formatted (LANG-940).

## Slice by slice

### A2: Lines language

| Suite  | What it proves                                                                                                                             | Requirements         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| unit   | Every line kind, block rule, text rule and sentence split parses to its known canonical model                                              | LANG-001 to LANG-707 |
| unit   | The canonical model's shape, defaults, order, normalisation and serialisation                                                              | LANG-801 to LANG-808 |
| unit   | Every catalogue entry except E604 and E703 is produced with its exact message, line, column and end; suggestions                           | LANG-901 to LANG-905 |
| unit   | The formatter and printer: idempotent, meaning kept, every sample and example unchanged, printing round-trips (checked over every fixture) | LANG-931 to LANG-941 |
| unit   | `aerie check`, `aerie format`, `aerie model`: output, JSON shape and exit codes                                                            | LANG-961 to LANG-966 |
| golden | The canonical model of every sample and of `docs/spec/examples/*.aerie`                                                                    | LANG-806             |

### A3: Model semantics

| Suite  | What it proves                                                                                         | Requirements           |
| ------ | ------------------------------------------------------------------------------------------------------ | ---------------------- |
| unit   | Tree terms, rim, default icons and kind labels                                                         | MODEL-001 to MODEL-005 |
| unit   | Audience resolution, sentences and the code voice flag                                                 | MODEL-101 to MODEL-106 |
| unit   | View resolution, zoom state, opening, closing, revealing and normalisation, including the Lotto tables | MODEL-201 to MODEL-211 |
| unit   | Lifting, carrying, merging and labels, including every row of the Lotto tables for every audience      | MODEL-301 to MODEL-306 |
| unit   | Replies, W601, stage views and E604, folding and visited steps, with the Lotto scenario facts          | MODEL-401 to MODEL-406 |
| unit   | Walkthrough pictures, including the Lotto `tour` table, and E703                                       | MODEL-501 to MODEL-506 |
| unit   | The picture, its defaults and its normalisation                                                        | MODEL-601 to MODEL-604 |
| golden | For every sample, view and audience: the drawn set, the edges and their labels                         | MODEL-302 to MODEL-304 |

### A4: Layout interface, ELK structure layout, audience reserve, rule checks

| Suite  | What it proves                                                                                                    | Requirements                       |
| ------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| unit   | The interface, determinism, rounding and audience independence; a lint test that only the adapter imports `elkjs` | LAYOUT-001 to LAYOUT-006           |
| unit   | Measuring from font files, wrapping and word splitting                                                            | LAYOUT-101 to LAYOUT-104           |
| unit   | Box and label sizes, and the reserve                                                                              | LAYOUT-201 to LAYOUT-205           |
| unit   | The ELK graph the adapter sends, option by option                                                                 | LAYOUT-301 to LAYOUT-306           |
| rules  | Rule checks on every sample, view, audience and zoom state                                                        | RULE-001 to RULE-009               |
| rules  | Edge crossings, bends and fit scale against the committed baseline; timings reported                              | SCORE-001 to SCORE-003, LAYOUT-901 |
| golden | Layout results (boxes, routes, label boxes) for every sample, view and zoom state                                 | LAYOUT-003                         |

### A5: Contour renderer

| Suite       | What it proves                                                                                | Requirements                               |
| ----------- | --------------------------------------------------------------------------------------------- | ------------------------------------------ |
| unit        | Tokens for both themes, and contrast computed from them                                       | LOOK-001 to LOOK-013, SCORE-004            |
| unit        | Type scale, box anatomy, shapes, icons, relationship and selection styles in the drawing code | LOOK-101 to LOOK-603                       |
| golden      | The drawn SVG (numbers rounded, ids stable) for every sample, view, audience and theme        | LOOK-201 to LOOK-503                       |
| screenshots | Every Lotto view in every audience in both themes at 1600 x 900, and one sample of each shape | LOOK-301 to LOOK-502, LOOK-801 to LOOK-807 |
| screenshots | In the browser, drawn text fits its box and labels fit their space for every audience         | RULE-003, RULE-008                         |

### A6: Interactions

| Suite       | What it proves                                                                                 | Requirements                                 |
| ----------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| unit        | The transition plan (who glides, fades in, leaves, when lines return), fitting and the camera  | LAYOUT-401 to LAYOUT-452, INT-351 to INT-353 |
| journeys    | Audience switch, select and side panel, open in place, camera, keyboard and screen reader text | INT-001 to INT-304, INT-901 to INT-905       |
| journeys    | Reduced motion makes every change instant; an accessibility audit finds no problems            | LOOK-901 to LOOK-903, SCORE-005              |
| screenshots | A selection, and an open container                                                             | LOOK-601, LOOK-602                           |

### A7: Navigation sidebar and shared links

| Suite    | What it proves                                                                   | Requirements                           |
| -------- | -------------------------------------------------------------------------------- | -------------------------------------- |
| unit     | Writing and reading the fragment, one fragment per picture, unknown keys ignored | INT-501 to INT-504                     |
| journeys | The sidebar, history entries, Copy link, and a link reopening its exact picture  | INT-401 to INT-404, INT-505 to INT-507 |

### A8: Scenarios on the architecture

| Suite       | What it proves                                                      | Requirements             |
| ----------- | ------------------------------------------------------------------- | ------------------------ |
| unit        | Trail geometry and folded loops                                     | LAYOUT-501 to LAYOUT-505 |
| unit        | The lanes layout                                                    | LAYOUT-601 to LAYOUT-607 |
| rules       | Lanes are tidy and every step is drawn, at every zoom state tested  | RULE-010, RULE-011       |
| golden      | Trail geometry and lanes layouts for every scenario of every sample | LAYOUT-501, LAYOUT-601   |
| screenshots | Trail frames and lanes in both themes                               | LOOK-701 to LOOK-706     |
| journeys    | Playing, stepping, the step list, lanes, audience switch and Done   | INT-601 to INT-606       |

### A9: Presenter-mode walkthroughs

| Suite       | What it proves                                                               | Requirements       |
| ----------- | ---------------------------------------------------------------------------- | ------------------ |
| unit        | Fitting the camera to focus                                                  | INT-702            |
| journeys    | Presenting, keys, scenario steps inside a walkthrough, live audience, ending | INT-701 to INT-707 |
| screenshots | A focus step, a scenario step and the last step                              | LOOK-603           |

### A10: Live split editor and watch mode

| Suite    | What it proves                                                                                       | Requirements       |
| -------- | ---------------------------------------------------------------------------------------------------- | ------------------ |
| unit     | Highlighting by line kind, indentation on Enter, completion lists, the error list text               | INT-801 to INT-804 |
| journeys | Live updates, keeping the last picture on errors with plain-word messages, Format, Download, Discard | INT-805 to INT-808 |
| unit     | The watch server: localhost only, a change reaches an open page, terminal output, a missing file     | INT-851 to INT-855 |

### A12: Aerie skill for Claude

| Suite | What it proves                                                                                                    | Requirements           |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ---------------------- |
| unit  | The skill's files are well formed; every Lines example in it passes `aerie check` without errors and is formatted | SKILL-001 to SKILL-006 |
| unit  | The skill's summary of the language matches the parser: the same keywords and line kinds                          | SKILL-101 to SKILL-108 |
| unit  | The worked examples mark what they could not confirm; the commands the skill runs exist and print what it expects | SKILL-203 to SKILL-208 |

SKILL-201, SKILL-202, SKILL-209 and SKILL-210 (agreeing scope, reading the project, reporting, and
editing rather than rewriting) have no unit test: they are verified by human review of the skill and
by the dry run recorded in [voting-app.md](../skill-dry-runs/voting-app.md), and again by A11's record
(SKILL-301).

The skill's behaviour on a real project is shown in A11, where it drafts the Lotto sample; the
transcript summary is committed with that slice (SKILL-301).

### A11: Lotto sample, browser journeys, readability baseline, v1

| Suite    | What it proves                                                                                   | Requirements               |
| -------- | ------------------------------------------------------------------------------------------------ | -------------------------- |
| journeys | The seven journeys below, on the new Lotto sample                                                | JOURNEY-001 to JOURNEY-007 |
| rules    | The readability baseline for the new Lotto sample is committed and every score is at or above it | SCORE-001 to SCORE-005     |
| all      | Goldens and screenshots of the new sample are re-baselined on purpose                            | ACC-003                    |

- **ACC-101** Before the v1 tag, a check lists every requirement id in this spec and fails if any is
  not cited by a test title (ACC-002).
- **ACC-102** Before the v1 tag, every slice has its read log in `docs/clean-room/read-log/`.

## Browser journeys

Journeys run against the production build with the Lotto sample, at 1600 x 900, as a reader would use
it: real clicks and keys, no calls into the page's code. Each slice adds the journeys for its own
features as soon as it lands; A11 runs them all on the final sample. Wording below is from
[examples/lotto.aerie](examples/lotto.aerie); A11 updates it to the final sample.

- **JOURNEY-001 Switch audience.** Open the Services view. Record every element's and label's on-screen
  box. Press 3. The Website's tagline reads "lotto-options-ui, Angular 21" and the label between
  Website and Screen API reads "calls /ui/\* on". Every recorded box is unchanged. The address holds
  `aud=engineer`. Press 1: the Screen API is named "Website back end".
- **JOURNEY-002 Open in place.** On Services, click the open control on Engine service. Request
  handling, Pick generation and Draw history lookup appear inside it, and the address holds
  `open=engine-service`. The line from Screen API now ends at Request handling. Click the control
  again: the three disappear and the line ends at Engine service again.
- **JOURNEY-003 Select and read.** Click the Results store. It is outlined, unrelated parts dim, and the
  side panel shows "Service in Lotto suite", the name, the tagline, "At every level" and its
  connections as sentences. Click "Saved draws" in a sentence: it is revealed if needed and selected.
  Press Esc: nothing is selected.
- **JOURNEY-004 Play a scenario.** Choose "Generate picks". The caption bar reads "1/14" with step 1's
  caption. Press the Right arrow eight times: "9/14", and the ninth badge is the current one. Switch to
  "As lanes": still step 9. Press 3: the caption gains the engineer paragraph ("The generator chosen
  by `numberGenerator` ...") and nothing moves. Press Esc: the scenario ends and the view is fitted.
- **JOURNEY-005 Present a walkthrough.** Choose "A tour of the Lotto suite". The page is in presenter
  mode with step 1's narration. Go forward to step 4: the Services view with Engine service open and
  Pick generation focused. Go to step 7: the Generate picks scenario plays; forward moves through its
  steps, then to step 8. Press Esc: reading mode, same view.
- **JOURNEY-006 Reopen from a shared link.** Set Services, Executive, Engine service open, Pick
  generation selected. Copy the link and open it in a new page: the same picture (same address, same
  panel, same boxes, same screenshot). Open the link with `sel=nothing-here` added: the notice of
  INT-505 appears and the rest of the picture is shown.
- **JOURNEY-007 Edit live.** Open the editor and change `screen-api` to `screen-apu` in the line
  `website gets screen data from screen-api`. The error list reads "Line 168, column 31: There is no
  element called `screen-apu`. Did you mean `screen-api`?", and the diagram is unchanged. Undo the
  change: the error list empties and the diagram is current.
