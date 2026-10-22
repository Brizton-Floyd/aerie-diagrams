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
  diff, since the expected files come from the code under test.
- `npx aerie check|format|model <file>` runs the Lines tools ([src/cli/aerie.ts](src/cli/aerie.ts),
  executed by Node's type stripping, so it imports `.ts` files and uses only erasable syntax).

The rules, screenshots and journeys suites still hold stubs that prove their wiring; the slice that
owns each suite replaces its stub.

## Sharp edges

- Dependencies are pinned to exact versions (`.npmrc` has `save-exact`). TypeScript stays on 6.0.x
  until `typescript-eslint` supports 7.
- `lint` also runs `scripts/check-text.ts`, which fails on any em dash in the repo (use a plain
  hyphen), and `scripts/check-docs.ts`, which fails on broken Markdown links and on spec ids
  (`LANG-012`, `E008`) that are defined twice or cited in docs or tests without being defined.
- `docs/spec/examples/*.json` and the language fixtures' `.json` files are byte-exact canonical
  models and diagnostics, so Prettier skips them.
- `src/lines/` (the parser, catalogue, formatter and printer) is pure TypeScript: lint rejects Node
  imports and DOM globals there. Every diagnostic message comes from `src/lines/catalogue.ts`, and a
  test holds it word for word to the catalogue table in `docs/spec/language.md`.
- `src/model/` (model semantics: views, zoom, lifting, scenarios, walkthroughs, the picture) is pure
  TypeScript too and may import only `src/lines/index.ts`. Its entry point and API notes are in
  [src/model/index.ts](src/model/index.ts). Diagnostics that need the model's meaning (E604, E703)
  come from its `check()`, which the CLI and the language fixtures use; `parse()` alone omits them.
- Playwright builds and serves the app on port 4173 and never reuses a running server. Set
  `AERIE_PREVIEW_PORT` when several checkouts run checks at the same time.
- Screenshot baselines are shared across platforms (no OS suffix), so screenshot tests must not
  depend on font rendering differences between macOS and Linux.

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
