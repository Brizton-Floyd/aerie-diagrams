# d6-report: read log

Task: drift detection slice D6 (issue #66, tracker #69): `aerie drift <model>` and the four forms of
its report (the terminal report, `--format diff`, `--format json` as `aerie-drift/1`, `--format pr`),
exit codes and `--fail-on`, printed from D5's finding model in `src/drift/`; golden reports of the
fixtures and the Lotto benchmark, a patch round trip through `git apply`, the spec (`DRIFT-501` to
`DRIFT-509`) and their tests.
Builder: firstmate crewmate (Claude Code session)
Date: 2026-10-23

## Files

Built from this repository: `AGENTS.md`, `docs/spec/drift.md`, `docs/spec/acceptance.md`,
`docs/spec/language.md` (section 15), `docs/clean-room/read-log/` (D5's log and the template),
`CHANGELOG.md`, `eslint.config.js`, `.prettierignore`, `package.json`, `scripts/check-coverage.ts`,
`scripts/check-docs.ts`, the code of `src/cli/`, `src/drift/`, `src/extract/` (its entry point,
facts, problems and the Java loader) and `src/model/check.ts`, and the tests and fixture projects
of `tests/unit/drift/` and `tests/unit/lines/cli.test.ts`.

Outside it:

- `/Users/briztonfloyd/Desktop/firstmate/data/aerie-d6-report/brief.md` - the task's own brief, the
  same text as the session's dispatch message
- `/Users/briztonfloyd/Desktop/firstmate/data/aerie-drift-report/out/` - the outputs of Aerie's own
  report prototype (ticket #54), which the brief names as the agreed look: `drift.txt`,
  `drift.ansi`, `drift.json` (its first part), `suggested.diff`, `pr-comment.md`,
  `pr-inline-suggestion.md`, `control.txt`, `after-patch.txt` and `ignores.txt` were read; the
  folder's file names were listed, and so were those of `aerie-drift-report/` and its `prototype/`
  and `screenshots/` folders, none of whose files was opened

Firstmate tooling: `/Users/briztonfloyd/Desktop/firstmate/bin/fm-ensure-agents-md.sh` - run on this
worktree, as the brief asks (product-neutral).

Status lines were appended to `/Users/briztonfloyd/Desktop/firstmate/state/aerie-d6-report.status`
(written, not read). A session-start hook printed a list of local review sessions, which named file
paths only; none of those files was opened. `no-mistakes doctor` was run to check the pipeline.

## URLs

This repository's own GitHub issues, read with `gh-axi` (and, for comment bodies,
`gh api repos/Brizton-Floyd/aerie-diagrams/issues/<n>/comments`, read only):

- https://github.com/Brizton-Floyd/aerie-diagrams/issues/66 - the D6 slice ticket
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/54 - the report prototype's results, the
  agreed formats and the captain's decisions (resolution comment)

## Forbidden sources opened

None.
