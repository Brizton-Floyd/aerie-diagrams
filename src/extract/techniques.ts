// The techniques that find facts (docs/spec/drift.md, section 4, DRIFT-003). Each fact names the
// one that found it; matching (slice D5) counts how many techniques agree on a connection, and a
// technique that only corroborates (`depends_on` is start-up order, not a call) never counts alone.
// Maven and Spring (slice D3) add theirs after Compose's.

export interface Technique {
  /** How a report names it, before the fact's detail: "Compose environment URL: ...". */
  name: string;
  /**
   * The stack whose files it reads: Compose (and Dockerfiles), Node and Angular (and nginx), Maven
   * poms, or Spring configuration and Java.
   */
  stack: 'compose' | 'node' | 'maven' | 'spring';
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
  'maven-module': { name: 'Maven module', stack: 'maven', corroborates: false },
  'maven-dependency': { name: 'Maven dependency', stack: 'maven', corroborates: false },
  'spring-boot-app': { name: 'Spring Boot application', stack: 'spring', corroborates: false },
  'spring-property': { name: 'Spring property', stack: 'spring', corroborates: false },
  'spring-config-url': { name: 'Spring configuration URL', stack: 'spring', corroborates: false },
  'spring-config-jdbc': {
    name: 'Spring configuration JDBC URL',
    stack: 'spring',
    corroborates: false,
  },
  'spring-config-host': {
    name: 'Spring configuration host name',
    stack: 'spring',
    corroborates: false,
  },
  'spring-mapping': { name: 'Spring request mapping', stack: 'spring', corroborates: false },
  'webclient-call': { name: 'WebClient call', stack: 'spring', corroborates: false },
  'restclient-call': { name: 'RestClient call', stack: 'spring', corroborates: false },
  'resttemplate-call': { name: 'RestTemplate call', stack: 'spring', corroborates: false },
  'feign-client': { name: 'Feign client', stack: 'spring', corroborates: false },
  'http-interface': { name: 'HTTP interface', stack: 'spring', corroborates: false },
  'kafka-listener': { name: 'Kafka listener', stack: 'spring', corroborates: false },
  'kafka-template': { name: 'Kafka template', stack: 'spring', corroborates: false },
  'rabbit-listener': { name: 'RabbitMQ listener', stack: 'spring', corroborates: false },
  'rabbit-template': { name: 'RabbitMQ template', stack: 'spring', corroborates: false },
  'jms-listener': { name: 'JMS listener', stack: 'spring', corroborates: false },
  'jms-template': { name: 'JMS template', stack: 'spring', corroborates: false },
  'stream-bridge': { name: 'Spring Cloud Stream bridge', stack: 'spring', corroborates: false },
  'stream-binding': { name: 'Spring Cloud Stream binding', stack: 'spring', corroborates: false },
  'spring-event-publish': { name: 'Spring event publisher', stack: 'spring', corroborates: false },
  'spring-event-listener': { name: 'Spring event listener', stack: 'spring', corroborates: false },
  'spring-scheduled': { name: 'Spring schedule', stack: 'spring', corroborates: false },
} as const satisfies Record<string, Technique>;

export type TechniqueId = keyof typeof TECHNIQUES;
