// The facts a Compose project shows (docs/spec/drift.md, section 4; DRIFT-101 to DRIFT-113).
import type { CodeUnit } from '../../lines/index.ts';
import type { ConnectionFact, Fact } from '../facts.ts';
import { resolve } from '../paths.ts';
import { PROBLEMS } from '../problems.ts';
import type { TechniqueId } from '../techniques.ts';
import type { At } from '../yaml.ts';
import { baseChain, readDockerfile, stageNamed, type Stage } from './dockerfile.ts';
import { readEnvFile } from './dotenv.ts';
import { HOST_KEY, LOOPBACK, hideSecrets, hostsIn } from './hosts.ts';
import { folderProjectName, loadProject, type ComposeProject, type Loading } from './load.ts';
import { isRemote, type ServiceDef } from './service.ts';

/**
 * What the Node and nginx extractors (slice D4) need from a Compose project: the names that reach
 * each service, and for each service its environment, the ports the host publishes and what its
 * image is built from and holds.
 */
export interface ComposeView {
  /** Every name that reaches a service from another, in lower case, to the service's name. */
  byName: ReadonlyMap<string, string>;
  services: ServiceView[];
}

export interface ServiceView {
  unit: CodeUnit;
  /** Its environment as the container sees it: Compose's, over the image's own `ENV`. */
  environment: ReadonlyMap<string, { value: string; at: At }>;
  /** The host ports it publishes. */
  published: string[];
  /** Every file or folder of the system its image is built from: build contexts and copies. */
  sources: string[];
  /** What the final image holds from the system's files: each copy into its target stage chain. */
  files: ImageFile[];
}

export interface ImageFile {
  /** The file or folder copied, absolute. */
  source: string;
  /** Where it lands in the container: absolute, ending in `/` when it is a folder. */
  destination: string;
  /** Whether several sources are copied at once, so each lands inside the destination. */
  many: boolean;
  /** The line that copies it. */
  at: At;
}

/**
 * The facts of the Compose project made of `paths`, merged in order. When `views` is given, what
 * the Node and nginx extractors need from the project is added to it.
 */
export function composeFacts(
  paths: readonly string[],
  loading: Loading,
  views?: ComposeView[],
): Fact[] {
  const project = loadProject(paths, loading);
  if (project === null) return [];
  const facts: Fact[] = [];
  const view: ComposeView = { byName: new Map(), services: [] };
  const at = (where: At) => loading.locator.evidence(where.file, where.line);
  facts.push(
    project.name === null
      ? {
          kind: 'project',
          technique: 'compose-folder',
          at: at({ file: project.first, line: 1 }),
          name: folderProjectName(project.folder),
        }
      : {
          kind: 'project',
          technique: 'compose-project',
          at: at(project.name.at),
          name: project.name.value,
        },
  );
  const hosts = hostNames(project);
  view.byName = hosts.byName;
  views?.push(view);
  for (const service of project.services) {
    const unit: CodeUnit = { kind: 'compose', name: service.name };
    facts.push({ kind: 'unit', technique: 'compose-service', at: at(service.at), unit });
    if (service.image !== null) {
      facts.push({
        kind: 'image',
        technique: 'compose-image',
        at: at(service.image.at),
        unit,
        image: service.image.value,
      });
    }
    for (const port of service.ports) {
      const { target, protocol, published, hostIp } = port.value;
      facts.push({
        kind: 'port',
        technique: 'compose-port',
        at: at(port.at),
        unit,
        target,
        protocol,
        published: { port: published, hostIp },
      });
    }
    for (const expose of service.expose) {
      const [target = '', protocol = 'tcp'] = expose.value.split('/');
      facts.push({
        kind: 'port',
        technique: 'compose-port',
        at: at(expose.at),
        unit,
        target,
        protocol,
        published: null,
      });
    }
    const environment = environmentOf(service, project, loading);
    const built =
      service.build === null ? null : buildFacts(service, unit, project, loading, facts);
    // The image's own ENV counts where Compose gives the variable no value of its own.
    for (const env of built?.env ?? []) {
      if ((environment.get(env.name)?.value ?? null) === null) {
        environment.set(env.name, { value: env.value, at: env.at });
      }
    }
    const known = new Map<string, { value: string; at: At }>();
    for (const [key, each] of environment) {
      if (each.value === null) continue;
      known.set(key, { value: each.value, at: each.at });
      facts.push(...connections(service, key, each.value, at(each.at), hosts));
    }
    view.services.push({
      unit,
      environment: known,
      published: service.ports.flatMap((port) =>
        port.value.published === null ? [] : [port.value.published],
      ),
      sources: built?.sources ?? [],
      files: built?.files ?? [],
    });
    for (const [name, where] of service.dependsOn) {
      if (!hosts.services.has(name)) continue;
      facts.push(dependency('compose-depends-on', unit, name, at(where)));
    }
    for (const link of service.links) {
      if (!hosts.services.has(link.value.service)) continue;
      facts.push(dependency('compose-links', unit, link.value.service, at(link.at)));
    }
    for (const mount of service.volumes) {
      const { type, source, target } = mount.value;
      const bind = type === 'bind' && source !== null && !source.startsWith('~');
      facts.push({
        kind: 'volume',
        technique: 'compose-volume',
        at: at(mount.at),
        unit,
        type,
        name: bind ? null : source,
        place: bind ? loading.locator.place(source) : null,
        target,
      });
    }
    for (const profile of service.profiles) {
      facts.push({
        kind: 'profile',
        technique: 'compose-profile',
        at: at(profile.at),
        unit,
        profile: profile.value,
      });
    }
    if (service.healthcheck !== null && service.healthcheck.value !== null) {
      facts.push({
        kind: 'healthcheck',
        technique: 'compose-healthcheck',
        at: at(service.healthcheck.at),
        unit,
        test: service.healthcheck.value,
      });
    }
  }
  return facts;
}

interface HostNames {
  services: Set<string>;
  /** Every name that reaches a service, in lower case: its own, `container_name`, `hostname`, aliases. */
  byName: Map<string, string>;
}

/**
 * DRIFT-110: the names by which the services reach each other. A link's alias reaches its service
 * only from the service that declares the link, so `connections` adds those itself.
 */
function hostNames(project: ComposeProject): HostNames {
  const byName = new Map<string, string>();
  const add = (name: string, service: string): void => {
    const lower = name.toLowerCase();
    if (!byName.has(lower)) byName.set(lower, service);
  };
  for (const service of project.services) add(service.name, service.name);
  for (const service of project.services) {
    for (const name of [service.containerName, service.hostname, ...service.aliases]) {
      if (name !== null) add(name.value, service.name);
    }
  }
  return { services: new Set(project.services.map((each) => each.name)), byName };
}

/** The environment Compose gives a service: its `env_file`s in order, then `environment` over them. */
function environmentOf(
  service: ServiceDef,
  project: ComposeProject,
  loading: Loading,
): Map<string, { value: string | null; at: At }> {
  const out = new Map<string, { value: string | null; at: At }>();
  for (const ref of service.envFiles) {
    const content = loading.files.read(ref.value.path);
    if (content === undefined) {
      if (ref.value.required) {
        const where = loading.locator.evidence(ref.at.file, ref.at.line);
        loading.problems.push({
          id: 'missing-file',
          level: 'warning',
          at: where,
          message: PROBLEMS['missing-file']('environment file', ref.value.path),
        });
      }
      continue;
    }
    loading.read.add(ref.value.path);
    for (const entry of readEnvFile(content, project.variables, ref.value.raw).entries) {
      if (entry.value === null) out.delete(entry.name);
      else
        out.set(entry.name, { value: entry.value, at: { file: ref.value.path, line: entry.line } });
    }
  }
  for (const [key, each] of service.environment) out.set(key, each);
  return out;
}

/** DRIFT-110, DRIFT-111: the services and outside hosts one environment variable names. */
function connections(
  from: ServiceDef,
  key: string,
  value: string,
  at: Fact['at'],
  hosts: HostNames,
): ConnectionFact[] {
  const unit: CodeUnit = { kind: 'compose', name: from.name };
  const links = new Map(
    from.links.map((link) => [link.value.alias.toLowerCase(), link.value.service]),
  );
  const serviceOf = (host: string): string | undefined => links.get(host) ?? hosts.byName.get(host);
  const facts: ConnectionFact[] = [];
  const seen = new Set<string>();
  for (const mention of hostsIn(value)) {
    if (mention.host === '' || LOOPBACK.has(mention.host)) continue;
    const service = serviceOf(mention.host);
    if (service === from.name) continue;
    if (
      mention.kind === 'host' &&
      (service === undefined || (!mention.port && !HOST_KEY.test(key)))
    ) {
      continue;
    }
    const technique: TechniqueId =
      mention.kind === 'url' ? 'env-url' : mention.kind === 'jdbc' ? 'env-jdbc' : 'env-host';
    const to =
      service === undefined ? { host: mention.host } : { kind: 'compose' as const, name: service };
    const id = `${technique} ${'host' in to ? to.host : to.name}`;
    if (seen.has(id)) continue;
    seen.add(id);
    facts.push({
      kind: 'connection',
      technique,
      at,
      from: unit,
      to,
      key,
      value: hideSecrets(value),
    });
  }
  return facts;
}

function dependency(
  technique: TechniqueId,
  unit: CodeUnit,
  name: string,
  at: Fact['at'],
): ConnectionFact {
  return {
    kind: 'connection',
    technique,
    at,
    from: unit,
    to: { kind: 'compose', name },
    key: null,
    value: null,
  };
}

/**
 * DRIFT-106 to DRIFT-108: a service's build context, and through its Dockerfile's stages the source
 * its image is built from; returns the ENV its image ends with.
 */
function buildFacts(
  service: ServiceDef,
  unit: CodeUnit,
  project: ComposeProject,
  loading: Loading,
  facts: Fact[],
): {
  env: { name: string; value: string; at: At }[];
  sources: string[];
  files: ImageFile[];
} | null {
  const build = service.build;
  if (build === null) return null;
  const at = (where: At) => loading.locator.evidence(where.file, where.line);
  const context = build.context?.value ?? project.folder;
  const where = at(build.context?.at ?? build.at);
  if (isRemote(context)) {
    facts.push({
      kind: 'build',
      technique: 'compose-build',
      at: where,
      unit,
      context: null,
      remote: context,
      dockerfile: null,
      target: build.target?.value ?? null,
    });
    loading.problems.push({
      id: 'remote-build',
      level: 'warning',
      at: where,
      message: PROBLEMS['remote-build'](service.name, context),
    });
    return null;
  }
  const path = build.inline ? null : resolve(context, build.dockerfile?.value ?? 'Dockerfile');
  facts.push({
    kind: 'build',
    technique: 'compose-build',
    at: where,
    unit,
    context: loading.locator.place(context),
    remote: null,
    dockerfile: path === null ? null : loading.locator.place(path),
    target: build.target?.value ?? null,
  });
  if (path === null) {
    loading.problems.push({
      id: 'inline-dockerfile',
      level: 'warning',
      at: where,
      message: PROBLEMS['inline-dockerfile'](service.name),
    });
    return { env: [], sources: [context], files: [] };
  }
  const content = loading.files.read(path);
  if (content === undefined) {
    loading.problems.push({
      id: 'missing-dockerfile',
      level: 'warning',
      at: where,
      message: PROBLEMS['missing-dockerfile'](service.name, loading.locator.place(path).path),
    });
    return { env: [], sources: [context], files: [] };
  }
  loading.read.add(path);
  const args = new Map([...build.args].map(([key, each]) => [key, each.value]));
  const stages = readDockerfile(content, args);
  const target =
    build.target === null ? stages.at(-1) : (stageNamed(stages, build.target.value) ?? undefined);
  if (target === undefined) return { env: [], sources: [context], files: [] };
  // Every stage the target needs: its bases and the stages it copies from, and theirs.
  const needed: Stage[] = [];
  const visit = (stage: Stage): void => {
    if (needed.includes(stage)) return;
    needed.push(stage);
    const chain = baseChain(stages, stage);
    for (const each of chain) visit(each);
    for (const copy of stage.copies) {
      if (copy.from === null || build.contexts.has(copy.from)) continue;
      const from = stageNamed(stages.slice(0, stage.index), copy.from);
      if (from !== undefined) visit(from);
    }
  };
  visit(target);
  const image = baseChain(stages, target);
  const sources = [context];
  const files: ImageFile[] = [];
  for (const stage of needed.sort((a, b) => a.index - b.index)) {
    for (const copy of stage.copies) {
      let folder: string | null = context;
      if (copy.from !== null) {
        const named = build.contexts.get(copy.from)?.value;
        folder = named === undefined || isRemote(named) || /^[a-z-]+:/.test(named) ? null : named;
      }
      if (folder === null) continue;
      for (const source of copy.sources) {
        const place = resolve(folder, source.replace(/^\/+/, '') || '.');
        sources.push(place);
        if (image.includes(stage)) {
          files.push({
            source: place,
            destination: copy.destination,
            many: copy.sources.length > 1,
            at: { file: path, line: copy.line },
          });
        }
        facts.push({
          kind: 'source',
          technique: 'dockerfile-copy',
          at: at({ file: path, line: copy.line }),
          unit,
          place: loading.locator.place(place),
          stage: stage.name,
        });
      }
    }
  }
  for (const stage of image) {
    for (const port of stage.expose) {
      facts.push({
        kind: 'port',
        technique: 'dockerfile-expose',
        at: at({ file: path, line: port.line }),
        unit,
        target: port.port,
        protocol: port.protocol,
        published: null,
      });
    }
  }
  const env = new Map<string, { name: string; value: string; at: At }>();
  for (const stage of image) {
    for (const each of stage.env) {
      env.set(each.name, {
        name: each.name,
        value: each.value,
        at: { file: path, line: each.line },
      });
    }
  }
  return { env: [...env.values()], sources, files };
}
