// The facts the Node and Angular code of a system shows (docs/spec/drift.md, section 4; DRIFT-301
// to DRIFT-310): its packages and their frameworks, Angular projects, HTTP calls, the dev server's
// proxy, environment files, and the nginx configuration of the images Compose builds. A relative
// URL is followed through the dev proxy and through the nginx that serves the application.
import type { CodeUnit } from '../../lines/index.ts';
import { hideSecrets } from '../compose/hosts.ts';
import type { ComposeView, ServiceView } from '../compose/facts.ts';
import type { Loading } from '../compose/load.ts';
import type { ConnectionFact, Evidence, Fact } from '../facts.ts';
import { isInside, resolve } from '../paths.ts';
import { PROBLEMS, type ProblemId } from '../problems.ts';
import type { Repo } from '../project.ts';
import type { TechniqueId } from '../techniques.ts';
import { angularProjects, type AngularProject } from './angular.ts';
import { exportedSettings, findCalls, findInterceptors, HOLE } from './http.ts';
import {
  envsubst,
  landsAt,
  nginxConfig,
  proxyTargets,
  selectLocation,
  templateSettings,
  type Location,
  type NginxConfig,
} from './nginx.ts';
import {
  findPackages,
  frameworksOf,
  ownerOf,
  readProjectJson,
  type NodePackage,
} from './packages.ts';
import { readProxy, type ProxyRoute } from './proxy.ts';
import { insideAny, readSources, readTsconfig } from './sources.ts';
import { inContainer, isAbsoluteUrl, onHost, type Network, type Target } from './targets.ts';

/** nginx in a Compose service's image: its configuration and where the service sits. */
interface Served {
  service: ServiceView;
  byName: ReadonlyMap<string, string>;
  config: NginxConfig;
}

/** The facts of the Node packages and Angular applications of the system, and of its nginx. */
export function nodeFacts(
  repos: readonly Repo[],
  views: readonly ComposeView[],
  loading: Loading,
): Fact[] {
  const facts: Fact[] = [];
  const evidence = (file: string, line: number): Evidence => loading.locator.evidence(file, line);
  const warn = (id: ProblemId, at: Evidence | null, message: string): void => {
    const same = (each: (typeof loading.problems)[number]): boolean =>
      each.id === id && each.message === message && JSON.stringify(each.at) === JSON.stringify(at);
    if (!loading.problems.some(same)) loading.problems.push({ id, level: 'warning', at, message });
  };
  const network = networkOf(views);

  // DRIFT-302, DRIFT-303: the packages, from the repos, the images Compose builds and workspaces.
  const seeds = [
    ...repos.map((repo) => repo.path),
    ...views.flatMap((view) => view.services.flatMap((service) => service.sources)),
  ];
  const tried = new Set<string>();
  const packages = findPackages(seeds, loading, new Map(), tried);
  const projects: AngularProject[] = [];
  const workspaces = new Set<string>();
  for (let grown = true; grown;) {
    grown = false;
    for (const pkg of [...packages.values()]) {
      if (workspaces.has(pkg.folder)) continue;
      workspaces.add(pkg.folder);
      const found = angularProjects(pkg.folder, loading);
      projects.push(...found);
      const before = packages.size;
      findPackages(
        found.map((each) => each.root),
        loading,
        packages,
        tried,
      );
      if (packages.size > before) grown = true;
    }
  }
  const unnamed = new Set<NodePackage>();
  const unitOf = (pkg: NodePackage | undefined): CodeUnit | null => {
    if (pkg === undefined) return null;
    if (pkg.name === null) {
      unnamed.add(pkg);
      return null;
    }
    return { kind: 'npm', name: pkg.name };
  };
  for (const pkg of packages.values()) {
    const at = evidence(resolve(pkg.folder, 'package.json'), pkg.nameLine);
    const frameworks = frameworksOf(pkg);
    if (pkg.name === null) {
      if (frameworks.length > 0) unnamed.add(pkg);
      continue;
    }
    const unit: CodeUnit = { kind: 'npm', name: pkg.name };
    facts.push({ kind: 'unit', technique: 'npm-package', at, unit });
    for (const each of frameworks) {
      facts.push({
        kind: 'framework',
        technique: 'npm-dependency',
        at: evidence(resolve(pkg.folder, 'package.json'), each.line),
        unit,
        framework: each.framework,
        version: each.version,
      });
    }
  }

  // DRIFT-308, DRIFT-309: nginx in the images Compose builds, and where it sends calls.
  const served: Served[] = [];
  for (const view of views) {
    for (const service of view.services) {
      const config = imageNginx(service, loading);
      if (config === null) continue;
      served.push({ service, byName: view.byName, config });
      for (const server of config.servers) {
        for (const location of allLocations(server.locations)) {
          if (location.proxy === null) continue;
          const at = evidence(location.proxy.file, location.proxy.line);
          const targets = proxyTargets(location, server, config.upstreams);
          if ('unknown' in targets) {
            warn('nginx-variable', at, PROBLEMS['nginx-variable'](targets.unknown));
            continue;
          }
          for (const url of targets.urls) {
            const to = inContainer(url, view.byName, service.unit.name);
            if (to === null) continue;
            facts.push(
              connection('nginx-proxy-pass', at, service.unit, to, locationText(location), url),
            );
          }
        }
      }
    }
  }

  // DRIFT-303 to DRIFT-307: each Angular project, its dev proxy, its code and its environment.
  const scope = insideAny(repos.map((repo) => repo.path));
  for (const project of projects) {
    const projectAt = evidence(project.file, project.line);
    const unit = unitOf(ownerOf(packages, project.root));
    if (unit === null) continue;
    const entry = project.entry;
    facts.push({
      kind: 'app',
      technique: 'angular-project',
      at: projectAt,
      unit,
      name: project.name,
      type: project.type,
      entry: entry === null ? null : loading.locator.place(entry.path),
    });
    const routes: ProxyRoute[] = [];
    for (const proxy of project.proxies) {
      const where = evidence(project.file, proxy.line);
      const name = loading.locator.place(proxy.path).path;
      if (!proxy.path.endsWith('.json')) {
        warn('proxy-code', where, PROBLEMS['proxy-code'](name));
        continue;
      }
      if (loading.files.read(proxy.path) === undefined) {
        warn('missing-file', where, PROBLEMS['missing-file']('dev-server proxy file', name));
        continue;
      }
      const json = readProjectJson(proxy.path, 'dev-server proxy file', loading);
      if (json === undefined) continue;
      for (const route of readProxy(json)) {
        routes.push(route);
        const to = onHost(route.target, network);
        if (to === null) continue;
        const at = evidence(proxy.path, route.line);
        facts.push(connection('angular-proxy', at, unit, to, route.context, route.target));
      }
    }
    if (project.type !== 'application' || entry === null) continue;
    if (loading.files.read(entry.path) === undefined) {
      const name = loading.locator.place(entry.path).path;
      warn(
        'missing-file',
        evidence(project.file, entry.line),
        PROBLEMS['missing-file']('entry point', name),
      );
      continue;
    }
    for (const each of project.replacements) {
      for (const file of [each.replace, each.with]) {
        if (loading.files.read(file.path) !== undefined) continue;
        const name = loading.locator.place(file.path).path;
        warn(
          'missing-file',
          evidence(project.file, file.line),
          PROBLEMS['missing-file']('environment file', name),
        );
      }
    }
    const sources = readSources(
      [entry.path],
      project.replacements.map((each) => ({ replace: each.replace.path, with: each.with.path })),
      readTsconfig(project.tsConfig?.path ?? null, loading),
      scope,
      loading,
    );
    for (const each of findInterceptors(sources)) {
      const names = each.names.map((name) => `\`${name}\``).join(', ');
      warn('interceptor', evidence(each.file, each.line), PROBLEMS.interceptor(names));
    }
    // DRIFT-306, DRIFT-307: the calls, and where each one goes.
    const servers = served.filter((each) =>
      each.service.sources.some((source) =>
        isInside(ownerOf(packages, project.root)?.folder ?? project.root, source),
      ),
    );
    for (const call of findCalls(sources)) {
      const at = evidence(call.file, call.line);
      const from = unitOf(ownerOf(packages, call.file));
      if (from === null) continue;
      if (call.urls.length === 0) {
        warn('unknown-url', at, PROBLEMS['unknown-url'](short(call.written)));
        continue;
      }
      for (const raw of call.urls) {
        const url = raw.replaceAll(HOLE, '{}');
        const what = `${call.method} ${url}`;
        facts.push({
          kind: 'call',
          technique: 'angular-http',
          at,
          unit: from,
          method: call.method,
          url,
        });
        if (isAbsoluteUrl(url)) {
          const to = onHost(url, network);
          if (to !== null) facts.push(connection('angular-http', at, from, to, what, null));
          continue;
        }
        const path = pathOf(url, project.baseHref).replaceAll('{}', 'x');
        let forwarded = false;
        const route = routes.find((each) => each.matches(path));
        if (route !== undefined) {
          forwarded = true;
          const to = onHost(route.target, network);
          if (to !== null) facts.push(connection('http-dev-proxy', at, from, to, what, null));
        }
        for (const each of servers) {
          for (const server of each.config.servers) {
            const location = selectLocation(server.locations, path);
            if (location?.proxy == null) continue;
            forwarded = true;
            const targets = proxyTargets(location, server, each.config.upstreams);
            if ('unknown' in targets) continue;
            for (const target of targets.urls) {
              const to = inContainer(target, each.byName, each.service.unit.name);
              if (to !== null) facts.push(connection('http-nginx', at, from, to, what, null));
            }
          }
        }
        const file = path.replace(/[?#].*$/, '');
        if (!forwarded && file.endsWith('.json')) {
          warn('runtime-config', at, PROBLEMS['runtime-config'](file));
        }
      }
    }
    // DRIFT-305: the environment files the build swaps, and the addresses they hold.
    const environments = new Set(
      project.replacements.flatMap((each) => [each.replace.path, each.with.path]),
    );
    for (const path of environments) {
      const file = sources.files.get(path);
      const from = unitOf(ownerOf(packages, path));
      if (file === undefined || from === null) continue;
      for (const setting of exportedSettings(file, sources)) {
        for (const value of setting.values) {
          if (!isAbsoluteUrl(value)) continue;
          const to = onHost(value, network);
          if (to === null) continue;
          facts.push(
            connection(
              'angular-environment',
              evidence(path, setting.line),
              from,
              to,
              setting.key,
              value,
            ),
          );
        }
      }
    }
  }
  for (const pkg of unnamed) {
    warn(
      'unnamed-package',
      evidence(resolve(pkg.folder, 'package.json'), 1),
      PROBLEMS['unnamed-package'](),
    );
  }
  return facts;
}

function connection(
  technique: TechniqueId,
  at: Evidence,
  from: CodeUnit,
  to: Target,
  key: string,
  value: string | null,
): ConnectionFact {
  return {
    kind: 'connection',
    technique,
    at,
    from,
    to,
    key,
    value: value === null ? null : hideSecrets(value),
  };
}

/** Where the services of every Compose project can be reached, from the host and from each other. */
function networkOf(views: readonly ComposeView[]): Network {
  const byName = new Map<string, string | null>();
  const published = new Map<string, string[]>();
  for (const view of views) {
    for (const [name, service] of view.byName) {
      byName.set(name, byName.has(name) && byName.get(name) !== service ? null : service);
    }
    for (const service of view.services) {
      for (const port of service.published) {
        const list = published.get(port) ?? [];
        if (!list.includes(service.unit.name)) list.push(service.unit.name);
        published.set(port, list);
      }
    }
  }
  return { byName, published };
}

/** A request path from a relative URL, read from the app's base href. */
function pathOf(url: string, baseHref: string): string {
  if (url.startsWith('/')) return url;
  const base = baseHref.endsWith('/') ? baseHref : `${baseHref}/`;
  return `${base.startsWith('/') ? base : `/${base}`}${url.replace(/^(\.\/)+/, '')}`;
}

function short(text: string): string {
  const flat = text.replace(/\s+/g, ' ');
  return flat.length > 60 ? `${flat.slice(0, 57)}...` : flat;
}

function allLocations(locations: readonly Location[]): Location[] {
  return locations.flatMap((each) => [each, ...allLocations(each.nested)]);
}

function locationText(location: Location): string {
  return location.modifier === '' ? location.uri : `${location.modifier} ${location.uri}`;
}

/**
 * DRIFT-308: the nginx configuration a service's image holds, from what it copies under
 * `/etc/nginx`, with templates filled in from the container's environment; null when it holds none.
 */
function imageNginx(service: ServiceView, loading: Loading): NginxConfig | null {
  const environment = new Map([...service.environment].map(([key, each]) => [key, each.value]));
  const settings = templateSettings(environment);
  const entries = new Map<string, string>();
  const add = (path: string, source: string): void => {
    if (path.startsWith('/etc/nginx/') || isInside(settings.folder, path))
      entries.set(path, source);
  };
  for (const file of service.files) {
    if (loading.files.isFolder(file.source)) {
      const base = file.destination.replace(/\/+$/, '');
      for (const each of filesIn(file.source, loading))
        add(`${base}/${each}`, resolve(file.source, each));
    } else {
      add(landsAt(file.source, file.destination, file.many), file.source);
    }
  }
  if (entries.size === 0) return null;
  const rendered = new Map<string, { source: string; template: boolean }>();
  for (const [path, source] of entries) {
    if (isInside(settings.folder, path) && path.endsWith(settings.suffix)) {
      const inner = path.slice(settings.folder.length, path.length - settings.suffix.length);
      rendered.set(`${settings.output}${inner}`, { source, template: true });
    } else {
      rendered.set(path, { source, template: false });
    }
  }
  const config = nginxConfig([...rendered.keys()], (path) => {
    const found = rendered.get(path);
    if (found === undefined) return undefined;
    const text = loading.files.read(found.source);
    if (text === undefined) return undefined;
    loading.read.add(found.source);
    return { text: found.template ? envsubst(text, environment) : text, file: found.source };
  });
  return config.servers.length === 0 ? null : config;
}

/** The files in a folder and its folders, as paths from it. */
function filesIn(folder: string, loading: Loading): string[] {
  return loading.files.list(folder).flatMap((name) => {
    const path = resolve(folder, name);
    return loading.files.isFolder(path)
      ? filesIn(path, loading).map((each) => `${name}/${each}`)
      : [name];
  });
}
