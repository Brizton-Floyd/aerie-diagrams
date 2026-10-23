# Aerie Diagrams

Aerie is diagram-as-code for architecture: **one model, every audience**. Engineers describe a
system once in a text file (the Lines language); readers explore interactive, multi-view diagrams
that reword themselves for their audience level and open deeper in place. See
[README.md](README.md) for the pitch and [GLOSSARY.md](GLOSSARY.md) for the vocabulary, which is
binding in code, tests and UI text.

## Clean-room rules (mandatory)

Aerie is a clean-room build ([decision 0001](docs/decisions/0001-clean-room.md)). Every agent and
every human working here follows these rules on every task:

1. **Never open, read or copy anything** from `/Users/briztonfloyd/Desktop/ilo-spike`, from any
   treehouse `ilo-spike` worktree, or from Ilograph (its website, docs, app or code). Not to check
   one detail, not to compare output, not through a search result.
2. **Allowed inputs** are only:
   - this repository;
   - the map folder `/Users/briztonfloyd/Desktop/firstmate/data/ilo-own-map/` (`map.md`,
     `GLOSSARY.md`, `tickets/`);
   - the clean prototypes in `/Users/briztonfloyd/Desktop/firstmate/data/ilo-own-language/`,
     `.../ilo-own-layout/` and `.../ilo-own-look/`;
   - general, product-neutral references (language and library docs, package registries, standards);
   - the task's own firstmate instructions (the brief firstmate dispatches for the task, for
     example `/Users/briztonfloyd/Desktop/firstmate/data/<task>/brief.md`);
   - product-neutral firstmate tooling (for example scripts in
     `/Users/briztonfloyd/Desktop/firstmate/bin/`).

   These allowances never extend to the sources banned in rule 1.

3. **Keep a read log** for every task (below). If you are unsure whether a source is allowed, do not
   open it; ask.
4. If you open a forbidden source by accident, stop, record it in your read log, and report it
   before writing any more code. Do not use anything you saw.

### Read logs

Every task records what it read from outside this repository in
`docs/clean-room/read-log/<task>.md`, where `<task>` is the slice or task id (for example `a2-lines`).
List every external file path and every URL, one per line, with a few words on why. Files inside this
repository need not be listed. Commit the log with the task's work; a task without a read log is not
done. The format is shown in [docs/clean-room/read-log/](docs/clean-room/read-log/).

## Definition of done

A change is done when `npm run check` passes locally and in CI, and it meets the bar below for what
it touches. Aerie is only ever compared with Aerie.

- **Layout and rendering**: rule checks pass on every view and every audience (nothing overlaps,
  labels fit, children sit inside their parents, switching audience moves nothing, every
  relationship is drawn); goldens of Aerie's own samples match, and any change to them is deliberate
  and reviewed; screenshots match Aerie's own previous screenshots; readability scores (edge
  crossings, label sizes, contrast and accessibility) never get worse.
- **Language and editor**: every language rule has spec examples that parse to a known canonical
  model; every error message comes from Aerie's own plain-English catalogue and is tested with its
  line and column; the formatter round-trips every sample unchanged.
- **Features**: browser journeys on the Lotto sample cover switching audience, opening in place,
  playing a scenario, presenting a walkthrough, and reopening the exact picture from a shared link.
- **Clean room**: the task's read log is committed and lists only allowed sources.

## Commands

`npm run check` is the one gate; CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs the
same. The individual suites are the `test:*` scripts in [package.json](package.json):

- `test:unit`, `test:rules`, `test:golden` are Vitest projects (`tests/<suite>/**/*.test.ts`).
- `test:screenshots`, `test:journeys` are Playwright projects (`tests/<suite>/**/*.spec.ts`), run
  against the production build served by `vite preview`.
- Update baselines deliberately: `npx vitest run --project golden -u`, and
  `npx playwright test --project screenshots --update-snapshots`. The language fixtures
  (`tests/unit/lines/examples/`, ACC-012) update the same way with `--project unit -u`; review the
  diff, since the expected files come from the code under test. The readability baselines
  (`tests/rules/scores.json` and `contrast.json`, ACC-004) update with
  `AERIE_UPDATE_SCORES=1 npx vitest run --project rules tests/rules/scores.test.ts tests/rules/contrast.test.ts`.
- `npm run dev` serves the viewer page ([src/app/viewer.ts](src/app/viewer.ts)): a bundled sample
  (`?model=samples/lotto.aerie`) or a local file, drawn for a chosen view, audience, zoom,
  selection or scenario step. Render goldens are standalone SVGs under
  `tests/golden/__snapshots__/render/`, viewable in a browser.
- `npx aerie check|format|model <file>` runs the Lines tools ([src/cli/aerie.ts](src/cli/aerie.ts),
  executed by Node's type stripping, so it imports `.ts` files and uses only erasable syntax).
  `npx aerie` works only inside this checkout: elsewhere npm fetches an unrelated package of the same
  name, so run `node <checkout>/src/cli/aerie.ts` instead. `npx aerie watch <file>` (INT-851) serves
  the built `dist/`, so run `npm run build` first; its journeys spawn it on `--port 0`.
- [skills/aerie/](skills/aerie/SKILL.md) is the Claude skill for writing models (A12).
  `tests/unit/skill/` runs every Lines example in it through the CLI and holds its language summary
  to the parser, so a language change that breaks the skill fails `test:unit`.

Each later slice adds its own screenshots and journeys next to A5's (`tests/screenshots/page.ts`
has the steps for opening a model and choosing a view and audience with clicks).

## Sharp edges

- Dependencies are pinned to exact versions (`.npmrc` has `save-exact`). TypeScript stays on 6.0.x
  until `typescript-eslint` supports 7.
- `lint` also runs `scripts/check-text.ts`, which fails on any em dash in the repo (use a plain
  hyphen), `scripts/check-docs.ts`, which fails on broken Markdown links and on spec ids
  (`LANG-012`, `E008`) that are defined twice or cited in docs or tests without being defined, and
  `scripts/check-coverage.ts`, which fails when a spec requirement is cited by no test title or a
  slice has no read log (ACC-101, ACC-102): a new requirement lands with its test.
- `samples/lotto.aerie` is the flagship sample (refined with the skill in A11; how is in
  `samples/lotto.md`, which a unit test holds to it). `docs/spec/examples/lotto.aerie` is the spec's
  worked example: the model tests' Lotto tables and the tests that print a W601 use it, so leave it
  as the spec says. Changing the sample moves goldens, screenshots, scores and journey wording.
- `docs/spec/examples/*.json` and the language fixtures' `.json` files are byte-exact canonical
  models and diagnostics, so Prettier skips them.
- `src/lines/` (the parser, catalogue, formatter and printer) is pure TypeScript: lint rejects Node
  imports and DOM globals there. Every diagnostic message comes from `src/lines/catalogue.ts`, and a
  test holds it word for word to the catalogue table in `docs/spec/language.md`.
- `src/model/` (model semantics: views, zoom, lifting, scenarios, walkthroughs, the picture) is pure
  TypeScript too and may import only `src/lines/index.ts`. Its entry point and API notes are in
  [src/model/index.ts](src/model/index.ts). Diagnostics that need the model's meaning (E604, E703)
  come from its `check()`, which the CLI and the language fixtures use; `parse()` alone omits them.
- `src/layout/` (layout interface, reserve, ELK adapter, lanes, rule checks, scores) is pure
  TypeScript too, built only on `src/lines/index.ts` and `src/model/index.ts`; its API notes are in
  [src/layout/index.ts](src/layout/index.ts). Only `src/layout/elk/` imports `elkjs` (LAYOUT-002,
  lint-enforced; tests too). Import `inProcessEngine` (Node) and `workerEngine` (browser) from their
  own modules so the browser bundle never pulls in the in-process ELK.
- `src/render/` (the Contour renderer) is pure TypeScript too, built only on the three entry points
  above; its API notes are in [src/render/index.ts](src/render/index.ts). Drawings are SVG trees of
  classes and geometry; every colour, stroke, face and timing is in the stylesheet that
  `contourStyle()` writes from the tokens, so a theme switch redraws nothing and colours never
  appear outside `tokens.ts` (a unit test enforces it).
- Text is measured from `src/layout/text/advances.json`, written from the bundled Fontsource fonts by
  `node scripts/font-metrics.ts`; rerun it when a font package changes (a unit test compares them).
- The split editor (A10) is CodeMirror 6 in `src/app/editor.ts`, loaded only when "Edit" is pressed
  (`split.ts`); what it knows about Lines (colours, Enter indent, completion) is pure, in
  `src/lines/editing.ts`. CodeMirror draws only the lines near its viewport, so journeys scroll to a
  line before reading or clicking it, and its keymaps never see Option+letter on macOS (match
  `event.code` instead).
- Vitest 5 hides the console output of passing tests; a suite that reports (LAYOUT-901) writes to
  `process.stdout`.
- Playwright builds and serves the app on port 4173 and never reuses a running server. Set
  `AERIE_PREVIEW_PORT` when several checkouts run checks at the same time.
- Screenshot baselines are shared across platforms (no OS suffix) and compared with no tolerance:
  runs hide text (ACC-006), and nothing the page draws may take its size from rendered text (give
  such chrome a fixed width). Drawn text is unhinted (`text-rendering: geometricPrecision`) so it is
  as wide as measured on Linux too. Before pushing new baselines, run the suite on Linux as CI does,
  in `mcr.microsoft.com/playwright:v1.64.1-noble` with a fresh `npm ci` (macOS `node_modules` hold
  native binaries). Screenshot runs also hide the side panel's content, which wraps per platform.
  Playwright's default per-pixel colour threshold still passes faint changes (dark-theme borders),
  so after changing page chrome regenerate with `--update-snapshots=all`, not only the failures.
- The page (`src/app/`): `viewer.ts` holds the picture and the keys, `stage.ts` shows drawings (in
  place when the layout is the same, else gliding by `transitionPlan`) and runs the camera,
  `panel.ts` builds the side panel. In fit mode the camera follows the container the reader opened
  or closed (LAYOUT-453, `followCamera`) at scale 1 or more, so most of the picture is off the stage
  after a drill-down; the stage is `overflow: clip`, so Playwright cannot scroll an off-stage box
  into view: journeys reach it with `focus()` and keys, or press "Fit all" first. Every picture
  change goes through `Viewer.change()`, which writes the picture into the address's fragment
  (`link.ts`, INT-501) and adds a history entry only when the view or activity changes (INT-506);
  new controls just call it. Motion timings are
  read from the stylesheet's `--aerie-*` properties, so reduced motion needs no code path of its
  own. In an interactive drawing each box's `.shape` rect, not its group, is the focusable, named
  button (the accessibility audit, SCORE-005, rejects a button whose visible text is not in its
  name). Journeys wait for `document.getAnimations()` to empty (`settled` in
  `tests/journeys/reader.ts`), so CSS animations never fill forwards. Scenario playback (A8) is
  `scenario.ts` (side panel, caption, autoplay); other parts of the page start and end one with
  `Viewer.playScenario` and `endScenario`. Presenter mode (A9) is `presenter.ts` (narration bar
  words, Back/Next/Exit), started and ended with `Viewer.presentWalkthrough` and `endPresentation`;
  the `presenting` class on the page hides the chrome, and a presented scenario step draws its trail
  from the picture, not by playing the scenario. Screenshot runs hide the side panel's content, so
  they press its controls with `dispatchEvent('click')`; Playwright refuses to click a control
  marked `aria-disabled` without `force`.

## Plan

v1 is built in the slices listed in [docs/slice-plan.md](docs/slice-plan.md) (source:
`/Users/briztonfloyd/Desktop/firstmate/data/ilo-own-map/tickets/11-rebuild-plan.md`). Settled
decisions live in [docs/decisions/](docs/decisions/). The functional spec is
[docs/spec/](docs/spec/overview.md): build from it, cite its requirement ids at the start of test
titles, and map your slice's tests through [docs/spec/acceptance.md](docs/spec/acceptance.md).

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
