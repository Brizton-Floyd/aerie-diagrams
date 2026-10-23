// The facts of the Spring Boot code of the Maven modules (docs/spec/drift.md, section 4; DRIFT-204 to
// DRIFT-213): each module's configuration (its server, the addresses it holds, per profile, and the
// connections they name), then its Java: applications, endpoints, HTTP calls, message channels,
// events and schedules.
import type { CodeUnit } from '../../lines/index.ts';
import type { Loading } from '../compose/load.ts';
import { LOOPBACK, hideSecrets, hostsIn } from '../compose/hosts.ts';
import type { ConnectionFact, Fact } from '../facts.ts';
import type { JavaParser } from '../java/syntax.ts';
import { moduleNamed, type MavenModule } from '../maven/reactor.ts';
import { PROBLEMS } from '../problems.ts';
import type { TechniqueId } from '../techniques.ts';
import { Codebase } from './code.ts';
import {
  envName,
  readConfig,
  uniform,
  type Config,
  type ConfigEntry,
  type Filled,
} from './config.ts';
import { channelFacts, eventFacts, scheduleFacts } from './messaging.ts';
import { Values, type Settings, type Text } from './values.ts';
import { clientCallFacts, endpointFacts, interfaceCallFacts, type Analysis } from './web.ts';

/** DRIFT-207: the properties that say where a module listens and what it is called. */
const SERVER_KEYS = [
  'server.port',
  'server.address',
  'server.servlet.context-path',
  'spring.webflux.base-path',
  'spring.mvc.servlet.path',
  'spring.application.name',
  'management.server.port',
].map(uniform);

/** DRIFT-207: the last part of a property's name under which a bare host name counts as one. */
const ADDRESS_KEYS = new Set(
  [
    'host',
    'hosts',
    'hostname',
    'address',
    'addresses',
    'bootstrap-servers',
    'brokers',
    'broker-list',
    'servers',
    'nodes',
    'endpoint',
    'endpoints',
    'url',
    'urls',
    'uri',
    'uris',
    'base-url',
    'base-uri',
  ].map(uniform),
);

/** Properties that hold addresses which call this module, not addresses it calls. */
const INBOUND = /(^|\.)cors\.|allowedorigin/;

const SPRING_BOOT_APPLICATION = ['org.springframework.boot.autoconfigure.SpringBootApplication'];
const STREAM_BINDING = /^spring\.cloud\.stream\.bindings\.(.+)\.destination$/;

export function springFacts(
  modules: readonly MavenModule[],
  java: JavaParser | undefined,
  loading: Loading,
): Fact[] {
  const configs = new Map(modules.map((module) => [module, readConfig(module.classpath, loading)]));
  const world = new World(modules, configs);
  const facts: Fact[] = [];
  for (const module of modules) facts.push(...configFacts(module, world, loading));
  const code = new Codebase();
  for (const module of modules) {
    const files = javaFiles(module.sources, loading);
    if (files.length === 0) continue;
    if (java === undefined) {
      loading.problems.push({
        id: 'java-not-loaded',
        level: 'warning',
        at: null,
        message: PROBLEMS['java-not-loaded'](`maven:${module.artifactId}`),
      });
      continue;
    }
    for (const path of files) {
      const text = loading.files.read(path);
      if (text === undefined) continue;
      loading.read.add(path);
      const read = java.read(text);
      const error = read.errors[0];
      if (error !== undefined) {
        loading.problems.push({
          id: 'java-syntax',
          level: 'warning',
          at: loading.locator.evidence(path, error),
          message: PROBLEMS['java-syntax'](),
        });
      }
      code.add({ path, java: read, module });
    }
  }
  const values = new Values(code, world);
  const analysis: Analysis = {
    code,
    values,
    loading,
    target: (url) => world.target(url),
    related: (module) => world.related(module),
  };
  for (const cls of code.all()) {
    const annotation = cls.decl.annotations.find((each) =>
      code.isType(each.name, cls, SPRING_BOOT_APPLICATION),
    );
    if (annotation === undefined) continue;
    facts.push({
      kind: 'app',
      technique: 'spring-boot-app',
      at: loading.locator.evidence(cls.file.path, annotation.line),
      unit: cls.file.module.unit,
      className: cls.name,
    });
  }
  facts.push(
    ...endpointFacts(analysis),
    ...clientCallFacts(analysis),
    ...interfaceCallFacts(analysis),
    ...channelFacts(analysis, (scope, binding) => {
      const destination = world.value(
        scope.cls.file.module,
        `spring.cloud.stream.bindings.${binding}.destination`,
      );
      return destination === undefined ? binding : destination.text;
    }),
    ...eventFacts(analysis),
    ...scheduleFacts(analysis),
  );
  return facts;
}

/** The `.java` files under a source folder, in order of path. */
function javaFiles(folder: string, loading: Loading): string[] {
  const out: string[] = [];
  const visit = (at: string): void => {
    for (const name of loading.files.list(at)) {
      if (name.startsWith('.')) continue;
      const path = `${at}/${name}`;
      if (loading.files.isFolder(path)) visit(path);
      else if (name.endsWith('.java') && !/^(package|module)-info\.java$/.test(name))
        out.push(path);
    }
  };
  visit(folder);
  return out;
}

/** What the modules know of each other: their configuration, dependencies, ports and names. */
class World implements Settings {
  readonly modules: readonly MavenModule[];
  readonly configs: ReadonlyMap<MavenModule, Config>;
  readonly closures = new Map<MavenModule, Set<MavenModule>>();

  constructor(modules: readonly MavenModule[], configs: ReadonlyMap<MavenModule, Config>) {
    this.modules = modules;
    this.configs = configs;
    for (const module of modules) this.closures.set(module, this.closure(module));
  }

  /** The modules a module needs to run, through dependencies other than `test`. */
  private closure(module: MavenModule): Set<MavenModule> {
    const out = new Set<MavenModule>();
    const visit = (at: MavenModule): void => {
      for (const each of at.dependencies) {
        if (each.scope === 'test') continue;
        const target = moduleNamed(this.modules, each.groupId, each.artifactId);
        if (target === undefined || out.has(target) || target === module) continue;
        out.add(target);
        visit(target);
      }
    };
    visit(module);
    return out;
  }

  /** The modules that package this one, and so run its code. */
  private dependents(module: MavenModule): MavenModule[] {
    return this.modules.filter((each) => this.closures.get(each)?.has(module) ?? false);
  }

  related(module: MavenModule): MavenModule[] {
    const out = new Set<MavenModule>();
    for (const each of [module, ...this.dependents(module)]) {
      out.add(each);
      for (const needed of this.closures.get(each) ?? []) out.add(needed);
    }
    return [...out];
  }

  /**
   * A property as the code of a module reads it: from the module's own configuration, or else from
   * the modules that run it, when they agree.
   */
  value(module: MavenModule, key: string): Filled | undefined {
    const own = this.configs.get(module);
    const entry = own?.pick(key);
    if (own !== undefined && entry !== undefined) return own.fill(entry.value, entry.profile);
    const found = this.dependents(module).flatMap((each) => {
      const config = this.configs.get(each);
      const picked = config?.pick(key);
      return config === undefined || picked === undefined
        ? []
        : [config.fill(picked.value, picked.profile)];
    });
    const [first] = found;
    return first !== undefined && found.every((each) => each.text === first.text)
      ? first
      : undefined;
  }

  fill(module: MavenModule, text: string): Filled {
    const config = this.configs.get(module);
    if (config === undefined) return { text, unknown: [] };
    const filled = config.fill(text);
    if (filled.unknown.length === 0) return filled;
    // A library's placeholders are filled from the modules that run it, when they agree.
    const others = this.dependents(module).flatMap((each) => {
      const other = this.configs.get(each)?.fill(text);
      return other === undefined || other.unknown.length > 0 ? [] : [other];
    });
    const [first] = others;
    return first !== undefined && others.every((each) => each.text === first.text) ? first : filled;
  }

  /** The port a module listens on: its own `server.port`, with the active profiles. */
  port(module: MavenModule): string | null {
    const config = this.configs.get(module);
    const entry = config?.pick('server.port');
    if (config === undefined || entry === undefined) return null;
    const filled = config.fill(entry.value, entry.profile);
    return filled.unknown.length > 0 ? null : filled.text.trim();
  }

  /**
   * DRIFT-207: what a host names. A loopback host with a port is the one module that listens on that
   * port; another host is the one module of that `spring.application.name`; else it is outside.
   */
  host(host: string, port: string | null): CodeUnit | { host: string } {
    if (LOOPBACK.has(host)) {
      const listening =
        port === null ? [] : this.modules.filter((each) => this.port(each) === port);
      const [only] = listening;
      if (listening.length === 1 && only !== undefined) return only.unit;
      return { host: port === null ? host : `${host}:${port}` };
    }
    const named = this.modules.filter(
      (each) =>
        this.configs.get(each)?.pick('spring.application.name')?.value.toLowerCase() === host,
    );
    const [only] = named;
    return named.length === 1 && only !== undefined ? only.unit : { host };
  }

  /** What a call's URL names, when its scheme and host are known. */
  target(url: Text): CodeUnit | { host: string } | null {
    const [first] = url;
    if (typeof first !== 'string') return null;
    const match = /^([a-z][a-z0-9+.-]*):\/\/(?:[^@/]*@)?(\[[^\]]+\]|[^/:?#{}]+)(?::(\d+))?/i.exec(
      first,
    );
    if (match === null) return null;
    if (match[0].length === first.length && url.length > 1) return null;
    const scheme = (match[1] ?? '').toLowerCase();
    const host = (match[2] ?? '').replace(/^\[|\]$/g, '').toLowerCase();
    const port = match[3] ?? (scheme === 'https' ? '443' : scheme === 'http' ? '80' : null);
    return this.host(host, port);
  }
}

/** DRIFT-207: a module's server properties and addresses, and the connections the addresses name. */
function configFacts(module: MavenModule, world: World, loading: Loading): Fact[] {
  const config = world.configs.get(module);
  if (config === undefined) return [];
  const facts: Fact[] = [];
  for (const entry of config.entries) {
    const key = uniform(entry.key);
    const at = loading.locator.evidence(entry.file, entry.line);
    const filled = config.fill(entry.value, entry.profile);
    const binding = STREAM_BINDING.exec(entry.key);
    if (binding?.[1] !== undefined) {
      const direction = /-in-\d+$/.test(binding[1])
        ? 'receives'
        : /-out-\d+$/.test(binding[1])
          ? 'sends'
          : null;
      if (direction !== null) {
        facts.push({
          kind: 'channel',
          technique: 'stream-binding',
          at,
          unit: module.unit,
          className: null,
          method: null,
          direction,
          broker: 'stream',
          channel: filled.text,
          key: null,
        });
      }
    }
    if (INBOUND.test(key)) continue;
    const connections = connectionsOf(module, entry, filled, world, at);
    const last = uniform(entry.key.slice(entry.key.lastIndexOf('.') + 1).replace(/\[\d+\]$/, ''));
    const address = ADDRESS_KEYS.has(last) || /(url|uri)$/.test(last);
    const unresolved = filled.unknown[0];
    if (
      SERVER_KEYS.includes(key) ||
      connections.length > 0 ||
      (address && unresolved !== undefined)
    ) {
      facts.push({
        kind: 'property',
        technique: 'spring-property',
        at,
        unit: module.unit,
        key: entry.key,
        value: hideSecrets(filled.text),
        profile: entry.profile,
        env: envName(entry.key),
      });
    }
    if (address && unresolved !== undefined && connections.length === 0) {
      loading.problems.push({
        id: 'unresolved-placeholder',
        level: 'warning',
        at,
        message: PROBLEMS['unresolved-placeholder'](entry.key, `\${${unresolved}}`),
      });
    }
    facts.push(...connections);
  }
  return facts;
}

/** The modules and outside hosts one property's value names. */
function connectionsOf(
  module: MavenModule,
  entry: ConfigEntry,
  filled: Filled,
  world: World,
  at: Fact['at'],
): ConnectionFact[] {
  const last = uniform(entry.key.slice(entry.key.lastIndexOf('.') + 1).replace(/\[\d+\]$/, ''));
  const facts: ConnectionFact[] = [];
  const seen = new Set<string>();
  for (const mention of hostsIn(filled.text.replace(/\$\{[^{}]*\}/g, ' '))) {
    if (mention.host === '') continue;
    if (mention.kind === 'host') {
      // A bare word is a host only under an address's name, and only when it reads as a host name.
      if (!ADDRESS_KEYS.has(last) || !/[a-z]/.test(mention.host)) continue;
      if (/^(true|false|none|null|localhost)$/.test(mention.host) && !mention.port) continue;
    }
    if (LOOPBACK.has(mention.host) && mention.portNumber === null) continue;
    const to = world.host(mention.host, mention.portNumber);
    if ('kind' in to && to.name === module.artifactId) continue;
    const technique: TechniqueId =
      mention.kind === 'url'
        ? 'spring-config-url'
        : mention.kind === 'jdbc'
          ? 'spring-config-jdbc'
          : 'spring-config-host';
    const id = `${technique} ${'host' in to ? to.host : to.name}`;
    if (seen.has(id)) continue;
    seen.add(id);
    facts.push({
      kind: 'connection',
      technique,
      at,
      from: module.unit,
      to,
      key: entry.key,
      value: hideSecrets(filled.text),
    });
  }
  return facts;
}
