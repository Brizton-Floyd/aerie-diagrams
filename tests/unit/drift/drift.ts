// Drift on the fixture projects and on in-memory ones, and the finding model as text for the
// expected files: every finding with its evidence and edits, then suggestions, what is not checked,
// the ignore lines and what is confirmed.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { modelInput, slashes } from '../../../src/cli/project.ts';
import {
  applyHunks,
  compare,
  evidenceLine,
  type Drift,
  type Finding,
  type Hunk,
} from '../../../src/drift/index.ts';
import { extract, type Extraction } from '../../../src/extract/index.ts';
import { parse } from '../../../src/lines/index.ts';
import { java, memoryFiles } from '../extract/memory.ts';

export const DIR = join(import.meta.dirname, 'fixtures');

/** A model's text compared with an extraction, which must parse without errors. */
export function compareText(source: string, extraction: Extraction): Drift {
  const parsed = parse(source);
  if (parsed.model === null) {
    throw new Error(
      parsed.diagnostics.map((each) => `${String(each.line)}: ${each.message}`).join('\n'),
    );
  }
  return compare({ source, model: parsed.model, sourceMap: parsed.sourceMap, extraction });
}

/** The extraction of the system a model file names; the folder it is in is its repository. */
export function extractFor(file: string, home: string): Extraction {
  const parsed = parse(readFileSync(file, 'utf8'));
  if (parsed.model === null) throw new Error(`${file} does not parse`);
  return extract({ ...modelInput(file, parsed.model.system), homeRepo: slashes(home), java });
}

/** Drift on a fixture project's model, `fixtures/<fixture>/<model>.aerie`. */
export function driftFixture(
  fixture: string,
  model: string,
): { source: string; drift: Drift; extraction: Extraction } {
  const file = join(DIR, fixture, `${model}.aerie`);
  const source = readFileSync(file, 'utf8');
  const extraction = extractFor(file, join(DIR, fixture));
  return { source, drift: compareText(source, extraction), extraction };
}

/**
 * Drift on an in-memory workspace at `/w`, whose model is the lines given: its system root, if it
 * has one, names the repos and Compose files under `/w`.
 */
export function driftOf(files: Record<string, string>, ...model: string[]): Drift {
  const source = [...model, ''].join('\n');
  const parsed = parse(source);
  if (parsed.model === null) {
    throw new Error(
      parsed.diagnostics.map((each) => `${String(each.line)}: ${each.message}`).join('\n'),
    );
  }
  const extraction = extract({
    system: parsed.model.system,
    modelFolder: '/w',
    homeRepo: '/w',
    files: memoryFiles(files),
    java,
  });
  return compare({ source, model: parsed.model, sourceMap: parsed.sourceMap, extraction });
}

/** Each finding as `level kind key`, in report order. */
export function keys(drift: Drift): string[] {
  return drift.findings.map((each) => `${each.level} ${each.key}`);
}

/** The model with every suggested edit applied, compared again with the same code. */
export function patched(
  source: string,
  drift: Drift,
  extraction: Extraction,
): { source: string; drift: Drift } {
  const next = applyHunks(source, drift.patch());
  return { source: next, drift: compareText(next, extraction) };
}

function hunkLines(label: string, hunks: readonly Hunk[]): string[] {
  return hunks.flatMap((hunk) => [
    `    ${label} at ${String(hunk.at)}`,
    ...hunk.remove.map((line) => `      - ${line}`),
    ...hunk.add.map((line) => `      + ${line}`),
  ]);
}

function findingLines(finding: Finding): string[] {
  return [
    `${finding.id === '' ? '-' : finding.id} ${finding.level} ${finding.kind} ${finding.key}${finding.diagram === null ? '' : ` (line ${String(finding.diagram)})`}`,
    `    ${finding.title}`,
    `    ${finding.detail}`,
    ...finding.evidence.map((each) => `    ${evidenceLine(each)}`),
    ...hunkLines('edit', finding.edits),
    ...hunkLines('instead', finding.instead),
  ];
}

/** The whole finding model as text, for an expected file. */
export function report(drift: Drift): string {
  const lines: string[] = ['# Findings'];
  for (const finding of drift.findings) lines.push(...findingLines(finding));
  lines.push('', '# Suggestions');
  for (const each of drift.suggestions) {
    lines.push(
      `${each.id}${each.used ? ' (used)' : ''} ${each.key}`,
      `    ${each.title}`,
      `    ${each.detail}`,
    );
    lines.push(
      ...each.evidence.map((line) => `    ${evidenceLine(line)}`),
      ...hunkLines('edit', each.edits),
    );
  }
  lines.push('', '# Not checked');
  for (const each of drift.notChecked) {
    lines.push(
      `[${each.reason}] ${each.text}`,
      ...each.evidence.map((line) => `    ${evidenceLine(line)}`),
    );
  }
  lines.push('', '# Ignored');
  for (const each of drift.ignored) {
    lines.push(`${each.subject} - ${each.reason}`);
    for (const finding of each.findings)
      lines.push(...findingLines(finding).map((line) => `  ${line}`));
  }
  lines.push('', '# Confirmed');
  for (const each of drift.confirmed) {
    lines.push(`${each.text} [${each.techniques.join(', ')}]`);
  }
  return `${lines.join('\n')}\n`;
}
