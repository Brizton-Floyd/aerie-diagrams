// The canonical JSON model every Lines file parses to (docs/spec/language.md, section 12).
// Field order here is the serialisation order (LANG-806).
import type { CodeKind } from './code.ts';

export type Id = string;

export interface Words {
  /** The unmarked wording, or null when there is none. */
  base: string | null;
  /** Replacements, keyed by audience id in audience order (LANG-301). */
  set: Record<Id, string>;
}

export interface Prose {
  /** Paragraphs joined by "\n\n", or null. */
  base: string | null;
  /** Replacing paragraphs per audience (LANG-302). */
  set: Record<Id, string>;
  /** Added paragraphs per audience (LANG-303). */
  add: Record<Id, string>;
}

export interface Model {
  format: 'aerie-model/1';
  id: Id | null;
  title: Words;
  about: Prose;
  audiences: Audience[];
  defaultAudience: Id;
  /** What the `system` block says, or null without one (LANG-752). */
  system: System | null;
  elements: Element[];
  relationships: Relationship[];
  views: View[];
  scenarios: Scenario[];
  walkthroughs: Walkthrough[];
  /** The `ignore drift` lines, in the order written (LANG-758). */
  ignores: Ignore[];
}

export interface Audience {
  id: Id;
  name: string;
  code: boolean;
}

export interface Element {
  id: Id;
  parent: Id | null;
  /** The base is never null. */
  name: Words;
  tagline: Words;
  tags: Id[];
  /** Only what an icon line says. */
  icon: string | null;
  /** The code units its `code` lines name, in the order written (LANG-755). */
  code: CodeUnit[];
  about: Prose;
}

/** One piece of code a diagram element stands for, such as `compose:bff` (LANG-756). */
export interface CodeUnit {
  kind: CodeKind;
  name: string;
}

/** The repos and Compose files that form the system, as written (LANG-753, LANG-754). */
export interface System {
  repos: string[];
  compose: string[];
}

/** One end of an ignored difference: an element or a code unit (LANG-759). */
export type DriftEnd = { element: Id } | { unit: CodeUnit };

/** What an `ignore drift` line excuses: one end, or the connection from one end to another. */
export type DriftSubject = DriftEnd | { from: DriftEnd; to: DriftEnd };

export interface Ignore {
  subject: DriftSubject;
  reason: string;
}

export interface Relationship {
  subject: Id;
  /** The base is never null. */
  verb: Words;
  object: Id;
  kind: Id;
  about: Prose;
}

export interface View {
  id: Id;
  title: Words;
  about: Prose;
  show: ShowItem[];
  kinds: Id[];
  /** The authored main scenario; omitted in models that do not declare one. */
  mainScenario?: Id;
}

export type ShowItem = { element: Id; depth: number } | { tag: Id };

export interface Scenario {
  id: Id;
  title: Words;
  about: Prose;
  steps: Step[];
  stages?: Stage[];
}

/** An authored high-level stage, anchored to the first detailed step in its range. */
export interface Stage {
  from: number;
  to: number;
  title: Words;
  about: Prose;
}

export interface Step {
  subject: Id;
  verb: Words;
  object: Id;
  about: Prose;
}

export interface Walkthrough {
  id: Id;
  title: Words;
  about: Prose;
  steps: WalkStep[];
}

export interface WalkStep {
  /** A view id or a scenario id. */
  target: Id;
  focus: Id[];
  /** "n" alone gives from = to = n. */
  range: { from: number; to: number } | null;
  open: Id[];
  close: Id[];
  audience: Id | null;
  about: Prose;
}

/** A span in the source: lines and columns count from 1, columns count code points (LANG-901). */
export interface Span {
  line: number;
  column: number;
  /** The end is just after the last character of the span. */
  endLine: number;
  endColumn: number;
}

/** Writes a model as its canonical text (LANG-806). */
export function serializeModel(model: Model): string {
  return JSON.stringify(model, null, 2) + '\n';
}
