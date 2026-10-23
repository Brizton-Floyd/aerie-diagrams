// Drift: a model compared with the code it describes (docs/spec/drift.md, sections 5 and 6). Pure
// TypeScript like the language, the model and the extractor: it builds only on their entry points,
// and reads nothing itself.
//
// How the reports and the CLI (slice D6) use it:
//
//   const { model, sourceMap } = parse(source);           // without errors (aerie check)
//   const extraction = extract({ system: model.system, ... }); // src/extract/
//   const drift = compare({ source, model, sourceMap, extraction });
//   // drift.findings: drift then likely, numbered D01.., L01..; each with its title, why it has
//   //   its level, its evidence (`evidenceLine(each)` prints `repo/path:line  technique: detail`),
//   //   the suggested edit and the ignore line to add instead, as hunks (at, remove, add).
//   // drift.suggestions, drift.notChecked, drift.ignored, drift.confirmed: the rest of a report.
//   // drift.patch(): every suggested edit as one set of hunks; `applyHunks(source, hunks)`.
//
// - Matching (match.ts): code lines first, then names; anything uncertain is a suggestion only.
// - Links (links.ts): what joins code to code, from the facts, with the techniques drift adds:
//   calls matched to endpoints, events to listeners, messages to receivers.
// - The comparison (compare.ts) lifts links to elements and sets them against the diagram's
//   lines; edits are operations on the model file's lines (file.ts), so they combine into a patch.
// - The reports (slice D6) print one `Run` (report.ts: the file, its model, the extraction, the
//   drift and `--fail-on`) in four forms: `textReport` (text.ts), `unifiedDiff` of `allEdits`
//   (patch.ts), `jsonReport` (json.ts, `aerie-drift/1`) and `prComment` (comment.ts); `summarise`
//   gives the counts and the exit code. `aerie drift` (src/cli/aerie.ts) runs them.
export { compare, type CompareInput } from './compare.ts';
export { applyHunks, IGNORE_REASON, VERBS, type Hunk } from './file.ts';
export type {
  Confirmed,
  Drift,
  Finding,
  FindingKind,
  Ignored,
  Level,
  NotChecked,
  Suggestion,
} from './findings.ts';
export { evidenceLine, MATCHES, type EvidenceLine, type MatchId } from './links.ts';
export { commentMarker, prComment } from './comment.ts';
export { driftDocument, FORMAT, jsonReport, type DriftDocument, type JsonFinding } from './json.ts';
export { diffHunks, unifiedDiff } from './patch.ts';
export { allEdits, summarise, type Run, type Summary } from './report.ts';
export { textReport, type TextOptions } from './text.ts';
