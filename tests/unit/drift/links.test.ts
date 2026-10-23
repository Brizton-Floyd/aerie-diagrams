// What joins code to code (docs/spec/drift.md, section 5; DRIFT-411 to DRIFT-413): links from the
// facts, calls matched to endpoints, events to listeners and messages to receivers.
import { describe, expect, it } from 'vitest';
import { evidenceLine, type Drift } from '../../../src/drift/index.ts';
import { driftOf, keys } from './drift.ts';
import { bootApp, compose, javaClass, maven } from './projects.ts';

/** Each confirmed line with the techniques that confirm it. */
function lines(drift: Drift): string[] {
  return drift.confirmed.flatMap((each) =>
    'relationship' in each.subject ? [`${each.text} [${each.techniques.join(', ')}]`] : [],
  );
}

const WEB = 'org.springframework.web.bind.annotation.*';
const CLIENT = 'org.springframework.web.reactive.function.client.WebClient';

/** Two Spring Boot apps: `orders` calls `billing` with a WebClient at a literal address. */
function apps(path: string, mapping: string, contextPath = ''): Record<string, string> {
  return maven(
    {
      name: 'orders',
      java: {
        'o/Main.java': bootApp('o', 'Main'),
        'o/Client.java': javaClass(
          'o',
          [CLIENT],
          'public class Client {',
          '  private final WebClient web = WebClient.create("http://localhost:8082");',
          `  String charge() { return web.post().uri("${path}").retrieve().bodyToMono(String.class).block(); }`,
          '}',
        ),
      },
    },
    {
      name: 'billing',
      java: {
        'b/Main.java': bootApp('b', 'Main'),
        'b/Charges.java': javaClass(
          'b',
          [WEB],
          '@RestController',
          'public class Charges {',
          `  ${mapping}`,
          '  public String charge() { return ""; }',
          '}',
        ),
      },
      config: [
        'server:',
        '  port: 8082',
        ...(contextPath === '' ? [] : ['  servlet:', `    context-path: ${contextPath}`]),
      ],
    },
  );
}

const MODEL = [
  'model m: M',
  'orders: Orders',
  '  code maven:orders',
  '  client: Client',
  '    code class:o.Client',
  'billing: Billing',
  '  code maven:billing',
  '  charges: Charges',
  '    code class:b.Charges',
  'client charges cards with charges',
];

describe('links', () => {
  it('DRIFT-411 connection facts and calls are links, a depends_on alone shows nothing, and a test dependency is no build link', () => {
    const files = compose(
      'services:',
      '  web:',
      '    image: a',
      '    environment: { API_URL: "http://api:3000" }',
      '  api:',
      '    image: b',
      '    depends_on: [db]',
      '  db:',
      '    image: c',
    );
    const drift = driftOf(
      files,
      'model m: M',
      'web: Web',
      '  code compose:web',
      'api: API',
      '  code compose:api',
      'db: Database',
      '  code compose:db',
      'web calls api',
      'api reads db',
    );
    expect(lines(drift)).toEqual(['The line “Web calls API” is in the code. [env-url]']);
    expect(drift.notChecked.map((each) => each.text)).toContain(
      'The line “API reads Database” is not checked: only Compose depends_on, which only corroborates, shows it.',
    );
    const build = maven({ name: 'app', deps: [['kit', 'test']] }, { name: 'kit', deps: ['app'] });
    expect(
      keys(
        driftOf(
          build,
          'model m: M',
          'app: App',
          '  code maven:app',
          'kit: Kit',
          '  code maven:kit',
          'app depends on kit [code]',
        ),
      ),
    ).toEqual(['drift missing-dependency:app>kit', 'drift undrawn-dependency:kit>app']);
  });

  it('DRIFT-411 code that names an interface is linked to what implements it', () => {
    const files = maven({
      name: 'app',
      java: {
        'a/Api.java': javaClass('a', [], 'public class Api { Port port; }'),
        'a/Port.java': javaClass('a', [], 'public interface Port {}'),
        'a/Adapter.java': javaClass('a', [], 'public class Adapter implements Port {}'),
      },
    });
    const drift = driftOf(
      files,
      'model m: M',
      'app: App',
      '  code maven:app',
      '  api: API',
      '    code class:a.Api',
      '  adapter: Adapter',
      '    code class:a.Adapter',
      'api stores through adapter',
    );
    expect(lines(drift)).toEqual([
      'The line “API stores through Adapter” is in the code. [java-reference]',
    ]);
    expect(
      drift.confirmed.flatMap((each) => each.evidence.map((line) => evidenceLine(line))),
    ).toContain(
      'w/app/src/main/java/a/Api.java:4  Java type reference: maven:app a.Api uses a.Port, which a.Adapter extends or implements',
    );
  });

  it('DRIFT-412 a call is matched to the endpoint that answers it, by verb and path template, under the context path', () => {
    expect(lines(driftOf(apps('/charges/42', '@PostMapping("/charges/{id}")'), ...MODEL))).toEqual([
      'The line “Client charges cards with Charges” is in the code. [webclient-call, endpoint-match]',
    ]);
    expect(
      lines(driftOf(apps('/pay/charges', '@PostMapping("/charges")', '/pay'), ...MODEL)),
    ).toEqual([
      'The line “Client charges cards with Charges” is in the code. [webclient-call, endpoint-match]',
    ]);
    // A verb that does not agree leaves the call to the module, unanswered.
    const wrong = driftOf(apps('/charges', '@GetMapping("/charges")'), ...MODEL);
    expect(lines(wrong)).toEqual([
      'The line “Client charges cards with Charges” is in the code. [webclient-call]',
    ]);
    expect(keys(wrong)).toEqual(['likely unanswered-calls:client']);
    expect(wrong.findings[0]?.title).toBe(
      'Client makes a call that no endpoint of the system answers.',
    );
  });

  it('DRIFT-412 a call whose base is not known goes where one module answers its path, and a browser call to its service', () => {
    const files = maven(
      {
        name: 'orders',
        java: {
          'o/Client.java': javaClass(
            'o',
            [CLIENT],
            'public class Client {',
            '  private final WebClient web;',
            '  Client(WebClient web) { this.web = web; }',
            '  String one() { return web.get().uri("/charges/{id}", 1).retrieve().bodyToMono(String.class).block(); }',
            '}',
          ),
        },
      },
      {
        name: 'billing',
        java: {
          'b/Charges.java': javaClass(
            'b',
            [WEB],
            '@RestController',
            'public class Charges {',
            '  @GetMapping("/charges/{id}") public String one() { return ""; }',
            '}',
          ),
        },
      },
    );
    expect(lines(driftOf(files, ...MODEL))).toEqual([
      'The line “Client charges cards with Charges” is in the code. [endpoint-match]',
    ]);
  });

  it('DRIFT-413 an event reaches its listeners in the app that runs both, and a message its receivers', () => {
    const KAFKA = 'org.springframework.kafka.core.KafkaTemplate';
    const LISTENER = 'org.springframework.kafka.annotation.KafkaListener';
    const EVENTS = 'org.springframework.context.ApplicationEventPublisher';
    const ON = 'org.springframework.context.event.EventListener';
    const files = maven(
      {
        name: 'orders',
        java: {
          'o/Main.java': bootApp('o', 'Main'),
          'o/Placed.java': javaClass('o', [], 'public record Placed(String id) {}'),
          'o/Shop.java': javaClass(
            'o',
            [KAFKA, EVENTS],
            'public class Shop {',
            '  private final KafkaTemplate<String, String> kafka;',
            '  private final ApplicationEventPublisher events;',
            '  Shop(KafkaTemplate<String, String> kafka, ApplicationEventPublisher events) { this.kafka = kafka; this.events = events; }',
            '  void place() { kafka.send("orders.placed", "1"); events.publishEvent(new Placed("1")); }',
            '}',
          ),
          'o/Mailer.java': javaClass(
            'o',
            [ON],
            'public class Mailer {',
            '  @EventListener public void on(Placed placed) {}',
            '}',
          ),
        },
      },
      {
        name: 'billing',
        java: {
          'b/Main.java': bootApp('b', 'Main'),
          'b/Orders.java': javaClass(
            'b',
            [LISTENER],
            'public class Orders {',
            '  @KafkaListener(topics = "orders.placed") public void placed(String id) {}',
            '}',
          ),
        },
      },
    );
    const drift = driftOf(
      files,
      'model m: M',
      'orders: Orders',
      '  code maven:orders',
      '  shop: Shop',
      '    code class:o.Shop',
      '  mailer: Mailer',
      '    code class:o.Mailer',
      'billing: Billing',
      '  code maven:billing',
      'shop tells mailer',
      'shop announces orders to billing',
    );
    expect(lines(drift)).toEqual([
      'The line “Shop tells Mailer” is in the code. [event-match]',
      'The line “Shop announces orders to Billing” is in the code. [channel-match]',
    ]);
  });
});
