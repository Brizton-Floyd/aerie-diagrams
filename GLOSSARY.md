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

## Words to avoid

- "resource", "perspective" and "sequence": another product's terms. Say element, view and scenario.
- "detail level" for audience level: it blurs the line between wording and depth.
