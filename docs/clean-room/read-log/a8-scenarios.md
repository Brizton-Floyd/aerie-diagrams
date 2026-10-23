# a8-scenarios: read log

Task: A8, scenarios played on the architecture: the scenario side panel with its controls and
numbered step list, Back, Play and Pause, Next and Done, the caption bar, the switch between the map
and the lanes, the audience switch mid-scenario, reduced motion, and the entry point the navigation
sidebar (A7) calls; journeys, an accessibility audit and screenshots on the Lotto Generate picks
scenario.
Builder: firstmate crewmate (Claude Code session)
Date: 2026-10-22

## Files

Built from this repository: `docs/spec/` (above all `interaction.md` (INT-101 to INT-105, INT-201,
INT-303, INT-601 to INT-606, INT-901 to INT-905), `layout.md` (LAYOUT-451, LAYOUT-501 to
LAYOUT-607), `look.md` (LOOK-701 to LOOK-706, LOOK-801 to LOOK-805, LOOK-901 to LOOK-903),
`model.md` (MODEL-401 to MODEL-406, MODEL-601 to MODEL-604) and `acceptance.md`),
`docs/slice-plan.md`, `GLOSSARY.md`, the samples, and A2's to A6's and A10's code in `src/` and
`tests/`.

No file from the map folder or the clean prototypes was opened for this task.

Package files, from the installed copies in `node_modules/`, used through their documented APIs
only: `@playwright/test` and `playwright` 1.64.1 (the test API, and a scratch script driving the
local dev server to look at the page), `@axe-core/playwright` 4.14.0 (`AxeBuilder`).

Firstmate tooling:

- `/Users/briztonfloyd/Desktop/firstmate/bin/fm-ensure-agents-md.sh` - run on this worktree, as the
  brief asks (product-neutral)

The task brief arrived as the session's dispatch message; no brief file was opened.

A session-start hook printed a list of local review sessions, which named file paths only; none of
those files was opened.

## URLs

None opened in a browser other than the local dev and preview servers (`localhost`). `npm ci` read
the npm registry (package downloads only). The Linux run of the screenshot baselines used the
`mcr.microsoft.com/playwright:v1.64.1-noble` image already on this machine and ran `npm ci` inside
it against the npm registry (package downloads only).

## Forbidden sources opened

None.
