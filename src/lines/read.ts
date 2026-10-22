// Reading a Lines file into lines and blocks (docs/spec/language.md, sections 2 and 3).
// This stage needs nothing but the text: it finds comments, blank lines, statements and their
// owners, reads each statement into its parts, and reports E001, E002 and E004. Meaning (ids,
// owners allowed, references) is checked later by the parser. The formatter works from this.
import { diagnostic, type Diagnostic } from './catalogue.ts';
import type { Span } from './model.ts';
import { codePoints, findLastUnescaped, findUnescaped, isIdLike, isKeyword } from './text.ts';

/** A stretch of one line: its text and its offsets (UTF-16, from the start of the raw line). */
export interface Piece {
  text: string;
  start: number;
  end: number;
}

/** A comma-separated list. `empties` holds, for each empty item, the comma that makes it. */
export interface List {
  /** The items that are not empty. */
  items: Piece[];
  /** Every item, empty ones included, as the formatter keeps them. */
  all: Piece[];
  empties: number[];
}

export interface TitleRead {
  kind: 'model' | 'view' | 'scenario' | 'walkthrough';
  head: Piece;
  /** The text before the colon (or all of it without one), or null when there is none. */
  id: Piece | null;
  hasColon: boolean;
  /** The raw words after the colon, or null without a colon. */
  title: Piece | null;
}

export interface AudienceEntry {
  piece: Piece;
  /** Null when the entry cannot be read (E107). */
  id: Piece | null;
  /** The text inside the quotes, kept as written. */
  name: Piece | null;
  /** The flags inside the parentheses, or null without them. */
  flags: List | null;
  /** The parentheses and what is inside them, or null. */
  flagsAt: Piece | null;
}

export interface AudiencesRead {
  kind: 'audiences';
  head: Piece;
  entries: AudienceEntry[] | null;
  /** Every entry in order, with null for an empty one. */
  all: (AudienceEntry | null)[];
  empties: number[];
}

export interface TagGroup {
  open: number;
  /** The offset of the closing `]`, or null when there is none (E009). */
  close: number | null;
  items: Piece[];
  /** Text after the closing `]` (E012), or null. */
  after: Piece | null;
}

export interface ElementRead {
  kind: 'element';
  head: Piece;
  id: Piece;
  /** The raw name (escapes kept), trimmed. */
  name: Piece;
  /** The offset of the `|`, or null. */
  bar: number | null;
  tagline: Piece | null;
  tags: TagGroup | null;
}

export interface ValueRead {
  kind: 'icon' | 'for';
  head: Piece;
  value: Piece | null;
}

export type ShowItemRead =
  | { form: 'element'; piece: Piece; id: Piece; depth: Piece | null }
  | { form: 'tag'; piece: Piece; group: TagGroup }
  | { form: 'other'; piece: Piece };

export interface ShowRead {
  kind: 'show';
  head: Piece;
  items: ShowItemRead[] | null;
  /** Every item in order, with null for an empty one. */
  all: (ShowItemRead | null)[];
  empties: number[];
}

export interface ListRead {
  kind: 'kind' | 'open' | 'close';
  head: Piece;
  list: List | null;
}

export interface WalkStepRead {
  kind: 'walk-step';
  head: Piece;
  target: Piece | null;
  /** The offset of the colon, or null. */
  colon: number | null;
  /** The trimmed text after the colon, or null without a colon. */
  after: Piece | null;
  range: { from: Piece; to: Piece | null } | null;
  list: List | null;
}

export interface DescriptionRead {
  kind: 'description';
  /** `>`, or `>>` when the line starts with two (E304). */
  head: Piece;
  text: Piece;
}

export interface RewordingRead {
  kind: 'rewording';
  /** From the `@` to the end of the audience id. */
  head: Piece;
  audience: Piece;
  form: ':' | '>' | '>>';
  /** From the `@` to the end of the marker, as in `@exec >>`. */
  marker: Piece;
  /** The raw text after the marker, trimmed. */
  text: Piece;
  /** The offset of the first unescaped `|` in the text of a `:` rewording, or null. */
  bar: number | null;
}

export interface SentenceRead {
  kind: 'sentence';
  head: Piece;
  /** The words before any kind group, split on spaces. */
  words: Piece[];
  kind_: TagGroup | null;
  /** The offset of a `[` with no closing `]` after it (E009), or null. */
  unclosed: number | null;
}

export interface UnreadableRead {
  kind: 'unreadable';
  head: Piece;
}

export type Read =
  | TitleRead
  | AudiencesRead
  | ElementRead
  | ValueRead
  | ShowRead
  | ListRead
  | WalkStepRead
  | DescriptionRead
  | RewordingRead
  | SentenceRead
  | UnreadableRead;

/** A continuation line of a description (LANG-010). */
export interface Continuation {
  line: number;
  raw: string;
  text: Piece;
}

export interface Statement {
  /** 1-based line number. */
  line: number;
  raw: string;
  indent: number;
  read: Read;
  parent: Statement | null;
  children: Statement[];
  continuations: Continuation[];
  /** Levels of ownership above this statement: 0 at the top level. */
  depth: number;
  /** Set when the statement cannot be read (E001, E002 or E004); its block is skipped. */
  broken: boolean;
}

export type Entry =
  | { kind: 'blank' }
  | { kind: 'comment'; text: string }
  | { kind: 'statement'; statement: Statement }
  | { kind: 'continuation'; owner: Statement; text: string }
  | { kind: 'skipped' };

export interface Document {
  /** The raw lines, without line endings. */
  lines: string[];
  entries: Entry[];
  /** Statements at the top level, each with its block. */
  top: Statement[];
  /** E001, E002 and E004. */
  diagnostics: Diagnostic[];
}

/** A span on one line from UTF-16 offsets (columns count code points, LANG-901). */
export function spanAt(raw: string, line: number, start: number, end: number): Span {
  const column = codePoints(raw.slice(0, start)) + 1;
  return {
    line,
    column,
    endLine: line,
    endColumn: column + codePoints(raw.slice(start, end)),
  };
}

const piece = (raw: string, start: number, end: number): Piece => ({
  text: raw.slice(start, end),
  start,
  end,
});

/** The piece between two offsets with spaces trimmed off both ends. */
export function trimmed(raw: string, start: number, end: number): Piece {
  let s = start;
  let e = end;
  while (s < e && raw[s] === ' ') s++;
  while (e > s && raw[e - 1] === ' ') e--;
  return piece(raw, s, e);
}

/** Splits at commas outside double quotes and parentheses (when `nested` is set). */
function splitList(raw: string, start: number, end: number, nested = false): List {
  const items: Piece[] = [];
  const commas: number[] = [];
  let from = start;
  let quoted = false;
  let parens = 0;
  for (let i = start; i < end; i++) {
    const c = raw[i];
    if (nested && c === '"') quoted = !quoted;
    else if (nested && !quoted && c === '(') parens++;
    else if (nested && !quoted && c === ')') parens = Math.max(0, parens - 1);
    else if (c === ',' && !quoted && parens === 0) {
      items.push(trimmed(raw, from, i));
      commas.push(i);
      from = i + 1;
    }
  }
  items.push(trimmed(raw, from, end));
  const empties: number[] = [];
  items.forEach((item, index) => {
    if (item.text === '') {
      empties.push(commas[index > 0 ? index - 1 : 0] ?? start);
    }
  });
  return { items: items.filter((item) => item.text !== ''), all: items, empties };
}

/** Splits on runs of spaces. */
function splitWords(raw: string, start: number, end: number): Piece[] {
  const words: Piece[] = [];
  let i = start;
  while (i < end) {
    while (i < end && raw[i] === ' ') i++;
    const from = i;
    while (i < end && raw[i] !== ' ') i++;
    if (i > from) words.push(piece(raw, from, i));
  }
  return words;
}

/** A bracket group starting at `open`: its words, its closing bracket and anything after it. */
function tagGroup(raw: string, open: number, end: number): TagGroup {
  const close = findUnescaped(raw, ']', open + 1);
  if (close === -1 || close >= end) {
    return { open, close: null, items: splitWords(raw, open + 1, end), after: null };
  }
  const after = trimmed(raw, close + 1, end);
  return {
    open,
    close,
    items: splitWords(raw, open + 1, close),
    after: after.text === '' ? null : after,
  };
}

function readTitle(kind: TitleRead['kind'], raw: string, head: Piece, end: number): TitleRead {
  const rest = trimmed(raw, head.end, end);
  if (rest.text === '') {
    return { kind, head, id: null, hasColon: false, title: null };
  }
  const colon = raw.indexOf(':', rest.start);
  if (colon === -1 || colon >= end) {
    return { kind, head, id: rest, hasColon: false, title: null };
  }
  const id = trimmed(raw, rest.start, colon);
  return {
    kind,
    head,
    id: id.text === '' ? null : id,
    hasColon: true,
    title: trimmed(raw, colon + 1, end),
  };
}

const AUDIENCE = /^([^\s"(),]+) *(?:"([^"]*)")? *(?:\(([^)]*)\))?$/d;

function readAudiences(raw: string, head: Piece, end: number): AudiencesRead {
  const rest = trimmed(raw, head.end, end);
  if (rest.text === '') {
    return { kind: 'audiences', head, entries: null, all: [], empties: [] };
  }
  const list = splitList(raw, rest.start, rest.end, true);
  const readEntry = (entry: Piece): AudienceEntry => {
    const match = AUDIENCE.exec(entry.text);
    const at = (group: number): [number, number] | undefined => match?.indices?.[group];
    const idAt = at(1);
    if (match === null || idAt === undefined) {
      return { piece: entry, id: null, name: null, flags: null, flagsAt: null };
    }
    const nameAt = at(2);
    const flagsAt = at(3);
    return {
      piece: entry,
      id: piece(raw, entry.start + idAt[0], entry.start + idAt[1]),
      name: nameAt ? piece(raw, entry.start + nameAt[0], entry.start + nameAt[1]) : null,
      flags: flagsAt ? splitList(raw, entry.start + flagsAt[0], entry.start + flagsAt[1]) : null,
      flagsAt: flagsAt
        ? piece(raw, entry.start + flagsAt[0] - 1, entry.start + flagsAt[1] + 1)
        : null,
    };
  };
  const all = list.all.map((entry) => (entry.text === '' ? null : readEntry(entry)));
  const entries = all.filter((entry) => entry !== null);
  return { kind: 'audiences', head, entries, all, empties: list.empties };
}

function readElement(raw: string, head: Piece, end: number): ElementRead {
  const restStart = head.end + 1; // after the colon
  const open = findUnescaped(raw, '[', restStart);
  const bracket = open === -1 || open >= end ? -1 : open;
  const nameEnd = bracket === -1 ? end : bracket;
  const barAt = findUnescaped(raw, '|', restStart);
  const bar = barAt === -1 || barAt >= nameEnd ? null : barAt;
  return {
    kind: 'element',
    head,
    id: head,
    name: trimmed(raw, restStart, bar ?? nameEnd),
    bar,
    tagline: bar === null ? null : trimmed(raw, bar + 1, nameEnd),
    tags: bracket === -1 ? null : tagGroup(raw, bracket, end),
  };
}

const SHOW_ELEMENT = /^([^\s+[\]]+)(?: *\+ *(\d{1,2}))?$/d;

function readShowItem(raw: string, item: Piece): ShowItemRead {
  if (item.text.startsWith('[')) {
    const group = tagGroup(raw, item.start, item.end);
    return group.after === null
      ? { form: 'tag', piece: item, group }
      : { form: 'other', piece: item };
  }
  const match = SHOW_ELEMENT.exec(item.text);
  const idAt = match?.indices?.[1];
  if (match === null || idAt === undefined) {
    return { form: 'other', piece: item };
  }
  const depthAt = match.indices?.[2];
  return {
    form: 'element',
    piece: item,
    id: piece(raw, item.start + idAt[0], item.start + idAt[1]),
    depth: depthAt ? piece(raw, item.start + depthAt[0], item.start + depthAt[1]) : null,
  };
}

function readShow(raw: string, head: Piece, end: number): ShowRead {
  const rest = trimmed(raw, head.end, end);
  if (rest.text === '') {
    return { kind: 'show', head, items: null, all: [], empties: [] };
  }
  const list = splitList(raw, rest.start, rest.end);
  const all = list.all.map((item) => (item.text === '' ? null : readShowItem(raw, item)));
  return {
    kind: 'show',
    head,
    items: all.filter((item) => item !== null),
    all,
    empties: list.empties,
  };
}

function readList(kind: ListRead['kind'], raw: string, head: Piece, end: number): ListRead {
  const rest = trimmed(raw, head.end, end);
  return {
    kind,
    head,
    list: rest.text === '' ? null : splitList(raw, rest.start, rest.end),
  };
}

const RANGE = /^(\d+)(?: *- *(\d+))?$/d;

function readWalkStep(raw: string, head: Piece, end: number): WalkStepRead {
  const rest = trimmed(raw, head.end, end);
  const colonAt = raw.indexOf(':', rest.start);
  const colon = colonAt === -1 || colonAt >= end ? null : colonAt;
  const target = trimmed(raw, rest.start, colon ?? rest.end);
  const read: WalkStepRead = {
    kind: 'walk-step',
    head,
    target: target.text === '' ? null : target,
    colon,
    after: null,
    range: null,
    list: null,
  };
  if (colon === null) {
    return read;
  }
  const after = trimmed(raw, colon + 1, end);
  read.after = after;
  if (after.text === '') {
    return read;
  }
  const match = RANGE.exec(after.text);
  const fromAt = match?.indices?.[1];
  if (match !== null && fromAt !== undefined) {
    const toAt = match.indices?.[2];
    read.range = {
      from: piece(raw, after.start + fromAt[0], after.start + fromAt[1]),
      to: toAt ? piece(raw, after.start + toAt[0], after.start + toAt[1]) : null,
    };
  } else {
    read.list = splitList(raw, after.start, after.end);
  }
  return read;
}

function readSentence(raw: string, start: number, end: number, head: Piece): SentenceRead {
  let bodyEnd = end;
  let kindGroup: TagGroup | null = null;
  let unclosed: number | null = null;
  if (findLastUnescaped(raw, ']', end) === end - 1) {
    const open = findLastUnescaped(raw, '[', end - 1);
    if (open >= head.end) {
      kindGroup = { open, close: end - 1, items: splitWords(raw, open + 1, end - 1), after: null };
      bodyEnd = open;
    }
  } else {
    const open = findLastUnescaped(raw, '[', end);
    if (open >= head.end && findUnescaped(raw, ']', open + 1) === -1) {
      unclosed = open;
    }
  }
  return {
    kind: 'sentence',
    head,
    words: splitWords(raw, start, bodyEnd),
    kind_: kindGroup,
    unclosed,
  };
}

const REWORDING = /^@([^ :>]*) *(>>|>|:)/;

/** Reads one statement: `start` is the end of its indent, `end` the end of its text (LANG-007). */
export function readStatement(raw: string, start: number, end: number): Read {
  const text = raw.slice(start, end);
  const first = piece(raw, start, start + 1);
  if (text.startsWith('@')) {
    const match = REWORDING.exec(text);
    const audience = match?.[1] ?? '';
    const symbol = match?.[2] ?? ':';
    if (match === null || audience === '') {
      return { kind: 'unreadable', head: first };
    }
    const markerEnd = start + match[0].length;
    const textPiece = trimmed(raw, markerEnd, end);
    const form = symbol === '>>' ? '>>' : symbol === '>' ? '>' : ':';
    const bar = form === ':' ? findUnescaped(raw, '|', textPiece.start) : -1;
    return {
      kind: 'rewording',
      head: piece(raw, start, start + 1 + audience.length),
      audience: piece(raw, start + 1, start + 1 + audience.length),
      form,
      marker: piece(raw, start, markerEnd),
      text: textPiece,
      bar: bar === -1 ? null : bar,
    };
  }
  if (text.startsWith('>')) {
    const doubled = text.startsWith('>>');
    const head = piece(raw, start, start + (doubled ? 2 : 1));
    return { kind: 'description', head, text: trimmed(raw, head.end, end) };
  }
  const word = /^[a-z]+(?= |$)/.exec(text)?.[0];
  if (word !== undefined && isKeyword(word)) {
    const head = piece(raw, start, start + word.length);
    switch (word) {
      case 'model':
      case 'view':
      case 'scenario':
      case 'walkthrough':
        return readTitle(word, raw, head, end);
      case 'audiences':
        return readAudiences(raw, head, end);
      case 'show':
        return readShow(raw, head, end);
      case 'kind':
      case 'open':
      case 'close':
        return readList(word, raw, head, end);
      case 'icon':
      case 'for': {
        const value = trimmed(raw, head.end, end);
        return { kind: word, head, value: value.text === '' ? null : value };
      }
      case 'step':
        return readWalkStep(raw, head, end);
    }
  }
  const headWord = /^[^ :]+/.exec(text)?.[0] ?? '';
  const after = text[headWord.length];
  if (!isIdLike(headWord) || after === undefined) {
    return { kind: 'unreadable', head: first };
  }
  const head = piece(raw, start, start + headWord.length);
  return after === ':' ? readElement(raw, head, end) : readSentence(raw, start, end, head);
}

/** Description lines, and rewordings of descriptions, continue over deeper lines (LANG-010). */
export function isProse(read: Read): boolean {
  return read.kind === 'description' || (read.kind === 'rewording' && read.form !== ':');
}

/** Reads a whole file into lines and blocks (LANG-001 to LANG-007). */
export function readDocument(source: string): Document {
  const text = source.startsWith('﻿') ? source.slice(1) : source;
  const lines = text.split(/\r?\n/);
  const entries: Entry[] = [];
  const top: Statement[] = [];
  const diagnostics: Diagnostic[] = [];
  const stack: Statement[] = [];
  /** The indent each owner's block uses, once its first statement fixes it. */
  const blockIndent = new Map<Statement | null, number>([[null, 0]]);

  lines.forEach((raw, index) => {
    const line = index + 1;
    const indentEnd = /^[ \t]*/.exec(raw)?.[0].length ?? 0;
    const end = raw.replace(/[ \t]+$/, '').length;
    if (end <= indentEnd) {
      entries.push({ kind: 'blank' });
      return;
    }
    const tab = raw.slice(0, indentEnd).indexOf('\t');
    if (tab !== -1) {
      diagnostics.push(diagnostic('E001', spanAt(raw, line, tab, tab + 1)));
    }
    if (raw.startsWith('//', indentEnd)) {
      entries.push({ kind: 'comment', text: raw.slice(indentEnd, end) });
      return;
    }
    const indent = indentEnd;
    const last = stack.at(-1);
    if (last !== undefined && indent > last.indent && isProse(last.read)) {
      if (last.broken) {
        entries.push({ kind: 'skipped' });
      } else {
        last.continuations.push({ line, raw, text: piece(raw, indentEnd, end) });
        entries.push({ kind: 'continuation', owner: last, text: raw.slice(indentEnd, end) });
      }
      return;
    }
    while ((stack.at(-1)?.indent ?? -1) >= indent) {
      stack.pop();
    }
    const owner = stack.at(-1) ?? null;
    const statement: Statement = {
      line,
      raw,
      indent,
      read: readStatement(raw, indentEnd, end),
      parent: owner,
      children: [],
      continuations: [],
      depth: owner === null ? 0 : owner.depth + 1,
      broken: false,
    };
    stack.push(statement);
    if (stack.some((open) => open !== statement && open.broken)) {
      statement.broken = true;
      entries.push({ kind: 'skipped' });
      return;
    }
    entries.push({ kind: 'statement', statement });
    if (tab !== -1) {
      statement.broken = true;
      return;
    }
    const expected = blockIndent.get(owner);
    if (expected === undefined) {
      blockIndent.set(owner, indent);
    } else if (expected !== indent) {
      diagnostics.push(diagnostic('E002', spanAt(raw, line, 0, indent)));
      statement.broken = true;
      return;
    }
    if (statement.read.kind === 'unreadable') {
      diagnostics.push(diagnostic('E004', spanAt(raw, line, indentEnd, indentEnd + 1)));
      statement.broken = true;
      return;
    }
    (owner === null ? top : owner.children).push(statement);
  });
  return { lines, entries, top, diagnostics };
}
