// The Lines language: parser, canonical model, diagnostics, formatter and printer
// (docs/spec/language.md). Pure TypeScript with no DOM or Node dependency.
export {
  CATALOGUE,
  diagnostic,
  severityOf,
  sortDiagnostics,
  type Diagnostic,
  type DiagnosticId,
  type Severity,
} from './catalogue.ts';
export { format, type FormatResult } from './format.ts';
export { ICON_NAMES, type IconName } from './icons.ts';
export * from './model.ts';
export { DEFAULT_AUDIENCES, parse, type ParseResult } from './parse.ts';
export { print } from './print.ts';
export { KEYWORDS, type Keyword } from './text.ts';
