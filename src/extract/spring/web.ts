// HTTP in the Java code: the requests a module answers (DRIFT-209) and the requests it sends
// (DRIFT-210), through WebClient, RestClient, RestTemplate, Feign clients and HTTP interfaces. A
// call counts only when its receiver is declared with the client's type; its base URL comes from the
// builder that made the client, wherever the code shows it.
import type { CodeUnit } from '../../lines/index.ts';
import type { Loading } from '../compose/load.ts';
import type { EndpointFact, Fact, SpringCallFact } from '../facts.ts';
import type { Annotation, Expr, Method } from '../java/model.ts';
import { annotationArg, simpleName } from '../java/model.ts';
import type { MavenModule } from '../maven/reactor.ts';
import type { TechniqueId } from '../techniques.ts';
import { walkScoped, type ClassInfo, type Codebase, type Scope } from './code.ts';
import { compactText, joinPath, textOf, UNKNOWN, type Text, type Values } from './values.ts';

/** What the analysers of the Java code share. */
export interface Analysis {
  code: Codebase;
  values: Values;
  loading: Loading;
  /** What a URL's host names: a module listening there, an outside host, or null when not known. */
  target(url: Text): CodeUnit | { host: string } | null;
  /** The modules whose beans the code of a module may be given: its dependencies and dependents. */
  related(module: MavenModule): MavenModule[];
}

const WEB = 'org.springframework.web.bind.annotation.';
const EXCHANGE = 'org.springframework.web.service.annotation.';
const CONTROLLERS = [`${WEB}RestController`, 'org.springframework.stereotype.Controller'];
const VERB_MAPPINGS: Record<string, string> = {
  GetMapping: 'GET',
  PostMapping: 'POST',
  PutMapping: 'PUT',
  DeleteMapping: 'DELETE',
  PatchMapping: 'PATCH',
  RequestMapping: 'ANY',
};
const MAPPINGS = Object.keys(VERB_MAPPINGS).map((each) => WEB + each);
const VERB_EXCHANGES: Record<string, string> = {
  GetExchange: 'GET',
  PostExchange: 'POST',
  PutExchange: 'PUT',
  DeleteExchange: 'DELETE',
  PatchExchange: 'PATCH',
  HttpExchange: 'ANY',
};
const EXCHANGES = Object.keys(VERB_EXCHANGES).map((each) => EXCHANGE + each);
const FEIGN = ['org.springframework.cloud.openfeign.FeignClient'];
const WEB_CLIENT = ['org.springframework.web.reactive.function.client.WebClient'];
const REST_CLIENT = ['org.springframework.web.client.RestClient'];
const REST_TEMPLATE = [
  'org.springframework.web.client.RestTemplate',
  'org.springframework.web.client.RestOperations',
];
const BEAN = ['org.springframework.context.annotation.Bean'];
const VERBS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
const TEMPLATE_VERBS: Record<string, string> = {
  getForObject: 'GET',
  getForEntity: 'GET',
  headForHeaders: 'HEAD',
  postForObject: 'POST',
  postForEntity: 'POST',
  postForLocation: 'POST',
  put: 'PUT',
  patchForObject: 'PATCH',
  delete: 'DELETE',
  optionsForAllow: 'OPTIONS',
  exchange: 'ANY',
  execute: 'ANY',
};

/** A mapping annotation read: its verbs and paths. */
interface Mapping {
  verbs: string[];
  paths: Text[];
  line: number;
}

function mapping(
  analysis: Analysis,
  annotation: Annotation,
  cls: ClassInfo,
  table: Record<string, string>,
  names: readonly string[],
  pathKeys: string[],
): Mapping | null {
  const { code, values } = analysis;
  if (!code.isType(annotation.name, cls, names)) return null;
  const scope: Scope = { cls, method: null, lambdas: [] };
  const fixed = table[simpleName(annotation.name)] ?? 'ANY';
  let verbs = [fixed];
  const method = annotationArg(annotation, 'method');
  if (fixed === 'ANY' && method !== undefined) {
    const items = method.t === 'array' ? method.items : [method];
    const read = items.map((item) =>
      item.t === 'field'
        ? item.name
        : item.t === 'name'
          ? item.name
          : textOf(values.of(item, scope)),
    );
    verbs = read.length === 0 ? ['ANY'] : read.map((each) => each.toUpperCase());
  }
  const path = annotationArg(annotation, ...pathKeys);
  const items = path === undefined ? [] : path.t === 'array' ? path.items : [path];
  const paths = items.length === 0 ? [['']] : items.map((item) => values.setting(item, scope));
  return { verbs, paths, line: annotation.line };
}

function webMapping(analysis: Analysis, annotation: Annotation, cls: ClassInfo): Mapping | null {
  return mapping(analysis, annotation, cls, VERB_MAPPINGS, MAPPINGS, ['value', 'path']);
}

function exchangeMapping(
  analysis: Analysis,
  annotation: Annotation,
  cls: ClassInfo,
): Mapping | null {
  return mapping(analysis, annotation, cls, VERB_EXCHANGES, EXCHANGES, ['value', 'url']);
}

/** A request path as Spring joins a type's and a method's mappings: one leading `/`, none trailing. */
export function endpointPath(prefix: Text, path: Text): string {
  const joined = textOf(joinPath(joinPath(['/'], prefix), path)).replace(/\/{2,}/g, '/');
  return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
}

/**
 * The methods of a class with their mapping annotations: its own, or those of the supertype it
 * inherits them from (`owner`, whose file is their evidence).
 */
function mappedMethods(
  analysis: Analysis,
  cls: ClassInfo,
  read: (annotation: Annotation, owner: ClassInfo) => Mapping | null,
): { method: Method; owner: ClassInfo; mappings: Mapping[] }[] {
  const seen = new Map<string, { method: Method; owner: ClassInfo; mappings: Mapping[] }>();
  for (const owner of analysis.code.lineage(cls)) {
    for (const method of owner.decl.methods) {
      if (method.returns === null) continue;
      const key = `${method.name}/${String(method.params.length)}`;
      const mappings = method.annotations.flatMap((each) => read(each, owner) ?? []);
      const known = seen.get(key);
      if (known === undefined) seen.set(key, { method, owner, mappings });
      else if (known.mappings.length === 0 && mappings.length > 0) {
        seen.set(key, { method: known.method, owner, mappings });
      }
    }
  }
  return [...seen.values()].filter((each) => each.mappings.length > 0);
}

function typeMapping(
  analysis: Analysis,
  cls: ClassInfo,
  read: (annotation: Annotation, owner: ClassInfo) => Mapping | null,
): Mapping | null {
  for (const owner of analysis.code.lineage(cls)) {
    for (const annotation of owner.decl.annotations) {
      const found = read(annotation, owner);
      if (found !== null) return found;
    }
  }
  return null;
}

/** DRIFT-209: the requests each `@RestController` and `@Controller` answers. */
export function endpointFacts(analysis: Analysis): Fact[] {
  const { code, loading } = analysis;
  const facts: EndpointFact[] = [];
  for (const cls of code.all()) {
    if (cls.decl.kind !== 'class') continue;
    if (!cls.decl.annotations.some((each) => code.isType(each.name, cls, CONTROLLERS))) continue;
    const read = (annotation: Annotation, owner: ClassInfo): Mapping | null =>
      webMapping(analysis, annotation, owner);
    const prefixes = typeMapping(analysis, cls, read)?.paths ?? [['']];
    for (const { method, owner, mappings } of mappedMethods(analysis, cls, read)) {
      for (const each of mappings) {
        for (const prefix of prefixes) {
          for (const path of each.paths) {
            for (const verb of each.verbs) {
              facts.push({
                kind: 'endpoint',
                technique: 'spring-mapping',
                at: loading.locator.evidence(owner.file.path, each.line),
                unit: cls.file.module.unit,
                className: cls.name,
                method: method.name,
                verb,
                path: endpointPath(prefix, path),
              });
            }
          }
        }
      }
    }
  }
  return facts;
}

/** DRIFT-210: the requests sent through Feign clients and HTTP interfaces, one per mapped method. */
export function interfaceCallFacts(analysis: Analysis): Fact[] {
  const { code, values, loading } = analysis;
  const facts: SpringCallFact[] = [];
  for (const cls of code.all()) {
    if (cls.decl.kind !== 'interface') continue;
    const scope: Scope = { cls, method: null, lambdas: [] };
    const feign = cls.decl.annotations.find((each) => code.isType(each.name, cls, FEIGN));
    let base: Text;
    let technique: TechniqueId;
    let read: (annotation: Annotation, owner: ClassInfo) => Mapping | null;
    let prefix: Text = [''];
    if (feign !== undefined) {
      technique = 'feign-client';
      read = (annotation, owner) => webMapping(analysis, annotation, owner);
      const url = annotationArg(feign, 'url');
      const name = annotationArg(feign, 'name', 'value');
      const path = annotationArg(feign, 'path');
      if (url !== undefined) {
        base = values.setting(url, scope);
        const first = base[0];
        if (typeof first === 'string' && first !== '' && !first.includes('://'))
          base = ['http://', ...base];
      } else {
        base =
          name === undefined ? UNKNOWN : compactText(['http://', ...values.setting(name, scope)]);
      }
      if (path !== undefined) base = joinPath(base, values.setting(path, scope));
      prefix = typeMapping(analysis, cls, read)?.paths[0] ?? [''];
    } else {
      technique = 'http-interface';
      read = (annotation, owner) => exchangeMapping(analysis, annotation, owner);
      const type = typeMapping(analysis, cls, read)?.paths[0] ?? [''];
      const first = type[0];
      base = typeof first === 'string' && first.includes('://') ? type : joinPath(UNKNOWN, type);
    }
    for (const { method, owner, mappings } of mappedMethods(analysis, cls, read)) {
      for (const each of mappings) {
        for (const path of each.paths) {
          for (const verb of each.verbs) {
            const url = joinPath(joinPath(base, prefix), path);
            facts.push({
              kind: 'call',
              technique,
              at: loading.locator.evidence(owner.file.path, each.line),
              unit: cls.file.module.unit,
              className: cls.name,
              method: method.name,
              verb,
              url: textOf(url),
              to: analysis.target(url),
            });
          }
        }
      }
    }
  }
  return facts;
}

/** A client's base URL: none configured, known, or set where the code does not show it. */
type Base = { kind: 'none' } | { kind: 'known'; text: Text } | { kind: 'unknown' };

/** DRIFT-210: the requests sent through WebClient, RestClient and RestTemplate. */
export function clientCallFacts(analysis: Analysis): Fact[] {
  const { code } = analysis;
  const facts: SpringCallFact[] = [];
  for (const scope of code.methodScopes()) {
    const body = scope.method?.body;
    if (body === null || body === undefined) continue;
    for (const expr of body.exprs) {
      walkScoped(expr, scope, (each, where) => {
        if (each.t !== 'call') return;
        const call = fluentCall(analysis, each, where) ?? templateCall(analysis, each, where);
        if (call !== null) facts.push(call);
      });
    }
  }
  return facts;
}

/** `client.get().uri(...)` and `client.method(HttpMethod.GET).uri(...)` on a WebClient or RestClient. */
function fluentCall(
  analysis: Analysis,
  call: Extract<Expr, { t: 'call' }>,
  scope: Scope,
): SpringCallFact | null {
  const { code, values } = analysis;
  if (call.name !== 'uri' || call.object?.t !== 'call') return null;
  const spec = call.object;
  let verb: string;
  if (VERBS.has(spec.name) && spec.args.length === 0) verb = spec.name.toUpperCase();
  else if (spec.name === 'method' && spec.args.length === 1) verb = verbOf(spec.args[0]);
  else return null;
  const client = spec.object;
  if (client === null) return null;
  const isWeb = code.typeIs(client, scope, WEB_CLIENT);
  if (!isWeb && !code.typeIs(client, scope, REST_CLIENT)) return null;
  const [first] = call.args;
  if (first === undefined) return null;
  let path: Text;
  if (first.t === 'lambda') {
    // `uri(builder -> builder.path("/x").build(...))`: the path the builder builds, through each
    // statement that changes it (`builder.path(...)`) and the chain it returns.
    const param = first.params[0]?.name;
    const inner: Scope = {
      ...scope,
      lambdas: [...scope.lambdas, { params: first.params, body: first.body }],
    };
    path = [''];
    for (const each of first.body.exprs) {
      const current = path;
      const built = values.uri(each, inner, (root) =>
        root.t === 'name' && root.name === param ? current : undefined,
      );
      if (built !== undefined) path = built;
    }
  } else {
    path = values.of(first, scope);
  }
  const base = baseOf(analysis, client, scope, ['baseUrl'], 0);
  return callFact(
    analysis,
    scope,
    call.line,
    isWeb ? 'webclient-call' : 'restclient-call',
    verb,
    base,
    path,
  );
}

/** `restTemplate.getForObject(url, ...)` and the other RestTemplate methods. */
function templateCall(
  analysis: Analysis,
  call: Extract<Expr, { t: 'call' }>,
  scope: Scope,
): SpringCallFact | null {
  const { code, values } = analysis;
  const fixed = Object.hasOwn(TEMPLATE_VERBS, call.name) ? TEMPLATE_VERBS[call.name] : undefined;
  if (fixed === undefined || call.object === null) return null;
  if (!code.typeIs(call.object, scope, REST_TEMPLATE)) return null;
  const [first, second] = call.args;
  if (first === undefined) return null;
  const verb = fixed === 'ANY' && second !== undefined ? verbOf(second) : fixed;
  const path = values.of(first, scope);
  const base = baseOf(analysis, call.object, scope, ['rootUri'], 0);
  return callFact(analysis, scope, call.line, 'resttemplate-call', verb, base, path);
}

function verbOf(expr: Expr | undefined): string {
  if (expr?.t === 'field' && /^[A-Z]+$/.test(expr.name)) return expr.name;
  if (expr?.t === 'call' && expr.name === 'valueOf' && expr.args[0]?.t === 'string') {
    return expr.args[0].value.toUpperCase();
  }
  return 'ANY';
}

function callFact(
  analysis: Analysis,
  scope: Scope,
  line: number,
  technique: TechniqueId,
  verb: string,
  base: Base,
  path: Text,
): SpringCallFact {
  const first = path[0];
  const absolute = typeof first === 'string' && /^[a-z][a-z0-9+.-]*:\/\//i.test(first);
  const unknown = path.length === 1 && first === null;
  const url = absolute
    ? path
    : base.kind === 'known'
      ? joinPath(base.text, path)
      : base.kind === 'none' || unknown
        ? path
        : joinPath(UNKNOWN, path);
  const module = scope.cls.file.module;
  return {
    kind: 'call',
    technique,
    at: analysis.loading.locator.evidence(scope.cls.file.path, line),
    unit: module.unit,
    className: scope.cls.name,
    method: scope.method?.name ?? '',
    verb,
    url: textOf(url),
    to: analysis.target(url),
  };
}

const MAX_TRACE = 4;

/**
 * Where a client's base URL comes from: the builder chain that made it (`baseUrl`, or `rootUri` for
 * a RestTemplate), the value a variable or field was given, the method that returned it, or the one
 * bean of its type in the modules it runs with.
 */
function baseOf(
  analysis: Analysis,
  expr: Expr,
  scope: Scope,
  setters: string[],
  depth: number,
): Base {
  const { code, values } = analysis;
  if (depth > MAX_TRACE) return { kind: 'unknown' };
  if (expr.t === 'call') {
    // A chain: the last `baseUrl(...)` in it, or the factory at its root.
    for (let at: Expr | null = expr; at?.t === 'call'; at = at.object) {
      const [arg] = at.args;
      if (setters.includes(at.name) && arg !== undefined)
        return { kind: 'known', text: values.of(arg, scope) };
    }
    let root: Expr = expr;
    let factory: Extract<Expr, { t: 'call' }> = expr;
    while (root.t === 'call' && root.object !== null) {
      factory = root;
      root = root.object;
    }
    if (root.t === 'name' && !code.isVariable(root.name, scope)) {
      const [arg] = factory.args;
      if (factory.name === 'create' && arg !== undefined)
        return { kind: 'known', text: values.of(arg, scope) };
      if (factory.name === 'create' || factory.name === 'builder') return { kind: 'none' };
    }
    // A method of the system that returns the client: what it returns.
    const owner =
      expr.object === null || expr.object.t === 'this'
        ? scope.cls
        : code.typeOf(expr.object, scope)?.info;
    const found =
      owner === undefined
        ? undefined
        : code
            .methods(owner, expr.name, expr.args.length)
            .find((each) => each.method.body !== null);
    if (found !== undefined) {
      const returned = found.method.body?.returns[0];
      if (returned === undefined) return { kind: 'unknown' };
      return baseOf(
        analysis,
        returned,
        { cls: found.owner, method: found.method, lambdas: [] },
        setters,
        depth + 1,
      );
    }
    // A builder's chain with no base URL in it: what its builder was given, if the code shows it.
    if (root.t === 'call') return { kind: 'unknown' };
    return builderBase(analysis, root, scope, setters, depth + 1);
  }
  if (expr.t === 'new') return { kind: 'none' };
  // A client Spring injects, with no value the code shows: the one bean of its type.
  const injected = (where: Scope): Base =>
    code.typeIs(
      expr,
      scope,
      setters.includes('rootUri') ? REST_TEMPLATE : [...WEB_CLIENT, ...REST_CLIENT],
    )
      ? beanBase(analysis, where, setters, depth)
      : { kind: 'unknown' };
  return variableBase(analysis, expr, scope, setters, depth, injected);
}

/** A builder held in a variable: what the variable was given; an injected builder is not known. */
function builderBase(
  analysis: Analysis,
  expr: Expr,
  scope: Scope,
  setters: string[],
  depth: number,
): Base {
  return variableBase(analysis, expr, scope, setters, depth, () => ({ kind: 'unknown' }));
}

/** What a variable or field holds a client (or builder) from: its value, or what a constructor sets. */
function variableBase(
  analysis: Analysis,
  expr: Expr,
  scope: Scope,
  setters: string[],
  depth: number,
  injected: (scope: Scope) => Base,
): Base {
  const { code } = analysis;
  if (expr.t !== 'name' && !(expr.t === 'field' && expr.object.t === 'this'))
    return { kind: 'unknown' };
  const name = expr.name;
  const locals = [
    ...scope.lambdas.flatMap((each) => each.body.locals),
    ...(expr.t === 'name' ? (scope.method?.body?.locals ?? []) : []),
  ];
  for (const local of locals) {
    if (local.name === name && local.value !== null)
      return baseOf(analysis, local.value, scope, setters, depth + 1);
  }
  if (expr.t === 'name' && scope.method?.params.some((each) => each.name === name))
    return injected(scope);
  const field = expr.t === 'name' ? code.fieldInScope(name, scope) : code.field(scope.cls, name);
  if (field === undefined) return { kind: 'unknown' };
  const owner = field.owner;
  if (field.field.value !== null) {
    return baseOf(
      analysis,
      field.field.value,
      { cls: owner, method: null, lambdas: [] },
      setters,
      depth + 1,
    );
  }
  // What the constructors set it to; a constructor parameter is a bean Spring injects.
  for (const method of owner.decl.methods) {
    if (method.returns !== null || method.body === null) continue;
    for (const each of method.body.exprs) {
      if (each.t !== 'assign') continue;
      const target = each.target;
      const sets =
        (target.t === 'field' && target.object.t === 'this' && target.name === name) ||
        (target.t === 'name' &&
          target.name === name &&
          !method.params.some((param) => param.name === name));
      if (sets)
        return baseOf(
          analysis,
          each.value,
          { cls: owner, method, lambdas: [] },
          setters,
          depth + 1,
        );
    }
  }
  return injected({ cls: owner, method: null, lambdas: [] });
}

/** The base URL of the one `@Bean` of the client's type in the modules the code runs with. */
function beanBase(analysis: Analysis, scope: Scope, setters: string[], depth: number): Base {
  const { code } = analysis;
  const types = setters.includes('rootUri') ? REST_TEMPLATE : [...WEB_CLIENT, ...REST_CLIENT];
  const modules = new Set(analysis.related(scope.cls.file.module));
  const beans: { method: Method; owner: ClassInfo }[] = [];
  for (const cls of code.all()) {
    if (!modules.has(cls.file.module)) continue;
    for (const method of cls.decl.methods) {
      if (method.returns === null || method.body === null) continue;
      if (!method.annotations.some((each) => code.isType(each.name, cls, BEAN))) continue;
      if (code.isType(method.returns.name, cls, types)) beans.push({ method, owner: cls });
    }
  }
  const [bean] = beans;
  const returned = bean?.method.body?.returns[0];
  if (beans.length !== 1 || bean === undefined || returned === undefined)
    return { kind: 'unknown' };
  return baseOf(
    analysis,
    returned,
    { cls: bean.owner, method: bean.method, lambdas: [] },
    setters,
    depth + 1,
  );
}
