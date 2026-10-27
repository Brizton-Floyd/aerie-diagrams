# Reader tools and portable publishing

Post-v1 behavior accepted in [decision 0009](../decisions/0009-reader-tools.md).
Terms retain their meanings in the [glossary](../../GLOSSARY.md).

## Finding and following elements

- **INT-1001** Search matches an element's id, names and taglines for every declared audience,
  tags and authored code units without changing the current audience. Results name the element
  and its containment path in the reader's current wording.
- **INT-1002** Find element opens a keyboard-accessible dialog. Ctrl+K or Command+K opens it,
  arrows move through results, Enter chooses one, and Escape closes it and restores focus.
  Empty queries and queries with no matches have understandable states. Typing is isolated from
  the viewer's scenario, audience and camera shortcuts.
- **INT-1003** Choosing a result reveals and selects the exact element, using the current view
  when it can hold it or another eligible view otherwise. It ends playback as needed and records
  the resulting picture through normal link and visit history. Opening or revising a model does
  not leave stale results that can select an element from a previous model.
- **INT-1011** Following an element into an eligible target view preserves its audience and exact
  identity, opens the necessary ancestors, and selects it. Ineligible targets do not silently
  substitute a different element. Ordinary view switching retains its existing default behavior.
- **INT-1012** A selected element's details offer its other eligible views. Following one moves
  the camera to the selected element and creates a visit and a shared picture fragment. Back,
  Forward and reopening that fragment recover the picture.

## Portable HTML

- **INT-1021** Export HTML captures the complete current valid Lines source, a normalized opening
  picture and the current theme. All model views, audiences, elements, scenarios and walkthroughs
  remain available. The file is a snapshot, not a connection to its source repository.
- **INT-1022** The exported HTML works when moved to another folder and opened as a local file
  with the network disabled. Fonts, styles, application code and the layout worker are embedded.
  Readers can search, follow across views, change audience, open containers, use scenarios and
  tours, and navigate visits without loading remote assets. Editing and choosing other models
  are absent from the portable reader.
- **INT-1023** Export HTML explains that it includes the whole model and all audience wording.
  Invalid source, including a pending invalid edit, produces plain-word advice and no download.
  Build/runtime-load failures restore the export control so an author can retry.
- **INT-1024** Model content and titles cannot terminate an HTML script or inject executable
  markup into an export. The model is embedded as escaped JSON data and rendered as text or safe
  documentation. No relative build-asset URL is needed to open the file.

## Documentation beside the picture

- **INT-1031** Existing descriptions support paragraphs, bold, emphasis, inline code, links,
  headings, ordered and unordered lists, and fenced code blocks. Audience-specific descriptions
  keep their existing replacement and addition behavior. Existing plain descriptions render as
  before, and no Lines grammar or canonical model change is required.
- **INT-1032** Documentation renders through DOM nodes without executing authored HTML. Links
  permit safe web, email and relative destinations and reject executable or embedded-data
  schemes. External links isolate the opener. Code blocks remain literal text.
- **INT-1033** The same details panel contains the authored documentation and an element's code
  references when present. Ownership, runbook and decision links can be authored in descriptions.
  Code references are model declarations, not a claim of a successful drift check.

## Acceptance

Unit tests cover search/follow semantics, export escaping and the bounded documentation renderer.
Browser journeys cover the Lotto search and follow flow, opening downloaded HTML offline, and rich
documentation in a selected element. Existing rule and golden suites retain the same geometry;
page-chrome screenshot changes are reviewed and recorded on Linux.
