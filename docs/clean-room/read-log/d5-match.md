# d5-match: read log

Task: drift detection slice D5 (issue #65, tracker #69): the comparison engine in `src/drift/`
(matching elements to their code, lifting the code's links, confirming and reporting lines, units
and connections, the drift, likely and not checked levels, ignore lines, the finding model with its
suggested edits as hunks), the class graph it needs from the Java (`src/extract/spring/classes.ts`),
fixture projects with planted drifts per stack, the Lotto benchmark, the spec (`DRIFT-401` to
`DRIFT-433`) and their tests.
Builder: firstmate crewmate (Claude Code session)
Date: 2026-10-23

## Files

Built from this repository: `AGENTS.md`, `GLOSSARY.md`, `docs/spec/drift.md`, `docs/spec/language.md`
(sections 11 to 13), `docs/spec/acceptance.md`, `docs/decisions/0006-drift-detection.md`,
`docs/slice-plan.md`, `docs/clean-room/read-log/` (D3 and D4), `CHANGELOG.md`, `eslint.config.js`,
`.prettierignore`, the `tsconfig` files, `package.json`, `vitest.config.ts`, `scripts/check-coverage.ts`,
`samples/lotto.aerie`, the code of `src/lines/`, `src/model/` (`tree.ts`, `words.ts`, `index.ts`),
`src/extract/` and `src/cli/project.ts`, and the tests and fixture projects of `tests/unit/extract/`,
among them the copies of the Lotto repos that D2 to D4 made (`tests/unit/extract/fixtures/lotto/`),
which the benchmark reads; `tests/rules/scores.test.ts` for the shape of a baseline that may never
get worse.

Outside it:

- `/Users/briztonfloyd/Desktop/firstmate/data/aerie-d5-match/brief.md` - the task's own brief, the
  same text as the session's dispatch message
- `/Users/briztonfloyd/Desktop/firstmate/data/` and
  `/Users/briztonfloyd/Desktop/firstmate/data/ilo-own-map/tickets/` - their file names were listed,
  to find the brief; no other file in them was opened (the drift research and prototype folders,
  `aerie-drift-research/` and `aerie-drift-report/`, were not opened)

Firstmate tooling: `/Users/briztonfloyd/Desktop/firstmate/bin/fm-ensure-agents-md.sh` - read, then
run on this worktree, as the brief asks (product-neutral).

Status lines were appended to `/Users/briztonfloyd/Desktop/firstmate/state/aerie-d5-match.status`
(written, not read). A session-start hook printed a list of local review sessions, which named file
paths only; none of those files was opened. `npm ci` installed the locked dependencies (nothing was
added).

## URLs

This repository's own GitHub issues, read with `gh-axi` (and, for comment bodies `gh-axi` shortens,
`gh api repos/Brizton-Floyd/aerie-diagrams/issues/<n>/comments`, read only):

- https://github.com/Brizton-Floyd/aerie-diagrams/issues/65 - the D5 slice ticket
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/69 - the drift build tracker
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/58 - the drift map and its decisions
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/52 - matching rules (resolution comment)
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/53 - levels and suppressions (resolution)
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/54 - the report prototype's results and the
  captain's decision that exact single checks count as drift (resolution)
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/57 - definition of done (resolution)
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/51 - the extraction research's resolution:
  its answer, results table and read log, and in its Appendix A the scoring and part-level probes of
  its throwaway prototype (the hints it gave the Lotto parts, its class graph through interfaces,
  lifting through ancestors): the approach only, rewritten here; its prototype's other parts were not
  read

## Forbidden sources opened

None.
