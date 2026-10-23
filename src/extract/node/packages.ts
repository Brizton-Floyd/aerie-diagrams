// The Node packages of the system (DRIFT-302): each repo's own package.json, the packages its npm
// workspaces name, the projects of an Angular workspace and the folders a Compose service's image
// is built from. Each package is a code unit `npm:<name>` and may declare the frameworks it is
// built on.
import type { Loading } from '../compose/load.ts';
import { PROBLEMS } from '../problems.ts';
import { basename, dirname, isInside, resolve } from '../paths.ts';
import { at, items, members, readJson, text, type Json } from './json.ts';

export interface NodePackage {
  /** The folder that holds its package.json: absolute. */
  folder: string;
  json: Json;
  /** Its `name`, or null when it has none. */
  name: string | null;
  nameLine: number;
}

/** The frameworks drift names, by the package that brings each one. */
export const FRAMEWORKS: Readonly<Record<string, string>> = {
  '@angular/core': 'Angular',
  '@nestjs/core': 'NestJS',
  '@sveltejs/kit': 'SvelteKit',
  express: 'Express',
  fastify: 'Fastify',
  hono: 'Hono',
  koa: 'Koa',
  next: 'Next.js',
  nuxt: 'Nuxt',
  react: 'React',
  svelte: 'Svelte',
  vue: 'Vue',
};

/** Reads a JSON file of the project, with a warning when it is not valid; undefined when absent. */
export function readProjectJson(path: string, what: string, loading: Loading): Json | undefined {
  const content = loading.files.read(path);
  if (content === undefined) return undefined;
  loading.read.add(path);
  const found = readJson(path, content);
  if ('error' in found) {
    loading.problems.push({
      id: 'bad-json',
      level: 'warning',
      at: loading.locator.evidence(path, 1),
      message: PROBLEMS['bad-json'](what, found.error),
    });
    return undefined;
  }
  return found.json;
}

/**
 * The packages found from `seeds` (folders that may hold a package.json, or package.json files),
 * following npm workspaces; keyed by folder. `found` and `tried` carry on an earlier search.
 */
export function findPackages(
  seeds: readonly string[],
  loading: Loading,
  found = new Map<string, NodePackage>(),
  tried = new Set<string>(),
): Map<string, NodePackage> {
  const visit = (folder: string): void => {
    if (tried.has(folder)) return;
    tried.add(folder);
    const json = readProjectJson(resolve(folder, 'package.json'), 'package.json', loading);
    if (json === undefined) return;
    const nameNode = at(json.root, 'name');
    const name = text(nameNode) ?? null;
    found.set(folder, {
      folder,
      json,
      name: name === '' ? null : name,
      nameLine: json.line(nameNode?.offset ?? 0),
    });
    for (const pattern of workspaces(json)) {
      for (const each of expandPattern(folder, pattern, loading)) visit(each);
    }
  };
  for (const seed of seeds) visit(basename(seed) === 'package.json' ? dirname(seed) : seed);
  return found;
}

/** The workspace patterns of a package.json: `workspaces` as a list or as `{ packages }`. */
function workspaces(json: Json): string[] {
  const node = at(json.root, 'workspaces');
  const list = node?.type === 'array' ? node : at(node, 'packages');
  return items(list).flatMap((each) => {
    const pattern = text(each);
    return pattern === undefined || pattern.startsWith('!') ? [] : [pattern];
  });
}

/**
 * The folders a workspace pattern names, from `folder`: a plain path as it is, and `*` and `**`
 * parts by listing the folders they cover (never inside `node_modules`).
 */
export function expandPattern(folder: string, pattern: string, loading: Loading): string[] {
  const parts = pattern.replace(/^\.\//, '').replace(/\/+$/, '').split('/');
  let here = [folder];
  for (const part of parts) {
    const next: string[] = [];
    for (const base of here) {
      if (part === '**') {
        next.push(base, ...descendants(base, loading));
      } else if (/[*?[]/.test(part)) {
        const pattern = new RegExp(
          `^${part
            .split('')
            .map((char) =>
              char === '*' ? '[^/]*' : char === '?' ? '.' : char.replace(/[.+^$(){}|\\]/g, '\\$&'),
            )
            .join('')}$`,
        );
        for (const name of loading.files.list(base)) {
          const path = resolve(base, name);
          if (pattern.test(name) && name !== 'node_modules' && loading.files.isFolder(path)) {
            next.push(path);
          }
        }
      } else {
        next.push(resolve(base, part));
      }
    }
    here = next;
  }
  return here.filter((each) => isInside(folder, each) || each === folder);
}

function descendants(folder: string, loading: Loading): string[] {
  const out: string[] = [];
  for (const name of loading.files.list(folder)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = resolve(folder, name);
    if (!loading.files.isFolder(path)) continue;
    out.push(path, ...descendants(path, loading));
  }
  return out;
}

/** The frameworks a package declares: in `dependencies`, then dev and peer dependencies. */
export function frameworksOf(
  pkg: NodePackage,
): { framework: string; version: string; line: number }[] {
  const out: { framework: string; version: string; line: number }[] = [];
  const seen = new Set<string>();
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const { key, keyNode, value } of members(at(pkg.json.root, field))) {
      const framework = FRAMEWORKS[key];
      if (framework === undefined || seen.has(key)) continue;
      seen.add(key);
      out.push({ framework, version: text(value) ?? '', line: pkg.json.line(keyNode.offset) });
    }
  }
  return out;
}

/** The package whose folder holds a path most closely, if any. */
export function ownerOf(
  packages: ReadonlyMap<string, NodePackage>,
  path: string,
): NodePackage | undefined {
  let best: NodePackage | undefined;
  for (const pkg of packages.values()) {
    if (
      isInside(pkg.folder, path) &&
      (best === undefined || pkg.folder.length > best.folder.length)
    ) {
      best = pkg;
    }
  }
  return best;
}
