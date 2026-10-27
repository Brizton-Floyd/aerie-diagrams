# Aerie functional specification: overview

**One model. Every audience.**

Aerie is diagram-as-code for architecture. An engineer describes a system once, in a plain text file
written in the Lines language. Every reader then explores it as an interactive diagram at their own
level: the same model reads differently for an executive, a manager and an engineer, and opens deeper
in place when someone wants more detail.

This specification says what Aerie v1 does and how it behaves, precisely enough to build and test it
without having seen any other diagram tool. It was written in slice A1 from Aerie's own decisions
([docs/decisions/](../decisions/README.md)) and prototypes, under the clean-room rules in
[AGENTS.md](../../AGENTS.md#clean-room-rules-mandatory).

## Purpose

The core job is that a reader understands **how the system works, at their level**: what the parts
are, how they connect and how things flow through them, at the depth and in the wording that suits
them. Two separate controls serve this:

- **Zoom** changes depth: how far into nesting the reader sees (system, then service, then module).
  The reader opens and closes parts in place.
- **Audience level** changes wording, never depth: the same boxes and lines, reworded for the reader.
  Every reader starts with the plainest wording and uncovers the more technical wording on demand;
  changing the wording moves nothing on screen.

The vocabulary (model, element, relationship, view, scenario, walkthrough, zoom, audience level, and
the words to avoid) is in [GLOSSARY.md](../../GLOSSARY.md) and is binding in code, tests and the
interface.

## Who it is for

- **Readers**: executives, managers and engineers, often in the same room, each reading the one shared
  picture at their own level. Authors may declare their own audiences instead of these three.
- **Authors**: engineers, who write the model as text and review it in pull requests like code. Claude
  can draft the model from a codebase with the Aerie skill.
- **Users**: teams explaining their systems to mixed rooms, solo developers, and consultants and
  agencies explaining systems to clients.

The tone everywhere is plain English first, with technical detail one step away.

## What v1 does

- **SCOPE-001** The Lines language with its parser, canonical JSON model, plain-English error
  catalogue, formatter and command-line checker ([language.md](language.md)).
- **SCOPE-002** Model semantics: nesting, relationships declared once and lifted to whatever is
  visible, audience resolution and view resolution ([model.md](model.md)).
- **SCOPE-003** Structure views laid out by ELK behind Aerie's own layout interface, with space
  reserved for every audience, and rule checks on every view and audience ([layout.md](layout.md)).
- **SCOPE-004** The Signal look, dark by default with a light theme, with Aerie's own icons
  ([look.md](look.md)).
- **SCOPE-005** Reading: plain wording first with "More technical" on demand, select with the side panel, open and close in place, the
  camera, the navigation sidebar, and shared links that reopen the exact picture
  ([interaction.md](interaction.md)).
- **SCOPE-006** Scenarios played on the architecture as a lit trail, or shown as lanes, with a step
  list, play and step ([interaction.md](interaction.md#scenario-playback)).
- **SCOPE-007** Presenter-mode walkthroughs ([interaction.md](interaction.md#presenter-mode-walkthroughs)).
- **SCOPE-008** The live split editor and watch mode, with plain-word errors
  ([interaction.md](interaction.md#the-live-split-editor)).
- **SCOPE-009** The Aerie skill for Claude ([claude-skill.md](claude-skill.md)).
- **SCOPE-010** The Lotto sample, browser journeys over all of the above, and a readability baseline
  ([acceptance.md](acceptance.md)).

## What v1 does not do

These are out of scope for v1. Some are planned for later versions; none may be added to v1 without a
new decision.

- A visual editor or drag-to-arrange. Layout is always automatic.
- An importer from other diagram formats. An optional importer, as a separate module that maps onto
  the canonical model, may come after v1.
- Checking a model against the code or infrastructure it describes, and showing change over time.
  Checking against the code comes after v1 ([decision 0006](../decisions/0006-drift-detection.md),
  [drift.md](drift.md)).
- Embedding an interactive diagram in other pages. Static PNG/PDF exporting is a post-v1 addition
  specified in [export.md](export.md).
- Search, comments, accounts, hosting and real-time collaboration.
- Models split across several files.
- Layouts for phones and narrow windows (v1 is designed for windows from 1280 x 720 up).
- A colour per service, or any author choice of colours.

## Post-v1 additions

The exclusions above describe the original v1 scope. Static PNG/PDF document export expands the
current view and includes authored scenario explanations and an optional component reference,
as specified in [export.md](export.md).

[Decision 0009](../decisions/0009-reader-tools.md) adds element search, explicit following of a
selection across views, portable interactive HTML export, and richer documentation in the
existing details panel. Their requirements are in [reader-tools.md](reader-tools.md). Portable
HTML contains a complete model snapshot with an offline reader, opening at the captured picture.
Accounts, hosting, and real-time collaboration remain outside this addition. Ordinary view
changes retain their original default behavior.

## Reading this spec

| Document                           | What it covers                                                             | Ids                              |
| ---------------------------------- | -------------------------------------------------------------------------- | -------------------------------- |
| [overview.md](overview.md)         | purpose, audiences, scope, conventions, choices this spec makes            | `SCOPE`                          |
| [language.md](language.md)         | the Lines language, canonical model, errors, formatter, command line       | `LANG`, `E`/`W` diagnostic codes |
| [model.md](model.md)               | containment, audience resolution, views, lifting, scenarios, walkthroughs  | `MODEL`                          |
| [layout.md](layout.md)             | the layout interface, ELK, the reserve, opening in place, trail, lanes     | `LAYOUT`, `RULE`, `SCORE`        |
| [look.md](look.md)                 | Signal tokens, type, shapes, icons, the trail, motion                      | `LOOK`                           |
| [interaction.md](interaction.md)   | everything a reader and an author do                                       | `INT`                            |
| [reader-tools.md](reader-tools.md) | post-v1 search, following, offline HTML publishing, and safe documentation | `INT`                            |
| [acceptance.md](acceptance.md)     | test suites per slice, and the browser journeys                            | `ACC`, `JOURNEY`                 |
| [claude-skill.md](claude-skill.md) | the Aerie skill for Claude                                                 | `SKILL`                          |
| [export.md](export.md)             | static PNG/PDF documents and preview                                       | `EXPORT`                         |
| [drift.md](drift.md)               | drift detection: checking a model against the code (after v1)              | `DRIFT`                          |

- **Requirements** are the numbered statements, written in bold as `PREFIX-nnn` at the start of a
  list item. Each states one testable behaviour in the present tense ("is", "shows", "never moves").
  Prose around them explains; examples illustrate and are tested too, but the numbered statement
  decides.
- **Ids are permanent.** A requirement keeps its id when its text changes. A removed requirement's id
  is retired, never reused, and new requirements take new ids in the gaps or at the end of their
  section. Tests cite ids in their titles ([acceptance.md](acceptance.md#rules-for-every-slice)).
- **The docs check** (`npm run lint`) fails on a broken link between documents, a requirement id
  defined twice, or a cited id that is not defined. **The coverage check** (`npm run lint` too) fails
  on a requirement no test title cites (ACC-101).
- **Changing the spec** is a pull request like any other. A change that contradicts a settled decision
  needs a new decision record first.

## Choices this spec makes

The decisions settled the direction; writing the spec needed further choices. They are listed here so
they can be reviewed, and each can be changed by a pull request to this spec.

- **Lines details**: the `.aerie` extension; the `icon` line; the `(code)` audience flag, which puts an
  audience's wording in the monospace face (the decisions name the engineer audience; with
  author-declared audiences the author marks which ones); at most six audiences; walkthrough steps
  that `open`, `close` and switch audience with `for`; replies recognised from the model rather than
  marked in the file; relationships only at the top level.
- **The canonical model** is a faithful transcription of the file; meaning (lifting, replies, default
  icons) is computed from it, not stored in it.
- **Lifting merges** several relationships between the same two visible elements into one line with
  "(+N more)", and the side panel lists each one with its own ends.
- **Views can open a container partly** (a tag selector shows only the matching children), and the
  zoom state records the reader's changes as per-container open or closed marks.
- **Scenarios** play on a stage view (the current view when it can hold every participant) and can be
  shown "On the diagram" as a trail or "As lanes".
- **Layout** runs top down with people and outside systems on the top rank, and measures text from the
  bundled font files so layouts are identical everywhere.
- **The camera** has a fit mode and a free mode; shared links open fitted.
- **Signal tokens** name each colour by its role in both themes, so every text colour passes 4.5 to 1
  and every needed line 3 to 1 in each; the page mixes tokens for hairlines, glass and light rather
  than writing colours of its own; edge labels are 13.5 px to honour the 13.5 px floor.
- **Plain first** starts every reader at the first declared audience; the depth of "More technical"
  lasts for the browser tab's session, not on the device, and never changes the diagram's wording on
  its own.
- **Shared links** put the picture in the address fragment with keys `view`, `aud`, `open`, `closed`,
  `sel`, `play`, `lanes` and `present`; theme, reduced motion and camera are not shared.
- **The editor** works on a copy kept on the reader's device; watch mode serves on `127.0.0.1:4310`
  and leaves editing to the author's own editor.
- **Screenshots** hide text glyphs so baselines match on every platform; text is covered by goldens
  and rule checks.

## How the decisions map to this spec

| Decision                                                         | Where it is specified                                                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [0001 Clean room](../decisions/0001-clean-room.md)               | this spec's sources; [acceptance.md](acceptance.md) (Aerie compared only with Aerie)                                                             |
| [0002 Audience levels](../decisions/0002-audience-levels.md)     | LANG-101 to LANG-106, section 6 of [language.md](language.md); MODEL-101 to MODEL-106; LAYOUT-201 to LAYOUT-205; RULE-005; INT-101 to INT-106    |
| [0003 Lines](../decisions/0003-lines-language.md)                | [language.md](language.md); MODEL-301 to MODEL-306                                                                                               |
| [0004 ELK hybrid layout](../decisions/0004-elk-hybrid-layout.md) | [layout.md](layout.md)                                                                                                                           |
| [0005 Contour](../decisions/0005-contour-look.md)                | superseded by 0007                                                                                                                               |
| [0006 Drift detection](../decisions/0006-drift-detection.md)     | [drift.md](drift.md); LANG-751 to LANG-759 in section 11 of [language.md](language.md); MODEL-006                                                |
| [0007 Signal](../decisions/0007-signal-look.md)                  | [look.md](look.md); INT-101 to INT-106, INT-204, INT-207 and INT-208; LANG-104                                                                   |
| [0009 Reader tools](../decisions/0009-reader-tools.md)           | [reader-tools.md](reader-tools.md), INT-1001 to INT-1003, INT-1011, INT-1012, INT-1021 to INT-1024, INT-1031 to INT-1033; LANG-010 and MODEL-006 |

Static PNG/PDF document export is specified in [export.md](export.md), EXPORT-001 to EXPORT-010.
