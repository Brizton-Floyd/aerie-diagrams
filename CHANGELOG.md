# Changelog

All notable changes to Aerie. Versions follow [Semantic Versioning](https://semver.org/); the
functional spec for each version is [docs/spec/](docs/spec/overview.md).

## Unreleased

### Static exports

- Export the current view fully expanded as PNG or PDF, with one scenario's stages and detailed
  explanations and an optional authored component reference. Preview the selected audience and
  format before downloading; export settings preserve the main reading state. Documents carry no
  added application branding. PDF pages preserve the preview as images with non-selectable text.
- Invalid edits can export the last valid diagram with a warning outside the file. Oversized
  images offer PDF instead of silently clipping or shrinking text. Confluence Cloud is the target;
  live Cloud import testing was explicitly excluded from acceptance.

The Signal look and plain wording first ([decision 0007](docs/decisions/0007-signal-look.md)).

### Signal

- Aerie looks like Signal: an instrument panel at night, with hairline cards on a near-black stage,
  glass controls and light only for what the reader is doing (violet for the selection and the
  trail, a cyan light for the current step and the lines in play). It replaces Contour
  ([docs/spec/look.md](docs/spec/look.md)).
- Dark is the default. A light theme, the same panel in daylight, is one press of the theme button
  away for bright rooms and projectors, and is remembered on the device; printing always uses it.
  Both themes meet WCAG AA, and the accessibility audit finds no problems in either.
- Type is Inter, with JetBrains Mono for the code voice and metadata. Inter is a little wider than
  Source Sans, so the largest Lotto pictures fit at a slightly smaller scale (0.461 to 0.457); the
  readability baseline was re-recorded for it on purpose.
- A model's cover heads the side panel, with "Take the tour"; the first drawing of a model rises
  into place; labels sit on pills; selected lines carry a flowing light.

### Plain wording first

- The "Written for" switch is gone. Every reader starts with the model's first audience, the plain
  wording; "More technical" in the side panel uncovers each deeper wording in turn and remembers the
  depth for the browser tab's session, and resting on a box shows a hover card with the deeper
  names. "Word the whole diagram for Engineer" and the "Back to plain wording" chip word the whole
  picture; the digit keys, links and the presenter's wording button still carry a level
  ([docs/spec/interaction.md](docs/spec/interaction.md), INT-101 to INT-106, INT-204, INT-207,
  INT-208).
- Readers see "tour" for a walkthrough, and the copy is plainer throughout: "Step 5 of 14", "End",
  "On the diagram", "Open it here", "Move closer", and notices that say what happened.
- Choosing another model in the sidebar no longer fails to draw it.

## 1.1.0 - 2026-10-23

Drift detection: `aerie drift` checks a model against the code it describes, on the command line and
on every pull request, and the Aerie skill keeps models in step with the code
([docs/spec/drift.md](docs/spec/drift.md)). Phase 1 checks that the diagram's services, modules,
packages and connections exist, for Docker Compose, Spring Boot with Maven, and Node with Angular.

### Back and Forward through visits

- Every change the reader makes to the picture is a visit, one browser history entry with the camera
  where the reader left it: Back and Forward at the stage's top left, Alt+Left and Alt+Right, and the
  browser's own buttons return to the exact picture, and a list of the latest five visits jumps to
  any of them. Moving the camera updates the current visit; a reload keeps them
  ([docs/spec/interaction.md](docs/spec/interaction.md), INT-551 to INT-557).

### Checking against the code: the skill, the benchmark and the release (D8)

- The Aerie skill ([skills/aerie/](skills/aerie/SKILL.md)) ties every model it writes to the code: a
  system root and a `code` line for each part drift reads, added without being asked. After
  `aerie check` it runs `aerie drift` and fixes every drift and likely finding until there are
  none, fixing the model where it is wrong and adding an ignore line with the reason where a
  difference is meant. When Claude changes code in a way that changes the architecture, the skill
  runs drift and updates the model in the same change.
- The skill's reference gives the drift commands, its JSON, and the usual fix of every kind of
  finding. Worked example 1 (Recipe box) now holds the project's deployment and build files, and its
  drift rounds and a later code change are tested against what the commands print.
- The Lotto benchmark (precision 0.889, recall 0.889, every drift-level finding real) and the fixture
  projects per stack stay part of `npm run check`, and may never get worse.

### Checking against the code: the GitHub Action (D7)

- This repository is a GitHub Action (`action.yml`, [docs/spec/drift.md](docs/spec/drift.md),
  section 8): it runs `aerie drift` on each model file a workflow names, posts one sticky comment
  per model file on the pull request (edited in place on every run), suggests edits as GitHub
  `suggestion` review comments on the lines the pull request adds, adds each report to the job
  summary, and fails on drift (`fail-on: likely` for likely findings too).
- A multi-repo system's sibling repos are checked out beside the repository, read only, from the
  repository of each folder's name under the same owner (the `repos` input names others; a
  `repos-token` reads private ones), with the token given to git only through its environment,
  masked in the log in every form and redacted from everything the Action prints. `.github/workflows/drift.yml` runs the Action on this
  repository's pull requests against a fixture with planted drift. Other CIs run
  `npx aerie drift --format json` and use the exit code.

### Checking against the code: the reports and `aerie drift` (D6)

- `aerie drift <model>` checks a model against its code and prints what it finds
  ([docs/spec/drift.md](docs/spec/drift.md), section 7): a plain-English terminal report by default
  (drift, likely, what is not checked collapsed per element, suggestions and ignore lines; each
  finding one sentence in the diagram's names with its `repo/path:line` evidence, a copy-pasteable
  Lines edit and the ignore line to use instead), `--format diff` (every suggested edit as one patch
  for `git apply`; Aerie never writes the model), `--format json` (`aerie-drift/1`, with a stable key
  per finding) and `--format pr` (the body of a sticky pull request comment, found again by a hidden
  marker).
- Exit codes: 0 for no drift, 1 for drift (or likely too, with `--fail-on likely`), 2 when drift
  cannot run (a model with errors, a missing repo or Compose file). Golden reports of every fixture
  and of the Lotto benchmark; applying the patch and running again reports no drift.

### Checking against the code: matching, lifting and levels (D5)

- Drift compares a model with its code ([docs/spec/drift.md](docs/spec/drift.md), sections 5 and 6):
  each element's code line first, then its name against the Compose services, Maven modules and
  apps (anything uncertain only a suggestion); the code's connections, calls, events, messages and
  type references lifted to the elements that stand for them; each line of the diagram confirmed or
  missing; and the services, modules, packages and connections the diagram does not draw.
- Findings are drift (several techniques agree, or an exact check fails: a code line naming code
  that does not exist, a drawn module depending on an undrawn one) or likely (one technique), with
  their evidence, a suggested Lines edit as hunks, and the ignore line to add instead; ignore lines
  excuse what they name, and one that excuses nothing is reported. Calls are matched to the
  endpoints that answer them, and those no endpoint answers are reported too.
- The extractor reads a class graph from the Java (each type and the types it names), so parts with
  `class:` hints are checked. Fixture projects per stack with planted drifts, and a benchmark on the
  Lotto repos (precision 0.889, recall 0.889, every drift-level finding real) that may never get
  worse. The reports and `aerie drift` come in D6.

### Checking against the code: Node and Angular (D4)

- The extractor reads Node and Angular code too ([docs/spec/drift.md](docs/spec/drift.md)): each
  package (repo roots, npm workspaces, Angular projects and the folders an image is built from) as
  an `npm:` code unit with its frameworks, angular.json projects, dev-server proxy files,
  environment files, and `HttpClient` and `httpResource` calls with URLs read from literals,
  templates, `+`, constants and environment settings, following only the code the application
  imports.
- Each relative call is followed to where it goes, through the dev proxy and through the nginx of
  the image that serves the application (templates filled in from the container's environment,
  `include`, `set` and `upstream`, and nginx's own choice of location); `proxy_pass` is a connection
  of its own. Proxy files that are code, interceptors and configuration fetched at run time are
  warnings, never guesses.
- New dependency: `jsonc-parser`; `typescript` (6.0.3) is now a runtime dependency (both recorded in
  THIRD_PARTY_NOTICES.md). Nothing reads the facts yet; matching and reports come in D5 and D6.

### Checking against the code: Spring Boot and Maven (D3)

- Maven: each repo's root pom and the modules it lists (profiles and Maven 4 subprojects too), read
  from the raw poms with what each inherits from its parents in the system; every module as a
  `maven:` code unit, with its packaging and its dependencies and their scopes.
- Spring configuration: the `application` files of each module, every profile and document kept
  apart, placeholders filled in and relaxed binding (so `COREAPI_BASEURL` overrides
  `core-api.base-url`); the server's port, address and paths, and every address a property holds,
  with the module or outside host it names.
- Java, read with a WebAssembly parser and resolved as the compiler resolves names: Spring Boot apps,
  `@RestController` endpoints, outbound calls through WebClient, RestClient, RestTemplate, Feign and
  HTTP interfaces with their base URLs and the text of their addresses (through constants, helper
  methods and `@ConfigurationProperties`), Kafka, RabbitMQ, JMS and Stream channels, in-process events
  and schedules. A call or template counts only on a receiver declared with its type.
- New dependencies: `web-tree-sitter`, `@xmldom/xmldom` and `properties-file`, with the
  `tree-sitter-java-orchard` grammar kept as its released WebAssembly file (recorded in
  THIRD_PARTY_NOTICES.md). Nothing reads the facts yet; matching and reports come in D5 and D6.

### Checking against the code: the extractor and Docker Compose (D2)

- Aerie's own static extractor (`src/extract/`, [docs/spec/drift.md](docs/spec/drift.md)): it reads
  the project a model's `system` block names, without running anything, and returns facts, each with
  the technique that found it and its evidence as `repo/path:line`.
- Docker Compose: services, the project name, ports, volumes, profiles, healthchecks and images; each
  build's context and, through the Dockerfile's stages, the source the image is built from; and the
  services each one names in its environment (URLs, JDBC URLs, host names), with `depends_on` and
  `links` as corroboration. Interpolation from `.env`, merge keys, override files, `extends` and
  `include` are read as Compose reads them, and only the Compose files the system root names.
- New dependencies: `yaml` and `dockerfile-ast` (recorded in THIRD_PARTY_NOTICES.md). Nothing reads
  the facts yet; matching and reports come in D5 and D6.

### Checking against the code: the lines (D1)

- Lines that tie a model to its code, read only by drift detection ([docs/spec/drift.md](docs/spec/drift.md)):
  a `system` block naming the repos and authoritative Compose files, `code` lines under elements
  listing code units (`compose:`, `maven:`, `npm:`, `class:`), and `ignore drift <subject> - <reason>`
  lines. They never change what a reader sees.
- New diagnostics E801 to E814; the canonical model gains `system`, `code` and `ignores` (still
  `aerie-model/1`).
- `system`, `repo`, `compose`, `code` and `ignore` are now keywords, so a model that uses one of them
  as an id (such as `view code`) must rename it; `aerie check` reports E006 there.

## 1.0.0 - 2026-10-23

The first version: one model, every audience. Built in the slices of
[docs/slice-plan.md](docs/slice-plan.md), each a clean-room build with its read log in
[docs/clean-room/read-log/](docs/clean-room/read-log/README.md).

### The Lines language (A2)

- A plain text format for architecture: elements and their nesting, relationships as sentences,
  wording for each audience, views, scenarios and walkthroughs.
- A parser to one canonical JSON model, a plain-English error catalogue with line, column and
  suggestions, and a formatter that changes only spacing.
- The `aerie` command: `aerie check`, `aerie format` and `aerie model`.

### Model semantics (A3)

- Containment, relationships declared once and lifted to whatever is drawn, audience resolution,
  views with opening and closing in place, scenario replies and stage views, and walkthrough
  pictures.

### Layout (A4)

- Structure views laid out by ELK behind Aerie's own layout interface, with space reserved for the
  longest wording of every audience, so switching audience never moves anything.
- Rule checks on every view, audience and zoom state, and readability scores (edge crossings,
  bends, fit scale, contrast, accessibility) that may never get worse.

### The Contour look (A5)

- Light and dark themes from one set of tokens, Aerie's own icons, bands for nested containers,
  relationship labels, and an SVG renderer whose every colour and timing lives in one stylesheet.

### Reading (A6, A7)

- The audience switch, select with the side panel, highlight and dim, open and close in place with
  a glide, the camera, keyboard use and screen reader text, and reduced motion.
- The navigation sidebar, and an address that always holds the exact picture: Back and Forward,
  Copy link, and a link that reopens what its sender saw.

### Scenarios (A8)

- Scenarios played on the architecture as a red trail, or shown as lanes, with a step list, Play,
  Next and Back.

### Presenter mode (A9)

- Walkthroughs presented full screen with narration, moving through views and scenarios, with the
  audience switch live while presenting.

### Live editor and watch mode (A10)

- A split editor beside the diagram that updates as you type, keeps the last good picture on an
  error and lists the errors in plain words, with Format, Download and Discard.
- `aerie watch <file>`: the diagram follows a file saved in any editor.

### The Aerie skill for Claude (A12)

- `skills/aerie/`: teaches Claude to read a project, write its model in Lines with wording for each
  audience, and run the checker until the file is clean.

### The Lotto sample and v1 acceptance (A11)

- `samples/lotto.aerie`, the flagship sample, refined with the Aerie skill against the real Lotto
  code, with a record of how it was drafted ([samples/lotto.md](samples/lotto.md)).
- The v1 browser journeys on the Lotto sample, one per acceptance journey.
- The readability baseline for the final sample.
- A coverage check: every requirement of the spec is cited by a test title, and every slice has
  its read log.
