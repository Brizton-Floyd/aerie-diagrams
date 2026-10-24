# Safe model sharing: read log

Task: Fix issue 87, where local and edited model links can open another model for a recipient.
Builder: Codex
Date: 2026-10-24

## Files

- `/Users/briztonfloyd/.agents/skills/diagnosing-bugs/SKILL.md` - regression-first repair workflow.
- `/Users/briztonfloyd/.agents/skills/gh-axi/SKILL.md` - issue and review workflow.
- `/tmp/aerie-sharing-browser.log` - this repository's sharing regression output.
- `/tmp/aerie-sharing-linux.log` - this repository's first full Linux gate output.
- `/tmp/aerie-sharing-linux-final.log` - full Linux gate after the final visual adjustment.
- `/tmp/aerie-sharing-dialog.png` - screenshot of this repository's local sharing UI.

- `/tmp/aerie-sharing-baselines/sharing.spec.ts/local-model-share-light.png` - Linux screenshot review of the light dialog.

## URLs

- https://github.com/Brizton-Floyd/aerie-diagrams/issues/87 - tracked defect and acceptance criteria.
- http://localhost:4487/?model=samples/aerie.aerie - production preview used by sharing journeys.
- http://127.0.0.1:4398/?model=samples/aerie.aerie - local visual verification.

## Forbidden sources opened

None.
