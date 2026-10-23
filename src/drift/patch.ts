// `aerie drift --format diff` (docs/spec/drift.md, DRIFT-506): every suggested edit as one unified
// diff of the model file, a patch the author applies with `git apply` or `patch -p1`. Aerie never
// writes the file itself.
import type { Hunk } from './file.ts';

/** The lines of context a unified diff shows around each change. */
const CONTEXT = 3;

interface Line {
  sign: ' ' | '-' | '+';
  text: string;
  /** The line the file ends with, which has no newline after it. */
  last?: boolean;
}

/** DRIFT-506: the hunks as a unified diff of `file`, or '' when there are none. */
export function unifiedDiff(file: string, source: string, hunks: readonly Hunk[]): string {
  const body = diffHunks(source, hunks);
  return body === '' ? '' : `--- a/${file}\n+++ b/${file}\n${body}`;
}

/** The `@@` hunks of a unified diff, without its file names, or '' when there are none. */
export function diffHunks(source: string, hunks: readonly Hunk[]): string {
  const lines = source.split(/\r?\n/);
  const crlf = source.includes('\r\n');
  const newline = lines.at(-1) === '';
  if (newline) lines.pop();
  const count = lines.length;
  const changes = [...hunks]
    .filter((hunk) => hunk.remove.length > 0 || hunk.add.length > 0)
    .sort((a, b) => a.at - b.at);
  for (const hunk of changes) {
    const found = lines.slice(hunk.at - 1, hunk.at - 1 + hunk.remove.length);
    if (found.join('\n') !== hunk.remove.join('\n')) {
      throw new Error(`The edit at line ${String(hunk.at)} does not match the file.`);
    }
  }
  // Changes whose context touches share one `@@` hunk, from line `from` to line `to`.
  const groups: { from: number; to: number; hunks: Hunk[] }[] = [];
  for (const hunk of changes) {
    const from = Math.max(1, hunk.at - CONTEXT);
    const to = Math.min(count, hunk.at + hunk.remove.length - 1 + CONTEXT);
    const group = groups.at(-1);
    if (group !== undefined && from <= group.to + 1) {
      group.hunks.push(hunk);
      group.to = Math.max(group.to, to);
    } else {
      groups.push({ from, to, hunks: [hunk] });
    }
  }
  let offset = 0;
  return groups
    .map(({ from, to, hunks: group }) => {
      const out: Line[] = [];
      let line = from;
      for (const hunk of group) {
        for (; line < hunk.at; line++) out.push({ sign: ' ', text: lines[line - 1] ?? '' });
        for (const text of hunk.remove) out.push({ sign: '-', text });
        for (const text of hunk.add) out.push({ sign: '+', text });
        line = hunk.at + hunk.remove.length;
      }
      for (; line <= to; line++) out.push({ sign: ' ', text: lines[line - 1] ?? '' });
      const old = out.filter((each) => each.sign !== '+').length;
      const added = out.filter((each) => each.sign !== '-').length;
      const header = `@@ -${range(from, old)} +${range(from + offset, added)} @@`;
      offset += added - old;
      if (!newline && to === count) markLast(out);
      return [header, ...out.flatMap((each) => print(each, crlf))].join('\n') + '\n';
    })
    .join('');
}

/** `start,count`, with the count left out when it is 1, and the line before when it is 0. */
function range(start: number, count: number): string {
  if (count === 0) return `${String(start - 1)},0`;
  return count === 1 ? String(start) : `${String(start)},${String(count)}`;
}

/**
 * A file that does not end with a newline: the last line of the old file and of the new are each
 * marked. When they are not the same line, the end of the hunk from the first of them on is written
 * as its old lines taken out and its new lines put in, so that each side ends where it should.
 */
function markLast(out: Line[]): void {
  const oldLast = out.findLastIndex((each) => each.sign !== '+');
  const newLast = out.findLastIndex((each) => each.sign !== '-');
  if (oldLast === -1 || newLast === -1 || oldLast === newLast) {
    mark(out.at(Math.max(oldLast, newLast)));
    return;
  }
  const tail = out.splice(Math.min(oldLast, newLast));
  const old = tail.flatMap((each): Line[] => (each.sign === '+' ? [] : [{ ...each, sign: '-' }]));
  const next = tail.flatMap((each): Line[] => (each.sign === '-' ? [] : [{ ...each, sign: '+' }]));
  mark(old.at(-1));
  mark(next.at(-1));
  out.push(...old, ...next);
}

function mark(line: Line | undefined): void {
  if (line !== undefined) line.last = true;
}

/** A line as written, ending in `\r` when the file's lines end in CRLF and this one has an end. */
function print(line: Line, crlf: boolean): string[] {
  return [
    `${line.sign}${line.text}${crlf && line.last !== true ? '\r' : ''}`,
    ...(line.last === true ? ['\\ No newline at end of file'] : []),
  ];
}
