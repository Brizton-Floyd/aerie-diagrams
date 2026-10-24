# signal: read log

Task: ship the Signal look the owner chose, dark by default with a new light theme (remembered, used
for print), on top of the prototypes' plain-first wording ("More technical", the hover card, the
"Back to plain wording" chip, the presenter's wording button), the cover with "Take the tour", and
the copy changes; the spec (`look.md`, `interaction.md`) rewritten with numbered requirements in
place of Contour, decision 0007, the re-recorded readability baseline, journeys, an accessibility
audit in both themes, and screenshot baselines regenerated on Linux.
Builder: firstmate crewmate (Claude Code session)
Date: 2026-10-24

## Files

Built from this repository: `CLAUDE.md`, `AGENTS.md`, `GLOSSARY.md`, `docs/spec/` and
`docs/decisions/`, the samples, and the code and tests in `src/`, `scripts/` and `tests/`.

No file from the map folder or the clean prototypes was opened for this task.

Firstmate instructions and Aerie's own earlier prototype work, named by the task's brief:

- `/Users/briztonfloyd/Desktop/firstmate/data/aerie-ui-fresh/signal-ship.patch` - applied with
  `git am` as the starting point (Signal alone, plus the plain-first and copy work)
- `/Users/briztonfloyd/Desktop/firstmate/data/aerie-ui-fresh/report.md`, `decisions.md` and
  `brief.md` - the Signal prototype's report, the owner's decisions and its brief
- `/Users/briztonfloyd/Desktop/firstmate/data/aerie-ui-fresh/shots/signal-1-overview.png`,
  `signal-3b-more-technical.png`, `signal-4-scenario.png` and `signal-5-presenter.png` - looked at
- `/Users/briztonfloyd/Desktop/firstmate/data/aerie-ui-elevate/report.md` and `decisions.md` - the
  plain-first prototype's report (its copy table) and the owner's decisions on it

The prototypes' own read logs (`ui-elevate.md`, `ui-fresh.md`) stay in this folder, since their work
is in this change.

Status lines were appended to `/Users/briztonfloyd/Desktop/firstmate/state/aerie-signal.status`
(written, not read). Session-start hooks printed file paths of local review sessions; none of those
files was opened.

Package files: `@fontsource/inter` 5.3.0 and `@fontsource/jetbrains-mono` 5.3.0 (already in the
patch), read as font files by `scripts/font-metrics.ts`, and their `LICENSE` files and the font
files' name tables for the copyright lines in `THIRD_PARTY_NOTICES.md`. `@playwright/test` and
`playwright` 1.64.1 and `@axe-core/playwright` through their documented APIs (screenshots,
`emulateMedia` for print, `addInitScript`). `ffmpeg` (product-neutral) to compare two screenshots.

## URLs

`npm ci` and `npm uninstall` against the npm registry (package downloads only). Browsers opened only
the local preview servers on `localhost`. The Linux run of the screenshot baselines used the
`mcr.microsoft.com/playwright:v1.64.1-noble` image and ran `npm ci` inside it.

## Forbidden sources opened

None.
