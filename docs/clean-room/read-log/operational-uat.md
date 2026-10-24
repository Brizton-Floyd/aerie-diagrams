# Operational UI acceptance test: read log

Task: Explore the merged UI for reproducible operational defects and usability friction.
Builder: Codex
Date: 2026-10-24
Tested source: main commit 60101fa; draft PR 85 is outside this baseline.

## Files

- `/Users/briztonfloyd/.agents/skills/diagnosing-bugs/SKILL.md` - repeatable reproduction and evidence discipline; this task reports findings without implementing fixes.
- `/Users/briztonfloyd/.agents/skills/code-review/SKILL.md` - severity and evidence guidance.
- `/tmp/aerie-uat-baseline.log` - this repository's existing browser journey baseline.
- `/tmp/aerie-uat-watch.log` - watch-mode rerun after removing the conflicting color environment variable.

## URLs

- http://127.0.0.1:4398/ - this repository's main-branch UI under test.
- http://127.0.0.1:4398/?model=samples/aerie.aerie - authored main-flow exploration.
- http://127.0.0.1:4398/?model=samples/lotto.aerie - complex exploration, editing and playback.
- http://127.0.0.1:4398/?model=samples/shapes.aerie - model switching and browser Back.
- http://127.0.0.1:4398/?model=missing-model.aerie - unknown-model recovery probe.
- http://127.0.0.1:4398/?model=samples/aerie.aerie#view=missing&flow=full-flow.99 - stale picture-link recovery probe.
- http://localhost:4398/ - clean-origin recipient simulation for a copied local-file link.
- http://localhost:4398/?model=samples/lotto.aerie - presentation, draft recovery and minimized structural-edit testing on separate origin storage.

## Evidence and cleanup

Screenshots, two parser-checked reproduction inputs, DOM observations and the report are under
`docs/uat/2026-10-24-operational/`. Browser viewport overrides were reset and temporary editor
drafts discarded through the UI. No application code was changed.

## Forbidden sources opened

None.
