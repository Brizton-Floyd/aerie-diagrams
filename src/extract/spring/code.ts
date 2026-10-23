// The Java of the system's Maven modules as one codebase (DRIFT-208): every class by its full name,
// names resolved the way the compiler resolves them (nested types, single imports, the package, then
// wildcard imports), and the declared type of a variable, field or call. Matching a call by its
// receiver's declared type, never by a variable's name, is what keeps `ticketsPerTemplate.put(...)`
// from reading as a RestTemplate call.
import type { MavenModule } from '../maven/reactor.ts';
import type {
  Body,
  Expr,
  Field,
  JavaFile,
  Method,
  Param,
  TypeDecl,
  TypeRef,
} from '../java/model.ts';
import { childrenOf, simpleName } from '../java/model.ts';

export interface SourceFile {
  path: string;
  java: JavaFile;
  module: MavenModule;
}

export interface ClassInfo {
  /** `com.shop.Orders`, or `com.shop.Orders.Line` for a nested type. */
  name: string;
  decl: TypeDecl;
  file: SourceFile;
  outer: ClassInfo | null;
}

/** A type a name resolves to: in the system (`info`), or outside it by its full name if known. */
export interface Resolved {
  name: string;
  info: ClassInfo | undefined;
}

/** Where code runs: its class, its method (if any), and the lambdas it is inside, innermost last. */
export interface Scope {
  cls: ClassInfo;
  method: Method | null;
  lambdas: { params: Param[]; body: Body }[];
}

/** Calls `visit` on an expression and every expression inside it, each with where it runs. */
export function walkScoped(
  expr: Expr,
  scope: Scope,
  visit: (each: Expr, scope: Scope) => void,
): void {
  visit(expr, scope);
  if (expr.t === 'lambda') {
    const inner = {
      ...scope,
      lambdas: [...scope.lambdas, { params: expr.params, body: expr.body }],
    };
    for (const each of expr.body.exprs) walkScoped(each, inner, visit);
    return;
  }
  for (const each of childrenOf(expr)) walkScoped(each, scope, visit);
}

export class Codebase {
  readonly files: SourceFile[] = [];
  readonly classes = new Map<string, ClassInfo>();

  add(file: SourceFile): void {
    this.files.push(file);
    const visit = (decl: TypeDecl, outer: ClassInfo | null): void => {
      const prefix = outer === null ? file.java.package : outer.name;
      const name = prefix === '' ? decl.name : `${prefix}.${decl.name}`;
      const info: ClassInfo = { name, decl, file, outer };
      if (!this.classes.has(name)) this.classes.set(name, info);
      for (const inner of decl.types) visit(inner, info);
    };
    for (const decl of file.java.types) visit(decl, null);
  }

  /** Every class, in the order of their files. */
  all(): ClassInfo[] {
    return [...this.classes.values()];
  }

  private readonly resolved = new Map<ClassInfo, Map<string, Resolved>>();

  /** A type name as written in `from`'s source. */
  resolve(written: string, from: ClassInfo): Resolved {
    let known = this.resolved.get(from);
    if (known === undefined) {
      known = new Map();
      this.resolved.set(from, known);
    }
    const hit = known.get(written);
    if (hit !== undefined) return hit;
    const found = this.lookup(written, from);
    known.set(written, found);
    return found;
  }

  private lookup(written: string, from: ClassInfo): Resolved {
    const dot = written.indexOf('.');
    if (dot > 0) {
      const head = this.resolve(written.slice(0, dot), from);
      const rest = written.slice(dot + 1).split('.');
      if (head.info !== undefined || head.name !== written.slice(0, dot)) {
        let info = head.info;
        for (const part of rest) info = info === undefined ? undefined : this.nested(info, part);
        return { name: `${head.name}.${rest.join('.')}`, info };
      }
      return { name: written, info: this.classes.get(written) };
    }
    for (let at: ClassInfo | null = from; at !== null; at = at.outer) {
      if (at.decl.name === written) return { name: at.name, info: at };
      if (at.decl.types.some((each) => each.name === written)) {
        const inner = this.classes.get(`${at.name}.${written}`);
        if (inner !== undefined) return { name: inner.name, info: inner };
      }
    }
    const java = from.file.java;
    const single = java.imports.find(
      (each) => !each.isStatic && !each.wildcard && simpleName(each.name) === written,
    );
    if (single !== undefined) return { name: single.name, info: this.classes.get(single.name) };
    const local = java.package === '' ? written : `${java.package}.${written}`;
    const same = this.classes.get(local);
    if (same !== undefined) return { name: local, info: same };
    for (const each of java.imports) {
      if (each.isStatic || !each.wildcard) continue;
      const info = this.classes.get(`${each.name}.${written}`);
      if (info !== undefined) return { name: info.name, info };
    }
    return { name: written, info: undefined };
  }

  /** Whether a type as written in `from` is one of `names` (full names, outside the system). */
  isType(written: string, from: ClassInfo, names: readonly string[]): boolean {
    const resolved = this.resolve(written, from);
    if (resolved.info !== undefined) return names.includes(resolved.info.name);
    if (names.includes(resolved.name)) return true;
    if (resolved.name.includes('.')) return false;
    // A simple name no import or class of the system explains: a wildcard import of its package.
    return names.some((name) => {
      if (simpleName(name) !== written) return false;
      const pkg = name.slice(0, name.lastIndexOf('.'));
      return from.file.java.imports.some(
        (each) => each.wildcard && !each.isStatic && each.name === pkg,
      );
    });
  }

  /** A member type, declared in the class or one of its superclasses. */
  nested(info: ClassInfo, name: string): ClassInfo | undefined {
    const seen = new Set<ClassInfo>();
    for (
      let at: ClassInfo | undefined = info;
      at !== undefined && !seen.has(at);
      at = this.superclass(at)
    ) {
      seen.add(at);
      const decl = at.decl.types.find((each) => each.name === name);
      if (decl !== undefined) return this.classes.get(`${at.name}.${name}`);
    }
    return undefined;
  }

  superclass(info: ClassInfo): ClassInfo | undefined {
    const parent = info.decl.superclass;
    return parent === null ? undefined : this.resolve(parent.name, info).info;
  }

  /** The class and its supertypes in the system, nearest first. */
  lineage(info: ClassInfo): ClassInfo[] {
    const out: ClassInfo[] = [];
    const visit = (at: ClassInfo): void => {
      if (out.includes(at)) return;
      out.push(at);
      const parent = this.superclass(at);
      if (parent !== undefined) visit(parent);
      for (const each of at.decl.interfaces) {
        const resolved = this.resolve(each.name, at).info;
        if (resolved !== undefined) visit(resolved);
      }
    };
    visit(info);
    return out;
  }

  /** A field or record component by name, with the class that declares it. */
  field(info: ClassInfo, name: string): { field: Field; owner: ClassInfo } | undefined {
    for (const at of this.lineage(info)) {
      const field = at.decl.fields.find((each) => each.name === name);
      if (field !== undefined) return { field, owner: at };
      const component = at.decl.components.find((each) => each.name === name);
      if (component !== undefined && component.type !== null) {
        return { field: componentField(component, component.type), owner: at };
      }
    }
    return undefined;
  }

  /** The record component, or field, an accessor without a body of its own reads: `host()`, `getHost()`. */
  accessed(info: ClassInfo, method: string): { field: Field; owner: ClassInfo } | undefined {
    const match = /^(?:get|is)([A-Z].*)$/.exec(method);
    const name =
      match?.[1] === undefined ? method : match[1].charAt(0).toLowerCase() + match[1].slice(1);
    return this.field(info, method) ?? this.field(info, name);
  }

  /** Methods by name and number of arguments, nearest class first. */
  methods(info: ClassInfo, name: string, arity: number): { method: Method; owner: ClassInfo }[] {
    const out: { method: Method; owner: ClassInfo }[] = [];
    for (const at of this.lineage(info)) {
      for (const method of at.decl.methods) {
        if (method.name !== name || method.returns === null) continue;
        const spread = method.params.at(-1)?.type?.name.endsWith('[]') ?? false;
        if (method.params.length === arity || (spread && arity >= method.params.length - 1)) {
          out.push({ method, owner: at });
        }
      }
    }
    return out;
  }

  /** The declared type of a name where code runs: a lambda parameter, local, parameter or field. */
  variableType(name: string, scope: Scope): { type: TypeRef; owner: ClassInfo } | undefined {
    for (const lambda of [...scope.lambdas].reverse()) {
      const param = lambda.params.find((each) => each.name === name);
      if (param !== undefined) {
        return param.type === null ? undefined : { type: param.type, owner: scope.cls };
      }
      const local = lambda.body.locals.find((each) => each.name === name);
      if (local !== undefined) {
        return local.type === null ? undefined : { type: local.type, owner: scope.cls };
      }
    }
    const method = scope.method;
    const local = method?.body?.locals.find((each) => each.name === name);
    if (local !== undefined)
      return local.type === null ? undefined : { type: local.type, owner: scope.cls };
    const param = method?.params.find((each) => each.name === name);
    if (param?.type !== undefined && param.type !== null)
      return { type: param.type, owner: scope.cls };
    for (let at: ClassInfo | null = scope.cls; at !== null; at = at.outer) {
      const field = this.field(at, name);
      if (field !== undefined) return { type: field.field.type, owner: field.owner };
    }
    return undefined;
  }

  /** Whether a name is a variable where code runs, rather than a type. */
  isVariable(name: string, scope: Scope): boolean {
    return (
      scope.lambdas.some(
        (each) =>
          each.params.some((param) => param.name === name) ||
          each.body.locals.some((local) => local.name === name),
      ) ||
      (scope.method?.body?.locals.some((each) => each.name === name) ?? false) ||
      (scope.method?.params.some((each) => each.name === name) ?? false) ||
      this.fieldInScope(name, scope) !== undefined
    );
  }

  fieldInScope(name: string, scope: Scope): { field: Field; owner: ClassInfo } | undefined {
    for (let at: ClassInfo | null = scope.cls; at !== null; at = at.outer) {
      const field = this.field(at, name);
      if (field !== undefined) return field;
    }
    return undefined;
  }

  /**
   * The declared type of an expression, resolved: a variable's, a field's, a method's return, or a
   * `new` expression's. A bare type name (the receiver of a static call) resolves to that type.
   */
  typeOf(expr: Expr, scope: Scope): Resolved | undefined {
    switch (expr.t) {
      case 'name': {
        const variable = this.variableType(expr.name, scope);
        if (variable !== undefined) return this.resolve(variable.type.name, variable.owner);
        if (this.isVariable(expr.name, scope)) return undefined;
        return this.resolve(expr.name, scope.cls);
      }
      case 'this':
        return { name: scope.cls.name, info: scope.cls };
      case 'new':
        return this.resolve(expr.type.name, scope.cls);
      case 'field': {
        if (expr.object.t === 'this') {
          const field = this.field(scope.cls, expr.name);
          return field === undefined ? undefined : this.resolve(field.field.type.name, field.owner);
        }
        const owner = this.typeOf(expr.object, scope);
        if (owner?.info === undefined) {
          return owner === undefined
            ? undefined
            : { name: `${owner.name}.${expr.name}`, info: undefined };
        }
        const field = this.field(owner.info, expr.name);
        if (field !== undefined) return this.resolve(field.field.type.name, field.owner);
        const inner = this.nested(owner.info, expr.name);
        return inner === undefined ? undefined : { name: inner.name, info: inner };
      }
      case 'call': {
        const owner =
          expr.object === null
            ? { name: scope.cls.name, info: scope.cls }
            : this.typeOf(expr.object, scope);
        if (owner?.info === undefined) return undefined;
        const found = this.methods(owner.info, expr.name, expr.args.length)[0];
        const returns = found?.method.returns ?? null;
        if (found !== undefined && returns !== null) return this.resolve(returns.name, found.owner);
        const component = expr.args.length === 0 ? this.accessed(owner.info, expr.name) : undefined;
        return component === undefined
          ? undefined
          : this.resolve(component.field.type.name, component.owner);
      }
      default:
        return undefined;
    }
  }

  /**
   * Whether an expression's declared type is one of `names`: a variable, field or method declared
   * with that type, or a static factory of it (`WebClient.create(...)`, `RestClient.builder()...`).
   */
  typeIs(expr: Expr, scope: Scope, names: readonly string[]): boolean {
    const declared = this.declaredType(expr, scope);
    if (declared !== undefined) return this.isType(declared.type.name, declared.owner, names);
    let root: Expr = expr;
    while (root.t === 'call' && root.object !== null) root = root.object;
    if (root === expr || root.t !== 'name' || this.isVariable(root.name, scope)) return false;
    return this.isType(root.name, scope.cls, names);
  }

  /** The type an expression is declared with, and the class whose source writes it. */
  declaredType(expr: Expr, scope: Scope): { type: TypeRef; owner: ClassInfo } | undefined {
    switch (expr.t) {
      case 'name':
        return this.variableType(expr.name, scope);
      case 'new':
        return { type: expr.type, owner: scope.cls };
      case 'field': {
        const owner = expr.object.t === 'this' ? scope.cls : this.typeOf(expr.object, scope)?.info;
        const field = owner === undefined ? undefined : this.field(owner, expr.name);
        return field === undefined ? undefined : { type: field.field.type, owner: field.owner };
      }
      case 'call': {
        const owner =
          expr.object === null || expr.object.t === 'this'
            ? scope.cls
            : this.typeOf(expr.object, scope)?.info;
        const found =
          owner === undefined ? undefined : this.methods(owner, expr.name, expr.args.length)[0];
        const returns = found?.method.returns ?? null;
        if (found !== undefined && returns !== null) return { type: returns, owner: found.owner };
        const component =
          owner === undefined || expr.args.length > 0 ? undefined : this.accessed(owner, expr.name);
        return component === undefined
          ? undefined
          : { type: component.field.type, owner: component.owner };
      }
      default:
        return undefined;
    }
  }

  /** Every method and constructor in the system, with where it runs. */
  *methodScopes(): Generator<Scope> {
    for (const cls of this.all()) {
      for (const method of cls.decl.methods) yield { cls, method, lambdas: [] };
    }
  }
}

function componentField(component: Param, type: TypeRef): Field {
  return {
    name: component.name,
    type,
    isStatic: false,
    isFinal: true,
    annotations: component.annotations,
    value: null,
    line: component.line,
  };
}
