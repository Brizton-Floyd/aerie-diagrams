// An in-memory project for the extractor's unit tests, which records every path it is asked for.
import {
  extract,
  factText,
  type Extraction,
  type ProjectFiles,
} from '../../../src/extract/index.ts';
import { parse, type System } from '../../../src/lines/index.ts';

export interface MemoryFiles extends ProjectFiles {
  /** Every path read, in order. */
  reads: string[];
}

/** Files by absolute path; a folder exists when some file is inside it, and lists what is in it. */
export function memoryFiles(files: Record<string, string>): MemoryFiles {
  const reads: string[] = [];
  return {
    reads,
    read(path) {
      reads.push(path);
      return Object.hasOwn(files, path) ? files[path] : undefined;
    },
    isFolder(path) {
      return Object.keys(files).some((each) => each.startsWith(`${path}/`));
    },
    list(path) {
      const names = Object.keys(files).flatMap((each) =>
        each.startsWith(`${path}/`) ? [each.slice(path.length + 1).split('/')[0] ?? ''] : [],
      );
      return [...new Set(names)].sort();
    },
  };
}

/** The system root of a model written as its `system` block's lines. */
export function systemOf(...lines: string[]): System | null {
  const source = ['model m: M', '', ...lines, '', 'a: A', ''].join('\n');
  const parsed = parse(source);
  if (parsed.model === null) throw new Error(JSON.stringify(parsed.diagnostics));
  return parsed.model.system;
}

/**
 * Extracts a workspace at `/w`, whose model file is `/w/model.aerie` in the repository `/w`.
 * `system` holds the lines of its system root, or nothing for a model with none.
 */
export function extractFrom(files: Record<string, string>, ...system: string[]): Extraction {
  return extract({
    system: system.length === 0 ? null : systemOf('system', ...system.map((line) => `  ${line}`)),
    modelFolder: '/w',
    homeRepo: '/w',
    files: memoryFiles(files),
  });
}

/** The facts of a workspace as report lines, for `toEqual`. */
export function factLines(files: Record<string, string>, ...system: string[]): string[] {
  return extractFrom(files, ...system).facts.map((fact) => factText(fact));
}

/** A YAML file from its lines. */
export const yaml = (...lines: string[]): string => lines.join('\n') + '\n';
