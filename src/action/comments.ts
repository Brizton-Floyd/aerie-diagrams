// What the Action writes on a pull request (docs/spec/drift.md, section 8): one sticky comment per
// model file, found again by its hidden marker (DRIFT-603), and a GitHub `suggestion` review
// comment for each suggested edit on lines the pull request adds (DRIFT-604).
import { fence, type DriftDocument } from '../drift/index.ts';
import { listAll, type Api, type PullRequest } from './github.ts';
import type { CommentMode } from './inputs.ts';

interface IssueComment {
  id: number;
  body?: string;
}

/** The first line of a comment's body, where the marker of an Aerie comment is. */
const firstLine = (body: string | undefined): string => (body ?? '').split('\n', 1)[0] ?? '';

export type Upserted = 'created' | 'updated' | 'unchanged' | 'skipped';

/**
 * DRIFT-603: posts the model file's comment, or edits the one its marker finds, so a pull request
 * keeps one comment per model file however often it runs. With `on-findings`, a comment is only
 * created when the run found something, but one that exists is always brought up to date.
 */
export async function upsertComment(
  api: Api,
  pr: PullRequest,
  marker: string,
  body: string,
  mode: CommentMode,
  found: boolean,
): Promise<Upserted> {
  if (mode === 'never') return 'skipped';
  const issue = `/repos/${pr.owner}/${pr.repo}/issues`;
  const comments = await listAll<IssueComment>(api, `${issue}/${String(pr.number)}/comments`);
  const existing = comments.find((each) => firstLine(each.body) === marker);
  if (existing !== undefined) {
    if (existing.body === body) return 'unchanged';
    await api.request('PATCH', `${issue}/comments/${String(existing.id)}`, { body });
    return 'updated';
  }
  if (mode === 'on-findings' && !found) return 'skipped';
  await api.request('POST', `${issue}/${String(pr.number)}/comments`, { body });
  return 'created';
}

/** The lines a file's patch adds, by their number in the new file. */
export function addedLines(patch: string): Map<number, string> {
  const added = new Map<number, string>();
  let line = 0;
  for (const each of patch.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(each);
    if (hunk !== null) {
      line = Number(hunk[1]);
    } else if (each.startsWith('+')) {
      added.set(line++, each.slice(1).replace(/\r$/, ''));
    } else if (each.startsWith(' ')) {
      line++;
    }
  }
  return added;
}

/** A review comment as the reviews API takes it. */
export interface ReviewComment {
  path: string;
  line: number;
  start_line?: number;
  side: 'RIGHT';
  start_side?: 'RIGHT';
  body: string;
}

/** The hidden marker of one suggested edit, so a later run does not post it again. */
export function suggestionMarker(path: string, key: string, at: number): string {
  return `<!-- aerie-drift-suggestion: ${path} ${String(at)} ${encodeURIComponent(key)} -->`;
}

/**
 * DRIFT-604: a `suggestion` for each edit of a drift or likely finding whose lines the pull request
 * adds, as the model file reads at its head: an edit replaces its lines, and a line added before
 * line `at` is suggested with the added line above it (or, failing that, below it), when that line
 * reads at the head as it does in `source`, the model text drift ran on.
 */
export function suggestionComments(
  document: DriftDocument,
  path: string,
  added: ReadonlyMap<number, string>,
  source: string,
): ReviewComment[] {
  const comments: ReviewComment[] = [];
  const same = (line: number, text: string): boolean => added.get(line) === text.replace(/\r$/, '');
  const lines = source.split('\n');
  const anchor = (line: number): boolean => same(line, lines[line - 1] ?? '\0');
  for (const finding of document.findings) {
    for (const hunk of finding.edits) {
      let from = hunk.at;
      let lines = hunk.add;
      if (hunk.remove.length > 0) {
        if (!hunk.remove.every((text, i) => same(hunk.at + i, text))) continue;
      } else if (anchor(hunk.at - 1)) {
        from = hunk.at - 1;
        lines = [added.get(from) ?? '', ...hunk.add];
      } else if (anchor(hunk.at)) {
        lines = [...hunk.add, added.get(hunk.at) ?? ''];
      } else {
        continue;
      }
      const to = from + Math.max(hunk.remove.length, 1) - 1;
      comments.push({
        path,
        ...(to > from ? { start_line: from, start_side: 'RIGHT' as const } : {}),
        line: to,
        side: 'RIGHT',
        body: [
          suggestionMarker(path, finding.key, hunk.at),
          `**${finding.id ?? ''}** ${finding.title}`,
          '',
          ...fence(lines, 'suggestion'),
        ].join('\n'),
      });
    }
  }
  return comments;
}

/** DRIFT-604: posts, as one review, the suggestions no earlier run posted; returns how many. */
export async function postSuggestions(
  api: Api,
  pr: PullRequest,
  file: string,
  comments: readonly ReviewComment[],
): Promise<number> {
  if (comments.length === 0) return 0;
  const pulls = `/repos/${pr.owner}/${pr.repo}/pulls/${String(pr.number)}`;
  const posted = new Set(
    (await listAll<IssueComment>(api, `${pulls}/comments`)).map((each) => firstLine(each.body)),
  );
  const fresh = comments.filter((each) => !posted.has(firstLine(each.body)));
  if (fresh.length === 0) return 0;
  await api.request('POST', `${pulls}/reviews`, {
    commit_id: pr.head,
    event: 'COMMENT',
    body: `Aerie drift suggests ${fresh.length === 1 ? 'an edit' : `${String(fresh.length)} edits`} to \`${file}\` on lines this pull request adds.`,
    comments: fresh,
  });
  return fresh.length;
}
