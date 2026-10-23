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
  with the Aerie skill and re-baselines on purpose; the example stays as the spec's worked example.
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

| Suite       | What it proves                                                                                                   | Requirements                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| unit        | Tokens for both themes, and contrast computed from them                                                          | LOOK-001 to LOOK-013, SCORE-004            |
| unit        | Type scale, box anatomy, shapes, icons, relationship and selection styles in the drawing code                    | LOOK-101 to LOOK-603                       |
| golden      | The drawn SVG (numbers rounded, ids stable) for every sample, view and audience; the stylesheet with both themes | LOOK-201 to LOOK-503                       |
| screenshots | Every Lotto view in every audience in both themes at 1600 x 900, and one sample of each shape                    | LOOK-301 to LOOK-502, LOOK-801 to LOOK-807 |
| screenshots | In the browser, drawn text fits its box and labels fit their space for every audience                            | RULE-003, RULE-008                         |

### A6: Interactions

| Suite       | What it proves                                                                                 | Requirements                                 |
| ----------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| unit        | The transition plan (who glides, fades in, leaves, when lines return), fitting and the camera  | LAYOUT-401 to LAYOUT-455, INT-351 to INT-354 |
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
| journeys | Watch mode: a save updates the page, errors over the stage, a deleted file, stopping the server      | INT-851 to INT-855 |

### A12: Aerie skill for Claude

| Suite | What it proves                                                                                                    | Requirements           |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ---------------------- |
| unit  | The skill's files are well formed; every Lines example in it passes `aerie check` without errors and is formatted | SKILL-001 to SKILL-006 |
| unit  | The skill's summary of the language matches the parser: the same keywords and line kinds                          | SKILL-101 to SKILL-108 |
| unit  | The worked examples mark what they could not confirm; the commands the skill runs exist and print what it expects | SKILL-203 to SKILL-208 |

SKILL-201, SKILL-202, SKILL-209 and SKILL-210 (agreeing scope, reading the project, reporting, and
editing rather than rewriting) have no unit test: they are verified by human review of the skill and
by the dry run recorded in [voting-app.md](../skill-dry-runs/voting-app.md), and again by A11's record
(SKILL-301), [samples/lotto.md](../../samples/lotto.md), which a unit test holds to the sample.

The skill's behaviour on a real project is shown in A11, where it drafts the Lotto sample; the
transcript summary is committed with that slice (SKILL-301).

### A11: Lotto sample, browser journeys, readability baseline, v1

| Suite    | What it proves                                                                                   | Requirements                                          |
| -------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| journeys | The nine journeys below, on the new Lotto sample                                                 | JOURNEY-001 to JOURNEY-009                            |
| rules    | The readability baseline for the new Lotto sample is committed and every score is at or above it | SCORE-001 to SCORE-005                                |
| all      | Goldens and screenshots of the new sample are re-baselined on purpose                            | ACC-003                                               |
| unit     | The record of drafting the sample with the skill matches the sample                              | SKILL-201, SKILL-202, SKILL-209, SKILL-210, SKILL-301 |
| unit     | Every requirement id is cited by a test title, and every slice has its read log                  | ACC-101, ACC-102                                      |

- **ACC-101** Before the v1 tag, a check lists every requirement id in this spec and fails if any is
  not cited by a test title (ACC-002).
- **ACC-102** Before the v1 tag, every slice has its read log in `docs/clean-room/read-log/`.

### After v1: the camera follows the reader

A fix reported after v1 (read log `zoom-focus.md`): opening containers in place shrank the whole
picture until its text could not be read.

| Suite       | What it proves                                                                                       | Requirements             |
| ----------- | ---------------------------------------------------------------------------------------------------- | ------------------------ |
| unit        | Following frames an element and its neighbours at a readable scale; revealing pans without shrinking | LAYOUT-453 to LAYOUT-455 |
| journeys    | Drilling down keeps the opened container readable and in view; selecting brings it into view         | JOURNEY-010, INT-354     |
| screenshots | An open container, followed by the camera, and the Fit all button                                    | LOOK-302, LOOK-806       |

### After v1: D1, the lines for checking against the code

Slice D1 of drift detection ([drift.md](drift.md), read log `d1-lang.md`): the `system` block, `code`
lines and `ignore` lines in the Lines language. No extraction yet.

| Suite | What it proves                                                                                                                             | Requirements                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| unit  | Every rule of the system root, code lines and ignore lines parses to its known canonical model, and E801 to E814 come with line and column | LANG-751 to LANG-759         |
| unit  | The canonical model's `system`, `code` and `ignores` fields: shape, order and defaults                                                     | LANG-801, LANG-809           |
| unit  | The formatter keeps paths and normalises the new lines; the printer writes them in order and round-trips                                   | LANG-933, LANG-937, LANG-941 |
| unit  | The editor colours the new lines and indents under `system`                                                                                | INT-802, INT-803             |
| unit  | The skill's language summary lists the new keywords, ownership rows and diagnostics                                                        | SKILL-101, SKILL-206         |
| rules | Adding code lines, a system root and ignore lines to every sample changes no drawing, for every view, audience and zoom state              | MODEL-006                    |

### After v1: D2, the extractor core and Docker Compose

Slice D2 of drift detection ([drift.md](drift.md#the-extractor-core-slice-d2), read log
`d2-compose.md`): facts with evidence and technique, and the Docker Compose extractor. No matching or
reports yet.

| Suite | What it proves                                                                                                                                                    | Requirements                      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| unit  | Facts carry their technique and `repo/path:line` evidence, print as report lines, come sorted and once each; the parsers are pinned and noticed                   | DRIFT-001 to DRIFT-004, DRIFT-009 |
| unit  | Problems name what stops drift and what is not checked; the system root gives the repos and the Compose files read; YAML keeps positions                          | DRIFT-005 to DRIFT-008            |
| unit  | Each Compose rule, from interpolation and the `.env` format to hosts, secrets, builds and details                                                                 | DRIFT-101 to DRIFT-113            |
| unit  | Fixture projects with known facts (interpolation, merging, connections, builds, details): every fact found, nothing more, checked against `docker compose config` | DRIFT-102 to DRIFT-113            |
| unit  | Copies of the Lotto Compose files give its four services and three Compose connections, and only from the file the system root names                              | DRIFT-114                         |

### After v1: D4, Node and Angular

Slice D4 of drift detection ([drift.md](drift.md#node-and-angular-slice-d4), read log `d4.md`):
packages, Angular projects, dev-server proxies, environment files, HTTP calls and the nginx that
serves an application, each relative call followed to where it goes. No matching or reports yet.

| Suite | What it proves                                                                                                                                                                | Requirements           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| unit  | Each Node, Angular and nginx rule, from JSON with comments and workspaces to calls, URLs, proxies, templates and location choice                                              | DRIFT-301 to DRIFT-309 |
| unit  | A fixture workspace with every planted pattern (two proxies, environment files, a library, an unnamed package, interceptors, nginx templates): every fact found, nothing more | DRIFT-302 to DRIFT-309 |
| unit  | Copies of the Lotto UI give its package, its nine calls and the website's connection to the Screen API by four techniques, as the Lotto repos do                              | DRIFT-310              |
| unit  | The two new parsers are pinned, runtime dependencies and in the notices                                                                                                       | DRIFT-311              |

### After v1: D3, Spring Boot and Maven

Slice D3 of drift detection ([drift.md](drift.md#spring-boot-and-maven-slice-d3), read log
`d3-spring.md`): the Maven modules from the raw poms, and the Spring configuration and Java of each.
No matching or reports yet.

| Suite | What it proves                                                                                                                                   | Requirements                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| unit  | Modules from each repo's root pom, inheritance from parents in the system, dependencies with their scopes, and the warnings                      | DRIFT-201 to DRIFT-203            |
| unit  | Configuration files, profiles, placeholders and relaxed binding; the properties and connections an address names, with hosts resolved to modules | DRIFT-205 to DRIFT-207            |
| unit  | Java read into the model, names resolved as the compiler does; the parsers and the kept grammar pinned and noticed                               | DRIFT-208, DRIFT-215              |
| unit  | Apps, endpoints, calls by declared receiver type with their base URLs and address text, channels, events and schedules                           | DRIFT-204, DRIFT-209 to DRIFT-213 |
| unit  | A Spring fixture project with one of each pattern and its traps: every fact found, nothing more                                                  | DRIFT-201 to DRIFT-213            |
| unit  | Copies of the Lotto Spring repos give their apps, ports, module graph, endpoints, calls, event and the Texas downloads                           | DRIFT-214                         |

## Browser journeys

Journeys run against the production build with the Lotto sample, at 1600 x 900, as a reader would use
it: real clicks and keys, no calls into the page's code. Each slice adds the journeys for its own
features as soon as it lands; A11 runs them all on the final sample, and adds the last two. Wording
below is from the final sample, `samples/lotto.aerie`.

- **JOURNEY-001 Switch audience.** Open the Services view. Record every element's and label's on-screen
  box. Press 3. The Website's tagline reads "lotto-options-ui, Angular 21" and the label between
  Website and Screen API reads "calls /ui/\* on". Every recorded box is unchanged. The address holds
  `aud=engineer`. Press 1: the Screen API is named "Website back end".
- **JOURNEY-002 Open in place.** On Services, click the open control on Engine service. Request
  handling, Game analysis, Pick generation and Draw history lookup appear inside it, and the address
  holds
  `open=engine-service`. The line from Screen API now ends at Request handling. Click the control
  again: the four disappear and the line ends at Engine service again.
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
  generation selected, and press "Fit all", since a link opens fitted (INT-353). Copy the link and open it in a new page: the same picture (same address, same
  panel, same boxes, same screenshot). Open the link with `sel=nothing-here` added: the notice of
  INT-505 appears and the rest of the picture is shown.
- **JOURNEY-007 Edit live.** Open the editor and change `screen-api` to `screen-apu` in the line
  `website gets screen data from screen-api`. The error list reads "Line 213, column 31: There is no
  element called `screen-apu`. Did you mean `screen-api`?", and the diagram is unchanged. Undo the
  change: the error list empties and the diagram is current.
- **JOURNEY-008 Find your way.** Open the page: the sidebar lists the views "Big picture", "Services"
  and "Engineering: code modules", the scenarios "Generate picks" and "Results poll", and the
  walkthrough "A tour of the Lotto suite", with Big picture marked. Choose Services: it is marked, the
  address holds `view=services`, and the whole view fits the stage. Press 1: the Engineering view is
  listed as "How the code is organised". Choose "Results poll": it is marked and shows "1/6". Press
  the browser's Back: Services again, for the Executive, with nothing playing. Back again: the Big
  picture, with no fragment in the address.
- **JOURNEY-009 Watch a file.** Run `aerie watch` on a copy of the sample and open the address it
  prints. Choose Services and Engineer. Rename the Website in the file and save: the page shows the
  new name, still on Services for the Engineer. Save the change of JOURNEY-007: the last picture
  stays and the error list over the stage reads the same message. Save the sample again: the error
  list goes. Press Ctrl+C in the terminal: the server stops and says "Stopped watching."
- **JOURNEY-010 Drill down and read.** Open the Big picture, which fits the stage only below scale 1.
  Open the Analysis engine, then Engine service inside it, then the Results store. After each, the
  opened container's top left is on the stage and its name is drawn at 13.5 px or more on screen.
  Select Draw history lookup with the keyboard: it is in view and the scale is unchanged. Close the
  Results store, Engine service and the Analysis engine: the picture is drawn as it first was, at the
  first scale. Press "Fit all": the whole picture fits the stage.
