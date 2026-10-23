// The diagnostic catalogue of docs/spec/language.md, section 13, word for word (LANG-903).
// Placeholders are filled by the caller (LANG-905); `suggestion` is " Did you mean `x`?" or "".
import type { Span } from './model.ts';

/** Why a line is out of place (the E003 table). */
export type OutOfPlace =
  | { rule: 'top-level'; keyword: string }
  | { rule: 'in-view'; keyword: string }
  | { rule: 'in-element'; keyword: string }
  | { rule: 'in-system'; keyword: string }
  | { rule: 'in-walkthrough' }
  | { rule: 'in-walk-step'; keyword: string }
  | { rule: 'element' }
  | { rule: 'sentence' }
  | { rule: 'description' }
  | { rule: 'rewording'; audience: string }
  | { rule: 'holds-nothing'; line: string };

/** Why a rewording cannot reword its owner (the E303 table). */
export type BadRewording =
  | { rule: 'walk-step'; audience: string }
  | { rule: 'bar'; audience: string; what: 'verb phrase' | 'title' };

const n = String;

export const CATALOGUE = {
  E001: () => 'This line is indented with a tab. Indent with spaces instead.',
  E002: () =>
    "This line's indent does not line up with the lines above it. Indent it by the same amount as the other lines in its block.",
  E003: (why: OutOfPlace) => {
    switch (why.rule) {
      case 'top-level':
        return `\`${why.keyword}\` lines go at the top level, with no indent.`;
      case 'in-view':
        return `\`${why.keyword}\` lines go inside a view.`;
      case 'in-element':
        return `\`${why.keyword}\` lines go inside an element.`;
      case 'in-system':
        return `\`${why.keyword}\` lines go inside the \`system\` block.`;
      case 'in-walkthrough':
        return '`step` lines go inside a walkthrough.';
      case 'in-walk-step':
        return `\`${why.keyword}\` lines go inside a walkthrough step.`;
      case 'element':
        return 'An element goes at the top level or inside another element.';
      case 'sentence':
        return 'A sentence goes at the top level, as a relationship, or inside a scenario, as a step.';
      case 'description':
        return 'A `>` description needs something to describe. Indent it under the element, relationship, view or scenario it is about.';
      case 'rewording':
        return `A \`@${why.audience}\` line rewords the line it is indented under. Indent it under the line it rewords.`;
      case 'holds-nothing':
        return `Nothing can go inside a \`${why.line}\` line. Remove the extra indent.`;
    }
  },
  E004: () =>
    "Aerie cannot read this line. A line starts with an element id and a colon, a keyword such as `view`, `>` for a description, `@` for an audience's wording, or an element id for a sentence.",
  E005: (text: string) =>
    `\`${text}\` cannot be an id. Ids use lowercase letters, digits and single hyphens, start with a letter, and do not end with a hyphen.`,
  E006: (id: string) =>
    `\`${id}\` is a word Lines uses for itself, so it cannot be an id. Choose another id.`,
  E007: (id: string, line: number) =>
    `\`${id}\` is already used on line ${n(line)}. Every element, view, scenario and walkthrough needs its own id.`,
  E008: (id: string, suggestion: string) => `There is no element called \`${id}\`.${suggestion}`,
  E009: () => 'This `[` has no closing `]`.',
  E010: (marker: string) =>
    `There is no text after \`${marker}\`. Add the wording, or remove the line.`,
  E011: (id: string, what: 'name' | 'title', example: string) =>
    `Give \`${id}\` a ${what} after the colon, as in \`${example}\`.`,
  E012: (text: string) =>
    `The tags in brackets end the line, so \`${text}\` cannot come after them. Move it before the \`[\`, or write \`\\[\` and \`\\]\` to use brackets in the wording.`,
  E013: () => 'These brackets are empty. Put a tag inside, such as `[service]`, or remove them.',
  E014: () => 'This list has an empty item. Remove the extra comma.',
  E101: (line: number) =>
    `There is already a \`model\` line on line ${n(line)}. A file describes one model.`,
  E102: (line: number) =>
    `There is already an \`audiences\` line on line ${n(line)}. List every audience on one line.`,
  E103: (id: string) => `\`${id}\` is listed twice.`,
  E104: (first: string, second: string) =>
    `Only one audience can be the default, but \`${first}\` and \`${second}\` are both marked \`(default)\`.`,
  E105: (count: number) => `A model can have at most 6 audiences, and this line lists ${n(count)}.`,
  E106: (flag: string) =>
    `\`(${flag})\` is not something an audience can be. Use \`(default)\`, \`(code)\`, or both, as in \`(default, code)\`.`,
  E107: (text: string) =>
    `Aerie cannot read the audience \`${text}\`. Write an id, then an optional name in double quotes and optional flags in parentheses, as in \`dev "Developer" (code)\`.`,
  E201: (name: string, suggestion: string, list: string) =>
    `There is no icon called \`${name}\`.${suggestion} The icons are: ${list}.`,
  E202: (id: string, line: number) =>
    `\`${id}\` already has an icon, on line ${n(line)}. Keep one \`icon\` line.`,
  E301: (id: string, suggestion: string, list: string) =>
    `There is no audience called \`${id}\`.${suggestion} The audiences are ${list}.`,
  E302: (audience: string, line: number) =>
    `There is already \`@${audience}:\` wording for this on line ${n(line)}. Keep one.`,
  E303: (why: BadRewording) =>
    why.rule === 'walk-step'
      ? `A walkthrough step has no title to reword. Reword its narration with \`@${why.audience} >\` or \`@${why.audience} >>\`.`
      : `Only an element has a tagline after \`|\`. Here \`@${why.audience}:\` rewords the ${why.what} alone.`,
  E304: (audience: string, text: string) =>
    `\`>>\` adds a paragraph for one audience. Name the audience, as in \`@${audience} >> ${text}\`.`,
  E401: (word: string, suggestion: string, moved: string) =>
    `A sentence must end with the element it points to, and \`${word}\` is not an element.${suggestion}${moved}`,
  E402: () =>
    'A sentence needs an element, a verb phrase and another element, as in `web calls api`.',
  E403: (id: string) =>
    `A relationship joins two different elements, but this one starts and ends at \`${id}\`.`,
  E404: (inner: string, outer: string) =>
    `\`${inner}\` is inside \`${outer}\`, so a relationship between them would never be drawn. The nesting already shows that \`${outer}\` holds \`${inner}\`.`,
  E405: (line: number) => `This relationship is already declared on line ${n(line)}.`,
  E406: (count: number) =>
    `A relationship has one kind in brackets, such as \`[code]\`, and this one has ${n(count)}.`,
  E501: (item: string, id: string) =>
    `\`${item}\` is not something a view can show. Use an element id, an id with a depth such as \`${id} +1\`, or a tag in brackets such as \`[service]\`.`,
  E502: (tag: string, suggestion: string) => `No element has the tag \`[${tag}]\`.${suggestion}`,
  E503: (kind: string, suggestion: string) =>
    `No relationship has the kind \`${kind}\`.${suggestion}`,
  E601: (id: string, example: string) =>
    `The scenario \`${id}\` has no steps yet. Add sentences under it, such as \`${example}\`.`,
  E602: (count: number) =>
    `A scenario step goes to one element, and this one lists ${n(count)}. Write one step for each.`,
  E603: (kind: string) => `A scenario step has no kind. Remove \`[${kind}]\`.`,
  E604: (id: string, element: string, top: string) =>
    `No view can show every step of \`${id}\`, because none shows \`${element}\` or anything around it. Add \`${top}\` to a view's \`show\` line.`,
  W601: (subject: string, object: string, verb: string) =>
    `No relationship joins \`${subject}\` and \`${object}\` in the model. Add one, such as \`${subject} ${verb} ${object}\`, or check this step.`,
  E701: (id: string, view: string) =>
    `The walkthrough \`${id}\` has no steps yet. Add a line such as \`step ${view}\`.`,
  E702: (id: string, suggestion: string) =>
    `There is no view or scenario called \`${id}\`.${suggestion}`,
  E703: (id: string, view: string, container: string) =>
    `\`${id}\` is not visible in this step's picture of \`${view}\`, so the step cannot focus on it. Open its container with \`open ${container}\`, or choose a view that shows it.`,
  E704: (view: string) =>
    `\`${view}\` is a view, so this step takes element ids after the colon, not step numbers.`,
  E705: (scenario: string) =>
    `\`${scenario}\` is a scenario, so this step takes step numbers after the colon, such as \`${scenario}: 1-3\`, not element ids.`,
  E706: (scenario: string, count: number, range: string) =>
    `The steps of \`${scenario}\` run from 1 to ${n(count)}, so \`${range}\` cannot be played.`,
  E707: (id: string) => `\`${id}\` has nothing inside it to open or close.`,
  E708: (line: number) =>
    `This step already switches the audience, on line ${n(line)}. Keep one \`for\` line.`,
  E801: () =>
    'Nothing goes after `system` on its line. Put each repo and Compose file on its own line under it, such as `repo ../orders-api`.',
  E802: (line: number) =>
    `There is already a \`system\` block on line ${n(line)}. Declare the system once, with all its repos and Compose files.`,
  E803: () =>
    'The `system` block lists nothing yet. Add a `repo` or `compose` line under it, such as `repo ../orders-api`.',
  E804: (path: string) =>
    `\`${path}\` is not a path from this file's folder. Write it relative to the folder that holds this file, with forward slashes, such as \`../orders-api\`.`,
  E805: (path: string) =>
    `\`${path}\` is not inside any repo of the system. Add a \`repo\` line for the repo that holds it, or correct the path.`,
  E806: (text: string) =>
    `\`${text}\` does not say what kind of code it is. Write the kind and a colon first, as in \`compose:${text}\`.`,
  E807: (kind: string, suggestion: string, list: string) =>
    `There is no kind of code called \`${kind}\`.${suggestion} The kinds are ${list}.`,
  E808: (unit: string, what: string, how: string) => `\`${unit}\` does not name ${what}. ${how}`,
  E809: (unit: string, id: string, line: number) =>
    `\`${unit}\` is already the code of \`${id}\`, on line ${n(line)}. A code unit belongs to one element.`,
  E810: () =>
    'An `ignore` line says `ignore drift`, what to ignore, a hyphen with a space on each side, and why, as in `ignore drift maven:legacy - retiring with the desktop app`.',
  E811: (subject: string) =>
    `Say why this drift is ignored: end the line with a hyphen, a space and the reason, as in \`ignore drift ${subject} - retiring next year\`.`,
  E812: (subject: string) =>
    `\`${subject}\` is not something drift can ignore. Write an element id, a code unit such as \`maven:legacy\`, or two of them joined by \`to\`, such as \`web to api\`.`,
  E813: (subject: string, end: string) =>
    `\`${subject}\` joins \`${end}\` to itself. Ignore drift between two different things.`,
  E814: (subject: string, line: number) =>
    `Drift for \`${subject}\` is already ignored on line ${n(line)}. Keep one \`ignore\` line.`,
  W001: () => 'This file has no elements yet. Start with a line such as `web: Website`.',
} satisfies Record<string, (...args: never[]) => string>;

export type DiagnosticId = keyof typeof CATALOGUE;

export type Severity = 'error' | 'warning';

/** One diagnostic, in the shape `aerie check --format json` prints (LANG-963). */
export interface Diagnostic {
  id: DiagnosticId;
  severity: Severity;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
}

export function severityOf(id: DiagnosticId): Severity {
  return id.startsWith('W') ? 'warning' : 'error';
}

/**
 * Builds a diagnostic with its catalogue message. Text quoted from the file has its runs of spaces
 * written as one (LANG-905), so formatting a file never changes its messages (LANG-939).
 */
export function diagnostic<K extends DiagnosticId>(
  id: K,
  span: Span,
  ...args: Parameters<(typeof CATALOGUE)[K]>
): Diagnostic {
  const build = CATALOGUE[id] as (...values: Parameters<(typeof CATALOGUE)[K]>) => string;
  return { id, severity: severityOf(id), ...span, message: build(...args).replace(/ {2,}/g, ' ') };
}

/** LANG-902: by line, then column, then id. */
export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.sort(
    (a, b) => a.line - b.line || a.column - b.column || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
