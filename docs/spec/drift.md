# Drift detection: checking a model against the code

`aerie drift` reports where an Aerie model no longer matches the project it describes, with a
suggested Lines edit for each difference, on demand and in CI on every pull request. This document
records the whole feature as the captain settled it (decision
[0006](../decisions/0006-drift-detection.md), from the map's tickets #51 to #57), so that each slice
builds against it.

It is built after v1 in slices D1 to D8 (section 11). Slice D1 adds the lines a model needs
([language.md](language.md#11-checking-against-the-code)); the rest of this document is the contract
for D2 to D8. Requirement ids: the lines are `LANG-751` to `LANG-759`; each later slice gives the parts
it builds `DRIFT-nnn` ids, with their tests (ACC-101), and keeps this document's decisions. Where a
slice must choose something this document leaves open, it records the choice here.

## 1. What it is for

- A diagram drawn by hand drifts from the code: services are added and renamed, connections change.
  Drift detection reads the project statically (it never runs anything), compares what it finds with
  the model, and says in plain words where they disagree.
- **Phase 1** (this plan) checks that the diagram's elements and connections exist: missing or extra
  services, modules and connections. **Phase 2** (not yet specified) checks wrong details (ports,
  names, technologies) and scenarios against real call paths.
- **First stacks**: Docker Compose, Spring Boot with Maven, and Node with Angular. Kubernetes and
  Terraform are out of scope.
- **Triggers**: the command line (`aerie drift`) and CI on every pull request.
- **On drift**: a report with suggested Lines edits. Aerie never writes the model; the author (or
  Claude, through the skill) applies the edits.
- Drift reads only what the model and the code say. It never changes what a reader sees (MODEL-006):
  a model with or without the lines below draws the same.

## 2. Words

The vocabulary is binding, as everywhere ([GLOSSARY.md](../../GLOSSARY.md)).

- **Drift**: a difference between the model and the code.
- **Code unit**: one piece of code an element stands for: a Compose service, a Maven module, a Node
  or Angular app or package, or a class (or a package of classes). Written `kind:name`, such as
  `compose:bff` (LANG-756).
- **Code line**: the `code` line under an element that lists its code units (LANG-755).
- **System root**: the `system` block that names the repos and authoritative Compose files that form
  the system (LANG-752).
- **Ignore line**: `ignore drift <subject> - <reason>`, which marks a difference as meant (LANG-758).
- **Fact**: something the extractor found in the code, with its **evidence** (`repo/path:line`) and
  the **technique** that found it (for example "Compose environment URL").
- **Finding**: one difference drift reports, with its level, evidence and suggested edit.
- **Level**: how sure a finding is: drift, likely or not checked (section 6).

## 3. The lines in the model (slice D1)

Three kinds of line tie a model to its code. Their exact rules and errors are in
[language.md](language.md#11-checking-against-the-code); `aerie check` validates them.

```aerie
model lotto: Lotto suite

system
  repo ../lotto-options-core
  repo ../lotto-options-ui
  repo ../lottery-result-persistence-service
  compose ../lotto-options-core/compose.yaml

website: Website | Where players pick numbers [service]
  code compose:web-ui npm:lotto-options-ui
screen-api: Screen API | Shapes data for the screens [service]
  code compose:bff maven:lotto-options-core-bff
engine: Analysis engine | Generates and scores picks [service]
  code compose:core maven:lotto-options-core-server
  pick-generation: Pick generation
    code class:com.lotto.options.core.picks.*

website gets screen data from screen-api
screen-api requests analysis from pick-generation

ignore drift maven:lotto-options-core-legacy-desktop - retiring with the desktop app
```

The Compose services and Maven modules above are Lotto's own, as the research found them; the npm
package name and the `class:` package are only illustrations.

- **System root** (#52): declared once, by convention at the top. `repo` lines name the repos that
  form the system, as paths from the model file's folder; a multi-repo system such as Lotto lists
  each. Without `repo` lines the system is the repository that holds the model file. `compose`
  lines name the authoritative Compose files, which matters because a project may hold stale ones
  (Lotto has a second, stale Compose file). Without a `compose` line, drift reads the Compose file
  that `docker compose` would pick by default in each repo's root, if there is one (DRIFT-007
  lists the file names it tries).
- **Code lines** (#52): optional source hints. Each element may list the code units it stands for.
  An element drawn above the level of the code lists all its units (#53), and drift then compares at
  that level and never asks for finer detail. Parts (elements inside a module) are checked only when
  they carry `class:` hints (captain, #51).
- **Ignore lines** (#53): an intentional difference is acknowledged in the model file, with a required
  reason, so it is reviewed in pull requests like any other change. The subject is an element, a code
  unit, or a connection `a to b` between two of them.
- A model without any of these lines is still checked: drift matches by name (section 5).

## 4. Extraction (slices D2 to D4)

Decided by the research ticket (#51), measured on the captain's three Lotto repos against
`samples/lotto.aerie`.

- **Shape**: Aerie's own static extractor, a pure TypeScript layer like `src/lines/` and
  `src/model/`: text of the project's files in, **facts** out, each with its evidence
  (`repo/path:line`) and its technique. No existing extractor is reused as a library (the research
  found none maintained, permissively licensed and fit); their ideas are (per-technology evidence
  extractors, matching calls to endpoints, tracing the model to the code), and `docker compose config`
  serves as a test oracle.
- **Several techniques per stack**, counted for agreement. No single technique found every Lotto
  connection (each found 3 of 4), none found a false one, and together they found all 4. The number
  of techniques that agree decides a finding's level (section 6).
- **Parsers**: permissive npm packages that keep source positions: `yaml` (merge keys on for Compose,
  YAML 1.1 mode for Spring), `@xmldom/xmldom` for poms, `properties-file`, `jsonc-parser` for Angular
  proxy files, `dockerfile-ast`, the `typescript` 6.0.x API already pinned, and for Java
  `web-tree-sitter` with `tree-sitter-java-orchard` (WebAssembly). Aerie writes the small parts
  itself: nginx configuration, `.env` and Compose interpolation (`${VAR:-default}`; never a library
  that executes `$(...)`), Spring placeholders, relaxed binding and profiles. Avoid `java-parser` and
  native add-ons unless speed ever demands them. Each new dependency is pinned exactly and its licence
  recorded in `THIRD_PARTY_NOTICES.md`.

What each stack reveals:

| Stack                   | Facts                                                                                                                                                                                                                                                                                                                                    | Care needed                                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Docker Compose (D2)     | services, project, ports, build context (and through the Dockerfile's stages, the source each image is built from), environment values that name another service (URLs, JDBC URLs, bare host names), `depends_on`, volumes, profiles, healthchecks                                                                                       | interpolation and merge keys; the authoritative file; `depends_on` is start-up order, so it only corroborates; a healthcheck URL names the container itself                                            |
| Spring Boot, Maven (D3) | modules and their dependencies with scopes (from the raw poms), apps (`@SpringBootApplication`), `server.port`, URL-valued properties per profile, environment overrides, `@RestController` endpoints, outbound calls (WebClient, RestClient, RestTemplate, Feign) with literal or constant paths, messaging channels, in-process events | paths built in helper methods or from configuration properties need extra work (5 of 35 Lotto calls); a call's receiver needs its declared type checked (a name-only rule gave 2 false calls on Lotto) |
| Node, Angular (D4)      | apps and frameworks from `package.json`, `angular.json` (proxy configuration, file replacements), `proxy.conf.json`, environment files, `HttpClient` calls with literal, template or concatenated URLs                                                                                                                                   | relative URLs resolve through the dev proxy or the serving nginx; `proxy.conf.js`, interceptors and runtime configuration files are code, and need hints                                               |

How reliable it was on Lotto (n is small; the point is that no technique invented a connection):

| What                                  | In the diagram | Found | Precision            | Recall                                   |
| ------------------------------------- | -------------- | ----- | -------------------- | ---------------------------------------- |
| services (authoritative Compose file) | 4              | 4     | 100%                 | 100%                                     |
| service connections, all techniques   | 4              | 4     | 100%                 | 100%                                     |
| module `[code]` lines                 | 6              | 6     | 100%                 | 100%                                     |
| part lines, with class hints          | 13             | 10-12 | 86-95% after lifting | 77-92%                                   |
| code names quoted in the wording      | 165            | 158   | -                    | 96% confirmed, no real drift in the rest |

Matching HTTP calls to endpoints also found calls that no endpoint answers (14 on Lotto, which the
sample's author had noted by hand), and the class graph surfaced one real undrawn connection.

### The extractor core (slice D2)

The extractor is `src/extract/`, pure TypeScript like the language and the model; its entry point and
API notes are in `src/extract/index.ts`.

- **DRIFT-001** `extract` takes a model's system root, the folder that holds the model file, the
  repository that holds it, and read access to the project's files, and returns **facts**: what the
  code shows, each with its technique and its evidence. It reads files only through that access, never
  lists folders, runs a command, opens the network or writes, and reads only what the system root
  leads it to (the Compose files, the `.env` and env files, included and extended files, and the
  Dockerfiles they build with). A fact is one of: a Compose project, a code unit (a service), an
  image, a port, a build, a source an image is built from, a connection (one unit naming another, or
  a host outside the system), a volume, a profile or a healthcheck.
- **DRIFT-002** Evidence is a line of a file, printed `repo/path:line`, with lines counting from 1. A
  fact prints as one line, `repo/path:line  technique: detail`, with code units as `kind:name`; this
  is the evidence line of a report (section 7).
- **DRIFT-003** Every fact names its technique from one catalogue (`TECHNIQUES`), with the name a
  report prints and whether it only **corroborates**: `depends_on` and `links` are start-up order, so
  matching (D5) never counts them as evidence on their own.
- **DRIFT-004** Facts come once each, in a stable order: by repo, path and line, then by what they
  say. The same project always gives the same facts.
- **DRIFT-005** What stops or limits extraction is a **problem**, in plain English with the project's
  own names in backticks. An error means drift cannot run (exit code 2): a repo or Compose file the
  system root names does not exist, or a Compose file is not valid YAML or not a mapping. A warning
  names what is not checked: a variable with no value and no default, a missing env, included or
  extended file, an unknown `extends` service or a loop, a service an include declares twice, and a
  build whose source cannot be read (a remote context, an inline Dockerfile, a missing Dockerfile).
- **DRIFT-006** The repos are the system root's `repo` paths, read from the model file's folder; with
  no `repo` line the system is the repository that holds the model file (the command finds it as the
  nearest folder up with a `.git`). Evidence names a repo by its folder's name, or by its path as
  written when two repos share a folder name. A file outside every repo keeps its absolute path.
- **DRIFT-007** The Compose files read are the system root's `compose` lines, merged in order as one
  project whose folder is the first file's. Without a `compose` line, each repo's root gives one
  project of the file `docker compose` picks by default (the first of `compose.yaml`, `compose.yml`,
  `docker-compose.yml`, `docker-compose.yaml`) merged with the first override file
  (`compose.override.yml`, `compose.override.yaml`, `docker-compose.override.yml`,
  `docker-compose.override.yaml`), as the Compose tooling chooses them. Compose's search of parent
  folders does not apply. A repo with neither has no Compose facts and no problem.
- **DRIFT-008** YAML is read with the `yaml` package (YAML 1.2, merge keys on) into a tree that keeps
  the file and line of every key and value, with aliases resolved, so a value that comes through an
  anchor or a merge key is evidenced where it is written.
- **DRIFT-009** The parsers it uses, `yaml` and `dockerfile-ast` (with the two packages
  `dockerfile-ast` needs), are pinned to exact versions, unpatched, and recorded with their licences
  and sources in `THIRD_PARTY_NOTICES.md`; nothing else is added for D2.

### Docker Compose (slice D2)

The Compose extractor reads a project as `docker compose config` would show it, from the files alone;
`docker compose config` served as the oracle for the fixture projects.

- **DRIFT-101** Each service is a code unit `compose:<name>` (technique "Compose service"). The project
  is named by its last `name`, or else by its folder's name as Compose writes it (lower case letters,
  digits, `-` and `_`; technique "Compose project folder").
- **DRIFT-102** Values are interpolated as the Compose specification says, file by file before
  merging: `$VAR`, `${VAR}`, `${VAR:-default}`, `${VAR-default}`, `${VAR:?error}`, `${VAR?error}`,
  `${VAR:+replacement}`, `${VAR+replacement}`, defaults nested inside defaults, and `$$` for a `$`.
  Keys are never interpolated. A variable's value comes only from the project's `.env` file (an
  include's own `.env`, under the including project's), never from the environment drift runs in, so
  a run in CI reads what a reader of the repo reads. A variable with no value and no default reads as
  empty, as in Compose, with a warning.
- **DRIFT-103** `.env` and `env_file` files follow the Compose format: `VAR=VAL`, `export VAR=VAL`,
  `#` comments and comments after a space in an unquoted value, single quotes taken literally, double
  quotes with `\n`, `\r`, `\t`, `\\` and `\"`, quoted values over several lines, interpolation of
  unquoted and double-quoted values from the lines above, `VAR=` for empty and `VAR` alone for unset,
  and `format: raw`. Aerie reads them itself and never runs `$(...)`.
- **DRIFT-104** Merge keys (`<<: *anchor`, `<<: [*a, *b]`) apply with a key written in the map
  winning. Several files merge as the specification says: mappings key by key, scalars replaced (the
  healthcheck command too), ports kept unique by host address,
  target, published port and protocol, volumes by target, other lists appended; `!reset` removes an
  attribute (or one environment variable) and `!override` replaces it. Short and long syntaxes merge
  alike. Relative paths start from the project folder.
- **DRIFT-105** `extends` takes a service from the same file or another file (its relative paths start
  from that file's folder), recursively, before the file merges with the others. `include` (short and
  long syntax: `path` as one file or several, `project_directory`, `env_file`) loads each included
  project on its own and adds its services; a service declared again is a warning, and the first is
  kept.
- **DRIFT-106** A service's `build` gives a build fact: the context as a place in the system (or a
  remote context as written), the Dockerfile (`dockerfile` from the context, `Dockerfile` by default)
  and the target. Named contexts (`additional_contexts`, map or list) that are folders are resolved
  from the project folder.
- **DRIFT-107** The Dockerfile, read with `dockerfile-ast`, leads to the **source** the image is built
  from: the target stage (the last stage without a target), every stage it starts from, and every
  stage they copy from (by name, case-insensitively, or by index), recursively. Each `COPY` and `ADD`
  source path and each `RUN --mount=type=bind` source in those stages, from the build context or a
  named context that is a folder, is a source fact at the line that copies it, with its stage. Build
  arguments are filled in from `build.args`, then `ARG` defaults (a global `ARG` reaches a stage only
  where the stage declares it again). Copies from images, URLs and heredocs are not sources.
- **DRIFT-108** The image's own `EXPOSE` and `ENV` are those of the target stage and the stages it
  starts from (not of the stages it only copies from). `EXPOSE` gives ports ("Dockerfile EXPOSE");
  an `ENV` value counts as part of the service's environment, unless Compose gives the same variable a value (a variable Compose lists with no value leaves the image's).
- **DRIFT-109** A service's environment is its `env_file` files in order, then `environment` (map or
  list) over them; a variable `environment` names without a value is unset. Each value that names
  another service gives a connection at the line that sets it: a URL ("Compose environment URL",
  every host of a multi-host URL), a JDBC URL ("Compose environment JDBC URL", Oracle's
  `@host:port` form included) or a bare host name, alone or in a list ("Compose environment host
  name").
- **DRIFT-110** A host names a service by its name, its `container_name`, its `hostname` or a network
  alias, in any case, and through a `links` alias only from the service that declares the link.
  `localhost`, `127.0.0.1`, `0.0.0.0`, `::1` and `::` and the service's own names are the container
  itself and give nothing; a healthcheck is never a connection. A bare name counts only when a port
  follows it or the variable's name says it holds a host (`HOST`, `ADDR`, `SERVER`, `BROKER`,
  `ENDPOINT`, `URL`, `URI`, `BOOTSTRAP`, `NODE`, `PEER`, `UPSTREAM`, `BACKEND`, `TARGET`, `DSN`,
  `CONTACT` or `CLUSTER`), so `SPRING_PROFILES_ACTIVE: worker` never names the service `worker`. A
  URL whose host is no service names a host outside the system.
- **DRIFT-111** A connection keeps the variable and its value as evidence, with passwords hidden: the
  password of a URL's user, and `password`, `passwd`, `pwd`, `secret`, `token`, `apikey` and `api_key`
  parameters, print as `***`.
- **DRIFT-112** `depends_on` (list or map) and `links` give connections only to services of the
  project, with techniques that only corroborate (DRIFT-003).
- **DRIFT-113** Details for phase 2 and for matching: each `image`; each port (short syntax with host
  address, IPv6 in brackets, ranges and protocol, or long syntax; a port with no host port is
  published on a free port; `expose` ports are open only to the other services); each volume (a
  folder of the system for a bind mount, a named or anonymous volume, tmpfs and the rest by type);
  each profile; and the healthcheck command (`CMD`, `CMD-SHELL` or a string; none when `NONE` or
  `disable: true`).
- **DRIFT-114** On copies of the Lotto Compose files, with a system root that names Lotto's three
  repos and `lotto-options-core/compose.yaml`, the extractor finds the
  four services and the three service connections Compose shows (#51), through the shared
  `x-backend-build` anchor and the Dockerfile's stages to each repo's sources; without the `compose`
  line it also reads the stale `docker-compose.yml` of the Results store, which is why the system
  root names the authoritative file.

Choices D2 made, where this document left them open: the default Compose files are those of
DRIFT-007; variables come only from `.env` files (DRIFT-102); the top-level `jobs` element (new in the
specification) and `dockerfile_inline` are not read; a port range is one fact; the image's `ENV`
counts as environment (DRIFT-108); and nginx configuration, which the research read as glue between
Compose and the Web UI, belongs with the Node and Angular extractor (D4).

## 5. Matching and lifting (slice D5)

Decided in #52.

- **Order**: an exact hint first (a code line). Otherwise drift matches by normalised name: an
  element's id and name against Compose services, Maven modules and apps. Anything uncertain becomes
  a **suggestion** (such as "add: `code compose:bff`?"), never drift.
- **Lifting**: calls found in the code are lifted to the nearest hinted element that contains their
  code, as views lift relationships to what is visible. A library module belongs to every app that
  packages it (its compile and runtime dependency closure), as the research prototype counted it.
- **Connections**: a diagram relationship from A to B is confirmed when any lifted call runs from A to
  B. Relationship verbs are never checked. As in the research (#51), `[code]` relationships are
  compared with the build dependencies between modules, and other relationships with calls.
- **What code cannot show**, such as a person using a website, is "not checked", never drift.
- Parts are checked only where they carry `class:` hints; services and modules are checked
  everywhere.

## 6. Levels and suppression (slice D5)

Decided in #53, with the captain's decision on #54.

- **Drift**: the diagram and the code disagree and several techniques agree on it, or an exact single
  check fails: a `code` line names code that does not exist, or a drawn module depends on an undrawn
  one.
- **Likely**: one technique finds it.
- **Not checked**: the code cannot show it (people, parts without class hints, and in phase 1
  scenarios and wording).
- **Suggestion**: a name match to pin with a `code` line. Never fails anything.
- Only drift fails CI by default; `--fail-on likely` is stricter.
- An `ignore` line excuses the findings about its subject: an element or a code unit (its presence
  and its code line), or a connection `a to b` in that direction. The report lists each ignore line
  with its reason and how many differences it excused. An ignore line that matches nothing any more
  is itself a likely finding, with an edit that removes it. An ignore line without a reason is an
  `aerie check` error (E811), so it never reaches drift.

## 7. The report (slice D6)

Decided in #54 from a prototype on the Lotto repos: four planted drifts (a removed relationship, an
extra service, an undrawn module, a renamed service) came back as exactly four drift findings, plus two
real likely ones; the same model without the plants gave no drift; the suggested patch applied
cleanly and re-running gave no drift; three repos took 0.9 s.

- **One finding model**, printed in four forms by `aerie drift <model>`:
  - the plain-English **terminal report** (the default);
  - `--format diff`: a unified diff of every suggested edit, a patch the author applies (Aerie never
    writes the file);
  - `--format json`: one document with the format `aerie-drift/1`, for CI and the Claude skill;
  - `--format pr`: a pull request comment, with inline one-click suggestions where GitHub allows.
- **Each finding** is one sentence in the diagram's own names ("Website calls Screen API in the code,
  but no line in the diagram joins them."), why it has its level (which techniques found it), its
  evidence as `repo/path:line  technique: detail`, a `Suggested edit:` with `+` and `-` Lines at the
  model's line numbers, and `Or, if it is meant to differ:` with the `ignore` line to use instead.
- **Terminal order**: Drift (fails CI), Likely, Not checked (collapsed per element), Suggestions,
  Ignored (each with its reason and count). A header names the repos and what was found in them and
  the time taken; a footer gives the elements and lines confirmed, the counts and the exit code.
- **Exit codes**: 0 no drift, 1 drift (or likely, with `--fail-on likely`), 2 drift cannot run (a
  missing repo or Compose file, an unreadable model), with a plain message.
- **Suggested edits**: relationships at the finest grain the code shows, placed after the last
  relationship of the same kind; a new element as a placeholder name and its `code` line only (no
  invented wording); a removal takes the element's whole block and every line naming it; a rename
  replaces one word in the `code` line. Every edit also exists as a JSON hunk (`at`, `remove`, `add`)
  and in the patch.
- **JSON** `aerie-drift/1`: `summary` (counts, exit code), `findings[]` (`id`, `level`, `kind`,
  `title`, `detail`, `elements`, `diagram`, `evidence[]` with `technique` and `at`, `edits[]`,
  `instead[]`), `suggestions[]`, `notChecked[]`, `ignored[]`, `confirmed[]`. A stable key per
  finding is added before CI compares runs.
- **PR comment**: one sticky comment per model file (found again by a hidden marker), a status dot and
  one summary sentence, a table of findings, each finding folded with its evidence, a `diff` block and
  the `ignore` alternative; plus GitHub `suggestion` review comments on lines the pull request
  touches.
- Wording follows the error catalogue's rules (LANG-903): plain English, the author's own ids in
  backticks.

## 8. CI (slice D7)

Decided in #55.

- A published **GitHub Action** runs drift on every pull request, posts the sticky comment and the
  inline suggestions, and fails the check on drift.
- **Any other CI** runs `npx aerie drift --format json` and uses the exit code.
- **Multi-repo systems** (Lotto: three repos, one diagram): the check runs in the repo that holds the
  diagram, whose system root names the repos; CI checks the siblings out read-only. A pull request in
  a sibling repo may also run it, and comments when it changes the architecture. D7 decides how CI
  finds each sibling's remote and records it here.

## 9. The Claude skill (slice D8)

Decided in #56. The Aerie skill ([claude-skill.md](claude-skill.md)):

- runs `aerie drift` after writing a diagram and fixes findings until it is clean, as it already does
  with `aerie check`;
- adds `code` lines and the system root itself when it writes a diagram;
- when Claude changes code in a way that changes the architecture, runs drift and updates the diagram
  in the same change.

## 10. Definition of done

Decided in #57, on top of the repository's definition of done
([AGENTS.md](../../AGENTS.md#definition-of-done)).

- **Fixture projects per stack** (Compose, Spring with Maven, Angular) with planted drifts: every one
  is found, and nothing is invented.
- **The Lotto repos are the real-world benchmark**: precision and recall are tracked and may never get
  worse (like the readability scores, ACC-004).
- **Journeys**: the GitHub Action (a test pull request gets the right comment) and the skill loop (it
  ends clean).

## 11. Slices

In order; each is one task with its own read log, built under the clean-room rules.

| Slice | What                                                                                    | Decided in    |
| ----- | --------------------------------------------------------------------------------------- | ------------- |
| D1    | `code` lines, the system root and `ignore` lines in the Lines language and this spec    | #52, #53      |
| D2    | The extractor core (facts with evidence and technique) and Docker Compose               | #51           |
| D3    | Spring Boot and Maven extraction                                                        | #51           |
| D4    | Node and Angular extraction                                                             | #51           |
| D5    | Matching, lifting, and the drift, likely and not checked levels; ignore lines applied   | #52, #53, #54 |
| D6    | The report formats (terminal, diff, JSON `aerie-drift/1`, PR comment) and `aerie drift` | #54           |
| D7    | The GitHub Action                                                                       | #55           |
| D8    | Skill integration, the Lotto benchmark and the release                                  | #56, #57      |

## 12. Not yet specified, and out of scope

- **Not yet specified**: phase 2 (wrong details such as ports, names and technologies; scenarios
  against real call paths), and whether drift findings later show in the viewer (the captain did not
  choose live markers for now).
- **Out of scope**: Kubernetes and Terraform extraction, and editing diagrams automatically.
