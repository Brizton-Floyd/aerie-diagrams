# d3-spring: read log

Task: drift detection slice D3 (issue #63): the Maven extractor (`src/extract/maven/`: modules and
dependencies from the raw poms), the Spring extractor (`src/extract/spring/`: configuration files,
profiles, placeholders, relaxed binding, applications, endpoints, HTTP calls, message channels,
events, schedules) and the Java parser (`src/extract/java/`), the folder listing hook in
`ProjectFiles`, a Spring fixture project, copies of the Lotto Spring repos, the spec (`DRIFT-201` to
`DRIFT-215`) and their tests.
Builder: firstmate crewmate (Claude Code session)
Date: 2026-10-23

## Files

Built from this repository: `AGENTS.md`, `GLOSSARY.md`, `docs/spec/drift.md`, `docs/spec/language.md`
(section 11), `docs/spec/acceptance.md`, `docs/clean-room/read-log/`, `THIRD_PARTY_NOTICES.md`,
`CHANGELOG.md`, `eslint.config.js`, the `tsconfig` files, `scripts/check-coverage.ts`,
`scripts/check-text.ts`, and the code and tests in `src/extract/`, `src/cli/` and `tests/unit/extract/`
(slice D2's extractor core, which this slice builds on).

The drift research, which the task brief names as an input ("research and prototype, our own clean
code"). The D2 read log records that it was searched for mentions of the banned sources before it was
first opened; the only ones are the clean-room rule and the research's own read log saying none was
opened.

- `/Users/briztonfloyd/Desktop/firstmate/data/aerie-drift-research/decisions.md` - the captain's
  decision on part-level lines
- `/Users/briztonfloyd/Desktop/firstmate/data/aerie-drift-research/report.md` - sections 1 to 5, 8
  and 9 and its Answer (results on Lotto, the Spring and Maven rules, the parser choices), the start
  of section 6 (its tool table's header), and the Maven, Spring
  configuration and Java parts of its Appendix A prototype (lines 743 to 1258): the approach only,
  rewritten here from the Spring and Maven documentation
- The file names in `/Users/briztonfloyd/Desktop/firstmate/data/aerie-drift-research/` and
  `/Users/briztonfloyd/Desktop/firstmate/data/aerie-drift-report/` were listed; no file of the second
  folder was opened.

The Lotto repositories, read only (the task brief names them as the read-only sources; `git status`
stayed clean, at `64a2b70` and `7f46c4f`):

- `/Users/briztonfloyd/Desktop/firstmate/projects/lotto-options-core/` and
  `/Users/briztonfloyd/Desktop/firstmate/projects/lottery-result-persistence-service/` - every tracked
  `pom.xml`, `src/main/java/**/*.java` and `src/main/resources/application*` file (387 files, listed
  with `git ls-files`), copied with `rsync` to `tests/unit/extract/fixtures/lotto/`, with each em dash
  written as a hyphen (the repository's text rule; no line moved)
- In those repos, these were also read to learn how the code makes its calls: the BFF's and the
  engine's `application.yaml` and `application.properties`, `CoreApiClient.java`,
  `PersistenceServiceProperties.java`, `WebClientLotteryStateService.java`,
  `ResultsServiceDrawHistoryAdapter.java`, `ResultsServiceCatalogAdapter.java`,
  `ApplicationConfig.java`, `CoreApiPropertiesConfig.java`, `HttpLotteryPersistenceClient.java`,
  `DrawResultJob.java`, the legacy `LotteryStateService.java` and `ResultsServiceLocation.java`, and
  searches over their Java for clients, mappings, events and schedules
- `lotto-options-core/compose.yaml`, `lotto-options-core/deploy/backend/Dockerfile` and
  `lottery-result-persistence-service/docker-compose.yml` - compared with D2's copies (unchanged)
- The repos' top-level file names, their module folders and the output of `git log -1`

The extractor was also run on the Lotto repos themselves (read only) before the copies existed; the
tests read only the copies.

Firstmate tooling:

- `/Users/briztonfloyd/Desktop/firstmate/bin/fm-ensure-agents-md.sh` - run on this worktree, as the
  brief asks (product-neutral)

The task brief arrived as the session's dispatch message; no brief file was opened. Status lines were
appended to `/Users/briztonfloyd/Desktop/firstmate/state/aerie-d3-spring.status` (written, not read).
Session-start hooks printed a list of local review sessions, which named file paths only; none of those
files was opened.

## URLs

This repository's own GitHub issues, read with `gh-axi`:

- https://github.com/Brizton-Floyd/aerie-diagrams/issues/63 - the D3 slice ticket
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/69 - the drift build tracker

Package registry (versions, licences, scripts and contents), product-neutral:

- `npm view` of `web-tree-sitter`, `tree-sitter-java-orchard`, `tree-sitter-java`, `@xmldom/xmldom`
  and `properties-file` (https://registry.npmjs.org/)
- https://registry.npmjs.org/tree-sitter-java-orchard/-/tree-sitter-java-orchard-0.5.22.tgz,
  https://registry.npmjs.org/web-tree-sitter/-/web-tree-sitter-0.27.1.tgz and
  https://registry.npmjs.org/tree-sitter-java/-/tree-sitter-java-0.23.5.tgz - unpacked in the session's
  scratch folder (`npm pack`) to read their `package.json`, `LICENSE`, the grammar's
  `src/node-types.json` (its node and field names) and to take the grammar's `.wasm` file; installed
  into scratch folders, and into the `mcr.microsoft.com/playwright:v1.64.1-noble` container, to see
  whether each installs without a compiler (the grammar packages do not)
- The installed packages' own `package.json`, `LICENSE` and type declarations (`.d.ts`) in
  `node_modules/`

## Forbidden sources opened

None.
