# Glossary

Aerie's own vocabulary. Use these words in code, docs, tests, error messages and the UI.

**Model**: The one description of a system. Every view is drawn from it; nothing is described twice.

**Element**: Anything that exists in the system: a service, a data store, an app, a person, an outside system.
Elements nest inside other elements.

**Relationship**: A one-way connection from one element to another that reads as a plain sentence: element, verb
phrase, element (for example "Checkout charges the card through Payments").

**View**: One purposeful way of showing the model, such as Big picture, Services or Engineering.

**Scenario**: How something happens, told as ordered steps between elements.

**Walkthrough**: A narrated run through views and scenarios, for presenting to a room.

**Zoom**: How far into nesting a reader sees (system, then service, then module). Zoom changes depth, never
wording.

**Audience level**: Who the wording is written for (by default exec, manager, engineer). Audience level changes
wording, never depth.

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

**Trail**: A scenario drawn on the architecture as a red line with numbered steps.

**Lanes**: A scenario laid out with one column per element and one row per step.

**Presenter mode**: A walkthrough shown full screen, one step at a time, for a room.

**Reserve**: Space set aside for the longest wording of every audience level, so switching audience moves nothing.

## Words to avoid

- "resource", "perspective" and "sequence": another product's terms. Say element, view and scenario.
- "detail level" for audience level: it blurs the line between wording and depth.
