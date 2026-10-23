// The GitHub Action's inputs (docs/spec/drift.md, section 8; DRIFT-601), as `action.yml` passes
// them in the environment: read and checked before anything runs, so a wrong input stops the job
// with a plain message (exit code 2, as for a wrong option of `aerie drift`).
import type { Level } from '../drift/index.ts';

/** When the sticky comment is posted: on every run, only when something was found, or never. */
export const COMMENT_MODES = ['always', 'on-findings', 'never'] as const;
export type CommentMode = (typeof COMMENT_MODES)[number];

/** Where a sibling repo comes from: `owner/name` on the same GitHub, and a branch or tag. */
export interface RepoSource {
  repository: string;
  ref: string | null;
}

export interface Inputs {
  /** The model files, as the workflow names them from the top of the checkout. */
  models: string[];
  failOn: Level;
  comment: CommentMode;
  /** Posts the comments; usually `github.token`. */
  token: string;
  /** Reads the sibling repos; a token that can read them when they are private. */
  reposToken: string;
  /** Sibling sources by `repo` line as written, or by its folder's name. */
  repos: Map<string, RepoSource>;
}

/** A wrong input: the action stops before it runs drift. */
export class BadInput extends Error {}

const REPOSITORY = /^[\w.-]+\/[\w.-]+$/;

/** DRIFT-602: `repos` lines, `<repo line or folder>=<owner>/<name>[@<branch or tag>]`. */
export function readRepos(text: string): Map<string, RepoSource> {
  const repos = new Map<string, RepoSource>();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    const key = line.slice(0, equals).trim();
    const value = line.slice(equals + 1).trim();
    const at = value.indexOf('@');
    const repository = at === -1 ? value : value.slice(0, at);
    const ref = at === -1 ? null : value.slice(at + 1);
    if (equals <= 0 || !REPOSITORY.test(repository) || ref === '') {
      throw new BadInput(
        `Each line of repos is <repo line>=<owner>/<name>, with @<branch> if needed, not ${line}.`,
      );
    }
    repos.set(key, { repository, ref });
  }
  return repos;
}

/** DRIFT-601: the inputs from the environment `action.yml` sets (`AERIE_<INPUT>`). */
export function readInputs(env: Readonly<Record<string, string | undefined>>): Inputs {
  const input = (name: string): string => (env[`AERIE_${name}`] ?? '').trim();
  const models = input('MODELS')
    .split(/\s+/)
    .filter((each) => each !== '');
  if (models.length === 0) {
    throw new BadInput(
      'Name the model files to check in models, as in models: architecture.aerie.',
    );
  }
  const failOn = input('FAIL_ON') || 'drift';
  if (failOn !== 'drift' && failOn !== 'likely') {
    throw new BadInput(`fail-on is drift or likely, not ${failOn}.`);
  }
  const comment = input('COMMENT') || 'always';
  if (!(COMMENT_MODES as readonly string[]).includes(comment)) {
    throw new BadInput(`comment is always, on-findings or never, not ${comment}.`);
  }
  const token = input('TOKEN');
  return {
    models,
    failOn,
    comment: comment as CommentMode,
    token,
    reposToken: input('REPOS_TOKEN') || token,
    repos: readRepos(env['AERIE_REPOS'] ?? ''),
  };
}
