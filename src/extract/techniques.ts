// The techniques that find facts (docs/spec/drift.md, section 4, DRIFT-003). Each fact names the
// one that found it; matching (slice D5) counts how many techniques agree on a connection, and a
// technique that only corroborates (`depends_on` is start-up order, not a call) never counts alone.

export interface Technique {
  /** How a report names it, before the fact's detail: "Compose environment URL: ...". */
  name: string;
  /** The stack whose files it reads: Compose (and Dockerfiles), or Node and Angular (and nginx). */
  stack: 'compose' | 'node';
  /** Whether it only supports what other techniques find, and is never evidence on its own. */
  corroborates: boolean;
}

export const TECHNIQUES = {
  'compose-project': { name: 'Compose project', stack: 'compose', corroborates: false },
  'compose-folder': { name: 'Compose project folder', stack: 'compose', corroborates: false },
  'compose-service': { name: 'Compose service', stack: 'compose', corroborates: false },
  'compose-image': { name: 'Compose image', stack: 'compose', corroborates: false },
  'compose-port': { name: 'Compose port', stack: 'compose', corroborates: false },
  'compose-build': { name: 'Compose build context', stack: 'compose', corroborates: false },
  'dockerfile-copy': { name: 'Dockerfile COPY', stack: 'compose', corroborates: false },
  'dockerfile-expose': { name: 'Dockerfile EXPOSE', stack: 'compose', corroborates: false },
  'env-url': { name: 'Compose environment URL', stack: 'compose', corroborates: false },
  'env-jdbc': { name: 'Compose environment JDBC URL', stack: 'compose', corroborates: false },
  'env-host': { name: 'Compose environment host name', stack: 'compose', corroborates: false },
  'compose-depends-on': { name: 'Compose depends_on', stack: 'compose', corroborates: true },
  'compose-links': { name: 'Compose links', stack: 'compose', corroborates: true },
  'compose-volume': { name: 'Compose volume', stack: 'compose', corroborates: false },
  'compose-profile': { name: 'Compose profile', stack: 'compose', corroborates: false },
  'compose-healthcheck': { name: 'Compose healthcheck', stack: 'compose', corroborates: false },
  'npm-package': { name: 'package.json name', stack: 'node', corroborates: false },
  'npm-dependency': { name: 'package.json dependency', stack: 'node', corroborates: false },
  'angular-project': { name: 'Angular project', stack: 'node', corroborates: false },
  'angular-proxy': { name: 'Angular dev-server proxy', stack: 'node', corroborates: false },
  'angular-environment': { name: 'Angular environment file', stack: 'node', corroborates: false },
  'angular-http': { name: 'Angular HttpClient', stack: 'node', corroborates: false },
  'http-dev-proxy': {
    name: 'Angular HttpClient through the dev proxy',
    stack: 'node',
    corroborates: false,
  },
  'http-nginx': { name: 'Angular HttpClient through nginx', stack: 'node', corroborates: false },
  'nginx-proxy-pass': { name: 'nginx proxy_pass', stack: 'node', corroborates: false },
} as const satisfies Record<string, Technique>;

export type TechniqueId = keyof typeof TECHNIQUES;
