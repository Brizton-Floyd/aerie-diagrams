# Changelog

All notable changes to Aerie. Versions follow [Semantic Versioning](https://semver.org/); the
functional spec for each version is [docs/spec/](docs/spec/overview.md).

## Unreleased

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
