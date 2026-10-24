# Glossary

Aerie's own vocabulary. Use these words in code, docs, tests, error messages and the UI.

**Model**: The one description of a system. Every view is drawn from it; nothing is described twice.

**Element**: Anything that exists in the system: a service, a data store, an app, a person, an outside system.
Elements nest inside other elements.

**Relationship**: A one-way connection from one element to another that reads as a plain sentence: element, verb
phrase, element (for example "Checkout charges the card through Payments").

**View**: One purposeful way of showing the model, such as Big picture, Services or Engineering.

**Scenario**: How something happens, told as ordered steps between elements.

**Walkthrough**: A narrated run through views and scenarios, for presenting to a room. Readers see it called a
**tour** ("Take the tour", "Tours"); the language and the docs say walkthrough.

**Zoom**: How far into nesting a reader sees (system, then service, then module). Zoom changes depth, never
wording.

**Audience level**: Who the wording is written for (by default exec, manager, engineer). Audience level changes
wording, never depth.

**Plain wording**: The first audience level a model declares, which every reader starts with.

**More technical**: The side panel's control that uncovers the next audience level's wording of an element, one
layer at a time. Avoid "go deeper" for it: depth is zoom.

**Lines**: Aerie's text language. A model is written in a `.aerie` file.

**Canonical model**: The JSON form every Lines file parses to. Tools and the renderer read it, never Lines itself.

**Tag**: A word in brackets after an element, such as `[service]`. Views select elements by tag.

**Kind**: What sort of connection a relationship is: `runtime` unless marked, `code` for build-time dependencies.
Each view draws the kinds it chooses.

**Open, closed**: A container drawn with its children inside it, or as one box. Opening and closing in place is how a
reader zooms.

**Lifting**: Drawing a relationship between the nearest elements a reader can see when its own ends are inside a
closed box.

**Picture**: Everything that decides what a reader sees: the view, the audience level, what is open, the selection, and
any scenario or walkthrough step. A shared link carries the picture.

**Camera**: Magnifying and moving the picture on screen. The camera is not zoom: it changes size, never depth.

**Visit**: A picture the reader went to, with the camera where they left it. Back and Forward move between visits,
and the list of recent visits names the latest ones.

**Trail**: A scenario drawn on the architecture as a lit line with numbered steps.

**Flow overview**: A complete, static scenario trail. Selecting a number explains that step without
starting playback.

**Lanes**: A scenario laid out with one column per element and one row per step.

**Presenter mode**: A walkthrough shown full screen, one step at a time, for a room.

**Reserve**: Space set aside for the longest wording of every audience level, so switching audience moves nothing.

**Drift**: A difference between a model and the code it describes. `aerie drift` reports it, with a suggested Lines
edit.

**Code unit**: One piece of code an element stands for, written `kind:name`: a Compose service (`compose:bff`), a
Maven module, an npm package or a class.

**Code line**: The `code` line under an element that lists its code units. It never changes what a reader sees.

**System root**: The `system` block that names the repos and Compose files that form the system.

**Ignore line**: `ignore drift <subject> - <reason>`: a difference between the model and the code that is meant.

**Fact**: Something the extractor found in the code, such as a Compose service or one service naming another, with
its evidence and technique.

**Evidence**: Where a fact was found: a line of a file, written `repo/path:line`.

**Technique**: The way a fact was found, such as "Compose environment URL". Drift counts how many agree.

**Finding**: One difference drift reports, with its level, its evidence and a suggested Lines edit.

**Level**: How sure a finding is: drift (several techniques agree, or an exact check fails), likely (one technique), or
not checked (the code cannot show it).

**Suggestion**: A code line drift proposes from a name match or a pairing. It never fails anything.

## Words to avoid

- "resource", "perspective" and "sequence": another product's terms. Say element, view and scenario.
- "detail level" for audience level: it blurs the line between wording and depth.
