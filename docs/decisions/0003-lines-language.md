# 0003 Lines: our own line-based diagram language

Status: accepted, 2026-10-22

## Decision

Authors write diagrams in **Lines**, our own line-based text syntax:

- Relationships are literal sentences: subject, verb phrase, object.
- `@level:` and `@level >` lines reword the line above for a given audience.
- Views choose what to show with `+depth` (zoom) or `[tag]` selectors.
- Relationships are declared once, in the model; each view lifts them to whatever containers are
  visible at its zoom.
- Audiences are declared by the author, defaulting to exec, manager and engineer.

Every Lines file parses to a **canonical JSON model**, the format tools and the renderer consume. A
**formatter** prints Lines in one stable style so diffs stay small.

## Why

Engineers author in text that reads like plain English and reviews well in a pull request. A line
syntax keeps relationships readable as sentences and per-audience wording right next to what it
rewords. The JSON model gives tooling a stable interface independent of the surface syntax.

## Consequences

- The grammar, error catalogue (our own plain words, with line and column) and formatter are slice A2.
- Any future importer maps other formats onto the canonical model, never onto Lines directly.
