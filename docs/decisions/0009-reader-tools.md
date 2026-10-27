# 0009 Reader tools and portable publishing

Status: accepted, 2026-10-26

## Decision

Add model-wide element search, an explicit action to follow an element into another view,
portable interactive HTML export, and richer descriptions in the existing details panel.
These are the post-v1 additions requested by the owner. They extend the original v1 scope
in the [overview](../spec/overview.md); the behavior is in [reader-tools](../spec/reader-tools.md).

Search and following use the canonical model and existing picture operations. Ordinary view
navigation still starts at that view's default picture. Following is a separate, explicit
action that preserves the selected identity and audience and reveals its ancestors.

An exported file contains the complete model, its opening picture and theme, and a bundled
reader with fonts and a layout worker. It works from a local file without a network or server.
It includes every audience's wording and every view, including parts not initially visible.
It is a reader snapshot, with no live editor, file picker, account or hosted synchronization.

Descriptions gain a bounded Markdown subset rendered through safe DOM nodes. Authors can
write ownership, runbooks and decisions as headings and links inside existing descriptions.
Existing code lines may be listed in the details panel as authored code references; they still
change no diagram geometry. They do not establish that a model was checked against code.
No viewer status claims verification without actual evidence, and this change adds no such status.

## Why

Readers need to find a part, keep their place while exploring different connections, and open
a shared diagram without installing the authoring tools. Authors need useful explanations beside
the picture without maintaining a separate documentation surface or introducing new Lines syntax.

## Consequences

- The existing Lines grammar and canonical format stay compatible.
- Search, following and exported files use the same viewer, picture links and visit history.
- Portable publishing adds a build entry point; its assets are generated before development or
  production builds. It never loads editor code or fetches layout/font assets at runtime.
- Export refuses invalid source, including an invalid editor change awaiting its normal check.
- Export includes all model content; the UI explains that scope before the author shares it.
- Tests reopen downloaded files offline and compare Aerie only with its own model and pictures.
- Clean-room source restrictions remain unchanged. The implementation uses Aerie's requirements
  and repository, without opening competitor material.
