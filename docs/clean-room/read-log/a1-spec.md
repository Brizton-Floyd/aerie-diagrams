# a1-spec: read log

Task: A1, write Aerie's functional specification in `docs/spec/` (with requirement ids, the Lotto
worked example, a docs check wired into `npm run lint`, and glossary additions).
Builder: firstmate crewmate (Claude Code session)
Date: 2026-10-22

## Files

Task brief and map:

- `/Users/briztonfloyd/Desktop/firstmate/data/aerie-a1-spec/brief.md` - the task brief (first lines;
  the full text was also the session's dispatch message)
- `/Users/briztonfloyd/Desktop/firstmate/data/ilo-own-map/map.md` - settled decisions summary
- `/Users/briztonfloyd/Desktop/firstmate/data/ilo-own-map/GLOSSARY.md` - vocabulary
- `/Users/briztonfloyd/Desktop/firstmate/data/ilo-own-map/tickets/01-derivation-audit.md` through
  `.../tickets/12-product-name.md` (all twelve tickets) - the resolutions are the decisions

Language prototype (`/Users/briztonfloyd/Desktop/firstmate/data/ilo-own-language/`):

- `decisions.md`, `brief.md`, `report.md` - the chosen language direction and its findings
- `candidate-b-lines.arc` - the Lines candidate; adapted into `docs/spec/examples/lotto.aerie`
- `tools/langs.py`, `tools/check.py`, `tools/probe.py` - the prototype parser, lifting and checks
- `tools/check-output.txt`, `tools/probe-output.txt` - expected drawn sentences per view and audience,
  and probe messages; the tables in `docs/spec/model.md` were checked against them

Layout prototype (`/Users/briztonfloyd/Desktop/firstmate/data/ilo-own-layout/`):

- `decisions.md`, `brief.md` (first lines), `report.md` - the hybrid decision, the reserve, the lanes
  design
- `layout-elk.js`, `shared.js` - the layout interface, ELK options, lifting and merging, metrics
- `model.js` (first lines) - the shape of the prototype model

Look prototype (`/Users/briztonfloyd/Desktop/firstmate/data/ilo-own-look/`):

- `decisions.md`, `brief.md` (first lines), `report.md` - the Contour decision and its findings
- `contour.html`, `contour.css`, `aerie-base.css` - Contour tokens, metrics and motion timings
- `aerie-core.js` - sizing with the reserve, ELK options, trail geometry, selection and dimming, side
  panel, scenario playback, URL state
- `aerie-model.js` (first lines and a search for views and scenarios), `aerie-icons.js` (first lines),
  `LICENSES.md` - the prototype model, icon names and font licences
- `harness/check.cjs` (first lines) - how the audience-switch and overflow checks were measured
- `screenshots/contour-04-select-website.png`, `screenshots/contour-10-scenario-step-09.png` - the
  look of selection and of the trail

Product-neutral firstmate tooling:

- `/Users/briztonfloyd/Desktop/firstmate/bin/fm-ensure-agents-md.sh` - read, then run on this
  worktree (it reported AGENTS.md unchanged)

Directory listings only (names, not contents): the three prototype folders, their `tools/`,
`harness/`, `fonts/` and `screenshots/` folders, and `ilo-own-map/tickets/`. Not opened: the
other prototype files (candidates A and C, `compare.html`, `layout-own.js`, `metrics.json`, the HTML
pages, vendored code), and the reports the tickets cite outside the allowed inputs (the audit, legal,
landscape and name reports).

## URLs

None. Contrast ratios in `docs/spec/look.md` were computed locally from the token values with the
standard WCAG formula.

## Notes

- The layout prototype's report discloses that its author saw a one-line summary of the earlier
  prototype's renderer. The transition rule in `docs/spec/layout.md` (LAYOUT-402) follows the clean
  prototypes' own code and the interaction ticket ("calm short glide for persisting elements, fade for
  new"), not that summary.

## Forbidden sources opened

None.
