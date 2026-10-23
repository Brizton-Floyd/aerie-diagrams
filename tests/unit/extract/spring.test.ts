// What the Spring Boot code of a module shows: applications, endpoints, HTTP calls and the text of
// their addresses, message channels, events and schedules (docs/spec/drift.md, slice D3).
import { describe, expect, it } from 'vitest';
import { factText, type Fact } from '../../../src/extract/index.ts';
import { extractFrom } from './memory.ts';

const POM = '<project>\n  <groupId>g</groupId>\n  <artifactId>app</artifactId>\n</project>\n';

/**
 * The facts of one kind in a one-module repo: `java` maps a file name in `com/shop/` to the lines
 * after its package line, and `config` is its `application.properties`.
 */
function facts(kind: Fact['kind'], java: Record<string, string[]>, config = ''): string[] {
  const files: Record<string, string> = { '/w/pom.xml': POM };
  if (config !== '') files['/w/src/main/resources/application.properties'] = config;
  for (const [name, lines] of Object.entries(java)) {
    files[`/w/src/main/java/com/shop/${name}`] = ['package com.shop;', '', ...lines, ''].join('\n');
  }
  const found = extractFrom(files);
  if (found.problems.length > 0) throw new Error(JSON.stringify(found.problems));
  return found.facts
    .filter((fact) => fact.kind === kind)
    .map((fact) => factText(fact).replace('w/src/main/java/com/shop/', ''));
}

const WEB = 'import org.springframework.web.bind.annotation.*;';
const WEB_CLIENT = 'import org.springframework.web.reactive.function.client.WebClient;';

describe('Spring Boot code', () => {
  it('DRIFT-204 a Spring Boot application is the class annotated @SpringBootApplication, by its import', () => {
    expect(
      facts('app', {
        'App.java': [
          'import org.springframework.boot.autoconfigure.SpringBootApplication;',
          '',
          '@SpringBootApplication',
          'class App {}',
        ],
        // An annotation of the same simple name from another package is not Spring Boot's.
        'Fake.java': [
          'import com.other.SpringBootApplication;',
          '',
          '@SpringBootApplication',
          'class Fake {}',
        ],
      }),
    ).toEqual([
      'App.java:5  Spring Boot application: maven:app runs the Spring Boot app com.shop.App',
    ]);
  });

  it('DRIFT-209 each mapping of a @RestController or @Controller: the type prefix, verbs, several paths, constants and placeholders', () => {
    expect(
      facts('endpoint', {
        'Paths.java': [
          'public final class Paths {',
          '    public static final String API = "/api";',
          '}',
        ],
        'Orders.java': [
          WEB,
          '',
          '@RestController',
          '@RequestMapping(Paths.API + "/orders")',
          'class Orders {',
          '    @GetMapping({"", "/all"}) String list() { return ""; }',
          '    @PostMapping(path = "/{id}") String create() { return ""; }',
          '    @RequestMapping(value = "/{id}", method = {RequestMethod.PUT, RequestMethod.PATCH}) String update() { return ""; }',
          '    @RequestMapping("/any") String any() { return ""; }',
          '    @DeleteMapping("${orders.purge:/purge}") String purge() { return ""; }',
          '    String helper() { return ""; }',
          '}',
        ],
        'Pages.java': [
          'import org.springframework.stereotype.Controller;',
          WEB,
          '',
          '@Controller',
          'class Pages {',
          '    @GetMapping("/") String home() { return "home"; }',
          '}',
        ],
        'NotAController.java': [
          WEB,
          '',
          'class NotAController {',
          '    @GetMapping("/x") String x() { return ""; }',
          '}',
        ],
      }),
    ).toEqual([
      'Orders.java:8  Spring request mapping: maven:app answers GET /api/orders (Orders.list)',
      'Orders.java:8  Spring request mapping: maven:app answers GET /api/orders/all (Orders.list)',
      'Orders.java:9  Spring request mapping: maven:app answers POST /api/orders/{id} (Orders.create)',
      'Orders.java:10  Spring request mapping: maven:app answers PATCH /api/orders/{id} (Orders.update)',
      'Orders.java:10  Spring request mapping: maven:app answers PUT /api/orders/{id} (Orders.update)',
      'Orders.java:11  Spring request mapping: maven:app answers ANY /api/orders/any (Orders.any)',
      'Orders.java:12  Spring request mapping: maven:app answers DELETE /api/orders/purge (Orders.purge)',
      'Pages.java:8  Spring request mapping: maven:app answers GET / (Pages.home)',
    ]);
  });

  it('DRIFT-209 a mapping declared on an interface or superclass the controller inherits, evidenced where it is written', () => {
    expect(
      facts('endpoint', {
        'Api.java': [
          WEB,
          '',
          '@RequestMapping("/v1")',
          'interface Api {',
          '    @GetMapping("/items") String items();',
          '}',
        ],
        'Controller.java': [
          WEB,
          '',
          '@RestController',
          'class Controller implements Api {',
          '    public String items() { return ""; }',
          '}',
        ],
      }),
    ).toEqual([
      'Api.java:7  Spring request mapping: maven:app answers GET /v1/items (Controller.items)',
    ]);
  });

  it('DRIFT-210 WebClient and RestClient calls: the verb, and the base URL from the builder, the constructor, a getter or the one bean', () => {
    expect(
      facts(
        'call',
        {
          'Built.java': [
            WEB_CLIENT,
            '',
            'class Built {',
            '    private final WebClient client;',
            '    Built(WebClient.Builder builder, @org.springframework.beans.factory.annotation.Value("${core.url}") String url) {',
            '        this.client = builder.baseUrl(url).build();',
            '    }',
            '    WebClient client() { return client; }',
            '    void a() { client.get().uri("/a").retrieve(); }',
            '    void b() { client().post().uri("/b/{id}", 1).retrieve(); }',
            '    void c() { WebClient.create("http://other:9000").method(org.springframework.http.HttpMethod.PUT).uri("/c").retrieve(); }',
            '}',
          ],
          'Injected.java': [
            WEB_CLIENT,
            '',
            'class Injected {',
            '    private final WebClient web;',
            '    Injected(WebClient web) { this.web = web; }',
            '    void d() { web.delete().uri(b -> b.path("/d").pathSegment("x").queryParam("q", 1).build()).retrieve(); }',
            '}',
          ],
          'Beans.java': [
            WEB_CLIENT,
            'import org.springframework.context.annotation.Bean;',
            '',
            'class Beans {',
            '    @Bean WebClient web() { return WebClient.builder().baseUrl("http://beans:7000").build(); }',
            '}',
          ],
          'Rest.java': [
            'import org.springframework.web.client.RestClient;',
            '',
            'class Rest {',
            '    private final RestClient rest = RestClient.create();',
            '    void e() { rest.get().uri("https://api.example.com/e").retrieve(); }',
            '}',
          ],
        },
        'core.url=http://localhost:8002\n',
      ),
    ).toEqual([
      'Built.java:11  WebClient call: maven:app calls GET http://localhost:8002/a on host localhost:8002 (Built.a)',
      'Built.java:12  WebClient call: maven:app calls POST http://localhost:8002/b/{id} on host localhost:8002 (Built.b)',
      'Built.java:13  WebClient call: maven:app calls PUT http://other:9000/c on host other (Built.c)',
      'Injected.java:8  WebClient call: maven:app calls DELETE http://beans:7000/d/x on host beans (Injected.d)',
      'Rest.java:7  RestClient call: maven:app calls GET https://api.example.com/e on host api.example.com (Rest.e)',
    ]);
  });

  it('DRIFT-210 RestTemplate calls count only on a receiver declared as one, never by its name', () => {
    expect(
      facts('call', {
        'Shipping.java': [
          'import java.util.Map;',
          'import org.springframework.http.HttpMethod;',
          'import org.springframework.web.client.RestTemplate;',
          '',
          'class Shipping {',
          '    private final RestTemplate template = new RestTemplate();',
          '    private Map<String, String> ticketsPerTemplate;',
          '    private Object restTemplate;',
          '    void ship() {',
          '        ticketsPerTemplate.put("a", "b");',
          '        template.getForObject("http://shipping/api/{id}", String.class, 1);',
          '        template.exchange("http://shipping/api", HttpMethod.POST, null, String.class);',
          '        template.delete("http://shipping/api/1");',
          '    }',
          '}',
        ],
      }),
    ).toEqual([
      'Shipping.java:13  RestTemplate call: maven:app calls GET http://shipping/api/{id} on host shipping (Shipping.ship)',
      'Shipping.java:14  RestTemplate call: maven:app calls POST http://shipping/api on host shipping (Shipping.ship)',
      'Shipping.java:15  RestTemplate call: maven:app calls DELETE http://shipping/api/1 on host shipping (Shipping.ship)',
    ]);
  });

  it("DRIFT-210 Feign clients and HTTP interfaces: one call per mapped method, from the url or the client's name", () => {
    expect(
      facts(
        'call',
        {
          'Billing.java': [
            'import org.springframework.cloud.openfeign.FeignClient;',
            WEB,
            '',
            '@FeignClient(name = "billing", url = "${billing.url}", path = "/api")',
            'interface Billing {',
            '    @PostMapping("/charges") String charge();',
            '    @RequestMapping(method = RequestMethod.GET, value = "/charges/{id}") String get();',
            '}',
          ],
          'Ledger.java': [
            'import org.springframework.cloud.openfeign.FeignClient;',
            WEB,
            '',
            '@FeignClient("ledger")',
            'interface Ledger {',
            '    @GetMapping("/entries") String entries();',
            '}',
          ],
          'Stock.java': [
            'import org.springframework.web.service.annotation.*;',
            '',
            '@HttpExchange("/stock")',
            'interface Stock {',
            '    @GetExchange("/{sku}") String get();',
            '    @HttpExchange(method = "PUT", url = "/{sku}") String put();',
            '}',
          ],
        },
        'billing.url=billing.internal:8443\n',
      ),
    ).toEqual([
      'Billing.java:8  Feign client: maven:app calls POST http://billing.internal:8443/api/charges on host billing.internal (Billing.charge)',
      'Billing.java:9  Feign client: maven:app calls GET http://billing.internal:8443/api/charges/{id} on host billing.internal (Billing.get)',
      'Ledger.java:8  Feign client: maven:app calls GET http://ledger/entries on host ledger (Ledger.entries)',
      'Stock.java:7  HTTP interface: maven:app calls GET {?}/stock/{sku} (Stock.get)',
      'Stock.java:8  HTTP interface: maven:app calls PUT {?}/stock/{sku} (Stock.put)',
    ]);
  });

  it('DRIFT-211 the text of an address: constants, static imports, locals, helper methods, String.format and URI builders', () => {
    const lines = facts('call', {
      'Paths.java': [
        'public interface Paths {',
        '    String ROOT = "/api";',
        '    final class Orders { public static final String ALL = ROOT + "/orders"; }',
        '}',
      ],
      'Client.java': [
        'import static com.shop.Paths.ROOT;',
        'import org.springframework.web.client.RestTemplate;',
        'import org.springframework.web.util.UriComponentsBuilder;',
        '',
        'class Client {',
        '    private final RestTemplate rest = new RestTemplate();',
        '    private static final String BASE = "http://orders:8080";',
        '    private String url(String path) { return BASE + path; }',
        '    void calls(String id, boolean flag) {',
        '        rest.getForObject(BASE + Paths.Orders.ALL, String.class);',
        '        rest.getForObject(url(ROOT + "/x"), String.class);',
        '        String local = BASE + "/local";',
        '        rest.getForObject(local, String.class);',
        '        rest.getForObject(String.format("%s/items/%s", BASE, id), String.class);',
        '        rest.getForObject(UriComponentsBuilder.fromUriString(BASE).path("/built/").path("/more").toUriString(), String.class);',
        '        rest.getForObject(UriComponentsBuilder.newInstance().scheme("https").host("h.example.com").port(8443).path("p").build().toUri(), String.class);',
        '        rest.getForObject(flag ? BASE + "/a" : BASE + "/b", String.class);',
        '        rest.getForObject(id, String.class);',
        '    }',
        '}',
      ],
    });
    expect(lines.map((line) => line.replace(/^.*calls GET (\S+).*$/, '$1'))).toEqual([
      'http://orders:8080/api/orders',
      'http://orders:8080/api/x',
      'http://orders:8080/local',
      'http://orders:8080/items/{?}',
      'http://orders:8080/built/more',
      'https://h.example.com:8443/p',
      'http://orders:8080/{?}',
      '{?}',
    ]);
  });

  it("DRIFT-211 @ConfigurationProperties records and classes, nested properties, getters and @Value read the module's configuration", () => {
    const lines = facts(
      'call',
      {
        'Props.java': [
          'import org.springframework.boot.context.properties.ConfigurationProperties;',
          '',
          '@ConfigurationProperties(prefix = "partner")',
          'record Props(String baseUrl, Paths paths) {',
          '    record Paths(String orders) {}',
          '    String ordersUrl() { return baseUrl + paths.orders(); }',
          '}',
        ],
        'Legacy.java': [
          'import org.springframework.boot.context.properties.ConfigurationProperties;',
          '',
          '@ConfigurationProperties("legacy")',
          'class Legacy {',
          '    private String host = "http://legacy-default";',
          '    public String getHost() { return host; }',
          '}',
        ],
        'Client.java': [
          'import org.springframework.beans.factory.annotation.Value;',
          'import org.springframework.web.client.RestTemplate;',
          '',
          'class Client {',
          '    private final RestTemplate rest = new RestTemplate();',
          '    private final Props props;',
          '    private final Legacy legacy;',
          '    @Value("${partner.base-url}/health") private String health;',
          '    Client(Props props, Legacy legacy) { this.props = props; this.legacy = legacy; }',
          '    void calls() {',
          '        rest.getForObject(props.ordersUrl(), String.class);',
          '        rest.getForObject(props.baseUrl() + props.paths().orders() + "/2", String.class);',
          '        rest.getForObject(legacy.getHost() + "/old", String.class);',
          '        rest.getForObject(health, String.class);',
          '    }',
          '}',
        ],
      },
      'partner.base-url=https://partner.example.com\npartner.paths.orders=/v2/orders\n',
    );
    expect(lines.map((line) => line.replace(/^.*calls GET (\S+).*$/, '$1'))).toEqual([
      'https://partner.example.com/v2/orders',
      'https://partner.example.com/v2/orders/2',
      'http://legacy-default/old',
      'https://partner.example.com/health',
    ]);
  });

  it('DRIFT-212 Kafka, RabbitMQ and JMS listeners and templates, with topics, queues, exchanges and routing keys', () => {
    expect(
      facts(
        'channel',
        {
          'Messages.java': [
            'import org.apache.kafka.clients.producer.ProducerRecord;',
            'import org.springframework.amqp.rabbit.annotation.*;',
            'import org.springframework.amqp.rabbit.core.RabbitTemplate;',
            'import org.springframework.jms.annotation.JmsListener;',
            'import org.springframework.jms.core.JmsTemplate;',
            'import org.springframework.kafka.annotation.KafkaListener;',
            'import org.springframework.kafka.core.KafkaTemplate;',
            '',
            'class Messages {',
            '    static final String TOPIC = "orders.created";',
            '    KafkaTemplate<String, String> kafka;',
            '    RabbitTemplate rabbit;',
            '    JmsTemplate jms;',
            '    java.util.List<String> sendList;',
            '    @KafkaListener(topics = {TOPIC, "${topics.extra}"}) void a(String m) {}',
            '    @RabbitListener(queues = "refunds") void b(String m) {}',
            '    @RabbitListener(bindings = @QueueBinding(value = @Queue("q"), exchange = @Exchange("x"), key = {"k1", "k2"})) void c(String m) {}',
            '    @RabbitListener(queuesToDeclare = @Queue(name = "declared")) void d(String m) {}',
            '    @JmsListener(destination = "ledger") void e(String m) {}',
            '    void send() {',
            '        kafka.send(TOPIC, "m");',
            '        kafka.send(new ProducerRecord<>("records", "m"));',
            '        kafka.sendDefault("m");',
            '        rabbit.convertAndSend("x", "k1", "m");',
            '        rabbit.convertAndSend("refunds", "m");',
            '        jms.convertAndSend("ledger", "m");',
            '        sendList.add("not a channel");',
            '    }',
            '}',
          ],
        },
        'topics.extra=orders.cancelled\n',
      ),
    ).toEqual([
      'Messages.java:17  Kafka listener: maven:app receives from kafka orders.cancelled (Messages.a)',
      'Messages.java:17  Kafka listener: maven:app receives from kafka orders.created (Messages.a)',
      'Messages.java:18  RabbitMQ listener: maven:app receives from rabbit refunds (Messages.b)',
      'Messages.java:19  RabbitMQ listener: maven:app receives from rabbit x, routing key k1 (Messages.c)',
      'Messages.java:19  RabbitMQ listener: maven:app receives from rabbit x, routing key k2 (Messages.c)',
      'Messages.java:20  RabbitMQ listener: maven:app receives from rabbit declared (Messages.d)',
      'Messages.java:21  JMS listener: maven:app receives from jms ledger (Messages.e)',
      'Messages.java:23  Kafka template: maven:app sends to kafka orders.created (Messages.send)',
      'Messages.java:24  Kafka template: maven:app sends to kafka records (Messages.send)',
      'Messages.java:25  Kafka template: maven:app sends to kafka {?} (Messages.send)',
      'Messages.java:26  RabbitMQ template: maven:app sends to rabbit x, routing key k1 (Messages.send)',
      'Messages.java:27  RabbitMQ template: maven:app sends to rabbit refunds (Messages.send)',
      'Messages.java:28  JMS template: maven:app sends to jms ledger (Messages.send)',
    ]);
  });

  it("DRIFT-212 Spring Cloud Stream: the bridge sends to its binding's destination, and bindings in the configuration", () => {
    const java = {
      'Audit.java': [
        'import org.springframework.cloud.stream.function.StreamBridge;',
        '',
        'class Audit {',
        '    StreamBridge bridge;',
        '    void send() { bridge.send("audit-out-0", "m"); bridge.send("raw", "m"); }',
        '}',
      ],
    };
    const config = [
      'spring.cloud.stream.bindings.audit-out-0.destination=audit-trail',
      'spring.cloud.stream.bindings.orders-in-0.destination=orders',
      '',
    ].join('\n');
    expect(
      facts('channel', java, config).map((line) => line.replace('w/src/main/resources/', '')),
    ).toEqual([
      'Audit.java:7  Spring Cloud Stream bridge: maven:app sends to stream audit-trail (Audit.send)',
      'Audit.java:7  Spring Cloud Stream bridge: maven:app sends to stream raw (Audit.send)',
      'application.properties:1  Spring Cloud Stream binding: maven:app sends to stream audit-trail',
      'application.properties:2  Spring Cloud Stream binding: maven:app receives from stream orders',
    ]);
  });

  it('DRIFT-213 in-process events: what a publisher publishes, by type, and what each listener listens for', () => {
    expect(
      facts('event', {
        'Placed.java': ['record Placed(String id) {}'],
        'Refund.java': [
          'class Refund extends org.springframework.context.ApplicationEvent { Refund() { super(""); } }',
        ],
        'Shop.java': [
          'import org.springframework.context.ApplicationEventPublisher;',
          'import org.springframework.context.ApplicationListener;',
          'import org.springframework.context.event.EventListener;',
          '',
          'class Shop implements ApplicationListener<Refund> {',
          '    ApplicationEventPublisher publisher;',
          '    Other notAPublisher;',
          '    void place() {',
          '        publisher.publishEvent(new Placed("1"));',
          '        Refund refund = new Refund();',
          '        publisher.publishEvent(refund);',
          '        notAPublisher.publishEvent(new Placed("2"));',
          '    }',
          '    @EventListener void onPlaced(Placed event) {}',
          '    @EventListener(classes = {Placed.class, Refund.class}) void onEither() {}',
          '    public void onApplicationEvent(Refund event) {}',
          '}',
        ],
      }),
    ).toEqual([
      'Shop.java:11  Spring event publisher: maven:app publishes com.shop.Placed (Shop.place)',
      'Shop.java:13  Spring event publisher: maven:app publishes com.shop.Refund (Shop.place)',
      'Shop.java:16  Spring event listener: maven:app listens for com.shop.Placed (Shop.onPlaced)',
      'Shop.java:17  Spring event listener: maven:app listens for com.shop.Placed (Shop.onEither)',
      'Shop.java:17  Spring event listener: maven:app listens for com.shop.Refund (Shop.onEither)',
      'Shop.java:18  Spring event listener: maven:app listens for com.shop.Refund (Shop.onApplicationEvent)',
    ]);
  });

  it('DRIFT-213 scheduled methods: cron, fixed rate and fixed delay, with their units and placeholders', () => {
    expect(
      facts(
        'schedule',
        {
          'Jobs.java': [
            'import java.util.concurrent.TimeUnit;',
            'import org.springframework.scheduling.annotation.Scheduled;',
            '',
            'class Jobs {',
            '    static final String NIGHTLY = "0 0 3 * * *";',
            '    @Scheduled(cron = NIGHTLY) void a() {}',
            '    @Scheduled(cron = "${jobs.cron}") void b() {}',
            '    @Scheduled(fixedRate = 5000) void c() {}',
            '    @Scheduled(fixedDelay = 2, timeUnit = TimeUnit.SECONDS) void d() {}',
            '    @Scheduled(fixedRateString = "PT1M") void e() {}',
            '}',
          ],
        },
        'jobs.cron=0 */5 * * * *\n',
      ),
    ).toEqual([
      'Jobs.java:8  Spring schedule: maven:app runs Jobs.a on cron 0 0 3 * * *',
      'Jobs.java:9  Spring schedule: maven:app runs Jobs.b on cron 0 */5 * * * *',
      'Jobs.java:10  Spring schedule: maven:app runs Jobs.c every 5000 ms',
      'Jobs.java:11  Spring schedule: maven:app runs Jobs.d 2 s after each run',
      'Jobs.java:12  Spring schedule: maven:app runs Jobs.e every PT1M',
    ]);
  });
});
