// Loads a Compose project as `docker compose config` would see it, from the files alone
// (DRIFT-101 to DRIFT-105): each file parsed with merge keys, its values interpolated from the
// project's `.env`, its `extends` and `include` applied, and the files merged in order. Relative
// paths start from the project folder, the folder of the first file.
import type { Problem } from '../problems.ts';
import { PROBLEMS } from '../problems.ts';
import { basename, dirname, resolve } from '../paths.ts';
import type { Locator, ProjectFiles } from '../project.ts';
import { get, readYaml, text, type YNode } from '../yaml.ts';
import { readEnvFile } from './dotenv.ts';
import { interpolate } from './interpolate.ts';
import { merge, readService, type ServiceDef, type Value } from './service.ts';

export interface ComposeProject {
  /** The project folder: absolute. */
  folder: string;
  /** The first file, where a project with no `name` is named from its folder. */
  first: string;
  name: Value<string> | null;
  services: ServiceDef[];
  /** The project's variables, from its `.env` file. */
  variables: Map<string, string>;
}

/** What loading reads and reports, shared by a project and the projects it includes. */
export interface Loading {
  files: ProjectFiles;
  locator: Locator;
  problems: Problem[];
  /** Every file read, absolute. */
  read: Set<string>;
}

/**
 * Loads the project made of `paths`, merged in order. `outer` holds variables that win over its
 * `.env` (an including project's); `envFiles` replace its `.env` (an `include` that names them).
 */
export function loadProject(
  paths: readonly string[],
  loading: Loading,
  options: { folder?: string; outer?: ReadonlyMap<string, string>; envFiles?: string[] } = {},
  including: readonly string[] = [],
): ComposeProject | null {
  const first = paths[0];
  if (first === undefined) return null;
  const folder = options.folder ?? dirname(first);
  const variables = new Map<string, string>();
  for (const path of options.envFiles ?? [resolve(folder, '.env')]) {
    const content = loading.files.read(path);
    if (content === undefined) continue;
    loading.read.add(path);
    for (const entry of readEnvFile(content, variables).entries) {
      if (entry.value === null) variables.delete(entry.name);
      else variables.set(entry.name, entry.value);
    }
  }
  for (const [name, value] of options.outer ?? []) variables.set(name, value);
  const project: ComposeProject = { folder, first, name: null, services: [], variables };
  const unset = new Set<string>();
  for (const path of paths) {
    const root = readComposeFile(path, loading, variables, unset);
    if (root === null) continue;
    const name = get(root, 'name');
    if (name?.type === 'scalar' && name.text !== null) {
      project.name = { value: name.text, at: name.at };
    }
    const services = servicesOf(root, folder, path, loading, variables, unset);
    for (const included of includesOf(root, folder)) {
      if (including.includes(included.paths[0] ?? '')) continue;
      const missing = included.paths.find((each) => loading.files.read(each) === undefined);
      if (missing !== undefined) {
        problem(
          loading,
          'missing-file',
          included.at,
          PROBLEMS['missing-file']('included Compose file', missing),
        );
        continue;
      }
      const sub = loadProject(
        included.paths,
        loading,
        {
          folder: included.folder ?? dirname(included.paths[0] ?? path),
          outer: variables,
          ...(included.envFiles === null ? {} : { envFiles: included.envFiles }),
        },
        [...including, ...paths],
      );
      for (const service of sub?.services ?? []) {
        if (services.some((each) => each.name === service.name)) {
          problem(
            loading,
            'include-conflict',
            service.at,
            PROBLEMS['include-conflict'](service.name),
          );
        } else {
          services.push(service);
        }
      }
    }
    for (const service of services) {
      const at = project.services.findIndex((each) => each.name === service.name);
      if (at < 0) project.services.push(service);
      else project.services[at] = merge(project.services[at] ?? service, service);
    }
  }
  return project;
}

/** The name Compose gives a project from its folder: lower case letters, digits, `-` and `_`. */
export function folderProjectName(folder: string): string {
  return basename(folder)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^[_-]+/, '');
}

/** One file, parsed and interpolated, or null (with a problem) when it cannot be read. */
function readComposeFile(
  path: string,
  loading: Loading,
  variables: ReadonlyMap<string, string>,
  unset: Set<string>,
): YNode | null {
  const content = loading.files.read(path);
  if (content === undefined) return null;
  loading.read.add(path);
  const read = readYaml(content, path);
  const error = read.errors[0];
  if (error !== undefined) {
    problem(
      loading,
      'bad-yaml',
      { file: path, line: error.line },
      PROBLEMS['bad-yaml'](error.message),
      'error',
    );
    return null;
  }
  if (read.root?.type !== 'map') {
    problem(
      loading,
      'bad-compose',
      { file: path, line: 1 },
      PROBLEMS['bad-compose']('it does not hold a mapping of top-level keys such as `services`.'),
      'error',
    );
    return null;
  }
  return interpolateTree(read.root, variables, (name, at) => {
    if (unset.has(name)) return;
    unset.add(name);
    problem(loading, 'unset-variable', at, PROBLEMS['unset-variable'](name));
  });
}

/** Every scalar value of a tree interpolated; keys stay as written. */
function interpolateTree(
  node: YNode,
  variables: ReadonlyMap<string, string>,
  onUnset: (name: string, at: { file: string; line: number }) => void,
): YNode {
  switch (node.type) {
    case 'map':
      return {
        ...node,
        entries: node.entries.map((each) => ({
          ...each,
          value: interpolateTree(each.value, variables, onUnset),
        })),
      };
    case 'seq':
      return {
        ...node,
        items: node.items.map((each) => interpolateTree(each, variables, onUnset)),
      };
    case 'scalar': {
      if (!node.text?.includes('$')) return node;
      const done = interpolate(node.text, variables);
      for (const name of done.unset) onUnset(name, node.at);
      return { ...node, text: done.text };
    }
  }
}

/** A file's services, each with its `extends` applied. */
function servicesOf(
  root: YNode,
  folder: string,
  path: string,
  loading: Loading,
  variables: ReadonlyMap<string, string>,
  unset: Set<string>,
): ServiceDef[] {
  const node = get(root, 'services');
  if (node?.type !== 'map') return [];
  const written = new Map(
    node.entries.map((each) => [each.key, readService(each.key, each.at, each.value, folder)]),
  );
  // Files `extends` names, read once each; null for one that cannot be read.
  const others = new Map<string, Map<string, ServiceDef> | null>([[path, written]]);
  const servicesIn = (file: string): Map<string, ServiceDef> | null => {
    const known = others.get(file);
    if (known !== undefined) return known;
    const other = readComposeFile(file, loading, variables, unset);
    const found = get(other ?? undefined, 'services');
    const read = new Map<string, ServiceDef>();
    if (found?.type === 'map') {
      for (const each of found.entries) {
        read.set(each.key, readService(each.key, each.at, each.value, dirname(file)));
      }
    }
    others.set(file, other === null ? null : read);
    return other === null ? null : read;
  };
  const extended = (service: ServiceDef, file: string, chain: readonly string[]): ServiceDef => {
    const link = service.extends;
    if (link === null) return service;
    const own = { ...service, extends: null };
    const from = link.file ?? file;
    const key = `${from}#${link.service}`;
    if (chain.includes(key)) {
      problem(loading, 'extends-loop', link.at, PROBLEMS['extends-loop'](service.name));
      return own;
    }
    const pool = servicesIn(from);
    if (pool === null) {
      problem(
        loading,
        'missing-file',
        link.at,
        PROBLEMS['missing-file']('Compose file named by `extends`', from),
      );
      return own;
    }
    const base = pool.get(link.service);
    if (base === undefined) {
      problem(loading, 'unknown-service', link.at, PROBLEMS['unknown-service'](link.service));
      return own;
    }
    const resolved = extended(base, from, [...chain, key]);
    return { ...merge(resolved, own), name: service.name, at: service.at };
  };
  return [...written.values()].map((each) => extended(each, path, [`${path}#${each.name}`]));
}

interface Include {
  paths: string[];
  folder: string | null;
  envFiles: string[] | null;
  at: { file: string; line: number };
}

/** The files a file's `include` names, short or long syntax. */
function includesOf(root: YNode, folder: string): Include[] {
  const node = get(root, 'include');
  if (node?.type !== 'seq') return [];
  return node.items.flatMap((item) => {
    const listOf = (value: YNode | undefined): string[] =>
      value === undefined
        ? []
        : (value.type === 'seq' ? value.items : [value])
            .map((each) => text(each))
            .filter((each): each is string => typeof each === 'string')
            .map((each) => resolve(folder, each));
    if (item.type === 'scalar') {
      return item.text === null
        ? []
        : [{ paths: [resolve(folder, item.text)], folder: null, envFiles: null, at: item.at }];
    }
    const paths = listOf(get(item, 'path'));
    if (paths.length === 0) return [];
    const directory = text(get(item, 'project_directory'));
    const envFiles = listOf(get(item, 'env_file'));
    return [
      {
        paths,
        folder: typeof directory === 'string' ? resolve(folder, directory) : null,
        envFiles: envFiles.length > 0 ? envFiles : null,
        at: item.at,
      },
    ];
  });
}

function problem(
  loading: Loading,
  id: Problem['id'],
  at: { file: string; line: number },
  message: string,
  level: Problem['level'] = 'warning',
): void {
  loading.problems.push({ id, level, at: loading.locator.evidence(at.file, at.line), message });
}
