# a7-nav: read log

Task: A7, the navigation sidebar and full-state shared links: the sidebar's views, scenarios and
walkthroughs (walkthroughs launch with bare controls until A9), the picture written into the
address's fragment and read back from it, history entries for Back and Forward, the "Copy link"
button, and a shared link reopening its exact picture; unit tests of the fragment and journeys on
the Lotto sample.
Builder: firstmate crewmate (Claude Code session)
Date: 2026-10-22

## Files

Built from this repository: `docs/spec/` (above all `interaction.md` (INT-401 to INT-404, INT-501
to INT-507), `model.md` (MODEL-208, MODEL-404, MODEL-501 to MODEL-505, MODEL-601 to MODEL-604),
`look.md` (LOOK-801 to LOOK-803, LOOK-901) and `acceptance.md`), `docs/slice-plan.md`, the samples,
and A2's to A10's code in `src/` and `tests/`.

No file from the map folder or the clean prototypes was opened for this task.

Package files: `@playwright/test` 1.64.1, its documented test and browser API only (history
navigation, clipboard permissions, screenshots).

The task brief arrived as the session's dispatch message; no brief file was opened.

A session-start hook printed a list of local review sessions, which named file paths only; none of
those files was opened.

## URLs

None opened in a browser other than the local dev and preview servers (`localhost`). The Linux run
of the screenshot baselines used the `mcr.microsoft.com/playwright:v1.64.1-noble` image already on
this machine and ran `npm ci` inside it against the npm registry (package downloads only).

## Forbidden sources opened

None. When `chrome-devtools-axi pages` listed the tabs of its shared browser session, one tab of
another session was titled "ilograph". It was not selected, read or opened; this task moved to its
own browser session and then to Playwright scripts against the local dev server.
