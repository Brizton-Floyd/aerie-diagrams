// HTTP calls in an Angular application's code (DRIFT-306): `HttpClient` methods called on a value
// the code declares as an `HttpClient` (a typed property or parameter, or `inject(HttpClient)`; a
// name alone is never enough), and `httpResource`. A URL is read as far as the code shows it: string
// literals, templates, `+`, `? :`, constants declared in the same file or imported, class
// properties, and properties of object constants such as `environment.apiUrl` (in every
// environment file the build may swap in). Anything else is a hole, printed `{}`.
import ts from 'typescript';
import type { Sources } from './sources.ts';

/** A hole in a URL: text known only at run time. */
export const HOLE = '\u0000';
/** The most alternatives one URL may have, so a long chain of `? :` stays small. */
const MOST = 16;

export interface FoundCall {
  file: string;
  line: number;
  method: string;
  /** Each URL the call may use, with holes; empty when not even its start is known. */
  urls: string[];
  /** The URL expression as written, for a warning when it cannot be read. */
  written: string;
}

export interface Interceptor {
  file: string;
  line: number;
  names: string[];
}

const METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'jsonp']);
const HTTP_MODULE = '@angular/common/http';

/** Every HTTP call in the application's files, in file and line order. */
export function findCalls(sources: Sources): FoundCall[] {
  const calls: FoundCall[] = [];
  const evaluator = new Evaluator(sources);
  for (const file of sources.files.values()) {
    const names = httpNames(file);
    if (names.client.size === 0 && names.resource.size === 0) continue;
    const receivers = clientReceivers(file, names.client);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const found = clientCall(node, receivers) ?? resourceCall(node, names.resource);
        if (found !== null) {
          const urls =
            found.url === undefined ? [] : evaluator.evaluate(found.url, file).filter(known);
          calls.push({
            file: file.fileName,
            line: lineOf(file, node),
            method: found.method(evaluator, file),
            urls: [...new Set(urls)],
            written: found.url?.getText(file) ?? '',
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return calls;
}

/** Interceptors the application installs: `withInterceptors([...])` or `HTTP_INTERCEPTORS`. */
export function findInterceptors(sources: Sources): Interceptor[] {
  const found: Interceptor[] = [];
  for (const file of sources.files.values()) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'withInterceptors'
      ) {
        const list = node.arguments[0];
        const names =
          list !== undefined && ts.isArrayLiteralExpression(list)
            ? list.elements.map((each) => each.getText(file))
            : [];
        if (names.length > 0) found.push({ file: file.fileName, line: lineOf(file, node), names });
      } else if (ts.isObjectLiteralExpression(node)) {
        const value = (key: string): ts.Expression | undefined => {
          const property = node.properties.find(
            (each): each is ts.PropertyAssignment =>
              ts.isPropertyAssignment(each) && each.name.getText(file) === key,
          );
          return property?.initializer;
        };
        if (value('provide')?.getText(file) === 'HTTP_INTERCEPTORS') {
          const used = value('useClass') ?? value('useExisting') ?? value('useFactory');
          found.push({
            file: file.fileName,
            line: lineOf(file, node),
            names: [used?.getText(file) ?? 'HTTP_INTERCEPTORS'],
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return found;
}

/** Whether a URL's start is known: it does not begin with a hole. */
function known(url: string): boolean {
  return url !== '' && !url.startsWith(HOLE);
}

export function lineOf(file: ts.SourceFile, node: ts.Node): number {
  return file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
}

/** The local names of `HttpClient` and `httpResource` that a file imports from Angular. */
function httpNames(file: ts.SourceFile): { client: Set<string>; resource: Set<string> } {
  const client = new Set<string>();
  const resource = new Set<string>();
  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== HTTP_MODULE
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue;
    for (const each of bindings.elements) {
      const imported = (each.propertyName ?? each.name).text;
      if (imported === 'HttpClient') client.add(each.name.text);
      if (imported === 'httpResource') resource.add(each.name.text);
    }
  }
  return { client, resource };
}

/** The names a file holds an `HttpClient` under: `this.<name>` members and plain variables. */
interface Receivers {
  members: Set<string>;
  variables: Set<string>;
}

function clientReceivers(file: ts.SourceFile, client: ReadonlySet<string>): Receivers {
  const receivers: Receivers = { members: new Set(), variables: new Set() };
  if (client.size === 0) return receivers;
  const isClientType = (type: ts.TypeNode | undefined): boolean =>
    type !== undefined &&
    ts.isTypeReferenceNode(type) &&
    ts.isIdentifier(type.typeName) &&
    client.has(type.typeName.text);
  const isInjected = (init: ts.Expression | undefined): boolean =>
    init !== undefined &&
    ts.isCallExpression(init) &&
    ts.isIdentifier(init.expression) &&
    init.expression.text === 'inject' &&
    init.arguments[0] !== undefined &&
    ts.isIdentifier(init.arguments[0]) &&
    client.has(init.arguments[0].text);
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyDeclaration(node) &&
      (isClientType(node.type) || isInjected(node.initializer))
    ) {
      receivers.members.add(node.name.getText(file));
    } else if (ts.isParameter(node) && isClientType(node.type) && ts.isIdentifier(node.name)) {
      receivers.variables.add(node.name.text);
      if (ts.isParameterPropertyDeclaration(node, node.parent)) {
        receivers.members.add(node.name.text);
      }
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      (isClientType(node.type) || isInjected(node.initializer))
    ) {
      receivers.variables.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return receivers;
}

interface CallShape {
  url: ts.Expression | undefined;
  method(evaluator: Evaluator, file: ts.SourceFile): string;
}

/** `http.get(url)`, `this.http.post(url, body)`, `http.request('PUT', url)`. */
function clientCall(node: ts.CallExpression, receivers: Receivers): CallShape | null {
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee)) return null;
  const method = callee.name.text;
  if (!METHODS.has(method) && method !== 'request') return null;
  const receiver = callee.expression;
  const isClient =
    (ts.isPropertyAccessExpression(receiver) &&
      receiver.expression.kind === ts.SyntaxKind.ThisKeyword &&
      receivers.members.has(receiver.name.getText())) ||
    (ts.isIdentifier(receiver) && receivers.variables.has(receiver.text));
  if (!isClient) return null;
  if (method === 'request') {
    const [first, second] = node.arguments;
    return {
      url: second,
      method: (evaluator, file) =>
        first === undefined ? 'REQUEST' : methodName(evaluator.evaluate(first, file)),
    };
  }
  return { url: node.arguments[0], method: () => method.toUpperCase() };
}

/** `httpResource(() => url)`, `httpResource(() => ({ url, method }))`, `httpResource.text(...)`. */
function resourceCall(node: ts.CallExpression, resource: ReadonlySet<string>): CallShape | null {
  const callee = node.expression;
  const named =
    (ts.isIdentifier(callee) && resource.has(callee.text)) ||
    (ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      resource.has(callee.expression.text));
  if (!named) return null;
  let request = node.arguments[0];
  if (request !== undefined && (ts.isArrowFunction(request) || ts.isFunctionExpression(request))) {
    request = returned(request.body);
  }
  while (request !== undefined && ts.isParenthesizedExpression(request))
    request = request.expression;
  if (request !== undefined && ts.isObjectLiteralExpression(request)) {
    const property = (key: string): ts.Expression | undefined => {
      for (const each of request.properties) {
        if (ts.isPropertyAssignment(each) && each.name.getText() === key) return each.initializer;
      }
      return undefined;
    };
    const method = property('method');
    return {
      url: property('url'),
      method: (evaluator, file) =>
        method === undefined ? 'GET' : methodName(evaluator.evaluate(method, file)),
    };
  }
  return { url: request, method: () => 'GET' };
}

function returned(body: ts.ConciseBody): ts.Expression | undefined {
  if (!ts.isBlock(body)) return body;
  const last = body.statements.find(ts.isReturnStatement);
  return last?.expression;
}

function methodName(values: string[]): string {
  const [only] = values;
  return values.length === 1 && only !== undefined && !only.includes(HOLE)
    ? only.toUpperCase()
    : 'REQUEST';
}

/** What a declaration found by name holds: an expression, a class, or nothing drift can read. */
type Binding =
  | { kind: 'value'; node: ts.Expression; file: ts.SourceFile }
  | { kind: 'class'; node: ts.ClassDeclaration; file: ts.SourceFile };

/** Reads string values from expressions, as far as the code shows them. */
class Evaluator {
  private depth = 0;
  private readonly sources: Sources;

  constructor(sources: Sources) {
    this.sources = sources;
  }

  /** Every value an expression may have, with holes. */
  evaluate(node: ts.Expression, file: ts.SourceFile): string[] {
    if (this.depth > 24) return [HOLE];
    this.depth++;
    try {
      return this.value(node, file);
    } finally {
      this.depth--;
    }
  }

  private value(node: ts.Expression, file: ts.SourceFile): string[] {
    if (ts.isStringLiteralLike(node)) return [node.text];
    if (ts.isNumericLiteral(node)) return [node.text];
    if (ts.isTemplateExpression(node)) {
      let out = [node.head.text];
      for (const span of node.templateSpans) {
        out = join(join(out, this.evaluate(span.expression, file)), [span.literal.text]);
      }
      return out;
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      return join(this.evaluate(node.left, file), this.evaluate(node.right, file));
    }
    if (ts.isConditionalExpression(node)) {
      return [...this.evaluate(node.whenTrue, file), ...this.evaluate(node.whenFalse, file)].slice(
        0,
        MOST,
      );
    }
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isTypeAssertionExpression(node)
    ) {
      return this.evaluate(node.expression, file);
    }
    if (ts.isIdentifier(node)) {
      const values = this.bindings(node.text, node, file).flatMap((binding) =>
        binding.kind === 'value' ? this.evaluate(binding.node, binding.file) : [HOLE],
      );
      return values.length === 0 ? [HOLE] : values.slice(0, MOST);
    }
    if (ts.isPropertyAccessExpression(node)) {
      const values = this.members(node, file).flatMap((each) =>
        this.evaluate(each.node, each.file),
      );
      return values.length === 0 ? [HOLE] : values.slice(0, MOST);
    }
    return [HOLE];
  }

  /** The initialisers a property access may read: of a class member or of an object constant. */
  private members(
    node: ts.PropertyAccessExpression,
    file: ts.SourceFile,
  ): { node: ts.Expression; file: ts.SourceFile }[] {
    const name = node.name.text;
    if (node.expression.kind === ts.SyntaxKind.ThisKeyword) {
      const owner = ts.findAncestor(node, ts.isClassLike);
      const init = owner === undefined ? undefined : memberInit(owner, name, false);
      return init === undefined ? [] : [{ node: init, file }];
    }
    return this.objects(node.expression, file).flatMap((each) => {
      if (each.kind === 'class') {
        const init = memberInit(each.node, name, true);
        return init === undefined ? [] : [{ node: init, file: each.file }];
      }
      const init = propertyInit(each.node, name);
      return init === undefined ? [] : [{ node: init, file: each.file }];
    });
  }

  /** The object literals or classes an expression may stand for. */
  private objects(
    node: ts.Expression,
    file: ts.SourceFile,
  ): (
    | { kind: 'object'; node: ts.ObjectLiteralExpression; file: ts.SourceFile }
    | { kind: 'class'; node: ts.ClassDeclaration; file: ts.SourceFile }
  )[] {
    const inner = unwrap(node);
    if (ts.isObjectLiteralExpression(inner)) return [{ kind: 'object', node: inner, file }];
    if (ts.isIdentifier(inner)) {
      return this.bindings(inner.text, inner, file).flatMap((binding) =>
        binding.kind === 'class'
          ? [binding]
          : this.depth > 24
            ? []
            : this.nested(() => this.objects(binding.node, binding.file)),
      );
    }
    if (ts.isPropertyAccessExpression(inner)) {
      return this.members(inner, file).flatMap((each) =>
        this.nested(() => this.objects(each.node, each.file)),
      );
    }
    return [];
  }

  private nested<T>(run: () => T[]): T[] {
    if (this.depth > 24) return [];
    this.depth++;
    try {
      return run();
    } finally {
      this.depth--;
    }
  }

  /** What a name means where it is used: a `const` in scope, or what an import brings. */
  private bindings(name: string, from: ts.Node, file: ts.SourceFile): Binding[] {
    let at: ts.Node = from;
    while (!ts.isSourceFile(at)) {
      at = at.parent;
      if (ts.isBlock(at) || ts.isSourceFile(at) || ts.isModuleBlock(at)) {
        const found = declared(at.statements, name, file);
        if (found !== undefined) return [found];
      }
      if (ts.isFunctionLike(at) && at.parameters.some((each) => each.name.getText(file) === name)) {
        return [];
      }
    }
    for (const statement of file.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
        continue;
      const bindings = statement.importClause?.namedBindings;
      if (bindings === undefined || !ts.isNamedImports(bindings)) continue;
      const element = bindings.elements.find((each) => each.name.text === name);
      if (element === undefined) continue;
      const target = this.sources.resolve(statement.moduleSpecifier.text, file.fileName);
      if (target === undefined) return [];
      const imported = (element.propertyName ?? element.name).text;
      return (this.sources.variants.get(target) ?? [target]).flatMap((path) =>
        this.exported(path, imported, 0),
      );
    }
    return [];
  }

  /** What a file exports under a name, through `export { a as b }` and `export * from`. */
  private exported(path: string, name: string, depth: number): Binding[] {
    const file = this.sources.files.get(path);
    if (file === undefined || depth > 8) return [];
    const found = declared(file.statements, name, file, true);
    if (found !== undefined) return [found];
    for (const statement of file.statements) {
      if (!ts.isExportDeclaration(statement)) continue;
      const from =
        statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)
          ? this.sources.resolve(statement.moduleSpecifier.text, path)
          : path;
      const clause = statement.exportClause;
      if (clause === undefined) {
        if (from !== undefined && from !== path) {
          const inner = this.exported(from, name, depth + 1);
          if (inner.length > 0) return inner;
        }
        continue;
      }
      if (!ts.isNamedExports(clause)) continue;
      const element = clause.elements.find((each) => each.name.text === name);
      if (element === undefined || from === undefined) continue;
      const local = (element.propertyName ?? element.name).text;
      if (from === path) {
        const own = declared(file.statements, local, file);
        return own === undefined ? [] : [own];
      }
      return this.exported(from, local, depth + 1);
    }
    return [];
  }
}

/** A `const` or class a list of statements declares under a name (exported, when asked). */
function declared(
  statements: ts.NodeArray<ts.Statement>,
  name: string,
  file: ts.SourceFile,
  exported = false,
): Binding | undefined {
  const isExported = (node: ts.VariableStatement | ts.ClassDeclaration): boolean =>
    !exported || isExport(node);
  for (const statement of statements) {
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      if ((statement.declarationList.flags & ts.NodeFlags.Const) === 0) continue;
      for (const each of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(each.name) &&
          each.name.text === name &&
          each.initializer !== undefined
        ) {
          return { kind: 'value', node: each.initializer, file };
        }
      }
    }
    if (
      ts.isClassDeclaration(statement) &&
      statement.name?.text === name &&
      isExported(statement)
    ) {
      return { kind: 'class', node: statement, file };
    }
  }
  return undefined;
}

function isExport(node: ts.VariableStatement | ts.ClassDeclaration): boolean {
  return ts.getModifiers(node)?.some((each) => each.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

/** The initialiser of a class property (a static one, when asked). */
function memberInit(
  node: ts.ClassLikeDeclaration,
  name: string,
  isStatic: boolean,
): ts.Expression | undefined {
  for (const member of node.members) {
    if (!ts.isPropertyDeclaration(member) || member.name.getText() !== name) continue;
    const own =
      ts.getModifiers(member)?.some((each) => each.kind === ts.SyntaxKind.StaticKeyword) ?? false;
    if (own === isStatic) return member.initializer;
  }
  return undefined;
}

function propertyInit(node: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const property of node.properties) {
    if (ts.isPropertyAssignment(property) && propertyName(property.name) === name) {
      return property.initializer;
    }
    if (ts.isShorthandPropertyAssignment(property) && property.name.text === name) {
      return property.name;
    }
  }
  return undefined;
}

function propertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)
    ? name.text
    : undefined;
}

function unwrap(node: ts.Expression): ts.Expression {
  let at = node;
  while (
    ts.isParenthesizedExpression(at) ||
    ts.isAsExpression(at) ||
    ts.isSatisfiesExpression(at) ||
    ts.isNonNullExpression(at)
  ) {
    at = at.expression;
  }
  return at;
}

/** Every value of `a` followed by every value of `b`, keeping at most `MOST`. */
function join(a: readonly string[], b: readonly string[]): string[] {
  const out: string[] = [];
  for (const x of a) for (const y of b) if (out.length < MOST) out.push(collapse(x + y));
  return out;
}

/** Runs of holes count as one. */
function collapse(value: string): string {
  return value.replace(new RegExp(`${HOLE}+`, 'g'), HOLE);
}

/**
 * The string properties of every object constant a file exports, as `name.path` with their
 * values (an environment file's settings).
 */
export function exportedSettings(
  file: ts.SourceFile,
  sources: Sources,
): { key: string; values: string[]; line: number }[] {
  const evaluator = new Evaluator(sources);
  const out: { key: string; values: string[]; line: number }[] = [];
  const walk = (node: ts.ObjectLiteralExpression, prefix: string): void => {
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const name = propertyName(property.name);
      if (name === undefined) continue;
      const init = unwrap(property.initializer);
      if (ts.isObjectLiteralExpression(init)) {
        walk(init, `${prefix}.${name}`);
      } else {
        const values = evaluator.evaluate(init, file).filter((each) => !each.includes(HOLE));
        out.push({ key: `${prefix}.${name}`, values, line: lineOf(file, property) });
      }
    }
  };
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!isExport(statement)) continue;
    for (const each of statement.declarationList.declarations) {
      const init = each.initializer === undefined ? undefined : unwrap(each.initializer);
      if (ts.isIdentifier(each.name) && init !== undefined && ts.isObjectLiteralExpression(init)) {
        walk(init, each.name.text);
      }
    }
  }
  return out;
}
