// The project as the extractor reads it: the system root resolved to repos and Compose files
// (docs/spec/drift.md, section 3; DRIFT-006 and DRIFT-007), and where a file sits in it.
import type { System } from '../lines/index.ts';
import type { Evidence, Place } from './facts.ts';
import { basename, inside, isInside, normalize, resolve } from './paths.ts';
import { PROBLEMS, type Problem } from './problems.ts';

/**
 * Read access to the project's files. Paths are absolute, with forward slashes. The extractor only
 * reads what the system root leads it to; it never lists folders, runs anything or writes.
 */
export interface ProjectFiles {
  /** A file's text, or undefined when there is no such file. */
  read(path: string): string | undefined;
  /** Whether there is a folder at this path. */
  isFolder(path: string): boolean;
}

export interface ExtractInput {
  /** What the model's `system` block says, or null when it has none. */
  system: System | null;
  /** The folder that holds the model file: absolute, with forward slashes. */
  modelFolder: string;
  /** The repository that holds the model file, which is the system when no `repo` line names one. */
  homeRepo: string;
  files: ProjectFiles;
}

export interface Repo {
  /** How evidence names it: its folder's name, or its path as written when two share a name. */
  name: string;
  /** Absolute. */
  path: string;
}

/**
 * DRIFT-007: the files `docker compose` picks by default in a folder, in its order of preference:
 * the first of these that exists ...
 */
export const DEFAULT_COMPOSE_FILES = [
  'compose.yaml',
  'compose.yml',
  'docker-compose.yml',
  'docker-compose.yaml',
] as const;

/** ... and then the first of these, merged over it. */
export const DEFAULT_OVERRIDE_FILES = [
  'compose.override.yml',
  'compose.override.yaml',
  'docker-compose.override.yml',
  'docker-compose.override.yaml',
] as const;

/** Finds where a file is in the system, for evidence. */
export class Locator {
  readonly repos: readonly Repo[];

  constructor(repos: readonly Repo[]) {
    // The innermost repo wins when one holds another.
    this.repos = [...repos].sort((a, b) => b.path.length - a.path.length);
  }

  place(path: string): Place {
    const repo = this.repos.find((each) => isInside(each.path, path));
    return repo === undefined
      ? { repo: null, path }
      : { repo: repo.name, path: inside(repo.path, path) };
  }

  evidence(path: string, line: number): Evidence {
    return { ...this.place(path), line };
  }
}

export interface ResolvedSystem {
  repos: Repo[];
  /** Each Compose project to read: its files, merged in order, the first giving its folder. */
  compose: string[][];
  problems: Problem[];
}

/** DRIFT-006, DRIFT-007: the repos and Compose projects a system root names. */
export function resolveSystem(input: ExtractInput): ResolvedSystem {
  const { system, modelFolder, files } = input;
  const problems: Problem[] = [];
  const written = system === null || system.repos.length === 0 ? null : system.repos;
  const paths =
    written === null
      ? [{ path: normalize(input.homeRepo), as: basename(normalize(input.homeRepo)) }]
      : written.map((each) => ({ path: resolve(modelFolder, each), as: each }));
  const repos: Repo[] = [];
  for (const { path, as } of paths) {
    if (!files.isFolder(path)) {
      problems.push({
        id: 'missing-repo',
        level: 'error',
        at: null,
        message: PROBLEMS['missing-repo'](as),
      });
      continue;
    }
    const name = basename(path);
    const shared = paths.filter((other) => basename(other.path) === name).length > 1;
    repos.push({ name: shared ? as : name, path });
  }
  const compose: string[][] = [];
  if (system !== null && system.compose.length > 0) {
    const named: string[] = [];
    for (const each of system.compose) {
      const path = resolve(modelFolder, each);
      if (files.read(path) === undefined) {
        problems.push({
          id: 'missing-compose',
          level: 'error',
          at: null,
          message: PROBLEMS['missing-compose'](each),
        });
      } else {
        named.push(path);
      }
    }
    if (named.length > 0) compose.push(named);
  } else {
    for (const repo of repos) {
      const found = defaultComposeFiles(repo.path, files);
      if (found.length > 0) compose.push(found);
    }
  }
  return { repos, compose, problems };
}

/** The Compose files `docker compose` reads by default in a folder: none, one, or one and its override. */
export function defaultComposeFiles(folder: string, files: ProjectFiles): string[] {
  const first = (names: readonly string[]): string | undefined =>
    names.map((name) => resolve(folder, name)).find((path) => files.read(path) !== undefined);
  const main = first(DEFAULT_COMPOSE_FILES);
  if (main === undefined) return [];
  const override = first(DEFAULT_OVERRIDE_FILES);
  return override === undefined ? [main] : [main, override];
}
