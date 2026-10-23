// The Maven modules of a system (DRIFT-201, DRIFT-202): each repo's root pom and the modules it
// lists, recursively, read from the raw poms alone. What a module inherits from a parent that is in
// the system (group, version, properties, dependencies) is filled in; nothing is fetched, so parents
// and BOMs from outside the system add nothing.
import type { CodeUnit } from '../../lines/index.ts';
import type { Loading } from '../compose/load.ts';
import { dirname, resolve } from '../paths.ts';
import { PROBLEMS } from '../problems.ts';
import { readPom, type Pom } from './pom.ts';

export interface ModuleDependency {
  groupId: string | null;
  artifactId: string;
  scope: string;
  optional: boolean;
  /** Where it is written: this module's pom, or a parent's. */
  file: string;
  line: number;
}

export interface MavenModule {
  unit: CodeUnit;
  groupId: string | null;
  artifactId: string;
  packaging: string;
  pom: string;
  folder: string;
  /** The line of `<artifactId>`, and of `<packaging>` when it is written. */
  artifactLine: number;
  packagingLine: number | null;
  parent: MavenModule | null;
  dependencies: ModuleDependency[];
  /** The Java source folder and the folders Maven copies onto the classpath, absolute. */
  sources: string;
  classpath: string[];
}

interface Read {
  path: string;
  pom: Pom;
}

/** DRIFT-201: the modules of the builds whose top poms are `roots`, in the order they are found. */
export function readModules(roots: readonly string[], loading: Loading): MavenModule[] {
  const reads = new Map<string, Read>();
  const readAt = (path: string): Read | undefined => {
    if (reads.has(path)) return reads.get(path);
    const text = loading.files.read(path);
    if (text === undefined) return undefined;
    loading.read.add(path);
    const result = readPom(text);
    if (result.error !== null) {
      loading.problems.push({
        id: 'bad-pom',
        level: 'warning',
        at: loading.locator.evidence(path, result.error.line),
        message: PROBLEMS['bad-pom'](result.error.message),
      });
      return undefined;
    }
    const read = { path, pom: result.pom };
    reads.set(path, read);
    return read;
  };
  const order: Read[] = [];
  const visit = (path: string): void => {
    if (order.some((each) => each.path === path)) return;
    const read = readAt(path);
    if (read === undefined) return;
    order.push(read);
    for (const module of read.pom.modules) {
      const target = resolve(dirname(path), module.value);
      const pom = target.endsWith('.xml') ? target : `${target}/pom.xml`;
      if (loading.files.read(pom) === undefined) {
        loading.problems.push({
          id: 'missing-module',
          level: 'warning',
          at: loading.locator.evidence(path, module.line),
          message: PROBLEMS['missing-module'](module.value, loading.locator.place(pom).path),
        });
        continue;
      }
      visit(pom);
    }
  };
  for (const root of roots) visit(root);
  // A parent named by `relativePath` (by default the folder above) is read too, when it is the
  // module's parent, so that a module inherits from it even when no pom lists the module.
  // The loop also visits the parents it adds, and so reads their parents too.
  for (const read of order) {
    const parentPath = parentPomPath(read);
    if (parentPath === null || order.some((each) => each.path === parentPath)) continue;
    const parent = readAt(parentPath);
    if (parent !== undefined && isParentOf(parent.pom, read.pom)) order.push(parent);
  }
  return resolveModules(order, loading);
}

function parentPomPath(read: Read): string | null {
  const parent = read.pom.parent;
  if (parent === null || parent.relativePath === '') return null;
  const target = resolve(dirname(read.path), parent.relativePath ?? '..');
  return target.endsWith('.xml') ? target : `${target}/pom.xml`;
}

function isParentOf(parent: Pom, child: Pom): boolean {
  const ref = child.parent;
  if (ref === null || parent.artifactId?.value !== ref.artifactId) return false;
  const group = parent.groupId?.value ?? parent.parent?.groupId ?? null;
  return ref.groupId === null || group === null || group === ref.groupId;
}

interface Resolved {
  module: MavenModule;
  properties: Map<string, string>;
  version: string | null;
}

function resolveModules(reads: readonly Read[], loading: Loading): MavenModule[] {
  const done = new Map<string, Resolved | null>();
  const resolveOne = (read: Read): Resolved | null => {
    if (done.has(read.path)) return done.get(read.path) ?? null;
    done.set(read.path, null);
    const pom = read.pom;
    const parentRead =
      pom.parent === null
        ? undefined
        : (reads.find((each) => each.path === parentPomPath(read) && isParentOf(each.pom, pom)) ??
          reads.find((each) => each !== read && isParentOf(each.pom, pom)));
    const parent = parentRead === undefined ? null : resolveOne(parentRead);
    const folder = dirname(read.path);
    const properties = new Map(parent?.properties ?? []);
    for (const [key, value] of pom.properties) properties.set(key, value);
    const version = pom.version ?? parent?.version ?? null;
    const rawGroup = pom.groupId?.value ?? pom.parent?.groupId ?? null;
    const scope = new Map(properties);
    const fill = (text: string): string => interpolate(text, scope);
    const artifactId = pom.artifactId === null ? null : fill(pom.artifactId.value);
    if (artifactId === null) return null;
    scope.set('project.artifactId', artifactId);
    scope.set('artifactId', artifactId);
    if (version !== null) {
      scope.set('project.version', version);
      scope.set('version', version);
    }
    const groupId = rawGroup === null ? null : fill(rawGroup);
    if (groupId !== null) {
      scope.set('project.groupId', groupId);
      scope.set('groupId', groupId);
    }
    if (parent !== null) {
      scope.set('project.parent.groupId', parent.module.groupId ?? '');
      scope.set('project.parent.artifactId', parent.module.artifactId);
      if (parent.version !== null) scope.set('project.parent.version', parent.version);
    }
    scope.set('project.basedir', folder);
    scope.set('basedir', folder);
    const own = pom.dependencies.map((each) => ({
      groupId: each.groupId === null ? null : fill(each.groupId),
      artifactId: fill(each.artifactId),
      scope: each.scope === null ? 'compile' : fill(each.scope),
      optional: each.optional,
      file: read.path,
      line: each.line,
    }));
    const inherited = (parent?.module.dependencies ?? []).filter(
      (each) =>
        !own.some((mine) => mine.artifactId === each.artifactId && mine.groupId === each.groupId),
    );
    const module: MavenModule = {
      unit: { kind: 'maven', name: artifactId },
      groupId,
      artifactId,
      packaging: pom.packaging === null ? 'jar' : fill(pom.packaging.value),
      pom: read.path,
      folder,
      artifactLine: pom.artifactId?.line ?? pom.line,
      packagingLine: pom.packaging?.line ?? null,
      parent: parent?.module ?? null,
      dependencies: [...inherited, ...own],
      sources: resolve(folder, fill(pom.sourceDirectory ?? 'src/main/java')),
      classpath: (pom.classpath.length === 0 ? ['src/main/resources'] : pom.classpath).map((each) =>
        resolve(folder, fill(each)),
      ),
    };
    const resolved = { module, properties, version };
    done.set(read.path, resolved);
    return resolved;
  };
  const modules: MavenModule[] = [];
  for (const read of reads) {
    const resolved = resolveOne(read);
    if (resolved === null) continue;
    const { module } = resolved;
    const twin = modules.find(
      (each) => each.artifactId === module.artifactId && each.groupId === module.groupId,
    );
    if (twin !== undefined) {
      loading.problems.push({
        id: 'duplicate-module',
        level: 'warning',
        at: loading.locator.evidence(module.pom, module.artifactLine),
        message: PROBLEMS['duplicate-module'](`maven:${module.artifactId}`),
      });
      continue;
    }
    modules.push(module);
  }
  return modules;
}

/** `${name}` filled in from the properties; a name with no value stays as written. */
export function interpolate(text: string, properties: ReadonlyMap<string, string>): string {
  let out = text;
  for (let pass = 0; pass < 5 && out.includes('${'); pass++) {
    out = out.replace(/\$\{([^}]+)\}/g, (all, name: string) => properties.get(name) ?? all);
  }
  return out;
}

/** DRIFT-203: the module a dependency names, by group and artifact, when it is in the system. */
export function moduleNamed(
  modules: readonly MavenModule[],
  groupId: string | null,
  artifactId: string,
): MavenModule | undefined {
  const exact = modules.find(
    (each) => each.artifactId === artifactId && (groupId === null || each.groupId === groupId),
  );
  if (exact !== undefined || !groupId?.includes('${')) return exact;
  const named = modules.filter((each) => each.artifactId === artifactId);
  return named.length === 1 ? named[0] : undefined;
}
