// Sibling repos (docs/spec/drift.md, section 8; DRIFT-602): a model whose system root names repos
// beside its own is checked with each of them checked out, read only, where its `repo` line points.
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { repositoryOf } from '../cli/project.ts';
import type { System } from '../lines/index.ts';
import type { RepoSource } from './inputs.ts';
import { redact, secretForms, tokenHeader } from './secrets.ts';

/** Written into a clone's `.git`, so a later run on the same machine knows the folder is its own. */
const CLONED = 'aerie-drift-clone';

export interface Sibling {
  /** The `repo` line as written. */
  written: string;
  /** Where it points. */
  path: string;
  source: RepoSource;
}

/**
 * DRIFT-602: the repos to check out for a model file: each `repo` line that points outside the
 * model's own repository at a folder that is not there yet (or that an earlier run checked out).
 * A sibling comes from the `repos` input, by its line or its folder's name, else from the
 * repository of that name under the same owner, on its default branch.
 */
export function siblingsOf(
  model: string,
  system: System | null,
  repos: ReadonlyMap<string, RepoSource>,
  owner: string,
): Sibling[] {
  const folder = dirname(resolve(model));
  const home = repositoryOf(folder);
  return (system?.repos ?? []).flatMap((written) => {
    const path = resolve(folder, written);
    if (path === home || (existsSync(path) && !existsSync(join(path, '.git', CLONED)))) return [];
    const name = basename(path);
    const source = repos.get(written) ??
      repos.get(name) ?? { repository: `${owner}/${name}`, ref: null };
    return [{ written, path, source }];
  });
}

/** Runs git with its arguments and extra environment; throws as `execFileSync` does. */
export type Git = (args: string[], env: Record<string, string>) => void;

const runGit: Git = (args, env) => {
  execFileSync('git', args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'ignore', 'pipe'],
    encoding: 'utf8',
  });
};

/**
 * DRIFT-606: the environment that gives git the token's header for one command, after any
 * configuration the environment already gives it (`GIT_CONFIG_COUNT`), so the token is never an
 * argument (which the machine's process list shows) and never stored in the clone.
 */
export function headerEnv(
  server: string,
  token: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Record<string, string> {
  if (token === '' || !/^https?:/.test(server)) return {};
  const index = Number(env['GIT_CONFIG_COUNT'] ?? '0') || 0;
  return {
    GIT_CONFIG_COUNT: String(index + 1),
    [`GIT_CONFIG_KEY_${String(index)}`]: `http.${server}/.extraheader`,
    [`GIT_CONFIG_VALUE_${String(index)}`]: tokenHeader(token),
  };
}

/**
 * Checks a sibling out: a shallow clone from `server` (`GITHUB_SERVER_URL`), with the token's
 * header in git's environment (DRIFT-606). Throws with git's message, the token redacted.
 */
export function cloneSibling(sibling: Sibling, server: string, token: string, git = runGit): void {
  rmSync(sibling.path, { recursive: true, force: true });
  const { repository, ref } = sibling.source;
  try {
    git(
      [
        'clone',
        '--quiet',
        '--depth',
        '1',
        '--no-tags',
        ...(ref === null ? [] : ['--branch', ref]),
        `${server}/${repository}.git`,
        sibling.path,
      ],
      headerEnv(server, token),
    );
  } catch (error) {
    // git's own words when it gave any, else the error's message alone (never its whole value).
    const stderr = (error as { stderr?: unknown }).stderr;
    const said =
      typeof stderr === 'string' && stderr.trim() !== ''
        ? stderr.trim()
        : error instanceof Error
          ? error.message
          : 'git failed';
    // The cause is left off on purpose: git's error holds the whole command, never printed.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(
      redact(
        `Aerie could not check out ${repository}${ref === null ? '' : `@${ref}`} for the line repo ${sibling.written}: ${said}`,
        secretForms(token),
      ),
    );
  }
  writeFileSync(join(sibling.path, '.git', CLONED), `${repository}\n`);
}
