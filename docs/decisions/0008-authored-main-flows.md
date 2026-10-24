# 0008 Authored main flows and high-level stages

Status: accepted, 2026-10-24, following the approved Aerie prototype and issue 83.

## Decision

A view may explicitly name its main scenario with `scenario <id>`. It opens as a static numbered
overview. A scenario may group its detailed sentence steps with `step 2-4: Stage title` declarations.
Stages cover all detailed steps exactly once in order, and anchor to the first step of their range.
Stage titles and descriptions support the model's audience wording.

The same scenario remains the source of detailed playback. Following the full flow starts at the
selected stage's first detailed step. No relationship order is interpreted as chronology. Models
without these declarations retain their existing defaults and canonical output.

Clearing a configured main flow is an explicit picture state, written as `flow=none` in a shared
link. Selecting another view restores that view's authored default. Wording stays plain first, with
contextual technical detail and no permanent audience list.

## Why

The owner approved a four-stage Big picture explaining Aerie itself, then asked to implement it.
An author must control which steps constitute a meaningful high-level stage; drawing connections
alone cannot establish a runtime order. Reusing `scenario` and `step` in their owner contexts avoids
reserving new keywords and invalidating existing element ids.

The main flow is opt-in per view so adding this capability does not silently change existing models.
