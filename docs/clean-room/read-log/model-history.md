# Model history: read log

Task: Fix issue 88 so deliberate model switches retain the previous picture and camera.
Builder: Codex
Date: 2026-10-24

## Files

- `/Users/briztonfloyd/.agents/skills/diagnosing-bugs/SKILL.md` - regression-first diagnosis.
- `/Users/briztonfloyd/.agents/skills/gh-axi/SKILL.md` - inherited GitHub issue workflow.
- `/tmp/aerie-model-history-red.log` - browser regression showing the missing history entry.
- `/tmp/aerie-model-history-green.log` - targeted model-history verification output.

- `/tmp/aerie-model-history-local-red.log` - local-file Back regression before source retention.

- `/tmp/aerie-model-history-editor-red.log` - same-name draft replacing restored editor source.
- `/tmp/aerie-model-history-pending-red.log` - old editor remaining open after cross-model Back.

- `/tmp/aerie-model-history-repeat-red.log` - repeated invalid-draft return losing its last good diagram.

## URLs

- https://github.com/Brizton-Floyd/aerie-diagrams/issues/88 - defect and acceptance criteria.
- http://localhost:4488/?model=samples/aerie.aerie - repository production preview used by the regression.

## Forbidden sources opened

None.
