# Static document export

Post-v1 PNG/PDF export, settled through the [Wayfinder map](https://github.com/Brizton-Floyd/aerie-diagrams/issues/102).
Requirement ids: `EXPORT-nnn`.

- **EXPORT-001** Export the current view with every container recursively open, preserving that
  view's selected roots and relationship kinds. Do not add application branding to visible content,
  filenames or PDF metadata. Preserve authored system and component names. Do not alter the main
  reader's picture, camera, history or editor source when preparing or closing an export.
- **EXPORT-002** Export one selected authored scenario, defaulting to the displayed scenario or the
  view's main flow. Offer Architecture only and other authored scenarios. Scenarios whose actual
  participants are outside the expanded view are unavailable and cannot be silently truncated.
  Preserve the scenario introduction, every stage and every detailed step and description. Stage
  numbers on the diagram and detailed-step numbers in the text remain distinct. Unstaged scenarios
  show numbered steps. A no-flow view and an empty model can export without scenario text.
- **EXPORT-003** The independently optional component reference is initially off. It groups all
  exported elements by their parent, includes full authored descriptions and incoming/outgoing
  relationship sentences and descriptions, and indicates absent documentation. Removing it leaves
  all scenario explanations. Never import repository prose or generate rationale as export content.
- **EXPORT-004** Offer the model's actual audience choices, defaulting to the reader's wording.
  Resolve every exported word by the existing audience rules, including base wording when no
  override exists. Use sanitized view/scenario/audience filenames. Light document styling is
  independent of the application's current theme.
- **EXPORT-005** Preserve natural diagram size and measured readable text. Document paragraphs wrap
  and paginate without clipping; headings stay with following content. PNG is one complete image.
  At 2x raster scale support at most 8192 pixels per side and 32 million pixels per image; block
  larger PNGs with advice to use PDF. Each PDF page respects the same raster limit and the document
  has at most 80 pages. Diagram pages may grow to natural size, rather than shrinking text to fit
  standard paper. Unsupported diagrams/documents receive a clear error and no partial download.
  These are conservative tested application limits, not universal browser or Confluence limits.
- **EXPORT-006** Encode PNG and PDF from the same complete, font-embedded SVG pages. PDF pages
  contain images at 192 pixels per inch; their text is not selectable. Preview discloses this.
  File generation runs locally and releases temporary URLs. PDF generation is loaded on demand.
- **EXPORT-007** An accessible modal preview offers scenario, wording, component reference and
  format controls and Download PNG/PDF. PNG shows the complete composed image; PDF shows every page. Fit width and Actual size
  preview choices let the reader inspect text without changing the generated file.
  Prevent downloads until the latest preview is ready and while its file is encoding. Stale async
  work cannot replace newer choices or download after the dialog closes. Escape closes the dialog
  and preserves the underlying flow; focus returns to the Export button.
- **EXPORT-008** If current edits are invalid, export the displayed last valid model with a clear
  warning in the application outside the artifact. Every part uses the same valid snapshot. With
  no valid diagram, do not export and explain that errors must be fixed. An export session retains
  its captured model even if a watched file subsequently changes.
- **EXPORT-009** Generation/font failures are explained, with settings retained for retry. A failed
  generation offers no partial file and does not change the reader's state. Bundle fonts; never
  depend on an external font service or server-side model upload.
- **EXPORT-010** Target Confluence Cloud's documented file handling. The user explicitly excluded
  live upload testing from acceptance. Validate downloaded PNG/PDF files locally, including bounds,
  pagination, typography and content. No Confluence access/write is required, and compatibility in
  the user's specific instance remains unverified.

Implementation interface: [src/export/index.ts](../../src/export/index.ts). Browser preview/encoding:
[src/app/export-panel.ts](../../src/app/export-panel.ts), [export-files.ts](../../src/app/export-files.ts).
