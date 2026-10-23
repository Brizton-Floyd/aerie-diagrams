// The TypeScript an application is built from (DRIFT-305): its entry point and every file it imports,
// statically or lazily (`import('./x')` in a route), followed through relative paths and the
// tsconfig's `paths`, plus the files its build configurations swap in. Drift reads only these, so
// code the application never imports is never read. Parsed with the `typescript` 6.0 compiler API
// (`createSourceFile`, no type checker).
import ts from 'typescript';
import type { Loading } from '../compose/load.ts';
import { dirname, isInside, resolve } from '../paths.ts';
import { at, members, items, text } from './json.ts';
import { readProjectJson } from './packages.ts';

/** How module names resolve: the tsconfig's `paths`, from its `baseUrl` (or its own folder). */
export interface Resolution {
  base: string;
  paths: { prefix: string; suffix: string; targets: string[] }[];
}

/** The files of an application, by absolute path, in the order they were reached. */
export interface Sources {
  files: Map<string, ts.SourceFile>;
  /** Each file the build replaces, with every file that may stand in its place (itself first). */
  variants: Map<string, string[]>;
  /** The file a module name imported from `from` resolves to, if it is one of the system's. */
  resolve(name: string, from: string): string | undefined;
}

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts'];

/** The resolution a tsconfig gives, following its relative `extends`. */
export function readTsconfig(path: string | null, loading: Loading): Resolution {
  const out: Resolution = { base: path === null ? '/' : dirname(path), paths: [] };
  const seen = new Set<string>();
  let foundPaths = false;
  let foundBase = false;
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const json = readProjectJson(file, 'TypeScript configuration', loading);
    if (json === undefined) return;
    const options = at(json.root, 'compilerOptions');
    const baseUrl = text(at(options, 'baseUrl'));
    const paths = at(options, 'paths');
    if (!foundBase && baseUrl !== undefined) {
      out.base = resolve(dirname(file), baseUrl);
      foundBase = true;
    }
    if (!foundPaths && paths !== undefined) {
      foundPaths = true;
      if (!foundBase) out.base = dirname(file);
      for (const { key, value } of members(paths)) {
        const star = key.indexOf('*');
        out.paths.push({
          prefix: star < 0 ? key : key.slice(0, star),
          suffix: star < 0 ? '' : key.slice(star + 1),
          targets: items(value).flatMap((each) => {
            const target = text(each);
            return target === undefined ? [] : [target];
          }),
        });
      }
    }
    const extended = at(json.root, 'extends');
    const parents = extended?.type === 'array' ? items(extended).map(text) : [text(extended)];
    for (const parent of parents) {
      if (parent?.startsWith('.') === true) {
        visit(resolve(dirname(file), parent.endsWith('.json') ? parent : `${parent}.json`));
      }
    }
  };
  if (path !== null) visit(path);
  out.paths.sort((a, b) => b.prefix.length - a.prefix.length);
  return out;
}

/**
 * Reads the application that starts from `entries`, following imports inside `scope` (the system),
 * with `replacements` naming the files the build may swap in.
 */
export function readSources(
  entries: readonly string[],
  replacements: readonly { replace: string; with: string }[],
  resolution: Resolution,
  scope: (path: string) => boolean,
  loading: Loading,
): Sources {
  const variants = new Map<string, string[]>();
  for (const each of replacements) {
    const list = variants.get(each.replace) ?? [each.replace];
    if (!list.includes(each.with)) list.push(each.with);
    variants.set(each.replace, list);
  }
  const files = new Map<string, ts.SourceFile>();
  const resolveName = (name: string, from: string): string | undefined => {
    const bases: string[] = [];
    if (name.startsWith('.') || name.startsWith('/')) {
      bases.push(resolve(dirname(from), name));
    } else {
      const mapping = resolution.paths.find(
        (each) =>
          name.startsWith(each.prefix) &&
          name.endsWith(each.suffix) &&
          name.length >= each.prefix.length + each.suffix.length,
      );
      if (mapping === undefined) return undefined;
      const star = name.slice(mapping.prefix.length, name.length - mapping.suffix.length);
      for (const target of mapping.targets) {
        bases.push(resolve(resolution.base, target.replace('*', star)));
      }
    }
    for (const base of bases) {
      const found = candidates(base).find(
        (path) => scope(path) && loading.files.read(path) !== undefined,
      );
      if (found !== undefined) return found;
    }
    return undefined;
  };
  const queue = [...entries];
  for (const list of variants.values()) queue.push(...list);
  while (queue.length > 0) {
    const path = queue.shift() ?? '';
    if (files.has(path) || !scope(path)) continue;
    const content = loading.files.read(path);
    if (content === undefined) continue;
    loading.read.add(path);
    const file = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
    files.set(path, file);
    for (const name of importedNames(file)) {
      const found = resolveName(name, path);
      if (found !== undefined) queue.push(...(variants.get(found) ?? [found]));
    }
  }
  return { files, variants, resolve: resolveName };
}

/** The files a module path may be: itself with a TypeScript extension, or its folder's index. */
function candidates(base: string): string[] {
  const swapped = base.replace(
    /\.(m|c)?js$/,
    (_all, kind: string | undefined) => `.${kind ?? ''}ts`,
  );
  const out = EXTENSIONS.some((each) => base.endsWith(each)) ? [base] : [];
  if (swapped !== base) out.push(swapped);
  for (const each of EXTENSIONS) out.push(`${base}${each}`);
  for (const each of EXTENSIONS) out.push(`${base}/index${each}`);
  return out.filter((path) => !path.endsWith('.d.ts'));
}

/** Every module a file imports or re-exports, and every `import('...')` with a literal name. */
function importedNames(file: ts.SourceFile): string[] {
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      if (!(
        ts.isImportDeclaration(node) &&
        node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword
      )) {
        names.push(node.moduleSpecifier.text);
      }
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      names.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return names;
}

/** Whether a path is inside one of these folders. */
export function insideAny(folders: readonly string[]): (path: string) => boolean {
  return (path) => !path.includes('/node_modules/') && folders.some((each) => isInside(each, path));
}
