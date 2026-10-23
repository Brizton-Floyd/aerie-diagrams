// The text a Java expression holds, as far as the code shows it (DRIFT-211): literals, constants
// (in any class of the system, through imports and static imports), `+`, locals with one value,
// helper methods (their parameters bound to the arguments, a few calls deep), `@Value` and
// `@ConfigurationProperties` fields and accessors read from the module's configuration,
// `String.format`, and `UriComponentsBuilder` chains. A part it cannot know is null, printed `{?}`.
import type { MavenModule } from '../maven/reactor.ts';
import type { Expr, Field, Method, Param } from '../java/model.ts';
import { annotationArg, simpleName } from '../java/model.ts';
import type { ClassInfo, Codebase, Scope } from './code.ts';
import type { Filled } from './config.ts';

/** Text in parts; null for a part known only at run time. */
export type Text = (string | null)[];

export const UNKNOWN: Text = [null];

/** The text as a report prints it, with `{?}` for each unknown part. */
export function textOf(text: Text): string {
  return text.map((part) => part ?? '{?}').join('');
}

export function isKnown(text: Text): boolean {
  return text.every((part) => part !== null);
}

/** What the module's configuration says, for the code that runs in it. */
export interface Settings {
  /** A property's value, placeholders filled in; undefined when no file sets it. */
  value(module: MavenModule, key: string): Filled | undefined;
  /** Text with placeholders filled in from the module's configuration. */
  fill(module: MavenModule, text: string): Filled;
}

/** Filled text as parts: a placeholder with no value is an unknown part. */
export function filledText(filled: Filled): Text {
  if (filled.unknown.length === 0) return [filled.text];
  const parts: Text = [];
  let at = 0;
  for (const match of filled.text.matchAll(/\$\{[^{}]*\}/g)) {
    parts.push(filled.text.slice(at, match.index), null);
    at = match.index + match[0].length;
  }
  parts.push(filled.text.slice(at));
  return compactText(parts);
}

const CONFIGURATION_PROPERTIES = [
  'org.springframework.boot.context.properties.ConfigurationProperties',
];
const VALUE = ['org.springframework.beans.factory.annotation.Value'];
const URI_BUILDERS = [
  'org.springframework.web.util.UriComponentsBuilder',
  'org.springframework.web.servlet.support.ServletUriComponentsBuilder',
];
const MAX_DEPTH = 5;

interface Ctx {
  scope: Scope;
  /** Values of the parameters of a helper method being read for a call. */
  bound: Map<string, Text>;
  /** The configuration key `this` stands for, inside a `@ConfigurationProperties` class. */
  path: string | null;
  depth: number;
}

export class Values {
  readonly code: Codebase;
  readonly settings: Settings;

  constructor(code: Codebase, settings: Settings) {
    this.code = code;
    this.settings = settings;
  }

  /** The text an expression holds where it runs. */
  of(expr: Expr, scope: Scope): Text {
    return this.eval(expr, { scope, bound: new Map(), path: null, depth: 0 });
  }

  /** The text of an annotation's value, with Spring's placeholders filled in (as `@Value` does). */
  setting(expr: Expr, scope: Scope): Text {
    return this.fillText(this.of(expr, scope), scope.cls.file.module);
  }

  /**
   * The text a `UriComponentsBuilder` or `UriBuilder` chain builds, when `expr` is one; `root` gives
   * the text of a chain that starts from a variable, such as a `uriBuilder` lambda parameter.
   */
  uri(expr: Expr, scope: Scope, root?: (expr: Expr) => Text | undefined): Text | undefined {
    return this.uriChain(expr, { scope, bound: new Map(), path: null, depth: 0 }, root);
  }

  private fillText(text: Text, module: MavenModule): Text {
    return compactText(
      text.flatMap((part) =>
        part === null ? [null] : filledText(this.settings.fill(module, part)),
      ),
    );
  }

  private config(module: MavenModule, key: string): Text | undefined {
    const filled = this.settings.value(module, key);
    return filled === undefined ? undefined : filledText(filled);
  }

  private eval(expr: Expr, ctx: Ctx): Text {
    switch (expr.t) {
      case 'string':
        return [expr.value];
      case 'plus':
        return compactText(expr.parts.flatMap((part) => this.eval(part, ctx)));
      case 'other':
        return /^-?\d+[lL]?$/.test(expr.text) ? [expr.text.replace(/[lL]$/, '')] : UNKNOWN;
      case 'either': {
        // One of several: their text when they agree, else the start they share.
        const options = expr.options.map((each) => this.eval(each, ctx));
        const first = options[0];
        if (first === undefined) return UNKNOWN;
        if (options.every((each) => textOf(each) === textOf(first))) return first;
        const starts = options.map((each) => (typeof each[0] === 'string' ? each[0] : ''));
        let shared = starts[0] ?? '';
        for (const each of starts) while (!each.startsWith(shared)) shared = shared.slice(0, -1);
        return shared === '' ? UNKNOWN : [shared, null];
      }
      case 'name':
        return this.name(expr.name, ctx);
      case 'field':
        return this.field(expr, ctx);
      case 'call':
        return this.call(expr, ctx);
      case 'new': {
        const type = simpleName(expr.type.name);
        const [first] = expr.args;
        if (
          ['URI', 'URL', 'String', 'StringBuilder'].includes(type) &&
          first !== undefined &&
          expr.args.length === 1
        ) {
          return this.eval(first, ctx);
        }
        return UNKNOWN;
      }
      default:
        return UNKNOWN;
    }
  }

  private deeper(ctx: Ctx): boolean {
    return ctx.depth < MAX_DEPTH;
  }

  private name(name: string, ctx: Ctx): Text {
    const bound = ctx.bound.get(name);
    if (bound !== undefined) return bound;
    const { scope } = ctx;
    for (const lambda of [...scope.lambdas].reverse()) {
      if (lambda.params.some((each) => each.name === name)) return UNKNOWN;
      const local = lambda.body.locals.find((each) => each.name === name);
      if (local !== undefined) {
        return this.single([local.value, ...assignments(lambda.body.exprs, name)], {
          ...ctx,
          scope: { ...scope, lambdas: scope.lambdas.slice(0, scope.lambdas.indexOf(lambda) + 1) },
        });
      }
    }
    const method = scope.method;
    const local = method?.body?.locals.find((each) => each.name === name);
    if (local !== undefined && method?.body) {
      return this.single([local.value, ...assignments(method.body.exprs, name)], {
        ...ctx,
        scope: { ...scope, lambdas: [] },
      });
    }
    const param = method?.params.find((each) => each.name === name);
    if (param !== undefined) return this.param(param, ctx);
    const field = this.code.fieldInScope(name, scope);
    if (field !== undefined) {
      return this.fieldValue(
        field.field,
        field.owner,
        field.owner === scope.cls ? ctx.path : null,
        ctx,
      );
    }
    const imported = scope.cls.file.java.imports.find(
      (each) => each.isStatic && !each.wildcard && simpleName(each.name) === name,
    );
    if (imported !== undefined) {
      const owner = this.code.classes.get(imported.name.slice(0, imported.name.lastIndexOf('.')));
      if (owner !== undefined) return this.staticField(owner, name, ctx);
    }
    for (const each of scope.cls.file.java.imports) {
      if (!each.isStatic || !each.wildcard) continue;
      const owner = this.code.classes.get(each.name);
      if (owner?.decl.fields.some((field) => field.name === name))
        return this.staticField(owner, name, ctx);
    }
    return UNKNOWN;
  }

  /** One value from the expressions that set a variable: the same text from each, or unknown. */
  private single(sources: (Expr | null)[], ctx: Ctx): Text {
    const set = sources.filter((each) => each !== null);
    if (set.length === 0 || !this.deeper(ctx)) return UNKNOWN;
    const deeper = { ...ctx, depth: ctx.depth + 1 };
    const texts = set.map((each) => this.eval(each, deeper));
    const first = texts[0] ?? UNKNOWN;
    return texts.every((each) => textOf(each) === textOf(first)) ? first : UNKNOWN;
  }

  private param(param: Param, ctx: Ctx): Text {
    const value = param.annotations.find((each) =>
      this.code.isType(each.name, ctx.scope.cls, VALUE),
    );
    const arg = value === undefined ? undefined : annotationArg(value, 'value');
    return arg === undefined
      ? UNKNOWN
      : this.fillText(this.eval(arg, ctx), ctx.scope.cls.file.module);
  }

  private field(expr: Extract<Expr, { t: 'field' }>, ctx: Ctx): Text {
    const { scope } = ctx;
    if (expr.object.t === 'this') {
      const field = this.code.field(scope.cls, expr.name);
      return field === undefined
        ? UNKNOWN
        : this.fieldValue(field.field, field.owner, ctx.path, ctx);
    }
    if (expr.object.t === 'name' && !this.code.isVariable(expr.object.name, scope)) {
      const type = this.code.resolve(expr.object.name, scope.cls).info;
      return type === undefined ? UNKNOWN : this.staticField(type, expr.name, ctx);
    }
    const path = this.configPath(expr, ctx);
    if (path !== null) return this.config(scope.cls.file.module, path) ?? UNKNOWN;
    const owner = this.code.typeOf(expr.object, scope)?.info;
    if (owner === undefined) {
      // `Outer.Inner.NAME`: a nested type's constant.
      const type = this.code.typeOf(expr.object, scope);
      return type?.info === undefined ? UNKNOWN : this.staticField(type.info, expr.name, ctx);
    }
    const field = this.code.field(owner, expr.name);
    return field === undefined ? UNKNOWN : this.fieldValue(field.field, field.owner, null, ctx);
  }

  private staticField(owner: ClassInfo, name: string, ctx: Ctx): Text {
    const field = this.code.field(owner, name);
    if (field?.field.value == null || !this.deeper(ctx)) return UNKNOWN;
    return this.eval(field.field.value, {
      scope: { cls: field.owner, method: null, lambdas: [] },
      bound: new Map(),
      path: null,
      depth: ctx.depth + 1,
    });
  }

  /** A field's value: `@Value`, configuration properties, a constant, or what a constructor sets. */
  private fieldValue(field: Field, owner: ClassInfo, path: string | null, ctx: Ctx): Text {
    if (!this.deeper(ctx)) return UNKNOWN;
    const at: Ctx = {
      scope: { cls: owner, method: null, lambdas: [] },
      bound: new Map(),
      path: null,
      depth: ctx.depth + 1,
    };
    const value = field.annotations.find((each) => this.code.isType(each.name, owner, VALUE));
    const valueArg = value === undefined ? undefined : annotationArg(value, 'value');
    if (valueArg !== undefined) return this.fillText(this.eval(valueArg, at), owner.file.module);
    const prefix = path ?? this.prefixOf(owner);
    if (prefix !== null && !field.isStatic) {
      const set = this.config(ctx.scope.cls.file.module, `${prefix}.${field.name}`);
      if (set !== undefined) return set;
      return field.value === null ? UNKNOWN : this.eval(field.value, at);
    }
    if (field.value !== null) return this.eval(field.value, at);
    if (field.isStatic) return UNKNOWN;
    // What the constructors set it to: `this.name = ...` or `name = ...`.
    const sets: { expr: Expr; method: Method }[] = [];
    for (const method of owner.decl.methods) {
      if (method.returns !== null || method.body === null) continue;
      for (const expr of method.body.exprs) {
        if (expr.t !== 'assign') continue;
        const target = expr.target;
        const named =
          (target.t === 'field' && target.object.t === 'this' && target.name === field.name) ||
          (target.t === 'name' &&
            target.name === field.name &&
            !method.params.some((each) => each.name === field.name));
        if (named) sets.push({ expr: expr.value, method });
      }
    }
    const texts = sets.map((each) =>
      this.eval(each.expr, { ...at, scope: { cls: owner, method: each.method, lambdas: [] } }),
    );
    const first = texts[0];
    return first !== undefined && texts.every((each) => textOf(each) === textOf(first))
      ? first
      : UNKNOWN;
  }

  /** The prefix of a `@ConfigurationProperties` class, or null. */
  prefixOf(cls: ClassInfo): string | null {
    const annotation = cls.decl.annotations.find((each) =>
      this.code.isType(each.name, cls, CONFIGURATION_PROPERTIES),
    );
    if (annotation === undefined) return null;
    const arg = annotationArg(annotation, 'prefix', 'value');
    const text =
      arg === undefined
        ? ['']
        : this.eval(arg, {
            scope: { cls, method: null, lambdas: [] },
            bound: new Map(),
            path: null,
            depth: MAX_DEPTH - 1,
          });
    return isKnown(text) ? textOf(text) : null;
  }

  /**
   * The configuration key an expression reads, when it is a `@ConfigurationProperties` object or a
   * property of one: `props` is `core-api`, `props.baseUrl()` is `core-api.baseUrl`.
   */
  private configPath(expr: Expr, ctx: Ctx): string | null {
    const { scope } = ctx;
    switch (expr.t) {
      case 'this':
        return ctx.path ?? this.prefixOf(scope.cls);
      case 'name': {
        if (!this.code.isVariable(expr.name, scope)) return null;
        const inSelf = ctx.path ?? this.prefixOf(scope.cls);
        if (inSelf !== null && this.code.field(scope.cls, expr.name) !== undefined) {
          return `${inSelf}.${expr.name}`;
        }
        const type = this.code.typeOf(expr, scope)?.info;
        return type === undefined ? null : this.prefixOf(type);
      }
      case 'field':
      case 'call': {
        if (expr.t === 'call' && (expr.args.length > 0 || expr.object === null)) return null;
        const object = expr.object;
        if (object === null) return null;
        const base = this.configPath(object, ctx);
        if (base === null) return null;
        const owner = this.code.typeOf(object, scope)?.info;
        const member = expr.t === 'call' ? accessorName(expr.name) : expr.name;
        if (owner === undefined || this.code.field(owner, member) === undefined) return null;
        return `${base}.${member}`;
      }
      default:
        return null;
    }
  }

  private call(expr: Extract<Expr, { t: 'call' }>, ctx: Ctx): Text {
    const { scope } = ctx;
    const { object, name, args } = expr;
    const [first, second] = args;
    if (object?.t === 'name' && !this.code.isVariable(object.name, scope)) {
      const type = simpleName(this.code.resolve(object.name, scope.cls).name);
      if (type === 'String' && name === 'format' && first !== undefined) {
        return format(
          this.eval(first, ctx),
          args.slice(1).map((each) => this.eval(each, ctx)),
        );
      }
      if (type === 'String' && name === 'join' && first !== undefined) {
        const separator = this.eval(first, ctx);
        return compactText(
          args
            .slice(1)
            .flatMap((each, i) =>
              i === 0 ? this.eval(each, ctx) : [...separator, ...this.eval(each, ctx)],
            ),
        );
      }
      if (
        first !== undefined &&
        ((type === 'String' && name === 'valueOf') ||
          (type === 'Objects' && (name === 'requireNonNull' || name === 'toString')) ||
          (type === 'URI' && name === 'create'))
      ) {
        return this.eval(first, ctx);
      }
    }
    if (
      object !== null &&
      args.length === 0 &&
      ['toString', 'trim', 'strip', 'intern'].includes(name)
    ) {
      const built = this.uriChain(expr, ctx);
      return built ?? this.eval(object, ctx);
    }
    if (object !== null && name === 'concat' && first !== undefined && second === undefined) {
      return compactText([...this.eval(object, ctx), ...this.eval(first, ctx)]);
    }
    const built = this.uriChain(expr, ctx);
    if (built !== undefined) return built;
    if (!this.deeper(ctx)) return UNKNOWN;
    // A method of the system: read what it returns, its parameters bound to the arguments.
    let owner: ClassInfo | undefined;
    let path: string | null;
    if (object === null || object.t === 'this') {
      owner = scope.cls;
      path = ctx.path;
    } else {
      owner = this.code.typeOf(object, scope)?.info;
      path = this.configPath(object, ctx);
    }
    if (owner === undefined) return UNKNOWN;
    const found = this.code
      .methods(owner, name, args.length)
      .find((each) => each.method.body !== null);
    if (found === undefined) {
      const member = accessorName(name);
      const field = args.length === 0 ? this.code.field(owner, member) : undefined;
      return field === undefined ? UNKNOWN : this.fieldValue(field.field, field.owner, path, ctx);
    }
    const bound = new Map<string, Text>();
    found.method.params.forEach((param, i) => {
      const arg = args[i];
      bound.set(param.name, arg === undefined ? UNKNOWN : this.eval(arg, ctx));
    });
    const inner: Ctx = {
      scope: { cls: found.owner, method: found.method, lambdas: [] },
      bound,
      path: path ?? this.prefixOf(found.owner),
      depth: ctx.depth + 1,
    };
    const returns = found.method.body?.returns ?? [];
    const texts = returns.map((each) => this.eval(each, inner));
    const one = texts[0];
    return one !== undefined && texts.every((each) => textOf(each) === textOf(one)) ? one : UNKNOWN;
  }

  /** DRIFT-211: the text a URI builder chain builds, or undefined when `expr` is not one. */
  private uriChain(
    expr: Expr,
    ctx: Ctx,
    root?: (expr: Expr) => Text | undefined,
  ): Text | undefined {
    const steps: Extract<Expr, { t: 'call' }>[] = [];
    let at: Expr = expr;
    while (at.t === 'call' && at.object !== null) {
      steps.unshift(at);
      at = at.object;
    }
    let start: Text | undefined;
    const factory = steps[0];
    if (at.t === 'name' && !this.code.isVariable(at.name, ctx.scope) && factory !== undefined) {
      if (!this.code.isType(at.name, ctx.scope.cls, URI_BUILDERS)) return undefined;
      steps.shift();
      const [arg] = factory.args;
      if (
        ['fromUriString', 'fromHttpUrl', 'fromPath', 'fromUri'].includes(factory.name) &&
        arg !== undefined
      ) {
        start = this.eval(arg, ctx);
      } else if (
        ['newInstance', 'fromCurrentRequest', 'fromCurrentContextPath'].includes(factory.name)
      ) {
        start = factory.name === 'newInstance' ? [''] : UNKNOWN;
      } else {
        return undefined;
      }
    } else {
      start = root?.(at);
      if (start === undefined) return undefined;
    }
    let text = start;
    let scheme: Text | null = null;
    let host: Text | null = null;
    let port: Text | null = null;
    for (const step of steps) {
      const [arg] = step.args;
      switch (step.name) {
        case 'path':
          if (arg !== undefined) text = joinPath(text, this.eval(arg, ctx));
          break;
        case 'pathSegment':
          for (const each of step.args) text = joinPath(text, this.eval(each, ctx));
          break;
        case 'replacePath':
          text = arg === undefined ? text : joinPath(origin(text), this.eval(arg, ctx));
          break;
        case 'scheme':
          scheme = arg === undefined ? null : this.eval(arg, ctx);
          break;
        case 'host':
          host = arg === undefined ? null : this.eval(arg, ctx);
          break;
        case 'port':
          port = arg === undefined ? null : this.eval(arg, ctx);
          break;
        case 'uri':
          if (arg !== undefined) text = this.eval(arg, ctx);
          break;
        default:
          if (!URI_STEPS.has(step.name)) return undefined;
      }
    }
    if (host !== null) {
      const authority: Text = [
        ...(scheme ?? ['http']),
        '://',
        ...host,
        ...(port === null ? [] : [':', ...port]),
      ];
      text = joinPath(compactText(authority), text);
    }
    return compactText(text);
  }
}

/** The calls of a URI builder chain that leave its address as it is. */
const URI_STEPS = new Set([
  'build',
  'buildAndExpand',
  'encode',
  'expand',
  'toUri',
  'toUriString',
  'toString',
  'queryParam',
  'queryParams',
  'queryParamIfPresent',
  'query',
  'fragment',
  'replaceQuery',
  'replaceQueryParam',
  'userInfo',
  'cloneBuilder',
  'uriVariables',
  'normalize',
]);

/** `getHost` and `host` both read the property `host`. */
function accessorName(name: string): string {
  const match = /^(?:get|is)([A-Z].*)$/.exec(name);
  return match?.[1] === undefined ? name : match[1].charAt(0).toLowerCase() + match[1].slice(1);
}

/** The values a body assigns to a variable with `name = value`. */
function assignments(exprs: readonly Expr[], name: string): Expr[] {
  return exprs.flatMap((expr) =>
    expr.t === 'assign' && expr.target.t === 'name' && expr.target.name === name
      ? [expr.value]
      : [],
  );
}

/** `String.format` with `%s` and `%d`, which are all a URL needs; anything else is unknown. */
function format(pattern: Text, args: Text[]): Text {
  if (!isKnown(pattern)) return UNKNOWN;
  const out: Text = [];
  let next = 0;
  const text = textOf(pattern);
  let at = 0;
  for (const match of text.matchAll(/%(%|s|d|n|[-#+ 0,(]*\d*(?:\.\d+)?[a-zA-Z])/g)) {
    out.push(text.slice(at, match.index));
    at = match.index + match[0].length;
    const spec = match[1];
    if (spec === '%') out.push('%');
    else if (spec === 'n') out.push('\n');
    else if (spec === 's' || spec === 'd') out.push(...(args[next++] ?? UNKNOWN));
    else {
      next++;
      out.push(null);
    }
  }
  out.push(text.slice(at));
  return compactText(out);
}

/** Text joined by one `/`, as `UriComponentsBuilder.path` joins a path. */
export function joinPath(base: Text, path: Text): Text {
  const last = base.at(-1);
  const first = path[0];
  if (path.length === 0 || (path.length === 1 && first === '')) return base;
  const ends = typeof last === 'string' && last.endsWith('/');
  const starts = typeof first === 'string' && first.startsWith('/');
  if (base.length === 0 || (base.length === 1 && last === '')) return path;
  if (ends && starts) return compactText([...base.slice(0, -1), last.slice(0, -1), ...path]);
  if (!ends && !starts) return compactText([...base, '/', ...path]);
  return compactText([...base, ...path]);
}

/** A URL's scheme and authority, without its path. */
function origin(text: Text): Text {
  const first = text[0];
  if (typeof first !== 'string') return text.slice(0, 1);
  const match = /^[a-z][a-z0-9+.-]*:\/\/[^/]*/i.exec(first);
  return match === null ? [''] : [match[0]];
}

/** Adjacent known parts joined, and empty ones dropped. */
export function compactText(parts: Text): Text {
  const out: Text = [];
  for (const part of parts) {
    const last = out.at(-1);
    if (part === '') continue;
    if (part !== null && typeof last === 'string') out[out.length - 1] = last + part;
    else if (part === null && last === null) continue;
    else out.push(part);
  }
  return out.length === 0 ? [''] : out;
}
