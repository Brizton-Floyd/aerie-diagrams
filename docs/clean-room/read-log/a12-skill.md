# a12-skill: read log

Task: A12, the Aerie skill for Claude: `skills/aerie/` (SKILL.md, the Lines reference, the wording
guide, examples and two worked examples), its unit tests, and one dry run on a public sample
project.
Builder: firstmate crewmate (Claude Code session)
Date: 2026-10-22

## Files

Built from this repository: `docs/spec/` (above all `claude-skill.md`, `language.md`,
`acceptance.md`, and the parts of `model.md`, `look.md` and `interaction.md` the skill cites),
`docs/spec/examples/`, `GLOSSARY.md`, `docs/slice-plan.md`, `src/cli/aerie.ts`, and the exports of
`src/lines/` and `src/model/` that the tests compare against.

- `/Users/briztonfloyd/Desktop/firstmate/bin/fm-ensure-agents-md.sh` - read and run on this worktree,
  as the brief asks (firstmate tooling, product-neutral)

The task brief arrived as the session's dispatch message; no brief file was opened.

A session-start hook printed a list of local review sessions, which named file paths only; none of
those files was opened.

The dry run read a clone of the sample project below, kept in the session's scratch folder: its
`README.md`, `docker-compose.yml`, `k8s-specifications/*.yaml` (image and port lines),
`vote/Dockerfile`, `vote/requirements.txt`, `vote/app.py`, `vote/templates/index.html` (the form),
`result/server.js`, `result/package.json`, `result/Dockerfile`, `result/views/app.js`,
`result/docker-compose.test.yml`, `result/tests/tests.sh`, `result/tests/render.js`,
`worker/Program.cs`, `worker/Worker.csproj`, `seed-data/generate-votes.sh` and
`seed-data/make-data.py`. Its `architecture.excalidraw.png` was not opened. A second, independent
dry run by a fresh agent read only the skill folder and the same clone.

Not opened: the map folder, the clean prototypes and everything else outside this repository.

## URLs

- https://github.com/dockersamples/example-voting-app - cloned (commit `63e9150`) as the public
  sample project for the dry run; Apache-2.0, product-neutral
- https://registry.npmjs.org/ (package `aerie`) - reached by accident: an early `npx aerie --help`
  run outside the checkout made npm download an unrelated package of that name into its cache.
  Only npm's own install warnings were seen; nothing from the package was read or used. The skill
  now warns against this.

## Forbidden sources opened

None.
