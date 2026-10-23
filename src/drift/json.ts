// `aerie drift --format json` (docs/spec/drift.md, section 7; DRIFT-507): the finding model as one
// `aerie-drift/1` document, for CI and the Claude skill. Every finding keeps its stable `key`, so a
// run can be compared with the last.
import { evidenceText } from '../extract/index.ts';
import type { Finding, NotChecked } from './findings.ts';
import type { EvidenceLine } from './links.ts';
import { summarise, warnings, type Run, type Summary } from './report.ts';
import type { Hunk } from './file.ts';

export const FORMAT = 'aerie-drift/1';

/** A line of evidence: `at` is `repo/path:line`, `name` the technique as a report prints it. */
export interface JsonEvidence {
  technique: string;
  name: string;
  at: string;
  detail: string;
  corroborates: boolean;
}

export interface JsonFinding {
  /** `D01`, `L01` and on; null for a finding an ignore line excused. */
  id: string | null;
  key: string;
  level: Finding['level'];
  kind: Finding['kind'];
  title: string;
  detail: string;
  elements: string[];
  /** The line of the model file it is about, or null. */
  diagram: number | null;
  techniques: string[];
  evidence: JsonEvidence[];
  /** Hunks against the model file: at a line (from 1), the lines removed and those added. */
  edits: Hunk[];
  instead: Hunk[];
}

export interface DriftDocument {
  format: typeof FORMAT;
  /** The model file as the author named it. */
  model: string;
  /** The repos of the system, as evidence names them. */
  repos: string[];
  summary: Summary;
  findings: JsonFinding[];
  suggestions: {
    id: string;
    key: string;
    element: string;
    unit: string;
    title: string;
    detail: string;
    used: boolean;
    evidence: JsonEvidence[];
    edits: Hunk[];
  }[];
  notChecked: {
    subject: NotChecked['subject'];
    reason: NotChecked['reason'];
    text: string;
    elements: string[];
    diagram: number | null;
    evidence: JsonEvidence[];
  }[];
  ignored: {
    subject: string;
    reason: string;
    diagram: number | null;
    excused: JsonFinding[];
  }[];
  confirmed: {
    subject: { element: string } | { relationship: number };
    text: string;
    diagram: number | null;
    techniques: string[];
    evidence: JsonEvidence[];
  }[];
  /** What drift could not read in the project, so did not check. */
  problems: { id: string; level: 'warning'; at: string | null; message: string }[];
}

function evidence(lines: readonly EvidenceLine[]): JsonEvidence[] {
  return lines.map((each) => ({
    technique: each.technique,
    name: each.name,
    at: evidenceText(each.at),
    detail: each.detail,
    corroborates: each.corroborates,
  }));
}

function finding(each: Finding): JsonFinding {
  return {
    id: each.id === '' ? null : each.id,
    key: each.key,
    level: each.level,
    kind: each.kind,
    title: each.title,
    detail: each.detail,
    elements: each.elements,
    diagram: each.diagram,
    techniques: each.techniques,
    evidence: evidence(each.evidence),
    edits: each.edits,
    instead: each.instead,
  };
}

/** DRIFT-507: the `aerie-drift/1` document of a run. */
export function driftDocument(run: Run): DriftDocument {
  const { drift } = run;
  return {
    format: FORMAT,
    model: run.file,
    repos: run.extraction.repos.map((repo) => repo.name),
    summary: summarise(run),
    findings: drift.findings.map(finding),
    suggestions: drift.suggestions.map((each) => ({
      id: each.id,
      key: each.key,
      element: each.element,
      unit: `${each.unit.kind}:${each.unit.name}`,
      title: each.title,
      detail: each.detail,
      used: each.used,
      evidence: evidence(each.evidence),
      edits: each.edits,
    })),
    notChecked: drift.notChecked.map((each) => ({
      subject: each.subject,
      reason: each.reason,
      text: each.text,
      elements: each.elements,
      diagram: each.diagram,
      evidence: evidence(each.evidence),
    })),
    ignored: drift.ignored.map((each) => ({
      subject: each.subject,
      reason: each.reason,
      diagram: each.diagram,
      excused: each.findings.map(finding),
    })),
    confirmed: drift.confirmed.map((each) => ({
      subject: each.subject,
      text: each.text,
      diagram: each.diagram,
      techniques: each.techniques,
      evidence: evidence(each.evidence),
    })),
    problems: warnings(run.extraction).map((problem) => ({
      id: problem.id,
      level: 'warning' as const,
      at: problem.at === null ? null : evidenceText(problem.at),
      message: problem.message,
    })),
  };
}

/** The document as `aerie drift --format json` prints it. */
export function jsonReport(run: Run): string {
  return `${JSON.stringify(driftDocument(run), null, 2)}\n`;
}
