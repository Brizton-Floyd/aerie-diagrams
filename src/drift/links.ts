// What joins one piece of code to another (docs/spec/drift.md, section 5; DRIFT-411 to DRIFT-413):
// every connection, call, event, message and type reference the facts show, and every build
// dependency, as a link between two ends with the technique that found it. Matching a call to the
// endpoint that answers it, an event to its listeners and a message to its receivers are techniques
// of their own, which drift adds to the extractor's.
import type {
  AngularCallFact,
  ChannelFact,
  ConnectionFact,
  EndpointFact,
  EventFact,
  Evidence,
  Fact,
  ReferenceFact,
  SpringCallFact,
} from '../extract/index.ts';
import {
  evidenceText,
  factDetail,
  TECHNIQUES,
  unitText,
  type TechniqueId,
} from '../extract/index.ts';
import type { CodeUnit } from '../lines/index.ts';
import type { CodeIndex } from './code.ts';
import type { Matching } from './match.ts';

/** DRIFT-412, DRIFT-413: the techniques drift adds, each matching facts found apart. */
export const MATCHES = {
  'endpoint-match': { name: 'HTTP call matched to an endpoint' },
  'event-match': { name: 'Spring event matched to its listener' },
  'channel-match': { name: 'Message matched to its receiver' },
} as const;

export type MatchId = keyof typeof MATCHES;

/** A line of evidence: a fact, or a match of two facts, at the line of the first. */
export interface EvidenceLine {
  technique: TechniqueId | MatchId;
  /** The technique's name, as a report prints it. */
  name: string;
  at: Evidence;
  detail: string;
  /** Whether it only corroborates, and never counts on its own (DRIFT-003). */
  corroborates: boolean;
}

/** `repo/path:line  technique: detail`, as a report prints evidence (DRIFT-002). */
export function evidenceLine(line: EvidenceLine): string {
  return `${evidenceText(line.at)}  ${line.name}: ${line.detail}`;
}

/** One end of a link: code of a unit (a class of it, when known), or a host outside the system. */
export type End = { unit: CodeUnit; className: string | null } | { host: string };

export interface Link {
  /** A call, message or reference at run time, or a build dependency between Maven modules. */
  kind: 'runtime' | 'build';
  from: End;
  to: End;
  evidence: EvidenceLine;
  /**
   * A type reference is a dependency of the code, which a `[code]` line explains as well as a
   * runtime one; anything else only a runtime line explains.
   */
  either: boolean;
  /**
   * A type reference or an event never leaves the program it runs in, so where its target is a
   * library several apps package, it reaches the copy in the app that runs its source.
   */
  inProcess: boolean;
}

/** A call no endpoint of the system answers. */
export interface Unanswered {
  unit: CodeUnit;
  className: string | null;
  evidence: EvidenceLine;
}

/** A fact as a line of evidence. */
export function factEvidence(fact: Fact): EvidenceLine {
  const technique = TECHNIQUES[fact.technique];
  return {
    technique: fact.technique,
    name: technique.name,
    at: fact.at,
    detail: factDetail(fact),
    corroborates: technique.corroborates,
  };
}

function matched(id: MatchId, at: Evidence, detail: string): EvidenceLine {
  return { technique: id, name: MATCHES[id].name, at, detail, corroborates: false };
}

function simple(className: string): string {
  return className.slice(className.lastIndexOf('.') + 1);
}

/** DRIFT-411 to DRIFT-413: every link the facts show. */
export function linksOf(
  code: CodeIndex,
  matching: Matching,
): { links: Link[]; unanswered: Unanswered[] } {
  const links: Link[] = [];
  const unanswered: Unanswered[] = [];
  const facts = code.extraction.facts;
  const endpoints = facts.filter((fact): fact is EndpointFact => fact.kind === 'endpoint');
  for (const fact of facts) {
    switch (fact.kind) {
      case 'connection':
        links.push(connection(fact));
        break;
      case 'call':
        if ('className' in fact) {
          if (fact.to !== null) {
            const to: End = 'host' in fact.to ? fact.to : { unit: fact.to, className: null };
            links.push({
              kind: 'runtime',
              from: callEnd(fact),
              to,
              evidence: factEvidence(fact),
              either: false,
              inProcess: false,
            });
          }
          answer(fact, endpoints, code, links, unanswered);
        }
        break;
      case 'reference':
        links.push(...references(fact, code));
        break;
      case 'dependency':
        if (!('artifact' in fact.to) && fact.scope !== 'test') {
          links.push({
            kind: 'build',
            from: { unit: fact.from, className: null },
            to: { unit: fact.to, className: null },
            evidence: factEvidence(fact),
            either: false,
            inProcess: false,
          });
        }
        break;
      default:
        break;
    }
  }
  links.push(...browserCalls(facts, endpoints, code, matching));
  links.push(...events(facts, code), ...channels(facts));
  return { links, unanswered };
}

function connection(fact: ConnectionFact): Link {
  const to: End = 'host' in fact.to ? fact.to : { unit: fact.to, className: null };
  return {
    kind: 'runtime',
    from: { unit: fact.from, className: null },
    to,
    evidence: factEvidence(fact),
    either: false,
    inProcess: false,
  };
}

function callEnd(fact: SpringCallFact): End {
  return { unit: fact.unit, className: fact.className };
}

/** The path of an address, with each part known only at run time as `{}`: `/api/{}/games`. */
function pathOf(url: string): string[] | null {
  let rest = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '');
  if (rest.startsWith('{?}')) rest = rest.slice('{?}'.length);
  rest = rest.replace(/[?#].*$/, '');
  if (rest === '') rest = '/';
  if (!rest.startsWith('/')) return null;
  const parts = rest
    .split('/')
    .filter((part) => part !== '')
    .map((part) => (/^\{.*\}$/.test(part) || part.includes('{?}') ? '{}' : part));
  return parts;
}

/** Whether a call's path is one an endpoint's path template answers. */
function answers(call: string[], endpoint: string[]): boolean {
  return (
    call.length === endpoint.length &&
    call.every((part, i) => part === '{}' || endpoint[i] === '{}' || part === endpoint[i])
  );
}

/**
 * DRIFT-412: the endpoints that answer a call: of the module the call reaches (or the modules it
 * packages), or of any module when the call's host is not known, by verb and path template, with
 * each endpoint under its module's context path. The most literal templates win.
 */
function answering(
  verb: string,
  path: string[],
  modules: readonly string[] | null,
  endpoints: readonly EndpointFact[],
  code: CodeIndex,
): EndpointFact[] {
  const found = endpoints.filter((endpoint) => {
    if (modules !== null && !modules.includes(endpoint.unit.name)) return false;
    if (verb !== 'ANY' && endpoint.verb !== 'ANY' && endpoint.verb !== verb) return false;
    return code.prefixes(endpoint.unit.name).some((prefix) => {
      const template = pathOf(`${prefix}${endpoint.path}`);
      return template !== null && answers(path, template);
    });
  });
  const literal = (endpoint: EndpointFact): number =>
    (pathOf(endpoint.path) ?? []).filter((part) => part !== '{}').length;
  const best = Math.max(...found.map(literal));
  return found.filter((endpoint) => literal(endpoint) === best);
}

/** The modules a call to a module may be answered by: the module and what it packages. */
function modulesOf(unit: CodeUnit, code: CodeIndex): string[] {
  if (unit.kind !== 'maven') return [];
  return [unit.name, ...code.closure(unit.name)];
}

function answer(
  call: SpringCallFact,
  endpoints: readonly EndpointFact[],
  code: CodeIndex,
  links: Link[],
  unanswered: Unanswered[],
): void {
  if (call.to !== null && 'host' in call.to) return;
  if (call.to === null && !call.url.startsWith('{?}')) return;
  const path = pathOf(call.url);
  if (path === null || path.every((part) => part === '{}')) return;
  const modules = call.to === null ? null : modulesOf(call.to, code);
  const found = answering(call.verb, path, modules, endpoints, code);
  if (found.length === 0) {
    const reachable = endpoints.some(
      (each) => modules === null || modules.includes(each.unit.name),
    );
    if (reachable) {
      unanswered.push({ unit: call.unit, className: call.className, evidence: factEvidence(call) });
    }
    return;
  }
  // A call whose host is not known goes where its path leads only when one module answers it.
  if (call.to === null && new Set(found.map((each) => each.unit.name)).size > 1) return;
  for (const endpoint of found) {
    links.push({
      kind: 'runtime',
      from: callEnd(call),
      to: { unit: endpoint.unit, className: endpoint.className },
      evidence: matched(
        'endpoint-match',
        call.at,
        `${unitText(call.unit)} calls ${call.verb} ${call.url}, which ${unitText(endpoint.unit)} answers (${simple(endpoint.className)}.${endpoint.method}) at ${evidenceText(endpoint.at)}`,
      ),
      either: false,
      inProcess: false,
    });
  }
}

/**
 * DRIFT-412: a call from a browser app that reaches a Compose service, matched to the endpoints of
 * the Maven modules the service's element stands for.
 */
function browserCalls(
  facts: readonly Fact[],
  endpoints: readonly EndpointFact[],
  code: CodeIndex,
  matching: Matching,
): Link[] {
  const links: Link[] = [];
  const calls = facts.filter(
    (fact): fact is AngularCallFact => fact.kind === 'call' && !('className' in fact),
  );
  const done = new Set<string>();
  for (const fact of facts) {
    if (fact.kind !== 'connection' || 'host' in fact.to || fact.to.kind !== 'compose') continue;
    if (
      !['angular-http', 'http-dev-proxy', 'http-nginx'].includes(fact.technique) ||
      fact.key === null
    )
      continue;
    const key = `${evidenceText(fact.at)} ${fact.key}`;
    if (done.has(key)) continue;
    done.add(key);
    const space = fact.key.indexOf(' ');
    const verb = fact.key.slice(0, space);
    const path = pathOf(fact.key.slice(space + 1));
    const element = matching.owner.get(unitText(fact.to));
    if (path === null || element === undefined) continue;
    const modules = matching.unitsOf(element).flatMap((owned) => modulesOf(owned.unit, code));
    if (modules.length === 0) continue;
    const call = calls.find((each) => evidenceText(each.at) === evidenceText(fact.at));
    for (const endpoint of answering(verb, path, modules, endpoints, code)) {
      links.push({
        kind: 'runtime',
        from: { unit: fact.from, className: null },
        to: { unit: endpoint.unit, className: endpoint.className },
        evidence: matched(
          'endpoint-match',
          fact.at,
          `${unitText(call?.unit ?? fact.from)} calls ${fact.key}, which ${unitText(endpoint.unit)} answers (${simple(endpoint.className)}.${endpoint.method}) at ${evidenceText(endpoint.at)}`,
        ),
        either: false,
        inProcess: false,
      });
    }
  }
  return links;
}

/**
 * DRIFT-411: a type reference, and through it each type of the system that extends or implements
 * the type named, since the code that names an interface calls what implements it.
 */
function references(fact: ReferenceFact, code: CodeIndex): Link[] {
  const from: End = { unit: fact.unit, className: fact.className };
  const links: Link[] = [
    {
      kind: 'runtime',
      from,
      to: { unit: fact.toUnit, className: fact.to },
      evidence: factEvidence(fact),
      either: true,
      inProcess: true,
    },
  ];
  for (const each of code.subtypes(fact.to)) {
    const declared = code.classes.get(each);
    if (declared === undefined || each === fact.className) continue;
    links.push({
      kind: 'runtime',
      from,
      to: { unit: declared.unit, className: each },
      evidence: {
        ...factEvidence(fact),
        detail: `${factDetail(fact)}, which ${each} extends or implements`,
      },
      either: false,
      inProcess: true,
    });
  }
  return links;
}

/**
 * DRIFT-413: an event published to the listeners of its type, when one application runs both: an
 * in-process event never leaves the program that publishes it.
 */
function events(facts: readonly Fact[], code: CodeIndex): Link[] {
  const all = facts.filter((fact): fact is EventFact => fact.kind === 'event');
  const links: Link[] = [];
  const runsIn = (unit: CodeUnit): Set<string> =>
    new Set([unit.name, ...code.packagedBy(unit.name)]);
  for (const publisher of all.filter((each) => each.direction === 'publishes')) {
    for (const listener of all.filter(
      (each) => each.direction === 'listens' && each.event === publisher.event,
    )) {
      const apps = runsIn(listener.unit);
      if (![...runsIn(publisher.unit)].some((each) => apps.has(each))) continue;
      links.push({
        kind: 'runtime',
        from: { unit: publisher.unit, className: publisher.className },
        to: { unit: listener.unit, className: listener.className },
        evidence: matched(
          'event-match',
          publisher.at,
          `${unitText(publisher.unit)} publishes ${publisher.event}, which ${unitText(listener.unit)} listens for (${simple(listener.className)}.${listener.method}) at ${evidenceText(listener.at)}`,
        ),
        either: false,
        inProcess: true,
      });
    }
  }
  return links;
}

/** Whether two sides name the same channel, `{?}` standing for any text. */
function sameChannel(a: string, b: string): boolean {
  const pattern = (text: string): RegExp =>
    new RegExp(
      `^${text
        .split('{?}')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*')}$`,
    );
  return a === b || pattern(a).test(b) || pattern(b).test(a);
}

/** Whether a RabbitMQ routing key reaches a binding's pattern: `*` one word, `#` any number. */
function routes(key: string | null, binding: string | null): boolean {
  if (key === null || binding === null) return true;
  const words = binding
    .split('.')
    .map((word) =>
      word === '*' ? '[^.]+' : word === '#' ? '.*' : word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
  return new RegExp(`^${words.join('\\.')}$`).test(key);
}

/** DRIFT-413: a message sent to a channel, to each receiver of that channel on the same broker. */
function channels(facts: readonly Fact[]): Link[] {
  const all = facts.filter((fact): fact is ChannelFact => fact.kind === 'channel');
  const links: Link[] = [];
  for (const sender of all.filter((each) => each.direction === 'sends')) {
    for (const receiver of all) {
      if (receiver.direction !== 'receives' || receiver.broker !== sender.broker) continue;
      if (!sameChannel(sender.channel, receiver.channel) || !routes(sender.key, receiver.key))
        continue;
      links.push({
        kind: 'runtime',
        from: { unit: sender.unit, className: sender.className },
        to: { unit: receiver.unit, className: receiver.className },
        evidence: matched(
          'channel-match',
          sender.at,
          `${unitText(sender.unit)} sends to ${sender.broker} ${sender.channel}, which ${unitText(receiver.unit)} receives at ${evidenceText(receiver.at)}`,
        ),
        either: false,
        inProcess: false,
      });
    }
  }
  return links;
}
