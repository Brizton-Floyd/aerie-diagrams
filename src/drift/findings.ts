// The finding model (docs/spec/drift.md, section 6; DRIFT-421 to DRIFT-431): what drift found,
// at what level and why, with its evidence, its suggested edit and the ignore line to use instead.
// The reports of slice D6 print it in four forms; nothing here prints anything.
import type { CodeUnit, Id } from '../lines/index.ts';
import type { Hunk } from './file.ts';
import type { EvidenceLine } from './links.ts';

/** DRIFT-421: drift fails CI; likely is one technique's word, or what reading cannot rule out. */
export type Level = 'drift' | 'likely';

/** DRIFT-426: the kinds of finding, each with its own wording and level rule. */
export type FindingKind =
  /** A code line names code the system does not have. */
  | 'missing-code'
  /** ... and the code has a unit of that kind no element names, most likely its new name. */
  | 'renamed-code'
  /** The code has a service, module or package no element stands for. */
  | 'undrawn-code'
  /** The code joins two elements that no line of the diagram joins. */
  | 'undrawn-connection'
  /** A line of the diagram that no call, message or reference in the code shows. */
  | 'missing-connection'
  /** A build dependency between two elements that no `[code]` line shows. */
  | 'undrawn-dependency'
  /** A `[code]` line that no build dependency shows. */
  | 'missing-dependency'
  /** Calls that no endpoint of the system answers. */
  | 'unanswered-calls'
  /** An ignore line that excuses nothing any more. */
  | 'unused-ignore';

export interface Finding {
  /** In report order: `D01` and on for drift, `L01` and on for likely. */
  id: string;
  /** The same for the same difference from one run to the next, so CI can compare runs. */
  key: string;
  level: Level;
  kind: FindingKind;
  /** One sentence in the diagram's own names. */
  title: string;
  /** Why it has its level: which techniques found it, or the exact check that failed. */
  detail: string;
  /** The elements it is about, in model order. */
  elements: Id[];
  /** The line of the model file it is about, if there is one. */
  diagram: number | null;
  /** The techniques that found it, each once, those that only corroborate last. */
  techniques: string[];
  evidence: EvidenceLine[];
  /** The suggested edit. */
  edits: Hunk[];
  /** The ignore line to add instead, if the difference is meant. */
  instead: Hunk[];
}

/** DRIFT-427: a code line drift suggests, which never fails anything. */
export interface Suggestion {
  /** `S01` and on. */
  id: string;
  key: string;
  element: Id;
  unit: CodeUnit;
  title: string;
  detail: string;
  /** Whether drift compared the element as standing for the unit already (a certain name match). */
  used: boolean;
  evidence: EvidenceLine[];
  edits: Hunk[];
}

/** DRIFT-424: what the code cannot show, or what drift cannot read, and so does not check. */
export interface NotChecked {
  subject:
    | { element: Id }
    | { relationship: number }
    | { scenario: Id }
    | { host: string }
    | { unit: CodeUnit }
    | { kind: string }
    | { wording: true };
  reason:
    | 'person'
    | 'no-code'
    | 'part'
    | 'uncertain'
    | 'missing-code'
    | 'end'
    | 'corroborated'
    | 'same-code'
    | 'not-maven'
    | 'scenario'
    | 'wording'
    | 'outside-host'
    | 'kind-not-drawn'
    | 'test-support'
    | 'no-code-lines'
    | 'typescript-classes'
    | 'java-not-read';
  text: string;
  elements: Id[];
  diagram: number | null;
  evidence: EvidenceLine[];
}

/** DRIFT-422: an ignore line, its reason, and the findings it excused. */
export interface Ignored {
  /** Its place among the model's ignore lines. */
  index: number;
  diagram: number | null;
  /** The subject as written: `maven:orders-legacy`, `web to api`. */
  subject: string;
  reason: string;
  /** The findings it excused, as they would otherwise have been reported. */
  findings: Finding[];
}

/** DRIFT-425: an element or a line of the diagram that the code confirms. */
export interface Confirmed {
  subject: { element: Id } | { relationship: number };
  diagram: number | null;
  text: string;
  techniques: string[];
  evidence: EvidenceLine[];
}

/** DRIFT-426: everything drift found comparing one model with its code. */
export interface Drift {
  findings: Finding[];
  suggestions: Suggestion[];
  notChecked: NotChecked[];
  ignored: Ignored[];
  confirmed: Confirmed[];
  /**
   * DRIFT-431: the edits of the findings and suggestions with these keys (all findings, when none
   * are given), combined into one set of hunks against the model file, as one patch.
   */
  patch(keys?: readonly string[]): Hunk[];
}

/** `` `a`, `b` and `c` `` in words. */
export function andList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`;
}

/** `` `a`, `b` or `c` `` in words. */
export function orList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items.at(-1) ?? ''}`;
}

export function code(text: string): string {
  return `\`${text}\``;
}
