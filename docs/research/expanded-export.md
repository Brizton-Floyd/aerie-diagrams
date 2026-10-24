# Expanded diagram export: compatibility findings and visual exploration

Date: 2026-10-24. Planning evidence, not a shipped exporter or a Confluence integration test.

Map: [Export expanded diagrams with audience wording and flow explanations](https://github.com/Brizton-Floyd/aerie-diagrams/issues/102).
Research: [Establish portable export formats for Confluence pages](https://github.com/Brizton-Floyd/aerie-diagrams/issues/103).
Prototype: [Readable expanded diagrams with complete flow explanations](https://github.com/Brizton-Floyd/aerie-diagrams/issues/105).

## Question and result

Which formats provide a documented path to placing a complete diagram in Confluence, and what
needs deciding before implementation? A PNG is the strongest first candidate for a static inline
image. PDF is a useful document alternative. SVG and interactive HTML should not be promised as
portable inline imports without testing the target environment. This is a research recommendation;
the user has requested visual comparisons before choosing scope or interactivity.

## Platform evidence

Sources below were accessed on 2026-10-24. Cloud is a rolling service; the current Data Center
pages identify version 11.0. The user's actual edition and configuration are unknown.

- Cloud documents PNG among supported image formats and PDF among document files. Its media
  workflow supports uploading and placing files in a page. This supports the PNG recommendation,
  but does not establish that every attached format renders as an inline image.
  [Cloud media formats](https://support.atlassian.com/confluence-cloud/docs/work-with-images-videos-and-files/).
- Cloud distinguishes images from general file tiles and previews, supports image dimensions,
  captions and alt text, and requires Add Attachments permission. An image attachment can carry
  our whole composed diagram and explanation key; the explanation key must be rendered into the
  artifact if it is to survive a single-image upload.
  [Cloud display behavior](https://support.atlassian.com/confluence-cloud/docs/display-files-and-images/).
- Attachment size is administrator-configured; the documented default is 100 MB. That is not a
  useful image-size target. Cloud also notes that source-file changes do not update attachments.
  Manual export means a snapshot unless a separate update workflow is added.
  [Cloud upload constraints](https://support.atlassian.com/confluence-cloud/docs/upload-a-file/).
- Data Center documents image insertion, PNG preview and full-size/zoom viewing. It lists image
  display-width controls from 16 to 900 px. Large exports therefore need a page-size readability
  review rather than relying only on high pixel resolution. PDF attachments have a preview path.
  [Data Center file display](https://confluence.atlassian.com/doc/display-files-and-images-245827130.html).
- Data Center's PDF macro shows a document in a viewer with next/back controls and cannot be resized
  on the page. PDF is a document experience, not automatically the same as an inline diagram image.
  [PDF macro](https://confluence.atlassian.com/doc/pdf-macro-375849180.html).
- Cloud has an iframe macro for embedding a web page. Frame restrictions can prevent a site from
  appearing. This supplies a possible interactive route if a reachable viewer is provided; it does
  not establish that attaching a standalone HTML file creates an interactive diagram in a page.
  Hosting, reader access and target configuration remain separate work.
  [Cloud iframe macro](https://support.atlassian.com/confluence-cloud/docs/insert-the-iframe-macro/).

SVG is absent from the cited Cloud supported-image list and Data Center preview list. Absence is
not proof of universal rejection: SVG attachment, preview and rendering behavior remain unverified
for the target instance. Aerie already renders SVG, so preserving a vector option may be valuable,
but it needs its own acceptance check for embedded styling, fonts and media handling.

No Confluence account was connected or altered. No import, iframe, PDF conversion or production
export was exercised. These findings are sufficient to compare format choices; actual import
acceptance belongs to the final release decision.

## Aerie facts and seams

- [The glossary](../../GLOSSARY.md) separates audience wording from nesting depth. A plain export
  can be fully expanded. Custom audiences and existing fallback wording must remain meaningful.
- [ViewScope.everythingOpen](../../src/model/views.ts) already provides an all-open state within a
  view's selected roots. This does not mean adding every other named view or changing relationship
  kinds. Expanding may expose children omitted by the default depth.
- [The flow panel](../../src/app/flow.ts) holds stage sentences and descriptions outside the SVG.
  [Semantics](../../src/model/semantics.ts) resolves these for an audience. Copying the drawing alone
  would omit explanation text. Whether detailed steps and element descriptions are also included
  remains a content decision.
- [The renderer](../../src/render/picture.ts) supports standalone SVG styling; the browser supplies
  bundled fonts through [the entry point](../../src/main.ts). A final export needs explicit font,
  theme, animation and full-bound handling. A PNG requires a rasterization path; PDF needs its own
  document conversion. Neither is delivered by this prototype.
- Existing sharing downloads the model file; image/document exporting remains outside the original
  v1 scope. The first feature needs new specification and acceptance coverage when implemented.

## Visual exploration, awaiting user feedback

Run `npm run dev -- --host 127.0.0.1 --port 4406 --strictPort`, then open
`http://127.0.0.1:4406/?export-prototype&variant=A`. This is a development-only branch of the existing
viewer route, using the real renderer and the repository's [Aerie sample](../../samples/aerie.aerie).
It never loads the Lotto model as its prototype subject.

- A compares current-view coverage with a multi-view document. Both recursively open every
  container. The sample's two fully expanded views have the same elements, deliberately exposing
  the possibility of duplicate content in a whole-model document.
- B composes an expanded diagram and every authored overview-stage explanation inside one export
  boundary. This is one candidate for retaining writing, not agreement that a numbered key satisfies
  every inline-annotation requirement.
- C keeps the diagram expanded but lets the reader choose one flow stage and its explanation.
  Its controls demonstrate interaction locally; they do not provide Confluence hosting or access.
- Plain and Technical switch actual authored wording. The sample only supplies some technical
  overrides, so unchanged wording correctly uses the existing fallback. This prototype does not
  generate new technical explanations.

Chromium smoke checks exercised all variants, selected stage 3, and switched its title from
"Build the picture" to "Lay out and render SVG". Screenshots were visually reviewed. No unit tests
were added for throwaway UI, and no complete production release gate is claimed.

The later user feedback below settles single-view static output and the starting composition.
Precise flow/explanation coverage, release format, controls, large-diagram behavior and real import
acceptance remain open on the content and release decision tickets. Work summary:
GPT-6.1 Sol with inherited runtime effort, inline research and prototype; no delegated workers or
model change. The branch and these assets are disposable planning evidence, not for merging.

## User feedback: starting export direction

The user selected a static export of the current view, fully expanded, with all flow explanations
included and a choice of plain or technical wording. The static diagram-plus-explanation composition
is the starting design. Whole-model documents and interactive embeds are outside this first release.
The export heading and footer no longer add the application name. The user clarified that this removes Aerie branding only; authored system and component names
inside the diagram must remain. Chromium checks confirmed unbranded export headings and footers,
Plain/Technical switching and all four stage explanations. This feedback does not
certify the exporter, decide large-model limits or establish real Confluence import acceptance.

## Component-reference visual example, awaiting a decision

The user subsequently confirmed one selected scenario per export and both overview stages and
all detailed steps. They requested a visual example before deciding whether full component
reference material should be optional. No reference-section decision is inferred from that request.

Variant D at `http://127.0.0.1:4406/?export-prototype&variant=D&audience=engineer` adds:

1. The expanded architecture and stage overview.
2. All eight actual scenario steps grouped under their four authored stages, preserving the stage
   and detailed-step numbering distinction.
3. An optional component reference with every drawn element, grouped into its parent context,
   showing descriptions, children and direct incoming/outgoing relationships.

The reference checkbox is independent of Plain/Technical wording. Chromium checks confirmed
11 reference entries and eight detailed steps in both wording choices. Turning off the reference
removes those entries while preserving all eight steps. The preview has no horizontal overflow
at 1440 px. Typecheck, text and Markdown-link checks pass. This is not a production export gate.

Diagram/flow wording and base descriptions come from the Aerie sample. Two extra technical
paragraphs are authored for this prototype from the repository's module boundaries and layout
behavior. The rationale example paraphrases the accepted
[audience-level decision](../decisions/0002-audience-levels.md). This source distinction is disclosed
above the document preview. It demonstrates possible documentation structure, not automatic
extraction or invention of responsibilities or decision rationale. The eventual content source
for such additional notes remains part of the open content decision.

Visual assets: [component reference](export-prototype/component-reference.png),
[architecture rationale](export-prototype/architecture-rationale.png) and
[scenario detail](export-prototype/scenario-detail.png). No product exporter or schema was added.
