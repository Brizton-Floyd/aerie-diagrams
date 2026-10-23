# d2-compose: read log

Task: drift detection slice D2 (issue #62): the extractor core (`src/extract/`: facts with technique
and `repo/path:line` evidence, problems, the system root resolved to repos and Compose files, YAML
with positions), the Docker Compose extractor (interpolation, `.env`, merge keys, override files,
`extends`, `include`, the Dockerfile stage graph, environment values naming services, `depends_on`,
volumes, profiles, healthchecks), the Node file access in `src/cli/project.ts`, fixture projects,
copies of the Lotto Compose files, the spec (`DRIFT-001` to `DRIFT-009`, `DRIFT-101` to
`DRIFT-114`) and their tests.
Builder: firstmate crewmate (Claude Code session)
Date: 2026-10-23

## Files

Built from this repository: `AGENTS.md`, `GLOSSARY.md`, `docs/spec/drift.md`, `docs/spec/language.md`
(section 11), `docs/spec/acceptance.md`, `docs/decisions/0006-drift-detection.md`,
`docs/clean-room/read-log/`, `THIRD_PARTY_NOTICES.md`, `CHANGELOG.md`, `eslint.config.js`,
`scripts/check-coverage.ts`, `scripts/check-docs.ts`, `scripts/check-text.ts`, and the code and tests
in `src/lines/`, `src/model/`, `src/layout/`, `src/cli/` and `tests/`.

The drift research and its throwaway prototypes, which the task brief names as inputs for this slice
("our own clean code, approach reusable"). Before opening them they were searched for any mention of
the banned sources; the only mentions are the clean-room rule itself and the research's own read log
saying none was opened.

- `/Users/briztonfloyd/Desktop/firstmate/data/aerie-drift-research/brief.md` - the research task's
  scope
- `/Users/briztonfloyd/Desktop/firstmate/data/aerie-drift-research/decisions.md` - the captain's
  decision on part-level lines
- `/Users/briztonfloyd/Desktop/firstmate/data/aerie-drift-research/report.md` - summary, method,
  results on Lotto (sections 1 to 3), the Compose and parser sections (4.1, 5); the Compose rules it
  found (merge keys, `localhost` in a container, `depends_on` only corroborating, the stage graph)
- `/Users/briztonfloyd/Desktop/firstmate/data/aerie-drift-report/prototype/extract/package.json` -
  the parser versions the prototype used
- `/Users/briztonfloyd/Desktop/firstmate/data/aerie-drift-report/prototype/extract/extract.mjs` -
  the prototype's Compose, Dockerfile and resolution parts (lines 700 to 1000): the approach only,
  rewritten here from the Compose specification
- The file names in both folders were listed; no other file in them was opened.

The Lotto repositories, read only (the task brief names `lotto-options-core` as the read-only source;
`git status` stayed clean in both, at `b678f32` and `7f46c4f`):

- `/Users/briztonfloyd/Desktop/firstmate/projects/lotto-options-core/compose.yaml` - copied to
  `tests/unit/extract/fixtures/lotto/lotto-options-core/compose.yaml`
- `/Users/briztonfloyd/Desktop/firstmate/projects/lotto-options-core/deploy/backend/Dockerfile` -
  copied beside it
- `/Users/briztonfloyd/Desktop/firstmate/projects/lotto-options-core/deploy/web-ui/Dockerfile` -
  copied beside it
- `/Users/briztonfloyd/Desktop/firstmate/projects/lotto-options-core/Dockerfile` - its first lines, to
  see it is not the one Compose builds with (not copied)
- `/Users/briztonfloyd/Desktop/firstmate/projects/lottery-result-persistence-service/docker-compose.yml`
  - the stale Compose file, copied to show why the system root names the authoritative one
- The top-level file names of both repos and of `lotto-options-core/deploy/`.

A first run of the extractor read the files above from the Lotto repos themselves, before the copies
existed; the tests read only the copies.

Firstmate tooling:

- `/Users/briztonfloyd/Desktop/firstmate/bin/fm-ensure-agents-md.sh` - run on this worktree, as the
  brief asks (product-neutral)

The task brief arrived as the session's dispatch message; no brief file was opened. Status lines were
appended to `/Users/briztonfloyd/Desktop/firstmate/state/aerie-d2-compose.status` (written, not read).
A session-start hook printed a list of local review sessions, which named file paths only; none of
those files was opened.

`docker compose config` (Docker Compose v5.6.0, which only reads files) was run on this slice's own
fixture projects as the oracle the spec names, never on the Lotto repos.

## URLs

This repository's own GitHub issue, read with `gh-axi`:

- https://github.com/Brizton-Floyd/aerie-diagrams/issues/62 - the D2 slice ticket

The Compose specification and the reference loader's constants, product-neutral standards (accessed
2026-10-23):

- https://api.github.com/repos/compose-spec/compose-spec/contents - the list of the specification's
  files
- https://raw.githubusercontent.com/compose-spec/compose-spec/main/03-compose-file.md - default file
  names, merging several files, relative paths from the first file
- https://raw.githubusercontent.com/compose-spec/compose-spec/main/04-version-and-name.md - `name`
- https://raw.githubusercontent.com/compose-spec/compose-spec/main/05-services.md - `extends` and its
  merge rules, `links`, `profiles`
- https://raw.githubusercontent.com/compose-spec/compose-spec/main/10-fragments.md - anchors and
  merge keys
- https://raw.githubusercontent.com/compose-spec/compose-spec/main/12-interpolation.md - interpolation
- https://raw.githubusercontent.com/compose-spec/compose-spec/main/13-merge.md - merge rules,
  `!reset`, `!override`
- https://raw.githubusercontent.com/compose-spec/compose-spec/main/14-include.md - `include`
- https://raw.githubusercontent.com/compose-spec/compose-spec/main/15-profiles.md - profiles
- https://raw.githubusercontent.com/compose-spec/compose-spec/main/build.md - `build`, `context`,
  `dockerfile`, `additional_contexts`
- https://raw.githubusercontent.com/compose-spec/compose-spec/main/container_spec.md - `env_file` and
  its format, `environment`, `hostname`, `networks` aliases, `volumes`
- https://raw.githubusercontent.com/compose-spec/compose-spec/main/workload_spec.md - `depends_on`,
  `expose`, `healthcheck`, `ports`
- https://raw.githubusercontent.com/compose-spec/compose-go/main/cli/options.go - the default and
  override file names in order of preference (two constants)
- https://raw.githubusercontent.com/compose-spec/compose-go/main/paths/resolve.go - which paths are
  resolved from the project folder (a table of attribute paths)
- https://raw.githubusercontent.com/docker/docs/main/content/manuals/compose/how-tos/project-name.md
  - the project name rule
- https://raw.githubusercontent.com/docker/docs/main/content/manuals/compose/how-tos/multiple-compose-files/merge.md
  - the override file Compose reads by default

Package registry (licences and versions): `npm view yaml`, `npm view dockerfile-ast`
(https://registry.npmjs.org/yaml, https://registry.npmjs.org/dockerfile-ast), and the installed
packages' own `package.json`, `LICENSE` and `License.txt` files.

## Forbidden sources opened

None.
