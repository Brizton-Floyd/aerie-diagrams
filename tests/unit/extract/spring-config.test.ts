// A module's Spring configuration: its files and profiles, placeholders, relaxed binding, and the
// properties and connections drift reads from it (docs/spec/drift.md, slice D3).
import { describe, expect, it } from 'vitest';
import { evidenceText } from '../../../src/extract/index.ts';
import { envName, readConfig, uniform } from '../../../src/extract/spring/config.ts';
import { Locator } from '../../../src/extract/project.ts';
import { extractFrom, factLines, memoryFiles, yaml } from './memory.ts';

/** A one-module repo at `/w` whose resources hold `files` (by name inside `src/main/resources`). */
function module(files: Record<string, string>, artifact = 'app'): Record<string, string> {
  const out: Record<string, string> = {
    '/w/pom.xml': `<project>\n  <groupId>g</groupId>\n  <artifactId>${artifact}</artifactId>\n</project>\n`,
  };
  for (const [name, text] of Object.entries(files)) out[`/w/src/main/resources/${name}`] = text;
  return out;
}

const springLines = (files: Record<string, string>): string[] =>
  factLines(module(files)).filter((line) => !line.includes('Maven'));

describe('Spring configuration', () => {
  it('DRIFT-205 the application files of the classpath folder and its config folder, every profile, never other files', () => {
    const files = memoryFiles(
      module({
        'application.yml': yaml('server:', '  port: 8080'),
        'application.properties': 'server.port=8081\n',
        'config/application.yaml': yaml('server:', '  port: 8082'),
        'application-dev.properties': 'server.port=9090\n',
        'bootstrap.yml': yaml('server:', '  port: 1'),
        'other.properties': 'server.port=2\n',
      }),
    );
    const loading = { files, locator: new Locator([]), problems: [], read: new Set<string>() };
    const config = readConfig(['/w/src/main/resources'], loading);
    expect(
      config.entries.map(
        (each) => `${each.file.slice(22)} ${each.key}=${each.value} ${String(each.profile)}`,
      ),
    ).toEqual([
      'application-dev.properties server.port=9090 dev',
      'application.properties server.port=8081 null',
      'application.yml server.port=8080 null',
      'config/application.yaml server.port=8082 null',
    ]);
    // Spring's order: config/ over the folder, .properties over YAML, a profile over the default.
    expect(config.pick('server.port')?.value).toBe('8082');
    expect(config.pick('server.port', ['dev'])?.value).toBe('9090');
  });

  it('DRIFT-205 YAML is read as YAML 1.1, document by document, each tagged with the profile that activates it', () => {
    expect(
      springLines({
        'application.yml': yaml(
          'server:',
          '  port: 8080',
          'feature: yes',
          '---',
          'spring:',
          '  config:',
          '    activate:',
          '      on-profile: prod & cloud',
          'server:',
          '  port: 80',
          '---',
          'spring.profiles: legacy',
          'server.port: 8000',
        ),
      }),
    ).toEqual([
      'w/src/main/resources/application.yml:2  Spring property: maven:app sets server.port=8080 (env SERVER_PORT)',
      'w/src/main/resources/application.yml:10  Spring property: maven:app sets server.port=80 in profile prod & cloud (env SERVER_PORT)',
      'w/src/main/resources/application.yml:13  Spring property: maven:app sets server.port=8000 in profile legacy (env SERVER_PORT)',
    ]);
  });

  it('DRIFT-205 a properties file splits into documents at #--- and !---, and spring.profiles.active picks the profiles the code sees', () => {
    const found = extractFrom(
      module({
        'application.properties': [
          'spring.profiles.active=docker',
          'billing.url=http://localhost:8082',
          '#---',
          'spring.config.activate.on-profile=docker',
          'billing.url=http://billing:8082',
          '!---',
          'spring.config.activate.on-profile=test',
          'billing.url=http://localhost:1',
          '',
        ].join('\n'),
      }),
    );
    const properties = found.facts.flatMap((fact) =>
      fact.kind === 'property'
        ? [`${evidenceText(fact.at)} ${fact.value} ${String(fact.profile)}`]
        : [],
    );
    expect(properties).toEqual([
      'w/src/main/resources/application.properties:2 http://localhost:8082 null',
      'w/src/main/resources/application.properties:5 http://billing:8082 docker',
      'w/src/main/resources/application.properties:8 http://localhost:1 test',
    ]);
  });

  it('DRIFT-205 a file that is not valid YAML is a warning, and what it sets is not read', () => {
    const found = extractFrom(module({ 'application.yml': 'server:\n  port: [8080\n' }));
    expect(found.facts.filter((fact) => fact.kind === 'property')).toEqual([]);
    expect(
      found.problems.map((each) => [
        each.id,
        each.level,
        each.at === null ? null : evidenceText(each.at),
      ]),
    ).toEqual([['bad-config', 'warning', 'w/src/main/resources/application.yml:3']]);
  });

  it('DRIFT-206 placeholders: ${key}, ${key:default}, nested, from other properties and profiles; one with no value stays as written', () => {
    expect(
      springLines({
        'application.properties': [
          'billing.name=billing',
          'billing.url=http://${billing.name}:${billing.port:8082}/${missing:${also.missing:api}}',
          'ledger.url=${LEDGER_URL}',
          '',
        ].join('\n'),
      }),
    ).toEqual([
      'w/src/main/resources/application.properties:2  Spring configuration URL: maven:app to host billing (billing.url=http://billing:8082/api)',
      'w/src/main/resources/application.properties:2  Spring property: maven:app sets billing.url=http://billing:8082/api (env BILLING_URL)',
      'w/src/main/resources/application.properties:3  Spring property: maven:app sets ledger.url=${LEDGER_URL} (env LEDGER_URL)',
    ]);
  });

  it('DRIFT-206 relaxed binding: one name for camelCase, kebab case and underscores, and the environment variable that overrides it', () => {
    expect(uniform('core-api.baseUrl')).toBe(uniform('core-api.base-url'));
    expect(uniform('core_api.base_url')).toBe(uniform('coreApi.baseUrl'));
    expect(envName('core-api.base-url')).toBe('COREAPI_BASEURL');
    expect(envName('spring.kafka.bootstrap-servers')).toBe('SPRING_KAFKA_BOOTSTRAPSERVERS');
    expect(envName('app.targets[0].url')).toBe('APP_TARGETS_0_URL');
  });

  it('DRIFT-207 the server properties always, and every property that holds an address, with the connections it names', () => {
    expect(
      springLines({
        'application.yml': yaml(
          'server:',
          '  port: 8081',
          '  address: 127.0.0.1',
          '  servlet:',
          '    context-path: /shop',
          '  tomcat:',
          '    threads:',
          '      max: 200',
          'spring:',
          '  application:',
          '    name: orders',
          '  rabbitmq:',
          '    host: rabbit',
          '  datasource:',
          '    url: jdbc:postgresql://db:5432/orders?password=hunter2',
          '  kafka:',
          '    bootstrap-servers: kafka:9092,localhost:9093',
          'app:',
          '  mode: standalone',
          '  target-count: 5',
          '  cors:',
          '    allowed-origins: http://localhost:4200',
          '  web:',
          '    allowed-origins: http://localhost:4300',
          '  partner:',
          '    url: https://ops:secret@partner.example.com/api',
        ),
      }),
    ).toEqual([
      'w/src/main/resources/application.yml:2  Spring property: maven:app sets server.port=8081 (env SERVER_PORT)',
      'w/src/main/resources/application.yml:3  Spring property: maven:app sets server.address=127.0.0.1 (env SERVER_ADDRESS)',
      'w/src/main/resources/application.yml:5  Spring property: maven:app sets server.servlet.context-path=/shop (env SERVER_SERVLET_CONTEXTPATH)',
      'w/src/main/resources/application.yml:11  Spring property: maven:app sets spring.application.name=orders (env SPRING_APPLICATION_NAME)',
      'w/src/main/resources/application.yml:13  Spring configuration host name: maven:app to host rabbit (spring.rabbitmq.host=rabbit)',
      'w/src/main/resources/application.yml:13  Spring property: maven:app sets spring.rabbitmq.host=rabbit (env SPRING_RABBITMQ_HOST)',
      'w/src/main/resources/application.yml:15  Spring configuration JDBC URL: maven:app to host db (spring.datasource.url=jdbc:postgresql://db:5432/orders?password=***)',
      'w/src/main/resources/application.yml:15  Spring property: maven:app sets spring.datasource.url=jdbc:postgresql://db:5432/orders?password=*** (env SPRING_DATASOURCE_URL)',
      'w/src/main/resources/application.yml:17  Spring configuration host name: maven:app to host kafka (spring.kafka.bootstrap-servers=kafka:9092,localhost:9093)',
      'w/src/main/resources/application.yml:17  Spring configuration host name: maven:app to host localhost:9093 (spring.kafka.bootstrap-servers=kafka:9092,localhost:9093)',
      'w/src/main/resources/application.yml:17  Spring property: maven:app sets spring.kafka.bootstrap-servers=kafka:9092,localhost:9093 (env SPRING_KAFKA_BOOTSTRAPSERVERS)',
      'w/src/main/resources/application.yml:26  Spring configuration URL: maven:app to host partner.example.com (app.partner.url=https://ops:***@partner.example.com/api)',
      'w/src/main/resources/application.yml:26  Spring property: maven:app sets app.partner.url=https://ops:***@partner.example.com/api (env APP_PARTNER_URL)',
    ]);
  });

  it('DRIFT-207 a loopback address is the one module that listens on its port; another host, the module of that application name', () => {
    const pom = (artifact: string): string =>
      `<project>\n  <groupId>g</groupId>\n  <artifactId>${artifact}</artifactId>\n</project>\n`;
    const lines = factLines(
      {
        '/w/orders/pom.xml': pom('orders'),
        '/w/orders/src/main/resources/application.properties': [
          'server.port=8081',
          'billing.url=http://localhost:8082/api',
          'billing.by-name=http://billing-service/api',
          'self.url=http://127.0.0.1:8081/health',
          'nothing.url=http://localhost:7000',
          '',
        ].join('\n'),
        '/w/billing/pom.xml': pom('billing'),
        '/w/billing/src/main/resources/application.properties':
          'server.port=8082\nspring.application.name=billing-service\n',
      },
      'repo orders',
      'repo billing',
    );
    expect(lines.filter((line) => line.includes(' to '))).toEqual([
      'orders/src/main/resources/application.properties:2  Spring configuration URL: maven:orders to maven:billing (billing.url=http://localhost:8082/api)',
      'orders/src/main/resources/application.properties:3  Spring configuration URL: maven:orders to maven:billing (billing.by-name=http://billing-service/api)',
      'orders/src/main/resources/application.properties:5  Spring configuration URL: maven:orders to host localhost:7000 (nothing.url=http://localhost:7000)',
    ]);
  });

  it('DRIFT-207 an address property whose placeholder has no value or default is a warning, since its address is not checked', () => {
    const found = extractFrom(
      module({ 'application.properties': 'spring.datasource.url=${DB_URL}\nname=${NAME}\n' }),
    );
    expect(found.problems.map((each) => each.message)).toEqual([
      '`spring.datasource.url` takes its value from `${DB_URL}`, which has no value in the configuration and no default, so the address it holds is not checked.',
    ]);
  });
});
