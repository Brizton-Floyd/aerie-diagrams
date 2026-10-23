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
  runs a command, opens the network or writes, and reads only what the system root leads it to (the
  Compose files, the `.env` and env files, included and extended files, and the Dockerfiles they
  build with; from D4, each repo's package.json and what section "Node and Angular" follows from
  it; from D3, the poms, Spring configuration and Java of the Maven modules). It lists a folder only
  where a file it reads names a pattern of folders (npm workspaces) or copies a whole folder into an
  image (nginx configuration), and the source and classpath folders of the Maven modules
  (DRIFT-201). A fact is one of: a Compose project, a code unit (a service, a package or a module),
  an image, a port, a build, a source an image is built from, a connection (one unit naming another,
  or a host outside the system), a volume, a profile, a healthcheck, a framework, an Angular project
  or an HTTP call; from D3, a module's packaging, a dependency, a Spring Boot application, a
  property, an endpoint, a call, a message channel, an event or a schedule; and from D5, a Java type
  or a type reference (DRIFT-401, DRIFT-402).
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
  and sources in `THIRD_PARTY_NOTICES.md`; nothing else is added for D2 (D4 adds two, DRIFT-311).

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

### Node and Angular (slice D4)

The Node extractor reads a system's Node packages and Angular applications, and the nginx that
serves them, from the files alone: it never installs, builds or runs anything. It follows the code
from what the system root leads it to, so code that nothing imports is never read.

- **DRIFT-301** package.json, angular.json, tsconfig files and `.json` dev-server proxy files are
  read as JSON with comments and trailing commas (the Angular CLI's own reading), with
  `jsonc-parser`, keeping the line of every value. A file that is not valid is a warning, and what
  it holds is not checked.
- **DRIFT-302** The **packages** are each repo's own package.json, the packages its npm workspaces
  name (`workspaces` as a list or as `{ packages }`; a plain path as it is, `*` and `**` parts by
  listing folders, never `node_modules`, and `!` patterns skipped), the roots of an Angular
  workspace's projects, and every folder a Compose service's image is built from (DRIFT-107). A
  package with a `name` is the code unit `npm:<name>` ("package.json name"). Its frameworks
  (Angular, NestJS, SvelteKit, Express, Fastify, Hono, Koa, Next.js, Nuxt, React, Svelte, Vue) come
  from `dependencies`, then `devDependencies`, then `peerDependencies`, each once, with the version
  range asked for ("package.json dependency"). A package without a name is no code unit; it is a
  warning when it has a framework or code drift reads, since no code line can name it.
- **DRIFT-303** An `angular.json` beside a package.json is an Angular workspace. Each project is an
  "Angular project" fact, an application or a library, belonging to the package whose folder holds
  the project's `root`; paths in angular.json start from the workspace folder. For an application,
  the build target (`architect` or `targets`) gives its entry point (`browser`, or `main` for older
  builders), `tsConfig` and `baseHref` from its options, and `fileReplacements` (`replace` and
  `with`, or the older `src` and `replaceWith`) from its options and every configuration; the serve
  target gives `proxyConfig` from its options and every configuration. A missing entry point,
  environment file or proxy file is a warning.
- **DRIFT-304** A **dev-server proxy** file is read in either form the Angular CLI accepts: an object
  of contexts, or an array of entries with a `context` (one path or a list). A target is a URL or an
  object with `host`, `port` and `protocol`. Each route is a connection from the application's
  package ("Angular dev-server proxy", with the context and the target as evidence). A context
  matches a request path as the dev server matches it: from `^` a regular expression, a glob
  pattern (`*`, `**`, `?`, `{a,b}`) as a glob over the whole path, anything else as a prefix; the
  first route that matches takes the call. A proxy file that is not `.json` (`proxy.conf.js`,
  `.mjs`, `.ts`) is code the CLI runs, so drift never reads it: a warning says where it sends calls
  is not checked.
- **DRIFT-305** An application's **code** is its entry point and every file it imports, statically or
  with `import('...')` (lazy routes), and every file those import: relative paths, and names the
  tsconfig's `paths` map (from `baseUrl`, or the folder of the tsconfig that sets `paths`; its
  relative `extends` are followed). A `.js` name reads the `.ts` file, a folder its `index.ts`;
  `import type` is not followed, nor a package from `node_modules`, nor anything outside the
  system's repos; an import of a file that does not exist is left to the compiler. Every file
  `fileReplacements` may swap in is read wherever the file it replaces is imported. Files are parsed
  with the `typescript` compiler API (`createSourceFile` only; nothing is compiled or type-checked).
  The **environment files** (the files `fileReplacements` names) give one connection for each
  string setting of an exported object constant that is an absolute URL ("Angular environment
  file", with the setting as `environment.apiUrl` and its value).
- **DRIFT-306** An **HTTP call** is an `HttpClient` method (`get`, `post`, `put`, `delete`, `patch`,
  `head`, `options`, `jsonp`, or `request` with its method first) called on a value the file
  declares as an `HttpClient` imported from `@angular/common/http` (a property or variable typed so
  or set to `inject(HttpClient)`, a parameter typed so; an alias counts), or `httpResource` (with
  `.text` and the other forms) given a URL or a function returning a URL or a request object.
  A receiver's name alone never makes a call, so `map.get('/x')` is none. The URL is read as far as
  the code shows it: string literals, templates, `+`, both branches of `? :`, `const` values in
  scope or imported (through `export { a as b }` and `export *`), class properties
  (`this.base`, static ones), and properties of object constants (`environment.apiUrl`, in every
  environment file the build may swap in). Anything else is a hole, printed `{}`. Each URL is an
  "Angular HttpClient" fact (`calls GET /api/orders/{}`), owned by the package whose folder holds
  the file. A call whose URL does not start with text drift can read is a warning, and so is every
  interceptor the application installs (`withInterceptors`, `HTTP_INTERCEPTORS`): it may change
  where calls go, so drift checks their URLs as written.
- **DRIFT-307** **Where a call goes**: a URL with a host goes there ("Angular HttpClient"). Code on
  the developer's machine or in a browser (the dev server, the application) reaches a Compose
  service through the port the host publishes: a loopback address (`localhost`, `127.0.0.1`, `::1`)
  goes to the one service that publishes its port (80 and 443 by default), or else stays a host
  with its port (`localhost:8080`), since only the port tells which program on the machine it
  means; another name goes to the service it names, or is a host outside the system. A relative URL
  is a path from the application's base href; it goes through the first dev proxy route that matches
  ("Angular HttpClient through the dev proxy") and through the nginx of every Compose service whose
  image is built from the package's folder or a folder inside it ("Angular HttpClient through
  nginx", DRIFT-309). A relative `.json` that neither forwards is configuration the application
  reads from its own server at run time, which drift does not read: a warning.
- **DRIFT-308** **nginx** is read from the files a Compose service's final image holds under
  `/etc/nginx` (its target stage and the stages it starts from; a folder copied in is listed). As the
  nginx image does when it starts, each file under the template folder that ends with the template
  suffix (`/etc/nginx/templates`, `.template`, into `/etc/nginx/conf.d`, or the image's
  `NGINX_ENVSUBST_TEMPLATE_DIR`, `_SUFFIX` and `_OUTPUT_DIR`) is filled in with the container's
  environment (DRIFT-109): `${NAME}` and `$NAME` for every variable it defines, the rest left alone.
  The configuration is the image's own `/etc/nginx/nginx.conf` if it holds one, or else, as the
  image's default does, every `/etc/nginx/conf.d/*.conf`; `include` is followed through the files
  the image holds (relative to `/etc/nginx`). Aerie reads nginx itself: directives with their file
  and line, comments, quotes and `${}` words.
- **DRIFT-309** Each `location` with a `proxy_pass` (also inside its `if` and `limit_except`) gives a
  connection from the service ("nginx proxy_pass", with the location and the address as evidence).
  The address takes `set` variables from the location, then the server, and an `upstream` name
  gives each of its servers; a variable nothing sets in the address is a warning. Inside the
  container, a loopback address is the container itself, a name is a service of its Compose
  project, and any other host is outside the system. For a call (DRIFT-307), the location is
  chosen as nginx chooses it: an exact match (`=`), else the longest prefix if it is `^~`, else
  the first regular expression that matches (`~`, `~*`), else the longest prefix, looking first
  into its nested locations.
- **DRIFT-310** On copies of the Lotto UI (its package.json, angular.json, proxy and tsconfig files,
  and the TypeScript files from `src/main.ts` to the four that call the BFF) and of the nginx
  template of the Web UI image, with the system root of DRIFT-114, the extractor finds the package
  `npm:lotto-options-ui` on Angular, its nine calls, and the website's connection to the Screen API
  (`compose:bff`) by four techniques: the dev proxy, the calls through it, the calls through
  nginx, and nginx's own `proxy_pass` from `compose:web-ui`. Nothing else is found, and run on the
  Lotto repos themselves it finds the same.
- **DRIFT-311** The two parsers D4 adds, `jsonc-parser` and `typescript` (until now only a
  development tool, pinned at 6.0.x as the last version with a compiler API), are runtime
  dependencies pinned to exact versions, unpatched, and recorded with their licences and sources in
  `THIRD_PARTY_NOTICES.md`.

Choices D4 made, where this document left them open: the code read is what the entry point imports
(so code nothing imports is not checked); dev-server proxy files that are code, interceptors and
configuration fetched at run time are warnings, never guesses; `fetch`, `axios` and other HTTP
clients, server-side rendering entry points, URLs in package.json scripts (build-time, as the
research found), Nx `project.json` and `pnpm-workspace.yaml` are not read; nginx is read only in
the images Compose builds; a proxy's `pathRewrite` and nginx's rewriting of the path change where on
the target a call lands, not which target, so they are left to endpoint matching (D5).

### Spring Boot and Maven (slice D3)

The Maven extractor is `src/extract/maven/` and the Spring one `src/extract/spring/`, with the Java
parser in `src/extract/java/`; they return facts like the Compose extractor, and only from what the
files say: nothing is built, run or fetched.

- **DRIFT-201** The Maven modules are each repo's root `pom.xml` and the modules it lists,
  recursively: `<modules>`, Maven 4's `<subprojects>` and the modules of every `<profile>` (a module is
  code whichever profile builds it). A module is a folder holding a `pom.xml`, or the pom file named.
  Each module is a code unit `maven:<artifactId>` ("Maven module") at its `<artifactId>`, with a module
  fact giving its packaging (`jar` by default), its folder and its parent when that is in the system.
  A repo without a root pom has no Maven facts; a listed module without a pom is a warning. To read a
  module's code, the extractor lists its source and classpath folders (and nothing else), through
  `ProjectFiles.list`.
- **DRIFT-202** Poms are read raw with `@xmldom/xmldom`, which keeps every element's line. A module
  inherits group, version, properties and dependencies from its parent when the parent is in the
  system, found by `relativePath` (the folder above by default) or else by group and artifact; a parent
  read that way is a module too. `${...}` is filled in from the properties and `project.*`. A parent or
  BOM from outside the system adds nothing, since it is never fetched. A pom that is not well-formed XML
  or not a `project` is a warning, and two poms declaring one module keep the first, with a warning.
- **DRIFT-203** Each `<dependency>` of a module, its own or inherited, is a dependency fact ("Maven
  dependency") with its scope (`compile` by default) and whether it is optional: to the module of the
  system with that group and artifact, or else to the artifact outside the system (`group:artifact`).
  Test dependencies are kept, with their scope; `dependencyManagement` and profile dependencies add
  none.
- **DRIFT-204** A Spring Boot application is a class annotated `@SpringBootApplication`, by its
  resolved name, never its simple name alone ("Spring Boot application").
- **DRIFT-205** A module's configuration is the `application.properties`, `application.yml` and
  `application.yaml` files, and their `application-<profile>` variants, in each classpath folder
  (`src/main/resources` unless the pom names others) and its `config/` folder. YAML is read as Spring
  reads it, YAML 1.1 with merge keys, every document; `.properties` with `properties-file`, split into
  documents at Spring's `#---` and `!---` lines. Each document applies in the profile of its file or of
  its `spring.config.activate.on-profile` (or `spring.profiles`), kept as written and never merged into
  one value. Where the code needs one value, Spring's order picks it: a profile `spring.profiles.active`
  names over the default, `config/` over the folder, `.properties` over YAML, a later document over an
  earlier one. A YAML file that is not valid is a warning.
- **DRIFT-206** Placeholders are filled in as Spring fills them: `${key}`, `${key:default}`, nested,
  from the same configuration; one with no value and no default stays as written. Relaxed binding
  makes `core-api.baseUrl`, `core-api.base-url` and `core_api.base_url` one property, and names the
  environment variable that overrides it: dots to `_`, no `-`, upper case (`COREAPI_BASEURL`), which is
  how a Compose `environment` value reaches a Spring property.
- **DRIFT-207** A property fact ("Spring property", with its profile and environment variable) is kept
  for the server's `server.port`, `server.address`, `server.servlet.context-path`,
  `spring.webflux.base-path`, `spring.mvc.servlet.path`, `management.server.port` and
  `spring.application.name`, and for every property that holds an address: a URL or JDBC URL in its
  value, or a host name (with or without a port) under an address's name (`host`, `url`, `uri`,
  `address`, `bootstrap-servers`, `brokers`, `servers`, `nodes`, `endpoint` and their plurals, or a
  name ending in `url` or `uri`). Each host such a value names is a connection ("Spring configuration
  URL", "... JDBC URL" or "... host name"), with secrets hidden as in DRIFT-111. A loopback host with a
  port names the one module whose own `server.port` is that port; another host names the one module of
  that `spring.application.name`; anything else is a host outside the system. A module never connects
  to itself, and CORS origins (`cors`, `allowed-origins`) are addresses that call the module, so they
  give no connection. An address property whose placeholder has no value or default is a warning.
- **DRIFT-208** Java is read with `web-tree-sitter` and the `tree-sitter-java-orchard` grammar, both
  WebAssembly; a caller loads the parser once with `loadJava()` and passes it as `java`, and without it
  the Java is not read, with a warning. The `.java` files of each module's source folder
  (`src/main/java` unless the pom names another; never tests, `package-info` or `module-info`) are read
  into Aerie's own model of types, annotations, fields, methods and expressions. A syntax error is
  recovered from, with a warning at its line. Type names resolve as the compiler resolves them: nested
  types, single imports, the package, then wildcard imports; a type from outside the system is known by
  its full name, through its import or a wildcard import of its package.
- **DRIFT-209** Each method of a `@RestController` or `@Controller` with a mapping (`@GetMapping`,
  `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`, `@RequestMapping`) is an endpoint
  fact ("Spring request mapping") per verb and path: the type's `@RequestMapping` prefix joined to the
  method's path, `ANY` for a `@RequestMapping` without a method, paths and verbs from arrays, constants
  and placeholders. A mapping the class inherits from an interface or superclass it implements counts,
  evidenced where it is written. The context path is a property fact of its own and is not joined in.
- **DRIFT-210** Outbound HTTP calls are call facts with their verb, address and, when the address names
  one, the module or host it reaches (as DRIFT-207 resolves hosts): `client.get().uri(...)` and
  `client.method(HttpMethod.X).uri(...)` on a receiver declared as a `WebClient` ("WebClient call") or
  `RestClient` ("RestClient call"); the `RestTemplate` and `RestOperations` methods ("RestTemplate
  call", the verb of `exchange` from its `HttpMethod`); each mapped method of a `@FeignClient`
  interface ("Feign client", from its `url`, or else `http://<name>`, and its `path`); and each method of
  an HTTP interface (`@GetExchange` and the rest; "HTTP interface"). A receiver counts only by its
  declared type (a variable, field, method or static factory), never by its name. A client's base URL
  comes from the `baseUrl` (or `rootUri`) of the builder that made it, wherever the code shows it: the
  field's value, what a constructor sets it to, what a method returns, or the one `@Bean` of its type
  in the modules it runs with. A path that is absolute replaces the base; `uri(builder -> ...)` gives
  the path the builder builds.
- **DRIFT-211** The text of an address, a channel or a schedule is read from the code: literals,
  constants of any class of the system (through imports, static imports and nested types), `+`, a
  local with one value, a helper method's return with its parameters bound to the arguments (a few
  calls deep), `String.format` with `%s` and `%d`, `URI.create`, `UriComponentsBuilder` chains, the
  start two choices of `?:` share, `@Value` fields and parameters, and `@ConfigurationProperties`
  records and classes, nested properties and getters, read from the module's configuration (or the
  configuration of the modules that run it, when they agree). A part known only at run time prints as
  `{?}`.
- **DRIFT-212** Message channels are channel facts with the module, the broker and the direction:
  `@KafkaListener` topics and topic patterns, and `KafkaTemplate.send` (a `ProducerRecord`'s topic
  too; `sendDefault` is `{?}`); `@RabbitListener` queues, declared queues and bindings (exchange and
  routing key), and `RabbitTemplate` sends (exchange and routing key, or a queue through the default
  exchange); `@JmsListener` and `JmsTemplate` destinations; `StreamBridge.send` to its binding's
  destination, and the `spring.cloud.stream.bindings.<name>.destination` of a function binding
  (`-in-0` receives, `-out-0` sends). A template counts only on a receiver declared with its type.
- **DRIFT-213** In-process events are event facts by type: a `publishEvent` on an
  `ApplicationEventPublisher` or `ApplicationContext` with the type of its argument, and each
  `@EventListener` or `@TransactionalEventListener` method (its `classes`, or its parameter's type) and
  `ApplicationListener<X>`. Each `@Scheduled` method is a schedule fact: `on cron ...`, `every N ms`
  or `N ms after each run`, with its time unit and placeholders.
- **DRIFT-214** On copies of the Lotto Spring repos (poms, Java and configuration of
  `lotto-options-core` and `lottery-result-persistence-service`), the extractor finds the three apps
  and their ports, the module graph (the engine's runtime-only dependency on the legacy module
  included), 35 endpoints, the BFF's calls to the engine and the engine's calls to the store (the
  draw-history call through `PersistenceServiceProperties.drawHistoryUrl()`), the store's poll event and
  its listener, and the connection Compose cannot show: the store's downloads from the Texas lottery.
  Those calls that take their base from a constructor parameter (the legacy client) print it as `{?}`.
- **DRIFT-215** The parsers D3 adds, `@xmldom/xmldom`, `properties-file` and `web-tree-sitter`, are
  pinned to exact versions, unpatched and recorded with their licences and sources in
  `THIRD_PARTY_NOTICES.md`, none with dependencies of its own. The grammar's compiled
  `tree-sitter-java_orchard.wasm` (release 0.5.22) is kept unchanged in `src/extract/java/`, with its
  hash checked by a unit test, because installing its package compiles a native add-on, which needs a
  compiler that CI's screenshot container and a user's machine may not have.

Choices D3 made, where this document left them open: `ProjectFiles` gains `list` for the source and
classpath folders (DRIFT-201); the modules of every Maven profile are read; Spring Boot's default port
8080 is never assumed, so only an explicit `server.port` names a module; the context path is not
joined into endpoint paths; external dependencies are kept as facts (for phase 2 technologies);
the grammar's WebAssembly file is kept in the repo rather than installed (DRIFT-215); and
`java.net.URL` connections, `RouterFunction` routes, Kotlin, Gradle and the effective POM are not read.

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

The comparison is `src/drift/`, pure TypeScript like the extractor, built only on the entry points
of the language, the model and the extractor; its entry point and API notes are in
`src/drift/index.ts`. It takes the model file's text, its canonical model and source map, and the
extraction, and returns the finding model of section 6; it reads nothing itself.

### The class graph (slice D5)

Part-level lines need to know which class uses which (#51), so D5 adds two facts to the Java the
Spring extractor reads (DRIFT-208).

- **DRIFT-401** Each class, interface, record, enum and annotation type the Maven modules declare,
  nested ones too, is a fact ("Java type") at its declaration, by its full name, with the superclass
  and interfaces it names that are types of the system.
- **DRIFT-402** Each type of the system that a type's own code names is a fact ("Java type
  reference", `A uses B`), once per pair at the first line that names it: in fields, record
  components, method signatures, local variables, `new`, class literals, annotations and type
  arguments, and a bare name that is no variable where it runs (the type of a static call or a
  constant). A type's own supertypes are in its type fact instead, and types declared in the same
  outermost type are its own code.

### Matching (slice D5)

- **DRIFT-403** A code line's `compose`, `maven` and `npm` units are the element's when the code has
  them. A unit the code does not have is **missing** (DRIFT-418).
- **DRIFT-404** A missing unit was most likely **renamed** to a unit of the same kind that no element
  names and that shares a word with it (words split at `-`, `_` and `.`, common words such as `api`,
  `web` and `service` not counting) or is within two edits of it, when one such unit is closest. A
  qualified `class:` hint was most likely moved to the one type of the system with its simple name.
  Drift compares the element as standing for the new unit.
- **DRIFT-405** A `class:` hint names a type as closely as it is written: the type itself, a type
  nested in it, a simple name (the type, or a type nested in it), or a package written with `.*`
  (its types and their nested types, not its subpackages). A simple name or a package names only
  types of the modules that the nearest element around the part (or the part itself) stands for,
  with what they package, when there is one, since a package may be split across modules. A hint
  that names no type is missing. The hints of an element inside one that stands for an npm package
  are TypeScript, and when the Java was not read (DRIFT-208) none can be read: both are not checked.
- **DRIFT-406** An element without a code line is matched by name: its id and its name for every
  audience, normalised to lower case letters and digits, against each unit's name and the names of
  the apps it holds (a Spring Boot application's class without `Application`, an Angular project).
  A unit that matches exactly one element is a certain match: drift compares the element as
  standing for it, and suggests the code line that pins it (DRIFT-427). A parent or aggregator pom
  (packaging `pom`) holds no code, so nothing stands for it.
- **DRIFT-407** Anything less certain is only a suggestion: a unit whose name matches two elements,
  an element whose name matches part of a unit's (a run of words, not only common ones, at its start
  or end), a unit an element's tagline names, the Spring Boot app a Compose service runs (its image
  is built from the module's folder and listens on the `server.port` the module sets) and the npm
  package a service's image copies. A unit with such a suggestion is neither drawn nor undrawn: it is
  not checked until a code line says what it is.
- **DRIFT-408** Code lines cannot name hosts outside the system, so an element that stands for no
  code, and holds nothing that does, matches an outside host when one of its names is one of the
  host's labels (not `www`, the last label or a common word), or its wording (names, taglines and
  descriptions, every audience) names the host; only a host one element matches is used. A host no
  element stands for is not checked.

### Links and lifting (slice D5)

- **DRIFT-409** An element is **checked** when it stands for code: units, `class:` hints that name
  types, or a host. Each end of a diagram line is compared at its **anchor**: the element itself when
  it, or something inside it, is checked; else its nearest checked ancestor, so a part without
  `class:` hints is checked as its module; else nothing, and the line is not checked. Code between
  two elements one of which holds the other is internal to the outer one.
- **DRIFT-410** Code is lifted to the element that stands for it: a Java type to the element whose
  `class:` hint names it most closely (the deepest on a tie), or else to the element of its module;
  a unit to its element; and the code of a Maven library no element names to the elements of the
  apps that package it. A link that stays in its program (a type reference, an in-process event) is
  lifted once in each app that runs its source, with both ends in that app, since a library two apps
  package is copied into each.
- **DRIFT-411** The facts give **links** between two ends (a unit, a type of a unit, or a host), each
  with its technique: every connection fact (a `depends_on` or `links` one only corroborates), every
  call whose target the extractor knows, every type reference and through it each type of the system
  that extends or implements the type named (the code that names an interface calls what implements
  it), and every Maven dependency other than `test`, as a build link.
- **DRIFT-412** A call is matched to the endpoints that answer it ("HTTP call matched to an
  endpoint", a technique drift adds): a Spring call to a module, by the endpoints of the module and
  the modules it packages; one whose base is not known (`{?}`), by those of any module, when one
  module answers; and a browser call that reaches a Compose service, by those of the modules its
  element stands for. The verb must agree (`ANY` agrees with every verb) and the path template must
  fit, part by part (`{...}`, `{}` and `{?}` stand for one part), with each endpoint also under its
  module's (or its app's) `server.servlet.context-path` or `spring.webflux.base-path`; the most
  literal templates win. A call with a readable path that reaches a module that has endpoints, or
  whose base is not known, and that no endpoint answers is **unanswered** (DRIFT-420).
- **DRIFT-413** An in-process event is matched to the listeners of its type in an app that runs both
  ("Spring event matched to its listener"), and a message to the receivers of its channel on the same
  broker ("Message matched to its receiver"): the channel as written, `{?}` standing for any text,
  and a RabbitMQ routing key against the binding's pattern (`*` one word, `#` any number).

### The comparison (slice D5)

- **DRIFT-414** A runtime line (any kind but `code`) is **confirmed** by any lifted link between two
  elements each the same as, inside or around its anchors; a `[code]` line by a build link. Verbs are
  never checked. A line whose end is not checked, whose anchors are one inside the other, or (a
  `[code]` line) whose ends stand for no Maven module, is not checked; so is a runtime line that only
  a corroborating technique shows.
- **DRIFT-415** A runtime line that nothing confirms is a **missing connection**: likely, since
  reading the code cannot rule out a call. A `[code]` line that no Maven dependency confirms is a
  **missing dependency**: drift, an exact check, since the poms list every dependency.
- **DRIFT-416** A pair of elements the code joins that no runtime line explains is an **undrawn
  connection**, at the level its techniques give. A `[code]` line explains type references too, and a
  type reference between two Maven modules is a build dependency, left to the `[code]` comparison.
  Each is reported once, at the finest grain the code shows: the links of a coarser pair that no line
  explains count for the finer pairs inside it.
- **DRIFT-417** A build link between two elements that no `[code]` line explains is an **undrawn
  dependency**: drift, an exact check. Build dependencies are compared only in a model with `[code]`
  lines; in one without, they are not checked.
- **DRIFT-418** A missing unit (DRIFT-403, DRIFT-405) is drift, an exact check: the code line names
  code that does not exist, or that was renamed (DRIFT-404).
- **DRIFT-419** For each kind of unit (`compose`, `maven`, `npm`) the diagram names at all, every
  unit of that kind that no element stands for is **undrawn**: drift when a drawn module depends on
  it, directly or through modules no element names (an exact check); otherwise at the level of its
  techniques (the one that shows it exists, its applications, and its links). A parent pom, a module
  only test dependencies reach (not checked) and a unit with a suggestion (DRIFT-407) are not
  reported. The units of a kind the diagram names nowhere are not checked: it is drawn above them.
- **DRIFT-420** The unanswered calls of an element are one finding, likely.

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

### Levels and ignore lines (slice D5)

- **DRIFT-421** An exact check that fails is drift (DRIFT-415, DRIFT-417 to DRIFT-419). Any other
  finding is drift when two or more techniques found it, and likely when one did; one that only
  corroborating techniques found is not reported. A missing connection, unanswered calls and an
  unused ignore line are likely. Each finding says why it has its level: the exact check, or the
  techniques that found it and those that only corroborate.
- **DRIFT-422** An ignore line whose subject is an element or a unit excuses the findings about its
  presence and its code line: a missing or renamed unit of that element or that unit, the unit
  undrawn, and the element's unanswered calls. One whose subject is `a to b` excuses the findings
  about a connection or a dependency from `a` to `b`: an end matches the element it names or an
  element inside it, or the element that stands for the unit it names. The first ignore line that
  matches a finding excuses it, and each lists its reason and the findings it excused.
- **DRIFT-423** An ignore line that excuses nothing is an **unused ignore**, likely, whose edit
  removes it.

### The finding model (slice D5)

The reports of D6 print the finding model; D5 builds it (`compare` in `src/drift/`).

- **DRIFT-424** What is **not checked** is listed with why, the elements it concerns and the line of
  the model: a person; an element with no code line whose name matches nothing; a part without
  `class:` hints (its lines are checked as its anchor's); an element or unit with a suggestion only;
  a line with an end that is not checked, with anchors one inside the other, or (`[code]`) between
  elements that stand for no Maven module, or shown only by a corroborating technique; each scenario
  and the wording (phase 2); a host outside the system no element stands for; the units of a kind
  the diagram names nowhere; a module only tests use; build dependencies in a model with no `[code]`
  lines; and `class:` hints that name TypeScript or that Java not read could resolve.
- **DRIFT-425** What is **confirmed** is listed with its techniques and evidence: each checked
  element (the units, hints or host it stands for), and each confirmed line, with the anchors it was
  checked as when they are not its own ends.
- **DRIFT-426** A **finding** has an `id` in report order (`D01` on for drift, `L01` on for likely),
  a `key` that stays the same for the same difference from run to run, its `level`, its `kind` (the
  nine of DRIFT-415 to DRIFT-423), a `title` (one sentence in the diagram's own names, code units in
  backticks), a `detail` (why it has its level, DRIFT-421), the `elements` it concerns, the line of
  the model it concerns (`diagram`, or none), its `techniques` (those that only corroborate last),
  its `evidence` (each line `repo/path:line  technique: detail`, DRIFT-002; a technique drift adds
  prints the matched fact's place in its detail), its `edits` and the ignore line to add `instead`.
  Findings come drift first, then likely, each by its line of the model and then by key.
- **DRIFT-427** A **suggestion** (`S01` on) names the element, the unit, why (a certain name match,
  which drift already compares, or an uncertain one, DRIFT-407), the evidence that the unit exists,
  and the edit that adds the code line.

### Suggested edits (slice D5)

- **DRIFT-428** Every edit is a list of **hunks** against the model file: `at` a line (counting from
  1), the lines `remove`d as written, and the lines to `add` in their place. Aerie never writes the
  file.
- **DRIFT-429** The edits: a missing relationship is added as `a calls b` (or `a depends on b [code]`)
  after the last relationship of its kind, at the finest grain the code shows; a new element is a
  placeholder (its id and name from the unit's, tagged `[service]` or `[module]`) with its code line
  only, at the end of the parent block of the drawn module that depends on it or of the elements of
  its kind, with the lines to the elements its links reach (new ones too); a removed element takes
  its whole block, the comments written right above it, and every line that names it or an element
  inside it (relationships, scenario steps, view `show` items, walkthrough focus, `open` and `close`
  items, ignore lines); a rename replaces one word of the code line; a missing unit leaves the code
  line (the element goes with it when it was its only code and nothing inside it is checked; a part
  keeps its place); a removed relationship takes its object from the line, or the whole statement.
- **DRIFT-430** The edit `instead` adds `ignore drift <subject> - why this difference is meant`
  after the last ignore line (or at the end, as a group of its own): the unit, or `a to b`, or the
  element.
- **DRIFT-431** `patch()` combines the edits of any findings and suggestions into one set of hunks:
  removals join, a code line's units change together, a list loses every item any edit drops, and an
  insertion two findings make is made once. `applyHunks` applies hunks to the text. On every fixture
  and on the Lotto benchmark, the patched model parses, and comparing it again finds no drift.

### Fixtures and the Lotto benchmark (slice D5)

- **DRIFT-432** Fixture projects per stack, in `tests/unit/drift/fixtures/` (Docker Compose, Spring
  Boot with Maven, Node and Angular with nginx), each with a model that matches its code and a model
  with planted differences (each listed in the model's opening comment): the first gives no finding,
  the second exactly the planted ones, at the planted levels, and its patched model none.
- **DRIFT-433** The Lotto benchmark: `tests/unit/drift/lotto/lotto.aerie` is `samples/lotto.aerie`
  with a system root naming the copies of the Lotto repos and code lines pinning each element to
  today's code. Every finding and every known miss is labelled by hand in `truth.txt` (real, false,
  missed); precision (real findings over findings), recall (real findings over real ones and misses),
  the precision of drift-level findings, the lines confirmed and four planted drifts (a removed
  relationship, an undrawn service, an undrawn module and a renamed service, found one at a time and
  all together, with nothing else changing) are kept in `benchmark.json`, and may never get worse
  (like ACC-004).

Choices D5 made, where this document left them open: parts are checked through a class graph drift
reads from the Java (DRIFT-401, DRIFT-402), and through calls, events and messages matched by class;
completeness is checked only for the kinds of unit a diagram names (DRIFT-419), so a diagram drawn
above modules is never asked for them; a line with an unchecked part is checked as the part's anchor
(DRIFT-409); a missing runtime line is likely, while a missing or undrawn `[code]` dependency is an
exact check like an undrawn module (DRIFT-415, DRIFT-417); a type reference across modules is left to
the `[code]` comparison (DRIFT-416); outside hosts are matched by name or wording, since code lines
cannot name them, and an unmatched one is not checked (DRIFT-408); calls no endpoint answers are
reported, likely, as the #54 prototype did (DRIFT-420); and the verbs drift suggests are `calls` and
`depends on`.

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

### `aerie drift` and the four forms (slice D6)

The reports are `src/drift/` too (`report.ts`, `text.ts`, `patch.ts`, `json.ts`, `comment.ts`), pure
like the comparison: each prints one run (the model file as the author named it, its text and model,
the extraction, the finding model of D5 and `--fail-on`) and reads nothing. The command is in
`src/cli/aerie.ts`.

- **DRIFT-501** `aerie drift <file> [--format text|diff|json|pr] [--fail-on drift|likely]` checks one
  model file against its code: it reads the file, stops if `aerie check` finds an error in it (each
  printed as LANG-962 prints it), extracts the system its system root names with the Java parser
  loaded, stops if extraction finds an error (each printed `repo/path:line: message`, DRIFT-005),
  compares, and prints the report to standard output. What stops it goes to standard error.
- **DRIFT-502** Every form gives the same counts: the drift and likely findings, the suggestions, what
  is not checked, the ignore lines that excused something and how many differences, the elements and
  the lines of the diagram (one per object) with how many of each the code confirms, `--fail-on` and
  the exit code. The terminal header names the repos and what was found in them (Compose services,
  Maven modules, npm packages, and apps: Spring Boot applications and Angular applications) and the
  time taken, to a tenth of a second.
- **DRIFT-503** Exit codes, for every form: 0 when nothing at or above `--fail-on` was found (drift
  by default), 1 when something was, and 2 when drift cannot run: a model that cannot be read or has
  errors, an extraction error (a missing repo or Compose file), or a wrong option, with a plain
  message.
- **DRIFT-504** What is not checked is collapsed per element: an element that stands for no code (a
  person, an uncertain match, no matching name) takes, in one line, every line of the diagram that is
  not checked because it is an end ("The line “User uses Website” (line 246) is not checked
  either."); the scenarios share one line; then each warning of the extractor, at its place in the
  code, says what drift could not read.
- **DRIFT-505** The terminal report (the default, `--format text`): `aerie drift <file>` and the
  header; then Drift, Likely, Not checked, Suggestions and Ignored, each with its count and left out
  when empty. A finding is its id and title, `Diagram:` and the model's line when it has one, why it
  has its level, `Code:` with its evidence (the first 8 lines, then how many more), `Suggested edit:`
  with each hunk under its place (`file:24`, `file:29-30`, or `file, after line 38`) as `-` and `+`
  Lines, and `Or, if it is meant to differ:` with the ignore line. Prose is wrapped at 100 columns;
  evidence and Lines never are, so they can be copied. A suggestion is printed like a finding,
  without the ignore line; an ignore line as its place, subject, reason and how many differences it
  excused. The footer gives how much the code confirms, the counts and the exit code, and points to
  `--format diff` when there are edits. On a terminal (standard output a TTY, `NO_COLOR` unset) the
  ids, headings, places and Lines are coloured; anywhere else the text is plain.
- **DRIFT-506** `--format diff` prints one unified diff of the model file (`--- a/<file>` and
  `+++ b/<file>`, the path relative to the folder drift ran in when the file is inside it, else to
  the top of its repository, with forward slashes; the file's CRLF line endings kept; three lines of context, `\ No newline at end of file`
  where it applies) with the edits of every finding and of every certain suggestion (DRIFT-427,
  `used`), combined as DRIFT-431 combines them; nothing when there are none. It applies with
  `git apply` or `patch -p1` from the folder drift ran in; on every fixture and on the Lotto
  benchmark, the patched model then reports no drift.
- **DRIFT-507** `--format json` prints one document: `format` (`aerie-drift/1`), `model`, `repos`,
  `summary` (DRIFT-502), then `findings`, `suggestions`, `notChecked`, `ignored` (each ignore line's
  subject, reason, line and the findings it `excused`, whose `id` is null) and `confirmed`, as D5
  builds them (DRIFT-424 to DRIFT-427), and `problems`, the extractor's warnings. Evidence is
  `{technique, name, at, detail, corroborates}` with `at` as `repo/path:line`; edits and `instead`
  are hunks (`at`, `remove`, `add`) against the model file. Every finding keeps its stable `key`.
- **DRIFT-508** `--format pr` prints the body of a pull request comment: the hidden marker
  `<!-- aerie-drift: <file> -->` that finds the comment of that model file again, a heading with a
  status dot (red for drift, yellow for likely only, green for neither) and one summary sentence
  that says what fails the check, a table of findings (id, title, the model's line or "not drawn"),
  each finding folded with its evidence, its edit as a `diff` block with context, and its ignore
  line; then what is not checked, the suggestions and the ignore lines, folded together.
- **DRIFT-509** The reports of every fixture project and of the Lotto benchmark are kept as golden
  files in `tests/unit/drift/reports/` (every form for each model with planted drifts, the text of
  each matching model, the text and the patch of the benchmark).

Choices D6 made, where this document left them open: the default form is called `text`, as for
`aerie check`; the patch also carries the certain suggestions, which change nothing drift finds, but
not the uncertain ones, which need the author's choice; evidence is cut to 8 lines in the text and
the comment (all of it is in the JSON); the time of a run is printed only in the text report, so the
JSON of two runs differs only where the findings do; and the inline `suggestion` review comments on
lines a pull request touches are left to the GitHub Action (D7), which knows the pull request's
lines and builds them from the JSON's hunks.

## 8. CI (slice D7)

Decided in #55.

- A published **GitHub Action** runs drift on every pull request, posts the sticky comment and the
  inline suggestions, and fails the check on drift.
- **Any other CI** runs `npx aerie drift --format json` and uses the exit code.
- **Multi-repo systems** (Lotto: three repos, one diagram): the check runs in the repo that holds the
  diagram, whose system root names the repos; CI checks the siblings out read-only. A pull request in
  a sibling repo may also run it, and comments when it changes the architecture. D7 decides how CI
  finds each sibling's remote and records it here.

### The GitHub Action (slice D7)

The Action is this repository's `action.yml`, a composite action that sets up Node, installs Aerie's
runtime dependencies and runs `src/action/main.ts`, which runs `aerie drift` in its own process (so
it reports exactly what the command line does) and talks to GitHub through its REST API.

- **DRIFT-601** Inputs: `models` (one or more model files, from the top of the checkout, one per line
  or separated by spaces; required), `fail-on` (`drift`, the default, or `likely`), `comment`
  (`always`, the default; `on-findings`, which creates the comment only when drift or likely is
  found but always brings an existing one up to date, for a sibling repo's pull requests; or
  `never`), `token` (posts the comments; `github.token` by default, which needs `pull-requests:
write`), `repos-token` (reads the sibling repos; `token` when empty) and `repos` (below). A wrong
  input stops the action with a plain message and exit code 2. The pull request is the one of a
  `pull_request` or `pull_request_target` event; on any other event the action only reports.
- **DRIFT-602** Sibling repos: each `repo` line of the system root that points outside the model's
  own repository, at a folder that is not there, is checked out there before drift runs: a shallow
  clone of the default branch, with `repos-token` sent as a header for that command only
  (DRIFT-606), never stored in the clone and never pushed to. The remote is the repository named like the folder under
  the same owner as the repository the workflow runs in (`repo ../lotto-options-core` in
  `acme/lotto-diagram` is `acme/lotto-options-core`), on the same GitHub server; a line of the
  `repos` input, `<repo line or folder>=<owner>/<name>[@<branch or tag>]`, names another. A folder
  that is already there is used as it is, so a workflow can check a sibling out itself (a sibling
  repo's own pull request checks itself out where the model expects it, and the diagram's repo
  beside it); a folder an earlier run cloned (marked in its `.git`) is cloned again, so a
  self-hosted runner never reads a stale one. A clone that fails stops that model file (exit code
  2), with git's message.
- **DRIFT-603** One sticky comment per model file: the body `aerie drift --format pr` prints, found
  again on the next run by its first line, the hidden marker (DRIFT-508), and edited in place only
  when it reads differently; a model file drift cannot check gets the same comment with a white dot
  and the reason. A comment the token may not post (a pull request from a fork) is a warning, never
  a failure.
- **DRIFT-604** Suggestions: each edit of a drift or likely finding whose lines the pull request
  adds, as they read at its head (from the pull request's patch of the model file), becomes a GitHub
  `suggestion` review comment: an edit replaces its lines; a line inserted before line `n` is
  suggested together with the added line above it, else the one below it. They are posted as one
  review on the head commit; each carries a hidden marker (file, line and finding key), so a later
  run posts only the new ones. Edits on lines the pull request does not add are only in the comment.
- **DRIFT-605** Each model file's report is also added to the job's summary. The action's exit code,
  and its `exit-code` output, is the worst of the model files': 0 for no drift, 1 for drift (or
  likely, with `fail-on: likely`), 2 when drift cannot run. The job fails on 1 or 2, so a workflow
  that should only report sets `continue-on-error`.
- **DRIFT-606** Tokens never reach the log, the summary or a message. Before anything else the
  action masks each token, and the base64 of the header git sends with it, with `::add-mask::` (what
  `core.setSecret` writes), and it redacts both forms from every line it prints, the summary and
  any error. git gets the header only through its environment (`GIT_CONFIG_COUNT`,
  `GIT_CONFIG_KEY_<n>` and `GIT_CONFIG_VALUE_<n>`, after any configuration the environment already
  gives), never as an argument, which the machine's process list would show. A failed clone reports
  git's own words, or else the error's message, redacted, and never the error itself, which holds
  the whole command.

`.github/workflows/drift.yml` runs the Action on this repository's pull requests that change it: a
matching fixture must pass with a green comment, and the Compose fixture's planted drifts (copied to
`tests/unit/action/fixtures/shop-drift.aerie`) must fail with exit code 1 and one red comment
however often it runs; a pull request that adds that file gets its eight suggestions once.

Any other CI runs the command in the repository that holds the model, with the sibling repos
checked out where its system root points, and uses the exit code; the JSON is for tools:

```sh
npx aerie drift docs/architecture.aerie --format json > drift.json
```

Choices D7 made, where this document left them open: a sibling's remote is its folder's name under
the same owner unless the `repos` input says otherwise; the action needs the repository it runs in
checked out (`actions/checkout`), and checks out only the siblings; suggestions go only on added
lines, as the pull request's head reads them, never on lines it does not touch; and the Action
writes the job summary and its comments through the REST API, with no third-party actions beyond
`actions/setup-node`.

## 9. The Claude skill (slice D8)

Decided in #56. The Aerie skill ([claude-skill.md](claude-skill.md)):

- runs `aerie drift` after writing a diagram and fixes findings until it is clean, as it already does
  with `aerie check`;
- adds `code` lines and the system root itself when it writes a diagram;
- when Claude changes code in a way that changes the architecture, runs drift and updates the diagram
  in the same change.

Slice D8 builds this as SKILL-211 to SKILL-213, and proves it on the skill's first worked example
(SKILL-302), whose deployment and build files now sit beside its model.

Choices D8 made, where this document left them open: the model is clean when drift's JSON has no
findings, drift or likely (an exit code of 0 alone still allows likely ones); the skill stops as it
does for `aerie check`, after ten runs or when the same finding survives two fixes; a suggested new
element is a placeholder the skill words like its siblings, never left as drift wrote it; a
difference that is meant, such as a development tool left out of the picture, becomes the finding's
ignore line with the true reason; the skill writes `repo .` for the model's own repository rather
than relying on the nearest `.git`; and ignore lines go last in the file.

## 10. Definition of done

Decided in #57, on top of the repository's definition of done
([AGENTS.md](../../AGENTS.md#definition-of-done)).

- **Fixture projects per stack** (Compose, Spring with Maven, Angular) with planted drifts: every one
  is found, and nothing is invented.
- **The Lotto repos are the real-world benchmark**: precision and recall are tracked and may never get
  worse (like the readability scores, ACC-004).
- **Journeys**: the GitHub Action (a test pull request gets the right comment) and the skill loop (it
  ends clean).

Where each is proven, as of D8: the fixture projects by DRIFT-432 (and their reports by DRIFT-509);
the benchmark by DRIFT-433, whose `benchmark.json` is part of `npm run check`; the Action by
`.github/workflows/drift.yml` on the pull requests that change it, and in memory by DRIFT-601 to
DRIFT-606; and the skill loop by SKILL-302, which runs the commands the skill runs, from a first draft
through drift's rounds and a change to the code, to a clean run.

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
