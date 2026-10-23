// Sibling repos (docs/spec/drift.md, section 8; DRIFT-602): a model whose system root names repos
// beside its own is checked with each of them checked out, read only, where its `repo` line points.
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { repositoryOf } from '../cli/project.ts';
import type { System } from '../lines/index.ts';
import type { RepoSource } from './inputs.ts';

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

/**
 * Checks a sibling out: a shallow clone from `server` (`GITHUB_SERVER_URL`), the token sent as a
 * header for that one command so it is never stored in the clone. Throws with git's message.
 */
export function cloneSibling(sibling: Sibling, server: string, token: string): void {
  rmSync(sibling.path, { recursive: true, force: true });
  const auth =
    token === '' || !/^https?:/.test(server)
      ? []
      : [
          '-c',
          `http.${server}/.extraheader=AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
        ];
  const { repository, ref } = sibling.source;
  try {
    execFileSync(
      'git',
      [
        ...auth,
        'clone',
        '--quiet',
        '--depth',
        '1',
        '--no-tags',
        ...(ref === null ? [] : ['--branch', ref]),
        `${server}/${repository}.git`,
        sibling.path,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' },
    );
  } catch (error) {
    const said = (error as { stderr?: string }).stderr?.trim() ?? String(error);
    throw new Error(
      `Aerie could not check out ${repository}${ref === null ? '' : `@${ref}`} for the line repo ${sibling.written}: ${said}`,
      { cause: error },
    );
  }
  writeFileSync(join(sibling.path, '.git', CLONED), `${repository}\n`);
}
