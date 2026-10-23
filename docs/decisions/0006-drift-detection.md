# 0006 Drift detection: checking a model against the code

Status: accepted, 2026-10-23

## Decision

After v1, Aerie checks a model against the code it describes: `aerie drift` reports where the
diagram and the project no longer match, with suggested Lines edits, on demand and in CI on every
pull request. Settled with the captain on the drift map (GitHub issue #58) and its tickets #51 to
#57:

- Phase 1 checks missing and extra services, modules and connections; phase 2 (wrong details,
  scenarios against real call paths) comes later.
- The first stacks are Docker Compose, Spring Boot with Maven, and Node with Angular, read
  statically by Aerie's own pure TypeScript extractor on permissive parsers, several techniques per
  stack counted for agreement.
- Models link to code with optional `code` lines under elements and a `system` block that names the
  repos and authoritative Compose files; anything else is matched by name, and an uncertain match is
  only a suggestion.
- Findings have three levels (drift, likely, not checked) and only drift fails CI by default.
  Intentional differences are `ignore drift` lines with a required reason, in the model file.
- One finding model is printed as a terminal report, a patch, JSON (`aerie-drift/1`) and a pull
  request comment. Aerie never writes the model.
- CI runs through a published GitHub Action or a plain CLI step; multi-repo systems are checked from
  the repo that holds the diagram.
- The Aerie skill runs drift until clean, writes code lines and the system root itself, and keeps
  the diagram current in the same change as architecture-changing code.

## Why

A diagram that drifts from the code stops being trusted. Checking it statically, with evidence for
every finding and suggested edits the author applies, keeps the one model honest without taking
authorship away from people.

## Consequences

- The feature is specified in [docs/spec/drift.md](../spec/drift.md) and built in slices D1 to D8.
- Lines gains the keywords `system`, `repo`, `compose`, `code` and `ignore`, so they can no longer be
  ids. These lines never change what a reader sees.
- Kubernetes and Terraform extraction, and editing diagrams automatically, are out of scope.
