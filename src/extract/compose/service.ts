// One Compose service in its expanded form, with the file and line of every value: short and long
// syntaxes read alike, relative paths made absolute, and the merge rules of the Compose
// specification for several files and `extends` (DRIFT-104, DRIFT-105). Only the attributes drift
// reads are kept.
import { resolve } from '../paths.ts';
import { get, text, type At, type YMap, type YNode } from '../yaml.ts';

export interface Value<T> {
  value: T;
  at: At;
}

export interface Port {
  hostIp: string | null;
  published: string | null;
  target: string;
  protocol: string;
}

export interface Mount {
  type: string;
  /** A volume name, an image, or for a bind mount an absolute path (or as written, from `~`). */
  source: string | null;
  target: string;
}

export interface EnvFileRef {
  /** Absolute. */
  path: string;
  required: boolean;
  raw: boolean;
}

export interface BuildDef {
  at: At;
  /** An absolute folder, or a remote context as written. */
  context: Value<string> | null;
  /** As written: a path from the build context. */
  dockerfile: Value<string> | null;
  inline: boolean;
  target: Value<string> | null;
  args: Map<string, Value<string | null>>;
  /** Named contexts: absolute folders, or as written when they are not folders. */
  contexts: Map<string, Value<string>>;
}

export interface ServiceDef {
  name: string;
  at: At;
  image: Value<string> | null;
  containerName: Value<string> | null;
  hostname: Value<string> | null;
  build: BuildDef | null;
  environment: Map<string, Value<string | null>>;
  envFiles: Value<EnvFileRef>[];
  ports: Value<Port>[];
  expose: Value<string>[];
  dependsOn: Map<string, At>;
  links: Value<{ service: string; alias: string }>[];
  volumes: Value<Mount>[];
  profiles: Value<string>[];
  /** The health check command, or null in the value when it is disabled. */
  healthcheck: Value<string | null> | null;
  aliases: Value<string>[];
  extends: { service: string; file: string | null; at: At } | null;
  /** Attributes this definition resets (`!reset`) or replaces (`!override`) when merged over another. */
  reset: Set<string>;
  replace: Set<string>;
  /** Environment variables it resets. */
  resetEnvironment: Set<string>;
}

/** Whether a build context is not a folder: a Git or other URL. */
export function isRemote(context: string): boolean {
  return (
    /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(context) ||
    context.startsWith('git@') ||
    context.startsWith('github.com/')
  );
}

/** A named build context that is not a folder: an image, another service's image, or a URL. */
function isNotFolder(context: string): boolean {
  return isRemote(context) || /^(?:docker-image|service|oci-layout):/.test(context);
}

const TAGGED = new Set(['!reset', '!override']);

/** A service as one file writes it. `folder` is where its relative paths start. */
export function readService(name: string, at: At, node: YNode, folder: string): ServiceDef {
  const service = emptyService(name, at);
  if (node.type !== 'map') return service;
  for (const entry of node.entries) {
    const value = entry.value;
    if (value.tag !== null && TAGGED.has(value.tag)) {
      (value.tag === '!reset' ? service.reset : service.replace).add(entry.key);
      if (value.tag === '!reset') continue;
    }
    switch (entry.key) {
      case 'image':
      case 'container_name':
      case 'hostname': {
        const scalar = scalarValue(value);
        if (entry.key === 'image') service.image = scalar;
        else if (entry.key === 'container_name') service.containerName = scalar;
        else service.hostname = scalar;
        break;
      }
      case 'build':
        service.build = readBuild(value, entry.at, folder);
        break;
      case 'environment':
        for (const [key, each] of keyValues(value)) {
          if (each.tag === '!reset') service.resetEnvironment.add(key);
          else service.environment.set(key, { value: each.value, at: each.at });
        }
        break;
      case 'env_file':
        service.envFiles = items(value).flatMap((item) => {
          const path = item.type === 'map' ? text(get(item, 'path')) : text(item);
          if (path === null || path === undefined) return [];
          return [
            {
              value: {
                path: resolve(folder, path),
                required: text(get(item, 'required')) !== 'false',
                raw: text(get(item, 'format')) === 'raw',
              },
              at: item.at,
            },
          ];
        });
        break;
      case 'ports':
        service.ports = items(value).flatMap((item) => {
          const port = item.type === 'map' ? longPort(item) : shortPort(text(item) ?? '');
          return port === null ? [] : [{ value: port, at: item.at }];
        });
        break;
      case 'expose':
        service.expose = scalarItems(value);
        break;
      case 'depends_on':
        if (value.type === 'map') {
          for (const each of value.entries) service.dependsOn.set(each.key, each.at);
        } else {
          for (const each of scalarItems(value)) service.dependsOn.set(each.value, each.at);
        }
        break;
      case 'links':
        service.links = scalarItems(value).map((each) => {
          const [linked = '', alias] = each.value.split(':');
          return { value: { service: linked, alias: alias ?? linked }, at: each.at };
        });
        break;
      case 'volumes':
        service.volumes = items(value).flatMap((item) => {
          const mount = item.type === 'map' ? longMount(item) : shortMount(text(item) ?? '');
          if (mount === null) return [];
          if (mount.type === 'bind' && mount.source !== null && !mount.source.startsWith('~')) {
            mount.source = resolve(folder, mount.source);
          }
          return [{ value: mount, at: item.at }];
        });
        break;
      case 'profiles':
        service.profiles = scalarItems(value);
        break;
      case 'healthcheck':
        service.healthcheck = readHealthcheck(value);
        break;
      case 'networks':
        if (value.type === 'map') {
          for (const network of value.entries) {
            service.aliases.push(...scalarItems(get(network.value, 'aliases')));
          }
        }
        break;
      case 'extends': {
        const named = value.type === 'map' ? text(get(value, 'service')) : text(value);
        const file = text(get(value, 'file'));
        if (typeof named === 'string') {
          service.extends = {
            service: named,
            file: typeof file === 'string' ? resolve(folder, file) : null,
            at: entry.at,
          };
        }
        break;
      }
    }
  }
  return service;
}

export function emptyService(name: string, at: At): ServiceDef {
  return {
    name,
    at,
    image: null,
    containerName: null,
    hostname: null,
    build: null,
    environment: new Map(),
    envFiles: [],
    ports: [],
    expose: [],
    dependsOn: new Map(),
    links: [],
    volumes: [],
    profiles: [],
    healthcheck: null,
    aliases: [],
    extends: null,
    reset: new Set(),
    replace: new Set(),
    resetEnvironment: new Set(),
  };
}

/** Attribute names, as the file writes them, of each field `merge` handles. */
const FIELD = {
  image: 'image',
  containerName: 'container_name',
  hostname: 'hostname',
  build: 'build',
  environment: 'environment',
  envFiles: 'env_file',
  ports: 'ports',
  expose: 'expose',
  dependsOn: 'depends_on',
  links: 'links',
  volumes: 'volumes',
  profiles: 'profiles',
  healthcheck: 'healthcheck',
  aliases: 'networks',
} as const;

/**
 * `over` merged onto `base`: as a later Compose file merges onto an earlier one, or a service onto
 * the one it extends. Scalars are replaced, mappings merged, sequences appended (ports and volumes
 * by their unique keys), and `!reset` and `!override` honoured.
 */
export function merge(base: ServiceDef, over: ServiceDef): ServiceDef {
  const pick = <K extends keyof typeof FIELD>(
    field: K,
    merged: () => ServiceDef[K],
    empty: ServiceDef[K],
  ): ServiceDef[K] => {
    const name = FIELD[field];
    if (over.reset.has(name)) return empty;
    if (over.replace.has(name)) return over[field];
    return merged();
  };
  const environment = pick(
    'environment',
    () => new Map([...base.environment, ...over.environment]),
    new Map(),
  );
  for (const key of over.resetEnvironment) environment.delete(key);
  return {
    name: base.name,
    at: base.at,
    image: pick('image', () => over.image ?? base.image, null),
    containerName: pick('containerName', () => over.containerName ?? base.containerName, null),
    hostname: pick('hostname', () => over.hostname ?? base.hostname, null),
    build: pick('build', () => mergeBuild(base.build, over.build), null),
    environment,
    envFiles: pick('envFiles', () => [...base.envFiles, ...over.envFiles], []),
    ports: pick('ports', () => unique(base.ports, over.ports, portKey), []),
    expose: pick('expose', () => unique(base.expose, over.expose, (each) => each), []),
    dependsOn: pick('dependsOn', () => new Map([...base.dependsOn, ...over.dependsOn]), new Map()),
    links: pick(
      'links',
      () => unique(base.links, over.links, (each) => `${each.service}:${each.alias}`),
      [],
    ),
    volumes: pick('volumes', () => unique(base.volumes, over.volumes, (each) => each.target), []),
    profiles: pick('profiles', () => unique(base.profiles, over.profiles, (each) => each), []),
    healthcheck: pick('healthcheck', () => over.healthcheck ?? base.healthcheck, null),
    aliases: pick('aliases', () => unique(base.aliases, over.aliases, (each) => each), []),
    extends: over.extends ?? base.extends,
    reset: new Set(),
    replace: new Set(),
    resetEnvironment: new Set(),
  };
}

function mergeBuild(base: BuildDef | null, over: BuildDef | null): BuildDef | null {
  if (base === null || over === null) return over ?? base;
  return {
    at: over.at,
    context: over.context ?? base.context,
    dockerfile: over.dockerfile ?? base.dockerfile,
    inline: over.dockerfile === null ? over.inline || base.inline : over.inline,
    target: over.target ?? base.target,
    args: new Map([...base.args, ...over.args]),
    contexts: new Map([...base.contexts, ...over.contexts]),
  };
}

/** `base` then `over`, where an item of `over` replaces the item of `base` with the same key. */
function unique<T>(base: Value<T>[], over: Value<T>[], key: (value: T) => string): Value<T>[] {
  const out = [...base];
  for (const item of over) {
    const at = out.findIndex((each) => key(each.value) === key(item.value));
    if (at >= 0) out[at] = item;
    else out.push(item);
  }
  return out;
}

const portKey = (port: Port): string =>
  `${port.hostIp ?? ''}|${port.target}|${port.published ?? ''}|${port.protocol}`;

function readBuild(node: YNode, at: At, folder: string): BuildDef {
  const build: BuildDef = {
    at,
    context: null,
    dockerfile: null,
    inline: false,
    target: null,
    args: new Map(),
    contexts: new Map(),
  };
  const contextOf = (value: Value<string>): Value<string> => ({
    value: isRemote(value.value) ? value.value : resolve(folder, value.value),
    at: value.at,
  });
  if (node.type === 'scalar') {
    const context = scalarValue(node);
    if (context !== null) build.context = contextOf(context);
    return build;
  }
  if (node.type !== 'map') return build;
  const context = scalarValue(get(node, 'context'));
  if (context !== null) build.context = contextOf(context);
  build.dockerfile = scalarValue(get(node, 'dockerfile'));
  build.inline = get(node, 'dockerfile_inline') !== undefined;
  build.target = scalarValue(get(node, 'target'));
  for (const [key, each] of keyValues(get(node, 'args'))) {
    build.args.set(key, { value: each.value, at: each.at });
  }
  for (const [key, each] of keyValues(get(node, 'additional_contexts'))) {
    if (each.value === null) continue;
    const value = isNotFolder(each.value) ? each.value : resolve(folder, each.value);
    build.contexts.set(key, { value, at: each.at });
  }
  return build;
}

function readHealthcheck(node: YNode): Value<string | null> | null {
  if (node.type !== 'map') return null;
  if (text(get(node, 'disable')) === 'true') return { value: null, at: node.at };
  const test = get(node, 'test');
  if (test === undefined) return null;
  if (test.type === 'scalar') return { value: test.text, at: test.at };
  const words = scalarItems(test).map((each) => each.value);
  const [first, ...rest] = words;
  if (first === 'NONE') return { value: null, at: test.at };
  if (first === 'CMD-SHELL') return { value: rest.join(' '), at: test.at };
  return { value: (first === 'CMD' ? rest : words).join(' '), at: test.at };
}

/** `[HOST_IP:][PUBLISHED:]TARGET[/PROTOCOL]`, with `[...]` around an IPv6 host. */
export function shortPort(spec: string): Port | null {
  let rest = spec.trim();
  let protocol = 'tcp';
  const slash = rest.lastIndexOf('/');
  if (slash >= 0) {
    protocol = rest.slice(slash + 1) || 'tcp';
    rest = rest.slice(0, slash);
  }
  let hostIp: string | null = null;
  if (rest.startsWith('[')) {
    const close = rest.indexOf(']');
    if (close < 0) return null;
    hostIp = rest.slice(1, close);
    rest = rest.slice(close + 1).replace(/^:/, '');
  }
  const parts = rest.split(':');
  const target = parts.pop();
  if (target === undefined || target === '') return null;
  const published = parts.pop();
  if (parts.length > 0) hostIp = parts.join(':');
  const given = (value: string | null | undefined): string | null =>
    value === undefined || value === null || value === '' ? null : value;
  return { hostIp: given(hostIp), published: given(published), target, protocol };
}

function longPort(node: YMap): Port | null {
  const target = text(get(node, 'target'));
  if (target === null || target === undefined) return null;
  return {
    hostIp: text(get(node, 'host_ip')) ?? null,
    published: text(get(node, 'published')) ?? null,
    target,
    protocol: text(get(node, 'protocol')) ?? 'tcp',
  };
}

/** `SOURCE:TARGET[:MODE]` or `TARGET` alone, an anonymous volume. */
export function shortMount(spec: string): Mount | null {
  const parts = spec.split(':');
  if (parts.length === 1) {
    return parts[0] ? { type: 'volume', source: null, target: parts[0] } : null;
  }
  const [source = '', target = ''] = parts;
  if (target === '') return null;
  const bind = /^(?:\.|\/|~)/.test(source);
  return { type: bind ? 'bind' : 'volume', source, target };
}

function longMount(node: YMap): Mount | null {
  const target = text(get(node, 'target'));
  if (target === null || target === undefined) return null;
  return {
    type: text(get(node, 'type')) ?? 'volume',
    source: text(get(node, 'source')) ?? null,
    target,
  };
}

function scalarValue(node: YNode | undefined): Value<string> | null {
  return node?.type === 'scalar' && node.text !== null ? { value: node.text, at: node.at } : null;
}

function items(node: YNode | undefined): YNode[] {
  if (node === undefined) return [];
  return node.type === 'seq' ? node.items : [node];
}

function scalarItems(node: YNode | undefined): Value<string>[] {
  return items(node).flatMap((item) => {
    const value = scalarValue(item);
    return value === null ? [] : [value];
  });
}

/**
 * A mapping written as a map (`KEY: value`) or as a list (`- KEY=value`, or `- KEY` alone with no
 * value), as `environment`, `args` and `additional_contexts` may be.
 */
function keyValues(
  node: YNode | undefined,
): Map<string, { value: string | null; at: At; tag: string | null }> {
  const out = new Map<string, { value: string | null; at: At; tag: string | null }>();
  if (node?.type === 'map') {
    for (const each of node.entries) {
      out.set(each.key, { value: text(each.value) ?? null, at: each.at, tag: each.value.tag });
    }
  } else if (node?.type === 'seq') {
    for (const item of scalarItems(node)) {
      const equals = item.value.indexOf('=');
      if (equals < 0) out.set(item.value, { value: null, at: item.at, tag: null });
      else {
        out.set(item.value.slice(0, equals), {
          value: item.value.slice(equals + 1),
          at: item.at,
          tag: null,
        });
      }
    }
  }
  return out;
}
