// Where a URL goes (DRIFT-307): to a Compose service, to a host outside the system, or nowhere
// drift can name. Code that runs on the developer's machine or in a browser (the dev server, the
// app itself) reaches a service through the port the host publishes; code that runs in a container
// (nginx) reaches it by its name on the Compose network.
import type { CodeUnit } from '../../lines/index.ts';
import { LOOPBACK } from '../compose/hosts.ts';

/** What the Compose projects of the system tell about reaching their services. */
export interface Network {
  /** Every name that reaches a service, in lower case, to the service; null when two share it. */
  byName: ReadonlyMap<string, string | null>;
  /** Every host port a service publishes, to the services that publish it. */
  published: ReadonlyMap<string, string[]>;
}

export type Target = CodeUnit | { host: string };

const URL = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/(?:[^@/?#]*@)?(\[[^\]]+\]|[^:/?#[\]]+)(?::(\d+))?/;
const DEFAULT_PORTS: Record<string, string> = { http: '80', https: '443', ws: '80', wss: '443' };

/** The host (lower case, no brackets) and port of an absolute URL, or null when it is not one. */
export function urlHost(url: string): { host: string; port: string | null } | null {
  const match = URL.exec(url.trim());
  if (match === null) return null;
  const host = (match[2] ?? '').replace(/^\[|\]$/g, '').toLowerCase();
  if (host === '' || /[{}$]/.test(host)) return null;
  const scheme = (match[1] ?? '').toLowerCase();
  return { host, port: match[3] ?? DEFAULT_PORTS[scheme] ?? null };
}

/** Whether a URL is absolute: it has a scheme, or starts `//`. */
export function isAbsoluteUrl(url: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(url) || url.startsWith('//');
}

/**
 * Where a URL goes from the developer's machine or a browser: a loopback address goes to the service
 * that publishes its port, if one alone does, and otherwise stays a host with its port, since only
 * the port tells which program on the machine it means; another name goes to the service it names,
 * or is a host outside the system. Null when the URL names no host drift can read.
 */
export function onHost(url: string, network: Network): Target | null {
  const found = urlHost(url);
  if (found === null) return null;
  if (LOOPBACK.has(found.host)) {
    const services = found.port === null ? [] : (network.published.get(found.port) ?? []);
    const only = services.length === 1 ? services[0] : undefined;
    if (only !== undefined) return { kind: 'compose', name: only };
    return { host: found.port === null ? found.host : `${found.host}:${found.port}` };
  }
  const service = network.byName.get(found.host);
  return typeof service === 'string' ? { kind: 'compose', name: service } : { host: found.host };
}

/**
 * Where a URL goes from inside the container of service `self`: a loopback address is the container
 * itself (null), and a name is a service of its Compose project or a host outside the system.
 */
export function inContainer(
  url: string,
  byName: ReadonlyMap<string, string>,
  self: string,
): Target | null {
  const found = urlHost(url);
  if (found === null || LOOPBACK.has(found.host)) return null;
  const service = byName.get(found.host);
  if (service === self) return null;
  return service === undefined ? { host: found.host } : { kind: 'compose', name: service };
}
