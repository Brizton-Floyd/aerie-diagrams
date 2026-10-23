// The model file as drift's suggested edits see it (docs/spec/drift.md, DRIFT-428 to DRIFT-431):
// its lines, the block each statement owns, and each edit as an operation on lines, so that the
// edits of several findings combine into one patch. Aerie never writes the file (section 1): these
// are suggestions, as hunks: at a line, the lines removed and the lines added in their place.
import type { CodeUnit, Id, Model, Span } from '../lines/index.ts';
import { encodeWords, isId, KEYWORDS } from '../lines/index.ts';

/** DRIFT-428: one change to the model file: from line `at` (from 1), `remove` becomes `add`. */
export interface Hunk {
  at: number;
  /** The lines taken out, as written; empty for an insertion before line `at`. */
  remove: string[];
  add: string[];
}

/** A column span on one line: from `column` to just before `endColumn`, counting from 1. */
interface Columns {
  column: number;
  endColumn: number;
}

/**
 * An edit, as an operation on the original lines. Operations from several findings that touch the
 * same line combine: removals join, a code line's units are changed together, and a list loses
 * every item any operation drops.
 */
export type Op =
  /** Lines added after line `after` (0 puts them before the first line). */
  | { op: 'insert'; after: number; lines: string[] }
  /** Lines `from` to `to`, both included, taken out. */
  | { op: 'remove'; from: number; to: number }
  /** A code line's units changed: some taken out, some renamed, some added at the end. */
  | { op: 'units'; line: number; remove: string[]; rename: [string, string][]; add: string[] }
  /**
   * Items of a comma-separated list on one line dropped (the objects of a relationship, a view's
   * `show` items, a walkthrough step's focus or `open` items). `all` is every item of the list;
   * when nothing is left, `empty` says what goes: the statement's lines, or the text from a column.
   */
  | {
      op: 'items';
      line: number;
      all: Columns[];
      drop: Columns[];
      empty: { from: number; to: number } | { cut: number };
    };

/** DRIFT-430: what an ignore line says until its author writes why the difference is meant. */
export const IGNORE_REASON = 'why this difference is meant';

/** The verbs of the relationships drift suggests: a call, or a build dependency for `[code]`. */
export const VERBS = { runtime: 'calls', code: 'depends on' } as const;

const INDENT = '  ';

export class ModelFile {
  readonly lines: readonly string[];
  readonly model: Model;
  private readonly map: Readonly<Record<string, Span>>;
  private readonly endsWithNewline: boolean;

  constructor(source: string, model: Model, sourceMap: Readonly<Record<string, Span>>) {
    const lines = source.split(/\r?\n/);
    this.endsWithNewline = lines.at(-1) === '';
    if (this.endsWithNewline) lines.pop();
    this.lines = lines;
    this.model = model;
    this.map = sourceMap;
  }

  /** The text of a line, counting from 1. */
  text(line: number): string {
    return this.lines[line - 1] ?? '';
  }

  private indent(line: number): number {
    const text = this.text(line);
    return text.length - text.trimStart().length;
  }

  private blank(line: number): boolean {
    return this.text(line).trim() === '';
  }

  private comment(line: number): boolean {
    return this.text(line).trimStart().startsWith('//');
  }

  /** The line a model location starts on, by JSON Pointer (LANG-807). */
  lineOf(pointer: string): number | null {
    return this.map[pointer]?.line ?? null;
  }

  private span(pointer: string): Span | undefined {
    return this.map[pointer];
  }

  /**
   * The last line of the block a statement owns: the statement and every line after it indented
   * deeper, blank lines between them included.
   */
  blockEnd(line: number): number {
    const base = this.indent(line);
    let last = line;
    for (let at = line + 1; at <= this.lines.length; at++) {
      if (this.blank(at)) continue;
      if (this.indent(at) <= base) break;
      last = at;
    }
    return last;
  }

  private elementIndex(id: Id): number {
    return this.model.elements.findIndex((each) => each.id === id);
  }

  /** The line that declares an element. */
  elementLine(id: Id): number {
    return this.lineOf(`/elements/${String(this.elementIndex(id))}`) ?? 0;
  }

  /** The lines of an element's block, with the comment lines written right above it. */
  elementBlock(id: Id): { from: number; to: number } {
    const line = this.elementLine(id);
    let from = line;
    while (from > 1 && this.comment(from - 1) && this.indent(from - 1) === this.indent(line)) {
      from--;
    }
    return { from, to: this.blockEnd(line) };
  }

  /** The line of an element's `index`th code unit. */
  codeLine(id: Id, index: number): number | null {
    return this.lineOf(`/elements/${String(this.elementIndex(id))}/code/${String(index)}`);
  }

  /** The line a relationship is declared on (several share it when it has several objects). */
  relationshipLine(index: number): number {
    return this.lineOf(`/relationships/${String(index)}`) ?? 0;
  }

  private children(parent: Id | null): Id[] {
    return this.model.elements.filter((each) => each.parent === parent).map((each) => each.id);
  }

  /** DRIFT-429: a unit added to an element's code line, or a code line added for it. */
  addUnit(id: Id, unit: CodeUnit): Op {
    const element = this.model.elements[this.elementIndex(id)];
    const count = element?.code.length ?? 0;
    const last = count === 0 ? null : this.codeLine(id, count - 1);
    if (last !== null)
      return { op: 'units', line: last, remove: [], rename: [], add: [text(unit)] };
    const line = this.elementLine(id);
    const next = line + 1;
    const after = /^\s*icon\s/.test(this.text(next)) && this.indent(next) > this.indent(line);
    const pad = ' '.repeat(this.indent(line)) + INDENT;
    return { op: 'insert', after: after ? next : line, lines: [`${pad}code ${text(unit)}`] };
  }

  /** A unit taken out of the code line that names it; the line goes when it names nothing else. */
  removeUnit(id: Id, index: number): Op[] {
    const line = this.codeLine(id, index);
    const unit = this.model.elements[this.elementIndex(id)]?.code[index];
    if (line === null || unit === undefined) return [];
    return [{ op: 'units', line, remove: [text(unit)], rename: [], add: [] }];
  }

  /** DRIFT-429: a rename replaces one word of the code line. */
  renameUnit(id: Id, index: number, to: CodeUnit): Op[] {
    const line = this.codeLine(id, index);
    const unit = this.model.elements[this.elementIndex(id)]?.code[index];
    if (line === null || unit === undefined) return [];
    return [{ op: 'units', line, remove: [], rename: [[text(unit), text(to)]], add: [] }];
  }

  /**
   * DRIFT-429: a new element, as a placeholder name and its code line only, at the end of its
   * parent's block (or after the last top-level element), set apart by a blank line when its
   * siblings are.
   */
  addElement(parent: Id | null, id: Id, name: string, tag: string, unit: CodeUnit): Op {
    const siblings = this.children(parent);
    const lastSibling = siblings.at(-1);
    let after: number;
    let pad: string;
    if (lastSibling !== undefined) {
      after = this.elementBlock(lastSibling).to;
      pad = ' '.repeat(this.indent(this.elementLine(lastSibling)));
    } else if (parent !== null) {
      after = this.blockEnd(this.elementLine(parent));
      pad = ' '.repeat(this.indent(this.elementLine(parent))) + INDENT;
    } else {
      after = this.headerEnd();
      pad = '';
    }
    const spaced =
      lastSibling === undefined
        ? parent === null
        : this.blank(this.elementBlock(lastSibling).from - 1);
    return {
      op: 'insert',
      after,
      lines: [
        ...(spaced ? [''] : []),
        `${pad}${id}: ${encodeWords(name)} [${tag}]`,
        `${pad}${INDENT}code ${text(unit)}`,
      ],
    };
  }

  /** The last line of the system block, or else of the model and audiences lines. */
  private headerEnd(): number {
    const system = this.lineOf('/system');
    if (system !== null) return this.blockEnd(system);
    let last = 0;
    for (let at = 1; at <= this.lines.length; at++) {
      if (/^(model|audiences)\b/.test(this.text(at))) last = this.blockEnd(at);
    }
    return last;
  }

  /**
   * DRIFT-429: a relationship, after the last relationship of its kind (or after the last of any
   * kind, or after the elements, as a group of its own).
   */
  addRelationship(subject: Id, object: Id, kind: 'runtime' | 'code'): Op {
    const verb = VERBS[kind];
    const line = `${subject} ${verb} ${object}${kind === 'code' ? ' [code]' : ''}`;
    const relationships = this.model.relationships;
    const ofKind = relationships.flatMap((each, index) =>
      (kind === 'code') === (each.kind === 'code') ? [index] : [],
    );
    const lastOfKind = ofKind.at(-1);
    if (lastOfKind !== undefined) {
      return { op: 'insert', after: this.relationshipEnd(lastOfKind), lines: [line] };
    }
    if (relationships.length > 0) {
      const last = Math.max(...relationships.map((_, index) => this.relationshipEnd(index)));
      return { op: 'insert', after: last, lines: ['', line] };
    }
    const tops = this.children(null);
    const lastTop = tops.at(-1);
    const after = lastTop === undefined ? this.headerEnd() : this.elementBlock(lastTop).to;
    return { op: 'insert', after, lines: ['', line] };
  }

  private relationshipEnd(index: number): number {
    return this.blockEnd(this.relationshipLine(index));
  }

  /** DRIFT-429: a relationship taken out: its object from the line, or the whole statement. */
  removeRelationship(index: number): Op {
    const line = this.relationshipLine(index);
    const all = this.model.relationships.flatMap((_, each) => {
      const object = this.span(`/relationships/${String(each)}/object`);
      return this.relationshipLine(each) === line && object !== undefined ? [columns(object)] : [];
    });
    const own = this.span(`/relationships/${String(index)}/object`);
    return {
      op: 'items',
      line,
      all,
      drop: own === undefined ? all : [columns(own)],
      empty: { from: line, to: this.blockEnd(line) },
    };
  }

  /**
   * DRIFT-429: an element removed: its whole block (its children too), and every line that names it
   * or a child: relationships, scenario steps, view `show` items, walkthrough focus, `open` and
   * `close` items, and ignore lines.
   */
  removeElement(id: Id): Op[] {
    const gone = new Set([id, ...this.descendants(id)]);
    const block = this.elementBlock(id);
    const ops: Op[] = [{ op: 'remove', from: block.from, to: block.to }];
    this.model.relationships.forEach((each, index) => {
      if (gone.has(each.subject) || gone.has(each.object)) {
        ops.push(gone.has(each.subject) ? this.statement(index) : this.removeRelationship(index));
      }
    });
    this.model.views.forEach((view, v) => {
      view.show.forEach((item, j) => {
        if ('element' in item && gone.has(item.element)) {
          ops.push(this.listItem(`/views/${String(v)}/show`, j, view.show.length, 'line'));
        }
      });
    });
    this.model.scenarios.forEach((scenario, s) => {
      scenario.steps.forEach((step, j) => {
        if (!gone.has(step.subject) && !gone.has(step.object)) return;
        const line = this.lineOf(`/scenarios/${String(s)}/steps/${String(j)}`);
        if (line !== null) ops.push({ op: 'remove', from: line, to: this.blockEnd(line) });
      });
    });
    this.model.walkthroughs.forEach((walkthrough, w) => {
      walkthrough.steps.forEach((step, j) => {
        const at = `/walkthroughs/${String(w)}/steps/${String(j)}`;
        step.focus.forEach((each, k) => {
          if (gone.has(each)) ops.push(this.listItem(`${at}/focus`, k, step.focus.length, 'cut'));
        });
        for (const name of ['open', 'close'] as const) {
          step[name].forEach((each, k) => {
            if (gone.has(each))
              ops.push(this.listItem(`${at}/${name}`, k, step[name].length, 'line'));
          });
        }
      });
    });
    this.model.ignores.forEach((ignore, index) => {
      const ends =
        'from' in ignore.subject ? [ignore.subject.from, ignore.subject.to] : [ignore.subject];
      if (ends.some((end) => 'element' in end && gone.has(end.element))) {
        ops.push(this.removeIgnore(index));
      }
    });
    return ops;
  }

  /** The whole statement of a relationship, every object with it. */
  private statement(index: number): Op {
    const line = this.relationshipLine(index);
    return { op: 'remove', from: line, to: this.blockEnd(line) };
  }

  /**
   * One item of a list that may run over several lines (`show` lines): the item, with the items on
   * its own line. When its line is left with nothing, the line goes, or for a walkthrough step's
   * focus, the text from the colon.
   */
  private listItem(pointer: string, index: number, count: number, empty: 'line' | 'cut'): Op {
    const own = this.span(`${pointer}/${String(index)}`);
    if (own === undefined) return { op: 'insert', after: 0, lines: [] };
    const all: Columns[] = [];
    for (let k = 0; k < count; k++) {
      const each = this.span(`${pointer}/${String(k)}`);
      if (each?.line === own.line) all.push(columns(each));
    }
    const first = all[0] ?? columns(own);
    const before = cut(this.text(own.line), 1, first.column);
    const colon = before.lastIndexOf(':');
    return {
      op: 'items',
      line: own.line,
      all,
      drop: [columns(own)],
      empty:
        empty === 'cut' && colon >= 0
          ? { cut: colon + 1 }
          : { from: own.line, to: this.blockEnd(own.line) },
    };
  }

  private descendants(id: Id): Id[] {
    const out: Id[] = [];
    const visit = (parent: Id): void => {
      for (const child of this.children(parent)) {
        out.push(child);
        visit(child);
      }
    };
    visit(id);
    return out;
  }

  /** DRIFT-430: an ignore line, after the last one, or as a group of its own at the end. */
  addIgnore(subject: string): Op {
    const line = `ignore drift ${subject} - ${IGNORE_REASON}`;
    const last = this.model.ignores.length - 1;
    if (last >= 0) {
      return { op: 'insert', after: this.lineOf(`/ignores/${String(last)}`) ?? 0, lines: [line] };
    }
    let end = this.lines.length;
    while (end > 0 && this.blank(end)) end--;
    return { op: 'insert', after: end, lines: end === 0 ? [line] : ['', line] };
  }

  /** DRIFT-423: an ignore line taken out. */
  removeIgnore(index: number): Op {
    const line = this.lineOf(`/ignores/${String(index)}`) ?? 0;
    return { op: 'remove', from: line, to: line };
  }

  /** An id for a new element, from a code unit's name, that no element has and no keyword is. */
  freshId(name: string, taken: ReadonlySet<Id>): Id {
    let base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!/^[a-z]/.test(base)) base = `code-${base}`;
    if (!isId(base)) base = 'code';
    const used = (id: string): boolean =>
      taken.has(id) || this.model.elements.some((each) => each.id === id) || isKeyword(id);
    if (!used(base)) return base;
    for (let n = 2; ; n++) {
      const id = `${base}-${String(n)}`;
      if (!used(id)) return id;
    }
  }

  /** DRIFT-431: the hunks that make the operations' changes, in order of line. */
  hunks(ops: readonly Op[]): Hunk[] {
    return render(this.lines, ops);
  }

  /** The file with the operations applied, as text. */
  apply(ops: readonly Op[]): string {
    return applyHunks(this.lines.join('\n') + (this.endsWithNewline ? '\n' : ''), this.hunks(ops));
  }
}

function isKeyword(word: string): boolean {
  return (KEYWORDS as readonly string[]).includes(word);
}

function text(unit: CodeUnit): string {
  return `${unit.kind}:${unit.name}`;
}

function columns(span: Span): Columns {
  return { column: span.column, endColumn: span.endColumn };
}

/** The text from one column to just before another, counting code points from 1 (LANG-901). */
function cut(line: string, from: number, to?: number): string {
  const points = Array.from(line);
  return points.slice(from - 1, to === undefined ? undefined : to - 1).join('');
}

const sameColumns = (a: Columns, b: Columns): boolean =>
  a.column === b.column && a.endColumn === b.endColumn;

/** What becomes of each line when the operations combine. */
function render(lines: readonly string[], ops: readonly Op[]): Hunk[] {
  const count = lines.length;
  const removed = new Array<boolean>(count + 1).fill(false);
  const replaced = new Map<number, string>();
  const inserted = new Map<number, string[][]>();
  const remove = (from: number, to: number): void => {
    for (let at = Math.max(1, from); at <= Math.min(count, to); at++) removed[at] = true;
  };
  for (const op of ops) if (op.op === 'remove') remove(op.from, op.to);
  // Lists first, since an emptied list can take out its statement's lines.
  const lists = new Map<number, Extract<Op, { op: 'items' }>[]>();
  for (const op of ops) {
    if (op.op === 'items') lists.set(op.line, [...(lists.get(op.line) ?? []), op]);
  }
  for (const [line, group] of lists) {
    const first = group[0];
    if (first === undefined || removed[line]) continue;
    const drop = group.flatMap((each) => each.drop);
    const kept = first.all.filter((item) => !drop.some((each) => sameColumns(each, item)));
    const original = lines[line - 1] ?? '';
    const end = Math.max(...first.all.map((each) => each.endColumn));
    if (kept.length === 0) {
      if ('cut' in first.empty) {
        replaced.set(line, cut(original, 1, first.empty.cut) + cut(original, end));
      } else {
        remove(first.empty.from, first.empty.to);
      }
      continue;
    }
    const start = Math.min(...first.all.map((each) => each.column));
    const list = kept.map((each) => cut(original, each.column, each.endColumn)).join(', ');
    replaced.set(line, cut(original, 1, start) + list + cut(original, end));
  }
  const units = new Map<number, Extract<Op, { op: 'units' }>[]>();
  for (const op of ops) {
    if (op.op === 'units') units.set(op.line, [...(units.get(op.line) ?? []), op]);
  }
  for (const [line, group] of units) {
    if (removed[line]) continue;
    const original = lines[line - 1] ?? '';
    const match = /^(\s*code)\s+(.*?)\s*$/.exec(original);
    if (match === null) continue;
    const [, head = '', rest = ''] = match;
    const renames = new Map(group.flatMap((each) => each.rename));
    const gone = new Set(group.flatMap((each) => each.remove));
    const words = rest
      .split(/\s+/)
      .filter((word) => word !== '' && !gone.has(word))
      .map((word) => renames.get(word) ?? word);
    for (const word of group.flatMap((each) => each.add))
      if (!words.includes(word)) words.push(word);
    if (words.length === 0) remove(line, line);
    else replaced.set(line, `${head} ${words.join(' ')}`);
  }
  for (const op of ops) {
    if (op.op !== 'insert' || op.lines.length === 0) continue;
    const before = inserted.get(op.after) ?? [];
    if (!before.some((each) => each.join('\n') === op.lines.join('\n'))) {
      inserted.set(op.after, [...before, op.lines]);
    }
  }
  const hunks: Hunk[] = [];
  let open: Hunk | null = null;
  const close = (): void => {
    if (open !== null) hunks.push(open);
    open = null;
  };
  for (let at = 0; at <= count; at++) {
    const adds = (inserted.get(at) ?? []).flat();
    if (adds.length > 0) {
      open ??= { at: at + 1, remove: [], add: [] };
      open.add.push(...adds);
    }
    const next = at + 1;
    if (next > count) break;
    const original = lines[next - 1] ?? '';
    if (removed[next]) {
      open ??= { at: next, remove: [], add: [] };
      open.remove.push(original);
    } else if (replaced.has(next) && replaced.get(next) !== original) {
      open ??= { at: next, remove: [], add: [] };
      open.remove.push(original);
      open.add.push(replaced.get(next) ?? original);
    } else {
      close();
    }
  }
  close();
  return hunks;
}

/**
 * DRIFT-431: a text with hunks applied, each against the original lines. Hunks are applied from
 * the last to the first, so their line numbers stay those of the original; a hunk whose removed
 * lines are not there is an error.
 */
export function applyHunks(source: string, hunks: readonly Hunk[]): string {
  const lines = source.split(/\r?\n/);
  const newline = lines.at(-1) === '';
  if (newline) lines.pop();
  const sorted = [...hunks].sort((a, b) => b.at - a.at);
  for (const hunk of sorted) {
    const found = lines.slice(hunk.at - 1, hunk.at - 1 + hunk.remove.length);
    if (found.join('\n') !== hunk.remove.join('\n')) {
      throw new Error(`The edit at line ${String(hunk.at)} does not match the file.`);
    }
    lines.splice(hunk.at - 1, hunk.remove.length, ...hunk.add);
  }
  return lines.join('\n') + (newline ? '\n' : '');
}
