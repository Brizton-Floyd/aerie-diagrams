# Slice plan

v1 is built in sequenced slices. Each slice is one task, done by a fresh builder under the clean-room
rules in [AGENTS.md](../AGENTS.md). Dependencies are in brackets.

| Slice | What                                                                                                           | Needs        |
| ----- | -------------------------------------------------------------------------------------------------------------- | ------------ |
| A0    | Repository bootstrap: toolchain, `npm run check`, CI, clean-room rules, read logs, licence                     | -            |
| A1    | Aerie functional spec and glossary, written from the decisions only                                            | A0           |
| A2    | Lines language: grammar, parser to the canonical JSON model, error catalogue, formatter, spec examples         | A1           |
| A3    | Model semantics: containment, relationship lifting, audience resolution and defaults                           | A2           |
| A4    | Layout interface, unmodified ELK structure layout, audience space reserve, layout rule checks                  | A3           |
| A5    | Contour renderer: shapes, bands, type, own icons, relationship sentences; own goldens and screenshots          | A4           |
| A6    | Interactions: select with side panel, highlight and dim, open in place, audience switch, glide, reduced motion | A5           |
| A7    | Navigation sidebar and full-state shared links                                                                 | A6           |
| A8    | Scenarios on the architecture: lanes layout, red trail, step list, play and step                               | A6           |
| A9    | Presenter-mode walkthroughs                                                                                    | A7, A8       |
| A10   | Live split editor and watch mode with plain-word errors                                                        | A2, A6       |
| A12   | Aerie skill for Claude: teaches Lines, reads a project, writes the `.aerie` file, runs the checker until clean | A3           |
| A11   | Lotto sample in Lines (drafted with the A12 skill), browser journeys, readability baseline, v1 tag             | A9, A10, A12 |

After v1, not before: an optional importer for Ilograph-style files (separate module, public key list
only), checking a model against code, change over time, embedding and export, a distribution
decision, then a lawyer review and public release.

Drift detection (checking a model against the code, [decision 0006](decisions/0006-drift-detection.md))
is built after v1 in slices D1 to D8, planned in [spec/drift.md](spec/drift.md#11-slices).
