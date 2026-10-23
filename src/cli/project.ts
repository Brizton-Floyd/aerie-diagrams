// The extractor's file access on a real disk (src/extract/index.ts): absolute, forward-slash paths,
// read only. `aerie drift` (slice D6) builds its extractor input with `modelInput`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ExtractInput, ProjectFiles } from '../extract/index.ts';
import type { System } from '../lines/index.ts';

/** A path as the extractor writes it: forward slashes on every platform. */
export function slashes(path: string): string {
  return path.replace(/\\/g, '/');
}

/** Reads files and lists folders on the disk; never writes or runs anything. */
export function projectFiles(): ProjectFiles {
  return {
    read(path) {
      try {
        return statSync(path).isFile() ? readFileSync(path, 'utf8') : undefined;
      } catch {
        return undefined;
      }
    },
    isFolder(path) {
      try {
        return statSync(path).isDirectory();
      } catch {
        return false;
      }
    },
    list(path) {
      try {
        return readdirSync(path).sort();
      } catch {
        return [];
      }
    },
  };
}

/** The repository that holds a folder: the nearest folder up with a `.git`, else the folder itself. */
export function repositoryOf(folder: string): string {
  for (let at = resolve(folder); ; at = dirname(at)) {
    try {
      statSync(resolve(at, '.git'));
      return at;
    } catch {
      if (dirname(at) === at) return resolve(folder);
    }
  }
}

/** The extractor's input for a model file and its system root. */
export function modelInput(modelFile: string, system: System | null): ExtractInput {
  const folder = dirname(resolve(modelFile));
  return {
    system,
    modelFolder: slashes(folder),
    homeRepo: slashes(repositoryOf(folder)),
    files: projectFiles(),
  };
}
