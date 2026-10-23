// Small text rules shared by the reader, the parser, the formatter and the printer.

/** The keywords of LANG-007, in the order the spec lists them (ties in suggestions go to the first). */
export const KEYWORDS = [
  'model',
  'audiences',
  'view',
  'scenario',
  'walkthrough',
  'step',
  'show',
  'kind',
  'icon',
  'open',
  'close',
  'for',
  'system',
  'repo',
  'compose',
  'code',
  'ignore',
] as const;

export type Keyword = (typeof KEYWORDS)[number];

export function isKeyword(word: string): word is Keyword {
  return (KEYWORDS as readonly string[]).includes(word);
}

const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** LANG-008: lowercase letters, digits and single hyphens, starting with a letter. */
export function isId(text: string): boolean {
  return ID.test(text);
}

/**
 * A word that looks meant as an id, even if it breaks LANG-008 (`Web`, `screen_api`). Lines that
 * start with one are read as elements or sentences, so the author gets E005 or E008 rather than E004.
 */
export function isIdLike(text: string): boolean {
  return /^[\p{L}\p{N}_][\p{L}\p{N}_.-]*$/u.test(text);
}

/** Characters a backslash makes ordinary inside words (LANG-011). */
const ESCAPABLE = '|[]\\';

/** The offset of the first unescaped `char` at or after `from`, or -1. */
export function findUnescaped(text: string, char: string, from = 0): number {
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (c === '\\' && ESCAPABLE.includes(text[i + 1] ?? ' ')) {
      i++;
    } else if (c === char) {
      return i;
    }
  }
  return -1;
}

/** The offset of the last unescaped `char` before `before`, or -1. */
export function findLastUnescaped(text: string, char: string, before = text.length): number {
  let found = -1;
  for (let i = 0; i < before; i++) {
    const c = text[i];
    if (c === '\\' && ESCAPABLE.includes(text[i + 1] ?? ' ')) {
      i++;
    } else if (c === char) {
      found = i;
    }
  }
  return found;
}

/** Runs of spaces become one space, and leading and trailing spaces go. */
export function collapseSpaces(text: string): string {
  return text.replace(/ {2,}/g, ' ').replace(/^ | $/g, '');
}

/** Trims spaces only (a tab is text, LANG-004 applies to indents). */
export function trimSpaces(text: string): string {
  return text.replace(/^ +| +$/g, '');
}

/** Words as the model holds them: spaces collapsed and backslash escapes removed (LANG-011). */
export function decodeWords(raw: string): string {
  let out = '';
  const text = collapseSpaces(raw);
  for (let i = 0; i < text.length; i++) {
    const c = text[i] ?? '';
    const next = text[i + 1];
    if (c === '\\' && next !== undefined && ESCAPABLE.includes(next)) {
      out += next;
      i++;
    } else {
      out += c;
    }
  }
  return out;
}

/** Words written back as Lines: every `|`, `[`, `]` and `\` gets a backslash. */
export function encodeWords(words: string): string {
  return words.replace(/[|[\]\\]/g, '\\$&');
}

/** The number of code points in a string. */
export function codePoints(text: string): number {
  return Array.from(text).length;
}

/** "big-picture" gives "Big picture" (the E011 example). */
export function nameFromId(id: string): string {
  const spaced = id.replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Edits between two words: insertions, deletions, substitutions and swaps of neighbours. */
export function editDistance(a: string, b: string): number {
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    const row: number[] = [];
    for (let j = 0; j <= b.length; j++) {
      if (i === 0 || j === 0) {
        row.push(i + j);
        continue;
      }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const above = rows[i - 1] ?? [];
      let best = Math.min((above[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (above[j - 1] ?? 0) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, (rows[i - 2]?.[j - 2] ?? 0) + 1);
      }
      row.push(best);
    }
    rows.push(row);
  }
  return rows[a.length]?.[b.length] ?? 0;
}

/**
 * The closest candidate within two edits and closer than half the word's length, ties going to the
 * first candidate (LANG-904), or undefined.
 */
export function closest(word: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (candidate === word) {
      continue;
    }
    const distance = editDistance(word, candidate);
    if (distance <= 2 && distance < word.length / 2 && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/** The `{suggestion}` placeholder: " Did you mean `x`?" or nothing (LANG-905). */
export function suggestion(word: string, candidates: Iterable<string>): string {
  const found = closest(word, candidates);
  return found === undefined ? '' : ` Did you mean \`${found}\`?`;
}

/** The `{list}` placeholder: ids in backticks, comma separated, in declaration order. */
export function codeList(ids: readonly string[]): string {
  return ids.map((id) => `\`${id}\``).join(', ');
}
