// An Angular workspace's angular.json (DRIFT-303): its projects, each application's entry point and
// TypeScript configuration, the files its build configurations replace (environment files), its
// base href and the dev server's proxy files. Paths in angular.json start from the workspace folder.
import type { Node } from 'jsonc-parser';
import type { Loading } from '../compose/load.ts';
import { resolve } from '../paths.ts';
import { at, items, members, text, type Json } from './json.ts';
import { readProjectJson } from './packages.ts';

/** A path angular.json gives, made absolute, with the line it is written on. */
export interface Written {
  path: string;
  line: number;
}

export interface AngularProject {
  name: string;
  /** Where angular.json names it. */
  file: string;
  line: number;
  type: 'application' | 'library';
  /** The project's own folder: absolute. */
  root: string;
  /** The application's entry point (`browser`, or `main` for older builders). */
  entry: Written | null;
  tsConfig: Written | null;
  baseHref: string;
  /** Every file a build configuration (or the build's options) replaces, and with what. */
  replacements: { replace: Written; with: Written }[];
  /** The dev server's proxy files, from its options and each of its configurations. */
  proxies: Written[];
}

/** The projects of the Angular workspace in `folder`, or none when it has no angular.json. */
export function angularProjects(folder: string, loading: Loading): AngularProject[] {
  const file = resolve(folder, 'angular.json');
  const json = readProjectJson(file, 'angular.json', loading);
  if (json === undefined) return [];
  return members(at(json.root, 'projects')).map(({ key, keyNode, value }) =>
    project(json, folder, key, keyNode, value),
  );
}

function project(
  json: Json,
  folder: string,
  name: string,
  keyNode: Node,
  node: Node,
): AngularProject {
  const written = (value: Node | undefined): Written | null => {
    const path = text(value);
    return path === undefined || value === undefined
      ? null
      : { path: resolve(folder, path), line: json.line(value.offset) };
  };
  const targets = at(node, 'architect') ?? at(node, 'targets');
  const build = at(targets, 'build');
  const serve = at(targets, 'serve');
  const buildOptions = [
    at(build, 'options'),
    ...members(at(build, 'configurations')).map((each) => each.value),
  ];
  const replacements: AngularProject['replacements'] = [];
  for (const options of buildOptions) {
    for (const each of items(at(options, 'fileReplacements'))) {
      const replace = written(at(each, 'replace') ?? at(each, 'src'));
      const by = written(at(each, 'with') ?? at(each, 'replaceWith'));
      if (replace !== null && by !== null) replacements.push({ replace, with: by });
    }
  }
  const proxies: Written[] = [];
  const serveOptions = [
    at(serve, 'options'),
    ...members(at(serve, 'configurations')).map((each) => each.value),
  ];
  for (const options of serveOptions) {
    const proxy = written(at(options, 'proxyConfig'));
    if (proxy !== null && !proxies.some((each) => each.path === proxy.path)) proxies.push(proxy);
  }
  const options = at(build, 'options');
  return {
    name,
    file: json.file,
    line: json.line(keyNode.offset),
    type: text(at(node, 'projectType')) === 'library' ? 'library' : 'application',
    root: resolve(folder, text(at(node, 'root')) ?? '.'),
    entry: written(at(options, 'browser')) ?? written(at(options, 'main')),
    tsConfig: written(at(options, 'tsConfig')),
    baseHref: text(at(options, 'baseHref')) ?? '/',
    replacements,
    proxies,
  };
}
