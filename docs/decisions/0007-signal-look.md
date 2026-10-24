# 0007 Signal: the visual identity, and plain wording first

Status: accepted, 2026-10-24. Supersedes [0005](0005-contour-look.md) (Contour), and changes how
[0002](0002-audience-levels.md) shows audience levels to a reader.

## Decision

Aerie looks like **Signal**: an instrument panel at night.

- Dark by default: hairline cards on a near-black stage with a blue cast, glass controls over it, and
  light only for what the reader is doing (violet for the selection and the trail, a cyan "live" light
  for the current step and the lines in play).
- A light theme, the same panel in daylight, for bright rooms, projectors and print. The reader
  switches with the theme button and the choice is remembered on that device; dark stays the default.
- Type: Inter for names, wording and the interface; JetBrains Mono for the code voice and metadata.
  Wording stays at 13.5 px or larger before any fit-to-screen scaling.
- Motion is quick and settles long (520 ms, an exponential ease-out), with a reduced-motion
  alternative.

Readers meet audience levels **plain first, more on demand**. There is no "Written for" switch in the
top bar. Everyone starts with the first declared audience's wording; the side panel's "More technical"
uncovers each deeper wording in turn (remembered for the browser tab's session), a hover card shows
them at a glance, and "Word the whole diagram for Engineer" with a "Back to plain wording" chip words
the whole picture. Links and presenter mode still carry a level. Readers see "tour" for a
walkthrough; "walkthrough" stays the word in the language and the docs.

## Why

The owner reviewed Contour, and an elevated Contour, and found them "too old-fashioned, paper-like";
Signal was chosen from three fresh prototyped directions as the one that feels like modern software.
Presenting in bright rooms is a core Aerie job, so the dark look gained a light theme rather than
staying dark only. The "Written for" switch asked every reader to classify themselves before reading;
plain first lets each reader go as deep as they want without choosing up front.

## Consequences

- Inter is wider than Source Sans, so the largest Lotto pictures fit at a slightly smaller scale
  (0.461 to 0.457 at most). The readability baseline was re-recorded on purpose for this change;
  crossings and bends are no worse.
- Audience levels stay the headline of 0002: the reserve, "switching moves nothing" and per-audience
  wording are unchanged. Only the control a reader uses changed.
- The `(default)` flag of an audience is now only the voice of unmarked wording; the viewer starts at
  the first audience listed (LANG-104, INT-101).
