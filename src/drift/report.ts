// What every form of the report shares (docs/spec/drift.md, section 7; DRIFT-501 to DRIFT-504):
// the run it describes, its counts and exit code, the place a hunk changes, and what is not checked,
// collapsed per element. The four forms (text.ts, patch.ts, json.ts, comment.ts) print one finding
// model; none of them reads or writes anything.
import { evidenceText, type Extraction, type Problem } from '../extract/index.ts';
import type { Id, Model } from '../lines/index.ts';
import type { Hunk } from './file.ts';
import { andList, type Drift, type Finding, type Level, type NotChecked } from './findings.ts';

/** One run of drift, as every form of the report prints it. */
export interface Run {
  /** The model file as the author named it on the command line. */
  file: string;
  /** Its text, which the suggested edits change. */
  source: string;
  model: Model;
  extraction: Extraction;
  drift: Drift;
  /** DRIFT-503: the lowest level that fails the run; drift by default. */
  failOn: Level;
  /** How long the run took, printed in the text report's header; null leaves it out. */
  seconds: number | null;
}

/** DRIFT-502: the counts a report gives, and the exit code they make. */
export interface Summary {
  drift: number;
  likely: number;
  suggestions: number;
  notChecked: number;
  /** The ignore lines that excused something, and how many differences they excused. */
  ignored: number;
  excused: number;
  elements: number;
  confirmedElements: number;
  lines: number;
  confirmedLines: number;
  failOn: Level;
  /** 0 when nothing at or above `failOn` was found, else 1 (2, drift cannot run, comes earlier). */
  exitCode: 0 | 1;
}

export function summarise(run: Run): Summary {
  const { drift, model, failOn } = run;
  const count = (level: Level): number =>
    drift.findings.filter((each) => each.level === level).length;
  const confirmed = (kind: 'element' | 'relationship'): number =>
    new Set(
      drift.confirmed.flatMap((each) =>
        kind in each.subject ? [JSON.stringify(each.subject)] : [],
      ),
    ).size;
  const found = { drift: count('drift'), likely: count('likely') };
  const fails = found.drift > 0 || (failOn === 'likely' && found.likely > 0);
  return {
    ...found,
    suggestions: drift.suggestions.length,
    notChecked: drift.notChecked.length,
    ignored: drift.ignored.length,
    excused: drift.ignored.reduce((sum, each) => sum + each.findings.length, 0),
    elements: model.elements.length,
    confirmedElements: confirmed('element'),
    lines: model.relationships.length,
    confirmedLines: confirmed('relationship'),
    failOn,
    exitCode: fails ? 1 : 0,
  };
}

/** `1 thing` or `2 things`. */
export function plural(n: number, word: string, many = `${word}s`): string {
  return `${String(n)} ${n === 1 ? word : many}`;
}

/** `9 of 11 elements and 3 of 5 lines confirmed`: how much of the diagram the code confirms. */
export function confirmedText(summary: Summary): string {
  return `${String(summary.confirmedElements)} of ${plural(summary.elements, 'element')} and ${String(summary.confirmedLines)} of ${plural(summary.lines, 'line')} confirmed`;
}

/** The repos of the system and what was found in them: `stack (5 Compose services, 1 app)`. */
export function checkedText(extraction: Extraction): string {
  const units = (kind: string): number =>
    extraction.facts.filter((fact) => fact.kind === 'unit' && fact.unit.kind === kind).length;
  const apps = extraction.facts.filter(
    (fact) => fact.kind === 'app' && ('className' in fact || fact.type === 'application'),
  ).length;
  const found = [
    [units('compose'), 'Compose service'],
    [units('maven'), 'Maven module'],
    [units('npm'), 'npm package'],
    [apps, 'app'],
  ] as const;
  const what = found.filter(([n]) => n > 0).map(([n, word]) => plural(n, word));
  const repos = extraction.repos.map((repo) => repo.name).join(', ');
  return `${repos} (${what.length === 0 ? 'no code drift reads' : what.join(', ')})`;
}

/** The extractor's warnings: parts of the project drift could not read, so did not check. */
export function warnings(extraction: Extraction): Problem[] {
  return extraction.problems.filter((problem) => problem.level === 'warning');
}

/** `file:12`, `file:12-14`, or `file, after line 11` for a hunk that only adds lines. */
export function hunkPlace(file: string, hunk: Hunk): string {
  if (hunk.remove.length === 0) {
    return hunk.at <= 1 ? `${file}, before line 1` : `${file}, after line ${String(hunk.at - 1)}`;
  }
  const last = hunk.at + hunk.remove.length - 1;
  return `${file}:${String(hunk.at)}${last > hunk.at ? `-${String(last)}` : ''}`;
}

/** A finding's edits as `-` and `+` Lines, each hunk under its place. */
export function hunkLines(file: string, hunks: readonly Hunk[]): string[][] {
  return hunks.map((hunk) => [
    hunkPlace(file, hunk),
    ...hunk.remove.map((line) => (line === '' ? '-' : `- ${line}`)),
    ...hunk.add.map((line) => (line === '' ? '+' : `+ ${line}`)),
  ]);
}

/** One line of what is not checked: where (a line of the model, or of the code), and why. */
export interface Unchecked {
  at: string | null;
  text: string;
}

/**
 * DRIFT-504: what is not checked, collapsed per element: an element that stands for no code takes
 * the lines it is an end of, and the scenarios share one line; then what the extractor could not
 * read.
 */
export function uncheckedLines(run: Run): Unchecked[] {
  const { drift, model, file } = run;
  const at = (line: number | null): string | null =>
    line === null ? null : `${file}:${String(line)}`;
  const own = new Map<Id, NotChecked>();
  for (const each of drift.notChecked) {
    if ('element' in each.subject) own.set(each.subject.element, each);
  }
  // The lines whose end stands for no code go with that end.
  const taken = new Map<Id, NotChecked[]>();
  const kept: NotChecked[] = [];
  for (const each of drift.notChecked) {
    const end = each.reason === 'end' ? each.elements.find((id) => own.has(id)) : undefined;
    if (end === undefined) kept.push(each);
    else taken.set(end, [...(taken.get(end) ?? []), each]);
  }
  const scenarios = kept.filter((each) => each.reason === 'scenario');
  const out: Unchecked[] = [];
  for (const each of kept) {
    if (each.reason === 'scenario') {
      if (each !== scenarios[0]) continue;
      if (scenarios.length === 1) {
        out.push({ at: at(each.diagram), text: each.text });
        continue;
      }
      const ids = scenarios.map((scenario) =>
        'scenario' in scenario.subject ? `\`${scenario.subject.scenario}\`` : '',
      );
      out.push({
        at: null,
        text: `${plural(scenarios.length, 'scenario')} (${andList(ids)}) are not checked: scenarios are checked against real call paths in phase 2.`,
      });
      continue;
    }
    const lines = 'element' in each.subject ? (taken.get(each.subject.element) ?? []) : [];
    out.push({ at: at(each.diagram), text: [each.text, ...linesToo(model, lines)].join(' ') });
  }
  for (const problem of warnings(run.extraction)) {
    out.push({
      at: problem.at === null ? null : evidenceText(problem.at),
      text: problem.message,
    });
  }
  return out;
}

/** `The line “User uses Website” (line 35) is not checked either.`, or the lines' count. */
function linesToo(model: Model, lines: readonly NotChecked[]): string[] {
  const numbers = lines.flatMap((each) => (each.diagram === null ? [] : [String(each.diagram)]));
  const [first] = lines;
  if (first === undefined) return [];
  if (lines.length === 1 && 'relationship' in first.subject) {
    const said = sentence(model, first.subject.relationship);
    const where = numbers.length === 1 ? ` (line ${numbers[0] ?? ''})` : '';
    return [`The line “${said}”${where} is not checked either.`];
  }
  return [`Its ${String(lines.length)} lines (lines ${andList(numbers)}) are not checked either.`];
}

/** A relationship in the diagram's own names: `User uses Website`. */
function sentence(model: Model, index: number): string {
  const relationship = model.relationships[index];
  if (relationship === undefined) return '';
  const name = (id: Id): string => model.elements.find((each) => each.id === id)?.name.base ?? id;
  return `${name(relationship.subject)} ${relationship.verb.base ?? ''} ${name(relationship.object)}`;
}

/** The evidence a report prints in full before it says how many more there are. */
export const EVIDENCE_SHOWN = 8;

/** The suggested edits of the findings and of the certain suggestions, as one patch. */
export function allEdits(drift: Drift): Hunk[] {
  return drift.patch([
    ...drift.findings.map((each) => each.key),
    ...drift.suggestions.filter((each) => each.used).map((each) => each.key),
  ]);
}

/** The findings at one level. */
export function findingsAt(drift: Drift, level: Level): Finding[] {
  return drift.findings.filter((each) => each.level === level);
}
