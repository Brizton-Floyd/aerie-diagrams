// Messages and events in the Java code: the channels a module sends to and receives from through
// Kafka, RabbitMQ, JMS and Spring Cloud Stream (DRIFT-212), the in-process events its classes
// publish and listen for, and the methods Spring runs on a schedule (DRIFT-213). As with HTTP calls,
// a template counts only when its receiver is declared with the template's type.
import type { ChannelFact, EventFact, Fact, ScheduleFact } from '../facts.ts';
import type { Annotation, Expr, Method } from '../java/model.ts';
import { annotationArg, simpleName } from '../java/model.ts';
import type { TechniqueId } from '../techniques.ts';
import { walkScoped, type ClassInfo, type Scope } from './code.ts';
import { textOf, type Text } from './values.ts';
import type { Analysis } from './web.ts';

const KAFKA = 'org.springframework.kafka.annotation.';
const RABBIT = 'org.springframework.amqp.rabbit.annotation.';
const LISTENERS: {
  names: string[];
  broker: ChannelFact['broker'];
  technique: TechniqueId;
}[] = [
  { names: [`${KAFKA}KafkaListener`], broker: 'kafka', technique: 'kafka-listener' },
  { names: [`${RABBIT}RabbitListener`], broker: 'rabbit', technique: 'rabbit-listener' },
  {
    names: ['org.springframework.jms.annotation.JmsListener'],
    broker: 'jms',
    technique: 'jms-listener',
  },
];
const TEMPLATES: {
  names: string[];
  methods: string[];
  broker: ChannelFact['broker'];
  technique: TechniqueId;
}[] = [
  {
    names: [
      'org.springframework.kafka.core.KafkaTemplate',
      'org.springframework.kafka.core.KafkaOperations',
      'org.springframework.kafka.core.reactive.ReactiveKafkaProducerTemplate',
    ],
    methods: ['send', 'sendDefault'],
    broker: 'kafka',
    technique: 'kafka-template',
  },
  {
    names: [
      'org.springframework.amqp.rabbit.core.RabbitTemplate',
      'org.springframework.amqp.rabbit.core.RabbitOperations',
      'org.springframework.amqp.core.AmqpTemplate',
      'org.springframework.amqp.rabbit.core.RabbitMessagingTemplate',
    ],
    methods: ['convertAndSend', 'send', 'convertSendAndReceive', 'sendAndReceive'],
    broker: 'rabbit',
    technique: 'rabbit-template',
  },
  {
    names: [
      'org.springframework.jms.core.JmsTemplate',
      'org.springframework.jms.core.JmsOperations',
      'org.springframework.jms.core.JmsMessagingTemplate',
    ],
    methods: ['convertAndSend', 'send', 'convertSendAndReceive', 'sendAndReceive'],
    broker: 'jms',
    technique: 'jms-template',
  },
  {
    names: ['org.springframework.cloud.stream.function.StreamBridge'],
    methods: ['send'],
    broker: 'stream',
    technique: 'stream-bridge',
  },
];
const PUBLISHERS = [
  'org.springframework.context.ApplicationEventPublisher',
  'org.springframework.context.ApplicationContext',
  'org.springframework.context.ConfigurableApplicationContext',
];
const EVENT_LISTENERS = [
  'org.springframework.context.event.EventListener',
  'org.springframework.transaction.event.TransactionalEventListener',
  'org.springframework.modulith.events.ApplicationModuleListener',
];
const APPLICATION_LISTENER = ['org.springframework.context.ApplicationListener'];
const SCHEDULED = ['org.springframework.scheduling.annotation.Scheduled'];
const UNITS: Record<string, string> = {
  NANOSECONDS: 'ns',
  MICROSECONDS: 'us',
  MILLISECONDS: 'ms',
  SECONDS: 's',
  MINUTES: 'min',
  HOURS: 'h',
  DAYS: 'd',
};

/** DRIFT-212: what listeners receive and templates send. */
export function channelFacts(
  analysis: Analysis,
  streamDestination: (scope: Scope, binding: string) => string,
): Fact[] {
  const { code, loading } = analysis;
  const facts: ChannelFact[] = [];
  const push = (
    cls: ClassInfo,
    method: string | null,
    line: number,
    technique: TechniqueId,
    broker: ChannelFact['broker'],
    direction: ChannelFact['direction'],
    channel: string,
    key: string | null,
  ): void => {
    facts.push({
      kind: 'channel',
      technique,
      at: loading.locator.evidence(cls.file.path, line),
      unit: cls.file.module.unit,
      className: cls.name,
      method,
      direction,
      broker,
      channel,
      key,
    });
  };
  for (const cls of code.all()) {
    const holders: { annotations: Annotation[]; method: Method | null }[] = [
      { annotations: cls.decl.annotations, method: null },
      ...cls.decl.methods.map((method) => ({ annotations: method.annotations, method })),
    ];
    for (const { annotations, method } of holders) {
      for (const annotation of annotations) {
        const listener = LISTENERS.find((each) => code.isType(annotation.name, cls, each.names));
        if (listener === undefined) continue;
        for (const { channel, key } of listened(analysis, annotation, cls, listener.broker)) {
          push(
            cls,
            method?.name ?? null,
            annotation.line,
            listener.technique,
            listener.broker,
            'receives',
            channel,
            key,
          );
        }
      }
    }
  }
  for (const scope of code.methodScopes()) {
    for (const expr of scope.method?.body?.exprs ?? []) {
      walkScoped(expr, scope, (each, where) => {
        if (each.t !== 'call' || each.object === null) return;
        const template = TEMPLATES.find(
          (kind) =>
            kind.methods.includes(each.name) && code.typeIs(each.object ?? each, where, kind.names),
        );
        if (template === undefined) return;
        const sent = sentTo(analysis, each, where, template.broker, streamDestination);
        push(
          where.cls,
          where.method?.name ?? null,
          each.line,
          template.technique,
          template.broker,
          'sends',
          sent.channel,
          sent.key,
        );
      });
    }
  }
  return facts;
}

function items(expr: Expr | undefined): Expr[] {
  if (expr === undefined) return [];
  return expr.t === 'array' ? expr.items : [expr];
}

/** The channels a listener annotation names. */
function listened(
  analysis: Analysis,
  annotation: Annotation,
  cls: ClassInfo,
  broker: ChannelFact['broker'],
): { channel: string; key: string | null }[] {
  const scope: Scope = { cls, method: null, lambdas: [] };
  const text = (expr: Expr): string => textOf(analysis.values.setting(expr, scope));
  switch (broker) {
    case 'kafka': {
      const topics = items(annotationArg(annotation, 'topics', 'value')).map(text);
      const pattern = annotationArg(annotation, 'topicPattern');
      return [...topics, ...(pattern === undefined ? [] : [text(pattern)])].map((channel) => ({
        channel,
        key: null,
      }));
    }
    case 'rabbit': {
      const out: { channel: string; key: string | null }[] = [];
      for (const each of items(annotationArg(annotation, 'queues', 'value'))) {
        out.push({ channel: text(each), key: null });
      }
      for (const each of items(annotationArg(annotation, 'queuesToDeclare'))) {
        const name =
          each.t === 'annotation' ? annotationArg(each.annotation, 'value', 'name') : each;
        if (name !== undefined) out.push({ channel: text(name), key: null });
      }
      for (const each of items(annotationArg(annotation, 'bindings'))) {
        if (each.t !== 'annotation') continue;
        const exchange = annotationArg(each.annotation, 'exchange');
        const exchangeName =
          exchange?.t === 'annotation'
            ? annotationArg(exchange.annotation, 'value', 'name')
            : exchange;
        const keys = items(annotationArg(each.annotation, 'key')).map(text);
        const queue = annotationArg(each.annotation, 'value');
        const queueName =
          queue?.t === 'annotation' ? annotationArg(queue.annotation, 'value', 'name') : queue;
        if (exchangeName !== undefined) {
          for (const key of keys.length === 0 ? [null] : keys)
            out.push({ channel: text(exchangeName), key });
        } else if (queueName !== undefined) {
          out.push({ channel: text(queueName), key: null });
        }
      }
      return out;
    }
    case 'jms':
    case 'stream': {
      const destination = annotationArg(annotation, 'destination', 'value');
      return destination === undefined ? [] : [{ channel: text(destination), key: null }];
    }
  }
}

/** Where a template sends: the topic, queue, exchange and routing key, or destination it is given. */
function sentTo(
  analysis: Analysis,
  call: Extract<Expr, { t: 'call' }>,
  scope: Scope,
  broker: ChannelFact['broker'],
  streamDestination: (scope: Scope, binding: string) => string,
): { channel: string; key: string | null } {
  const { values } = analysis;
  const text = (expr: Expr | undefined): Text =>
    expr === undefined ? [null] : values.of(expr, scope);
  const [first, second] = call.args;
  const unknown = { channel: '{?}', key: null };
  switch (broker) {
    case 'kafka': {
      if (call.name === 'sendDefault' || first === undefined) return unknown;
      // `send(new ProducerRecord<>(topic, ...))` names its topic in the record.
      if (first.t === 'new' && simpleName(first.type.name) === 'ProducerRecord') {
        return { channel: textOf(text(first.args[0])), key: null };
      }
      return call.args.length >= 2 ? { channel: textOf(text(first)), key: null } : unknown;
    }
    case 'rabbit': {
      if (call.args.length >= 3 && first !== undefined && second !== undefined) {
        const exchange = text(first);
        const key = text(second);
        if (exchange.every((part) => part !== null) && key.every((part) => part !== null)) {
          return {
            channel: textOf(exchange) === '' ? '(default)' : textOf(exchange),
            key: textOf(key),
          };
        }
      }
      return call.args.length >= 2 ? { channel: textOf(text(first)), key: null } : unknown;
    }
    case 'jms':
      return call.args.length >= 2 ? { channel: textOf(text(first)), key: null } : unknown;
    case 'stream': {
      const binding = text(first);
      if (!binding.every((part) => part !== null)) return unknown;
      return { channel: streamDestination(scope, textOf(binding)), key: null };
    }
  }
}

/** DRIFT-213: the events classes publish and listen for, by their types. */
export function eventFacts(analysis: Analysis): Fact[] {
  const { code, loading } = analysis;
  const facts: EventFact[] = [];
  for (const scope of code.methodScopes()) {
    for (const expr of scope.method?.body?.exprs ?? []) {
      walkScoped(expr, scope, (each, where) => {
        if (each.t !== 'call' || each.name !== 'publishEvent' || each.object === null) return;
        if (!code.typeIs(each.object, where, PUBLISHERS)) return;
        const [event] = each.args;
        const type = event === undefined ? undefined : code.typeOf(event, where);
        if (type === undefined || type.name === 'Object') return;
        facts.push({
          kind: 'event',
          technique: 'spring-event-publish',
          at: loading.locator.evidence(where.cls.file.path, each.line),
          unit: where.cls.file.module.unit,
          className: where.cls.name,
          method: where.method?.name ?? '',
          direction: 'publishes',
          event: type.name,
        });
      });
    }
  }
  for (const cls of code.all()) {
    const listens = (method: Method, event: string, line: number): void => {
      facts.push({
        kind: 'event',
        technique: 'spring-event-listener',
        at: loading.locator.evidence(cls.file.path, line),
        unit: cls.file.module.unit,
        className: cls.name,
        method: method.name,
        direction: 'listens',
        event,
      });
    };
    for (const method of cls.decl.methods) {
      const annotation = method.annotations.find((each) =>
        code.isType(each.name, cls, EVENT_LISTENERS),
      );
      if (annotation === undefined) continue;
      const classes = items(annotationArg(annotation, 'classes', 'value')).flatMap((each) =>
        each.t === 'class' ? [each.type.name] : [],
      );
      const types =
        classes.length > 0
          ? classes
          : method.params
              .slice(0, 1)
              .flatMap((param) => (param.type === null ? [] : [param.type.name]));
      for (const type of types) listens(method, code.resolve(type, cls).name, annotation.line);
    }
    const listener = cls.decl.interfaces.find((each) =>
      code.isType(each.name, cls, APPLICATION_LISTENER),
    );
    const event = listener?.args[0];
    const handler = cls.decl.methods.find((each) => each.name === 'onApplicationEvent');
    if (event !== undefined && handler !== undefined) {
      listens(handler, code.resolve(event.name, cls).name, handler.line);
    }
  }
  return facts;
}

/** DRIFT-213: the methods Spring runs on a schedule, and when. */
export function scheduleFacts(analysis: Analysis): Fact[] {
  const { code, values, loading } = analysis;
  const facts: ScheduleFact[] = [];
  for (const cls of code.all()) {
    const scope: Scope = { cls, method: null, lambdas: [] };
    const text = (expr: Expr): string => textOf(values.setting(expr, scope));
    for (const method of cls.decl.methods) {
      for (const annotation of method.annotations) {
        if (!code.isType(annotation.name, cls, SCHEDULED)) continue;
        const unitArg = annotationArg(annotation, 'timeUnit');
        const unit = unitArg?.t === 'field' ? (UNITS[unitArg.name] ?? unitArg.name) : 'ms';
        const cron = annotationArg(annotation, 'cron');
        const rate = annotationArg(annotation, 'fixedRate', 'fixedRateString');
        const delay = annotationArg(annotation, 'fixedDelay', 'fixedDelayString');
        const when =
          cron !== undefined
            ? `on cron ${text(cron)}`
            : rate !== undefined
              ? `every ${text(rate)}${/^\d+$/.test(text(rate)) ? ` ${unit}` : ''}`
              : delay !== undefined
                ? `${text(delay)}${/^\d+$/.test(text(delay)) ? ` ${unit}` : ''} after each run`
                : 'on a schedule set at run time';
        facts.push({
          kind: 'schedule',
          technique: 'spring-scheduled',
          at: loading.locator.evidence(cls.file.path, annotation.line),
          unit: cls.file.module.unit,
          className: cls.name,
          method: method.name,
          schedule: when,
        });
      }
    }
  }
  return facts;
}
