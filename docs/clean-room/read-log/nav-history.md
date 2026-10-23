# nav-history: read log

Task: Back and Forward through the reader's visits: every change the reader makes to the picture is
a visit, one per browser history entry, with the camera where they left it; Back and Forward buttons
and Alt+Left and Alt+Right at the stage's top left, a list of recent visits, the visits kept for a
reload; the spec's INT-551 to INT-557 and LOOK-808, unit tests, journeys and a screenshot on the
Lotto sample.
Builder: firstmate crewmate (Claude Code session)
Date: 2026-10-23

## Files

Built from this repository: `docs/spec/` (above all `interaction.md` (INT-201 to INT-205, INT-351 to
INT-354, INT-501 to INT-507, INT-601 to INT-606, INT-701 to INT-707), `layout.md` (LAYOUT-402,
LAYOUT-404, LAYOUT-453 to LAYOUT-455), `look.md` (LOOK-801 to LOOK-807) and `acceptance.md`),
`GLOSSARY.md`, the samples, and the code in `src/app/`, `src/layout/` and `tests/`.

No file from the map folder or the clean prototypes was opened for this task.

Package files: `@playwright/test` 1.64.1, its documented test and browser API only (history
navigation, mouse and keyboard, screenshots and their `style` option).

The task brief arrived as the session's dispatch message; no brief file was opened.

A session-start hook printed a list of local review sessions, which named file paths only; none of
those files was opened.

## URLs

None opened in a browser other than the local preview server (`localhost`). The Linux run of the
screenshot baselines used the `mcr.microsoft.com/playwright:v1.64.1-noble` image already on this
machine and ran `npm ci` inside it against the npm registry (package downloads only).

## Forbidden sources opened

None.
