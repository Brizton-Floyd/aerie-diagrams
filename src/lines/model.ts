// The canonical JSON model every Lines file parses to (docs/spec/language.md, section 11).
// Field order here is the serialisation order (LANG-806).

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
  elements: Element[];
  relationships: Relationship[];
  views: View[];
  scenarios: Scenario[];
  walkthroughs: Walkthrough[];
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
  about: Prose;
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
}

export type ShowItem = { element: Id; depth: number } | { tag: Id };

export interface Scenario {
  id: Id;
  title: Words;
  about: Prose;
  steps: Step[];
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
