// A Java file as the Spring extractor reads it (DRIFT-208): its types with their annotations, fields
// and methods, and the expressions in them, in Aerie's own small model. Only `syntax.ts` knows the
// grammar's tree; everything else reads this.

/** A type as written, without its package unless written with one: `WebClient.Builder`, `List<X>`. */
export interface TypeRef {
  name: string;
  args: TypeRef[];
}

export type Expr =
  | { t: 'string'; value: string; line: number }
  | { t: 'name'; name: string; line: number }
  | { t: 'this'; line: number }
  | { t: 'field'; object: Expr; name: string; line: number }
  | { t: 'call'; object: Expr | null; name: string; args: Expr[]; line: number }
  | { t: 'new'; type: TypeRef; args: Expr[]; line: number }
  /** `a + b + c`, which joins text when any part is text. */
  | { t: 'plus'; parts: Expr[]; line: number }
  /** `X.class`. */
  | { t: 'class'; type: TypeRef; line: number }
  /** `{a, b}` in an annotation, or an array's items. */
  | { t: 'array'; items: Expr[]; line: number }
  | { t: 'lambda'; params: Param[]; body: Body; line: number }
  | { t: 'assign'; target: Expr; value: Expr; line: number }
  /** `c ? a : b`: either of the two. */
  | { t: 'either'; options: Expr[]; line: number }
  | { t: 'annotation'; annotation: Annotation; line: number }
  /** Anything else, with the expressions inside it, so that a walk still finds every call. */
  | { t: 'other'; text: string; inner: Expr[]; line: number };

/** What a method, constructor or lambda body holds, flattened over its statements. */
export interface Body {
  /** Every local variable, wherever it is declared in the body. */
  locals: Local[];
  /** The value of every `return`. */
  returns: Expr[];
  /** Every expression the body evaluates, outermost first, including those above. */
  exprs: Expr[];
}

export interface Local {
  name: string;
  type: TypeRef | null;
  value: Expr | null;
  line: number;
}

export interface Annotation {
  /** As written: `GetMapping` or `org.springframework.web.bind.annotation.GetMapping`. */
  name: string;
  line: number;
  /** Each element; a single value without a name is `value`. */
  args: { name: string; value: Expr }[];
}

export interface Param {
  name: string;
  /** Null for a lambda parameter written without one. */
  type: TypeRef | null;
  annotations: Annotation[];
  line: number;
}

export interface Field {
  name: string;
  type: TypeRef;
  isStatic: boolean;
  isFinal: boolean;
  annotations: Annotation[];
  value: Expr | null;
  line: number;
}

export interface Method {
  name: string;
  /** Null for a constructor. */
  returns: TypeRef | null;
  params: Param[];
  annotations: Annotation[];
  /** Null for an abstract or interface method. */
  body: Body | null;
  line: number;
}

export interface TypeDecl {
  kind: 'class' | 'interface' | 'record' | 'enum' | 'annotation';
  name: string;
  line: number;
  annotations: Annotation[];
  superclass: TypeRef | null;
  /** What it implements, or for an interface what it extends. */
  interfaces: TypeRef[];
  /** A record's components. */
  components: Param[];
  fields: Field[];
  methods: Method[];
  /** Types declared inside it. */
  types: TypeDecl[];
}

export interface Import {
  /** `com.shop.Orders`, `com.shop.*` without the `.*`, or a static member's full name. */
  name: string;
  isStatic: boolean;
  wildcard: boolean;
}

export interface JavaFile {
  package: string;
  imports: Import[];
  types: TypeDecl[];
  /** The lines of syntax errors the parser recovered from. */
  errors: number[];
}

/** Calls `visit` on an expression and every expression inside it, lambdas included. */
export function walk(expr: Expr, visit: (each: Expr) => void): void {
  visit(expr);
  for (const inner of childrenOf(expr)) walk(inner, visit);
}

/** The expressions directly inside an expression. */
export function childrenOf(expr: Expr): Expr[] {
  switch (expr.t) {
    case 'field':
      return [expr.object];
    case 'call':
      return expr.object === null ? expr.args : [expr.object, ...expr.args];
    case 'new':
      return expr.args;
    case 'plus':
      return expr.parts;
    case 'array':
      return expr.items;
    case 'lambda':
      return expr.body.exprs;
    case 'assign':
      return [expr.target, expr.value];
    case 'either':
      return expr.options;
    case 'annotation':
      return expr.annotation.args.map((each) => each.value);
    case 'other':
      return expr.inner;
    case 'string':
    case 'name':
    case 'this':
    case 'class':
      return [];
  }
}

/** The value of an annotation's element: `value` also answers for a single unnamed value. */
export function annotationArg(annotation: Annotation, ...names: string[]): Expr | undefined {
  return annotation.args.find((each) => names.includes(each.name))?.value;
}

/** The last part of a dotted name: `WebClient` for `org.springframework...WebClient`. */
export function simpleName(name: string): string {
  return name.slice(name.lastIndexOf('.') + 1);
}
