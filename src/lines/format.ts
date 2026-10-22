// The formatter: rewrites a Lines file in one stable style, changing only spacing and keeping
// everything the author wrote, comments included (docs/spec/language.md, section 13).
import type { Diagnostic } from './catalogue.ts';
import { readDocument, type List, type Piece, type Read, type ShowItemRead } from './read.ts';
import { collapseSpaces, findUnescaped } from './text.ts';

export interface FormatResult {
  /** The formatted text, or the text unchanged when the file cannot be formatted. */
  text: string;
  changed: boolean;
  /** E001, E002 and E004, which stop the formatter (LANG-936); empty otherwise. */
  diagnostics: Diagnostic[];
}

const INDENT = '  ';

/** Formats a Lines file (LANG-931 to LANG-938). */
export function format(source: string): FormatResult {
  const document = readDocument(source);
  if (document.diagnostics.length > 0) {
    return { text: source, changed: false, diagnostics: document.diagnostics };
  }
  type Out =
    | { kind: 'blank' }
    | { kind: 'comment'; text: string }
    | { kind: 'line'; text: string; indent: number };
  const out: Out[] = [];
  for (const entry of document.entries) {
    switch (entry.kind) {
      case 'blank':
        out.push({ kind: 'blank' });
        break;
      case 'comment':
        out.push({ kind: 'comment', text: entry.text });
        break;
      case 'statement': {
        const { statement } = entry;
        const text = formatRead(statement.raw, statement.read).replace(/ +$/, '');
        out.push({ kind: 'line', indent: statement.depth, text });
        break;
      }
      case 'continuation':
        out.push({ kind: 'line', indent: entry.owner.depth + 1, text: entry.text });
        break;
      case 'skipped':
        break; // only in files with E001, E002 or E004, which are not formatted
    }
  }
  const lines: string[] = [];
  let indentAfter = 0;
  // Walk backwards so each comment can take the indent of the next line with content (LANG-934).
  for (let i = out.length - 1; i >= 0; i--) {
    const item = out[i];
    if (item === undefined) continue;
    if (item.kind === 'line') {
      indentAfter = item.indent;
      lines.push(INDENT.repeat(item.indent) + item.text);
    } else if (item.kind === 'comment') {
      lines.push(INDENT.repeat(indentAfter) + item.text);
    } else if (lines.length > 0 && lines.at(-1) !== '') {
      lines.push('');
    }
  }
  lines.reverse();
  while (lines[0] === '') {
    lines.shift();
  }
  const text = lines.length === 0 ? '' : lines.join('\n') + '\n';
  return { text, changed: text !== source, diagnostics: [] };
}

const words = (piece: Piece | null): string => (piece === null ? '' : collapseSpaces(piece.text));

/** A list as `a, b, c`, keeping empty items so their diagnostics stay the same. */
const list = (value: List): string => value.all.map((item) => collapseSpaces(item.text)).join(', ');

/** `head` followed by `rest` when there is any. */
const joined = (head: string, rest: string): string => (rest === '' ? head : `${head} ${rest}`);

function showItem(item: ShowItemRead | null): string {
  if (item === null) {
    return '';
  }
  switch (item.form) {
    case 'element':
      return item.depth === null ? item.id.text : `${item.id.text} +${item.depth.text}`;
    case 'tag':
      return item.group.close === null
        ? collapseSpaces(item.piece.text)
        : `[${item.group.items.map((tag) => tag.text).join(' ')}]`;
    case 'other':
      return collapseSpaces(item.piece.text);
  }
}

/** One-line wording with an element's `|`: `name | tagline`, `| tagline` or `name |`. */
function barred(raw: string, text: Piece): string {
  const bar = findUnescaped(raw, '|', text.start);
  if (bar === -1 || bar >= text.end) {
    return collapseSpaces(text.text);
  }
  const name = collapseSpaces(raw.slice(text.start, bar));
  const tagline = collapseSpaces(raw.slice(bar + 1, text.end));
  return joined(name === '' ? '|' : `${name} |`, tagline);
}

/** A statement in canonical spacing (LANG-933). */
export function formatRead(raw: string, read: Read): string {
  const whole = (): string => collapseSpaces(raw.slice(read.head.start).replace(/[ \t]+$/, ''));
  switch (read.kind) {
    case 'model':
    case 'view':
    case 'scenario':
    case 'walkthrough': {
      if (read.id === null) {
        return whole();
      }
      const head = `${read.kind} ${collapseSpaces(read.id.text)}`;
      return read.hasColon ? joined(`${head}:`, words(read.title)) : head;
    }
    case 'audiences': {
      if (read.entries === null) {
        return 'audiences';
      }
      const entries = read.all.map((entry) => {
        if (entry === null) {
          return '';
        }
        if (entry.id === null) {
          return entry.piece.text;
        }
        let text = entry.id.text;
        if (entry.name !== null) text += ` "${entry.name.text}"`;
        if (entry.flags !== null) text += ` (${list(entry.flags)})`;
        return text;
      });
      return `audiences ${entries.join(', ')}`;
    }
    case 'element': {
      const tags = read.tags;
      if (tags !== null && (tags.close === null || tags.after !== null)) {
        return whole();
      }
      let text = joined(`${read.id.text}:`, words(read.name));
      if (read.bar !== null) {
        text = joined(`${text} |`, words(read.tagline));
      }
      if (tags !== null) {
        text += ` [${tags.items.map((tag) => tag.text).join(' ')}]`;
      }
      return text;
    }
    case 'icon':
    case 'for':
      return joined(read.kind, words(read.value));
    case 'show':
      return read.items === null ? 'show' : `show ${read.all.map(showItem).join(', ')}`;
    case 'kind':
    case 'open':
    case 'close':
      return read.list === null ? read.kind : `${read.kind} ${list(read.list)}`;
    case 'walk-step': {
      if (read.target === null) {
        return whole();
      }
      const head = `step ${collapseSpaces(read.target.text)}`;
      if (read.colon === null) {
        return head;
      }
      let after = '';
      if (read.range !== null) {
        after =
          read.range.to === null
            ? read.range.from.text
            : `${read.range.from.text}-${read.range.to.text}`;
      } else if (read.list !== null) {
        after = list(read.list);
      }
      return joined(`${head}:`, after);
    }
    case 'description':
      return joined(read.head.text, read.text.text);
    case 'rewording': {
      const audience = `@${read.audience.text}`;
      if (read.form === ':') {
        return joined(`${audience}:`, barred(raw, read.text));
      }
      return joined(`${audience} ${read.form}`, read.text.text);
    }
    case 'sentence': {
      if (read.unclosed !== null) {
        return whole();
      }
      const body = read.words.map((word) => word.text).join(' ');
      if (read.kind_ === null) {
        return body;
      }
      return `${body} [${read.kind_.items.map((item) => item.text).join(' ')}]`;
    }
    case 'unreadable':
      return whole();
  }
}
