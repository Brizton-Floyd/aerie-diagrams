# 0001 Clean room: no Ilograph material, ever

Status: accepted, 2026-10-22

## Decision

Aerie is rebuilt from scratch in this fresh repository. Nothing in it comes from Ilograph or from the
earlier private prototype that borrowed from it: no code, no wording, no file format, no visual
calibration, no screenshots, no URL scheme. Ilograph is not used as a measurement reference either.

## Why

Ideas and methods are free to use; their expression is not. The earlier prototype ported code and
copied wording and visuals, so its history cannot ship. A clean room, where builders work only from
our own written decisions, keeps every line here traceable to us. Aerie may be published or sold.

## Consequences

- Builders follow the clean-room rules and keep read logs (see [AGENTS.md](../../AGENTS.md)).
- Tests compare Aerie only with Aerie: own goldens, own screenshots, own rule checks.
- The old prototype and its captures stay in a private archive; nothing moves across.
- An optional importer for Ilograph-style files may come after v1, as a separate module built from
  the public list of keys only.
- An IP lawyer reviews the product before any public release.
