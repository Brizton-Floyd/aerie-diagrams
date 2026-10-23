// What the split editor knows about Lines (docs/spec/interaction.md, INT-802 to INT-804): the colour
// of each part of a line, the indent a new line starts with, and what completion offers where the
// cursor is. Built on the reader, so the editor sees lines exactly as the parser does.
import { ICON_NAMES } from './icons.ts';
import { DEFAULT_AUDIENCES } from './parse.ts';
import { isProse, readStatement, type List, type Piece, type Read, type TagGroup } from './read.ts';
import { KEYWORDS, isId, isKeyword } from './text.ts';

/** INT-802: the kinds of text the editor colours. Everything else is plain. */
export type TokenKind = 'keyword' | 'id' | 'rewording' | 'description' | 'comment' | 'tag' | 'kind';

/** One coloured stretch of a line: `from` and `to` are UTF-16 offsets from the start of the line. */
export interface Token {
  /** 1-based line number. */
  line: number;
  from: number;
  to: number;
  kind: TokenKind;
}

/**
 * A line as the editor sees it. `raw` is the line as the editor holds it (a byte order mark kept),
 * `start` the offset after any mark, and `indent` the offset of the first character after the indent.
 */
type Scanned = { line: number; raw: string; start: number; indent: number } & (
  { kind: 'blank' | 'comment' | 'continuation' } | { kind: 'statement'; read: Read }
);

/**
 * Reads every line on its own, the way the reader does (LANG-002, LANG-003, LANG-010), but without
 * skipping the blocks of broken statements: the editor colours and completes every line.
 */
function scan(source: string): Scanned[] {
  const out: Scanned[] = [];
  /** The indent of the description that deeper lines continue, or null. */
  let prose: number | null = null;
  source.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const start = line === 1 && raw.startsWith('\uFEFF') ? 1 : 0;
    const indent = start + (/^[ \t]*/.exec(raw.slice(start))?.[0].length ?? 0);
    const end = raw.replace(/[ \t]+$/, '').length;
    const at = { line, raw, start, indent };
    if (end <= indent) {
      out.push({ kind: 'blank', ...at });
    } else if (raw.startsWith('//', indent)) {
      out.push({ kind: 'comment', ...at });
    } else if (prose !== null && indent > prose) {
      out.push({ kind: 'continuation', ...at });
    } else {
      const read = readStatement(raw, indent, end);
      prose = isProse(read) ? indent : null;
      out.push({ kind: 'statement', read, ...at });
    }
  });
  return out;
}

// ------------------------------------------------------------------ highlighting

function tokensOf(read: Read, line: number, end: number): Token[] {
  const out: Token[] = [];
  const mark = (from: number, to: number, kind: TokenKind): void => {
    if (to > from) out.push({ line, from, to, kind });
  };
  const piece = (at: Piece | null, kind: TokenKind): void => {
    if (at !== null) mark(at.start, at.end, kind);
  };
  const list = (at: List | null, kind: TokenKind): void => {
    at?.items.forEach((item) => {
      piece(item, kind);
    });
  };
  const group = (at: TagGroup | null, kind: TokenKind): void => {
    if (at !== null) mark(at.open, at.close === null ? end : at.close + 1, kind);
  };
  switch (read.kind) {
    case 'model':
    case 'view':
    case 'scenario':
    case 'walkthrough':
      piece(read.head, 'keyword');
      piece(read.id, 'id');
      break;
    case 'audiences':
      piece(read.head, 'keyword');
      for (const entry of read.entries ?? []) {
        piece(entry.id, 'id');
        list(entry.flags, 'tag');
      }
      break;
    case 'element':
      piece(read.id, 'id');
      group(read.tags, 'tag');
      break;
    case 'icon':
    case 'for':
      piece(read.head, 'keyword');
      piece(read.value, 'id');
      break;
    case 'system':
    case 'repo':
    case 'compose':
      piece(read.head, 'keyword');
      break;
    case 'code':
      piece(read.head, 'keyword');
      for (const unit of read.units) piece(unit, 'tag');
      break;
    case 'ignore':
      // `ignore drift`, then element ids and code units; the `to` between them and the reason are
      // plain.
      piece(read.head, 'keyword');
      if (read.what?.text === 'drift') piece(read.what, 'keyword');
      read.subject.forEach((word, index) => {
        if (word.text.includes(':')) piece(word, 'tag');
        else if (index !== 1 || word.text !== 'to') piece(word, 'id');
      });
      break;
    case 'show':
      piece(read.head, 'keyword');
      for (const item of read.items ?? []) {
        if (item.form === 'element') piece(item.id, 'id');
        else if (item.form === 'tag') group(item.group, 'tag');
      }
      break;
    case 'kind':
      piece(read.head, 'keyword');
      list(read.list, 'kind');
      break;
    case 'open':
    case 'close':
      piece(read.head, 'keyword');
      list(read.list, 'id');
      break;
    case 'walk-step':
      piece(read.head, 'keyword');
      piece(read.target, 'id');
      list(read.list, 'id');
      break;
    case 'description':
      mark(read.head.start, end, 'description');
      break;
    case 'rewording':
      piece(read.marker, 'rewording');
      if (read.form !== ':') piece(read.text, 'description');
      break;
    case 'sentence': {
      // LANG-013: the first word is the subject, the last the object, and a run of words ending in
      // a comma just before it are further objects; the words between are the verb phrase.
      const words = read.words;
      piece(read.head, 'id');
      let at = words.length - 1;
      if (at > 0) piece(words[at] ?? null, 'id');
      while (at > 2 && words[at - 1]?.text.endsWith(',') === true) {
        at--;
        const object = words[at];
        if (object !== undefined) mark(object.start, object.end - 1, 'id');
      }
      group(read.kind_, 'kind');
      break;
    }
    case 'unreadable':
      break;
  }
  return out;
}

/** INT-802: the coloured stretches of every line, in line order and, within a line, left to right. */
export function highlight(source: string): Token[] {
  const out: Token[] = [];
  for (const each of scan(source)) {
    const end = each.raw.replace(/[ \t]+$/, '').length;
    if (each.kind === 'comment') {
      out.push({ line: each.line, from: each.indent, to: end, kind: 'comment' });
    } else if (each.kind === 'continuation') {
      out.push({ line: each.line, from: each.indent, to: end, kind: 'description' });
    } else if (each.kind === 'statement') {
      out.push(...tokensOf(each.read, each.line, end).sort((a, b) => a.from - b.from));
    }
  }
  return out;
}

// ------------------------------------------------------------------ indentation

/** The line kinds that open a block, so the line after them starts one level deeper (INT-803). */
const OPENERS: ReadonlySet<Read['kind']> = new Set([
  'model',
  'element',
  'view',
  'scenario',
  'walkthrough',
  'walk-step',
  'system',
]);

/**
 * INT-803: the indent of the new line when Enter is pressed at `column` (a UTF-16 offset) of `line`
 * (1-based): the line's own indent, and two spaces more after a line that opens a block.
 */
export function newLineIndent(source: string, line: number, column: number): string {
  const scanned = scan(source)[line - 1];
  if (scanned === undefined) return '';
  const before = scanned.raw.slice(0, column);
  const spaces = /^ */.exec(before.slice(scanned.start))?.[0].length ?? 0;
  const indent = ' '.repeat(spaces);
  if (scanned.kind !== 'statement') return indent;
  const from = scanned.start + spaces;
  const end = before.replace(/[ \t]+$/, '').length;
  const opens = end > from && OPENERS.has(readStatement(before, from, end).kind);
  return opens ? `${indent}  ` : indent;
}

// ------------------------------------------------------------------ completion

/** What a completion option names. */
export type OptionKind =
  'keyword' | 'element' | 'tag' | 'view' | 'scenario' | 'audience' | 'icon' | 'kind';

export interface CompletionOption {
  label: string;
  kind: OptionKind;
  /** For an element, its name as written. */
  detail?: string;
}

export interface Completions {
  /** The UTF-16 offset in the line where the word being completed starts. */
  from: number;
  options: CompletionOption[];
}

/** Everything a file declares that completion can offer, in declaration order. */
interface Vocabulary {
  elements: CompletionOption[];
  tags: string[];
  views: string[];
  scenarios: string[];
  audiences: string[];
  kinds: string[];
}

function vocabulary(lines: Scanned[]): Vocabulary {
  const found = {
    elements: new Map<string, string>(),
    tags: new Set<string>(),
    views: new Set<string>(),
    scenarios: new Set<string>(),
    audiences: new Set<string>(),
    kinds: new Set<string>(['runtime']),
  };
  let declaredAudiences = false;
  for (const each of lines) {
    if (each.kind !== 'statement') continue;
    const read = each.read;
    if (read.kind === 'element' && isId(read.id.text)) {
      if (!found.elements.has(read.id.text)) found.elements.set(read.id.text, read.name.text);
      for (const tag of read.tags?.items ?? []) if (isId(tag.text)) found.tags.add(tag.text);
    } else if (read.kind === 'view' || read.kind === 'scenario') {
      if (read.id !== null && isId(read.id.text)) found[`${read.kind}s`].add(read.id.text);
    } else if (read.kind === 'audiences' && read.entries !== null) {
      declaredAudiences = true;
      for (const entry of read.entries) if (entry.id !== null) found.audiences.add(entry.id.text);
    } else if (read.kind === 'sentence' && each.indent === 0) {
      for (const kind of read.kind_?.items ?? []) if (isId(kind.text)) found.kinds.add(kind.text);
    }
  }
  return {
    elements: [...found.elements].map(([label, detail]) => ({ label, kind: 'element', detail })),
    tags: [...found.tags],
    views: [...found.views],
    scenarios: [...found.scenarios],
    audiences: declaredAudiences
      ? [...found.audiences]
      : DEFAULT_AUDIENCES.map((audience) => audience.id),
    kinds: [...found.kinds],
  };
}

const named = (labels: readonly string[], kind: OptionKind): CompletionOption[] =>
  labels.map((label) => ({ label, kind }));

/** Text that ends inside a comma-separated list after a keyword: `open a, b` and the like. */
const inList = (keyword: string): RegExp => new RegExp(`^${keyword} +(?:[^,]*, *)*$`);

/**
 * INT-804: what completion offers at `column` (a UTF-16 offset) of `line` (1-based), or null when
 * it offers nothing there: element ids at the start and end of a sentence and in `show`, `open`,
 * `close` and focus lists; tags after `[` in `show`; views and scenarios after `step`; audiences
 * after `@` and `for`; icon names after `icon`; kinds after `kind`; keywords at the start of a line.
 */
export function completionsAt(source: string, line: number, column: number): Completions | null {
  const lines = scan(source);
  const scanned = lines[line - 1];
  if (scanned === undefined || scanned.kind === 'comment' || scanned.kind === 'continuation') {
    return null;
  }
  const before = scanned.raw.slice(0, column);
  const word = /[a-z0-9-]*$/.exec(before)?.[0] ?? '';
  const from = column - word.length;
  const lead = before.slice(scanned.start, from).replace(/^ +/, '');
  const words = vocabulary(lines);
  const offer = (options: CompletionOption[]): Completions | null =>
    options.length === 0 ? null : { from, options };

  if (lead === '') return offer([...named(KEYWORDS, 'keyword'), ...words.elements]);
  if (lead === '@') return offer(named(words.audiences, 'audience'));
  if (/^for +$/.test(lead)) return offer(named(words.audiences, 'audience'));
  if (/^icon +$/.test(lead)) return offer(named(ICON_NAMES, 'icon'));
  if (inList('kind').test(lead)) return offer(named(words.kinds, 'kind'));
  if (/^show +(?:[^,]*, *)*\[ *$/.test(lead)) return offer(named(words.tags, 'tag'));
  if (inList('show').test(lead) || inList('open').test(lead) || inList('close').test(lead)) {
    return offer(words.elements);
  }
  if (/^step +$/.test(lead)) {
    return offer([...named(words.views, 'view'), ...named(words.scenarios, 'scenario')]);
  }
  const focus = /^step +([^ :]+) *: *(?:[^,]*, *)*$/.exec(lead);
  if (focus !== null) return words.views.includes(focus[1] ?? '') ? offer(words.elements) : null;
  // A sentence: an id-like first word, a space, and no bracket group begun.
  const subject = /^([^ :@>[]+) +[^[]*$/.exec(lead)?.[1];
  if (subject !== undefined && !isKeyword(subject)) return offer(words.elements);
  return null;
}
