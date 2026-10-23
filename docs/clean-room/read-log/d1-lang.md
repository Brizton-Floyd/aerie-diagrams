# d1-lang: read log

Task: drift detection slice D1: `code` lines, the `system` block and `ignore drift` lines in the
Lines language (reader, parser, canonical model, catalogue E801 to E814, formatter, printer, editor
colours), `docs/spec/drift.md` recording the whole feature from tickets #51 to #57, the language,
model and acceptance spec, decision 0006, the skill's language reference, and their tests.
Builder: firstmate crewmate (Claude Code session)
Date: 2026-10-23

## Files

Built from this repository: `AGENTS.md`, `GLOSSARY.md`, `docs/spec/` (above all `language.md`,
`model.md`, `acceptance.md`, `overview.md`, `interaction.md` (INT-802, INT-803)), `docs/decisions/`,
`docs/slice-plan.md`, `CHANGELOG.md`, `skills/aerie/reference/lines.md`, `scripts/check-docs.ts`,
`scripts/check-coverage.ts`, and the code and tests in `src/lines/`, `src/model/`, `src/cli/` and
`tests/`.

No file from the map folder or the clean prototypes was opened for this task. The tickets point to
two firstmate data folders (`aerie-drift-research/` and `aerie-drift-report/`); they are not in the
allowed list, so they were not opened: everything here comes from the tickets' own text.

Firstmate tooling:

- `/Users/briztonfloyd/Desktop/firstmate/bin/fm-ensure-agents-md.sh` - run on this worktree, as the
  brief asks (product-neutral)

The task brief arrived as the session's dispatch message; no brief file was opened. Status lines were
appended to `/Users/briztonfloyd/Desktop/firstmate/state/aerie-d1-lang.status`, as the brief asks
(written, not read).

A session-start hook printed a list of local review sessions, which named file paths only; none of
those files was opened.

## URLs

This repository's own GitHub issues, read with `gh` (the brief names them as the contract):

- https://github.com/Brizton-Floyd/aerie-diagrams/issues/61 - the D1 slice ticket
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/69 - the drift build tracker
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/58 - the drift map: destination, captain
  decisions, scope
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/51 - extraction research (body and
  comments, including its appendices and its own read log); its survey links were not followed
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/52 - source hints and matching rules
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/53 - false positives and suppressions
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/54 - drift report and suggested edits
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/55 - CI integration
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/56 - Claude skill integration
- https://github.com/Brizton-Floyd/aerie-diagrams/issues/57 - definition of done and slice plan

The name rules for code units (Compose service names, Maven artifactIds, npm package names, Java
identifiers) come from general knowledge of those public, product-neutral formats; no page was
opened for them.

## Forbidden sources opened

None.
