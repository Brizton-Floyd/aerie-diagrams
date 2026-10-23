// Java read with `web-tree-sitter` and the `tree-sitter-java-orchard` grammar (DRIFT-208), both
// WebAssembly, so nothing native is installed or run. The grammar's `.wasm` file is kept beside this
// module (THIRD_PARTY_NOTICES.md says where it comes from); this is the only module that knows its
// tree, which it turns into the small model of `model.ts` and then frees.
import { Language, Parser, type Node } from 'web-tree-sitter';
import type {
  Annotation,
  Body,
  Expr,
  Field,
  Import,
  JavaFile,
  Local,
  Method,
  Param,
  TypeDecl,
  TypeRef,
} from './model.ts';

/** Reads Java source into the model; it never fails, and records the lines it could not parse. */
export interface JavaParser {
  read(text: string): JavaFile;
}

/** The grammar, kept beside this module and checked against its release by a unit test. */
export const JAVA_GRAMMAR = new URL('./tree-sitter-java_orchard.wasm', import.meta.url);

let loading: Promise<JavaParser> | undefined;

/** Loads the parser and its grammar, once; WebAssembly loads asynchronously, then parses at once. */
export function loadJava(): Promise<JavaParser> {
  loading ??= (async () => {
    await Parser.init();
    const language = await Language.load(JAVA_GRAMMAR);
    const parser = new Parser();
    parser.setLanguage(language);
    return {
      read(text: string): JavaFile {
        const tree = parser.parse(text);
        if (tree === null) return { package: '', imports: [], types: [], errors: [1] };
        try {
          return readFile(tree.rootNode);
        } finally {
          tree.delete();
        }
      },
    };
  })();
  return loading;
}

const COMMENTS = new Set(['line_comment', 'block_comment']);

const TYPE_DECLARATIONS: Record<string, TypeDecl['kind']> = {
  class_declaration: 'class',
  interface_declaration: 'interface',
  record_declaration: 'record',
  enum_declaration: 'enum',
  annotation_type_declaration: 'annotation',
};

/** The node types that are expressions, so a statement's walk knows where an expression starts. */
const EXPRESSIONS = new Set([
  'method_invocation',
  'object_creation_expression',
  'field_access',
  'identifier',
  'string_literal',
  'binary_expression',
  'ternary_expression',
  'parenthesized_expression',
  'cast_expression',
  'lambda_expression',
  'assignment_expression',
  'array_creation_expression',
  'array_access',
  'array_initializer',
  'class_literal',
  'this',
  'super',
  'unary_expression',
  'update_expression',
  'instanceof_expression',
  'method_reference',
  'switch_expression',
  'template_expression',
  'decimal_integer_literal',
  'hex_integer_literal',
  'octal_integer_literal',
  'binary_integer_literal',
  'decimal_floating_point_literal',
  'hex_floating_point_literal',
  'character_literal',
  'true',
  'false',
  'null_literal',
]);

function named(node: Node): Node[] {
  return node.namedChildren.filter((child) => !COMMENTS.has(child.type));
}

function lineOf(node: Node): number {
  return node.startPosition.row + 1;
}

function readFile(root: Node): JavaFile {
  const file: JavaFile = { package: '', imports: [], types: [], errors: [] };
  for (const child of named(root)) {
    if (child.type === 'package_declaration') {
      const name = named(child).find((each) => each.type.endsWith('identifier'));
      file.package = name === undefined ? '' : compact(name.text);
    } else if (child.type === 'import_declaration') {
      file.imports.push(readImport(child));
    } else if (child.type in TYPE_DECLARATIONS) {
      file.types.push(readType(child));
    }
  }
  if (root.hasError) file.errors = errorLines(root);
  return file;
}

function readImport(node: Node): Import {
  const name = named(node).find((each) => each.type.endsWith('identifier'));
  return {
    name: name === undefined ? '' : compact(name.text),
    isStatic: node.children.some((each) => each.type === 'static'),
    wildcard: named(node).some((each) => each.type === 'asterisk'),
  };
}

function errorLines(root: Node): number[] {
  const lines = new Set<number>();
  const visit = (node: Node): void => {
    if (node.isError || node.isMissing) {
      lines.add(lineOf(node));
      return;
    }
    if (!node.hasError) return;
    for (const child of node.children) visit(child);
  };
  visit(root);
  return [...lines].sort((a, b) => a - b);
}

function readType(node: Node): TypeDecl {
  const kind = TYPE_DECLARATIONS[node.type] ?? 'class';
  const decl: TypeDecl = {
    kind,
    name: node.childForFieldName('name')?.text ?? '',
    line: lineOf(node),
    annotations: annotationsOf(node),
    superclass: null,
    interfaces: [],
    components: [],
    fields: [],
    methods: [],
    types: [],
  };
  const superclass = node.childForFieldName('superclass');
  const parent = superclass === null ? undefined : named(superclass)[0];
  if (parent !== undefined) decl.superclass = readTypeRef(parent);
  const interfaces =
    node.childForFieldName('interfaces') ??
    named(node).find((each) => each.type === 'extends_interfaces') ??
    null;
  if (interfaces !== null) {
    for (const list of named(interfaces)) decl.interfaces.push(...named(list).map(readTypeRef));
  }
  const components =
    node.type === 'record_declaration' ? node.childForFieldName('parameters') : null;
  if (components !== null) decl.components = readParams(components);
  const body = node.childForFieldName('body');
  if (body !== null) readMembers(body, decl);
  return decl;
}

function readMembers(body: Node, decl: TypeDecl): void {
  for (const member of named(body)) {
    switch (member.type) {
      case 'field_declaration':
      case 'constant_declaration':
        decl.fields.push(...readFields(member, decl.kind === 'interface'));
        break;
      case 'method_declaration':
      case 'constructor_declaration':
      case 'compact_constructor_declaration':
        decl.methods.push(readMethod(member));
        break;
      case 'enum_body_declarations':
        readMembers(member, decl);
        break;
      default:
        if (member.type in TYPE_DECLARATIONS) decl.types.push(readType(member));
    }
  }
}

function modifierWords(node: Node): Set<string> {
  const modifiers = named(node).find((each) => each.type === 'modifiers');
  const words = new Set<string>();
  if (modifiers === undefined) return words;
  for (const child of modifiers.children) {
    if (child.type === 'annotation' || child.type === 'marker_annotation') continue;
    for (const word of child.text.split(/\s+/)) words.add(word);
  }
  return words;
}

function annotationsOf(node: Node): Annotation[] {
  const modifiers = named(node).find((each) => each.type === 'modifiers');
  const holders = modifiers === undefined ? [node] : [modifiers, node];
  return holders.flatMap((holder) =>
    named(holder)
      .filter((each) => each.type === 'annotation' || each.type === 'marker_annotation')
      .map(readAnnotation),
  );
}

function readAnnotation(node: Node): Annotation {
  const annotation: Annotation = {
    name: compact(node.childForFieldName('name')?.text ?? ''),
    line: lineOf(node),
    args: [],
  };
  const args = node.childForFieldName('arguments');
  if (args === null) return annotation;
  for (const arg of named(args)) {
    if (arg.type === 'element_value_pair') {
      const value = arg.childForFieldName('value');
      annotation.args.push({
        name: arg.childForFieldName('key')?.text ?? '',
        value: value === null ? other(arg) : readExpr(value),
      });
    } else {
      annotation.args.push({ name: 'value', value: readExpr(arg) });
    }
  }
  return annotation;
}

function readFields(node: Node, constant: boolean): Field[] {
  const words = modifierWords(node);
  const typeNode = node.childForFieldName('type');
  const type = typeNode === null ? { name: '?', args: [] } : readTypeRef(typeNode);
  const annotations = annotationsOf(node);
  return node.childrenForFieldName('declarator').map((declarator) => {
    const value = declarator.childForFieldName('value');
    return {
      name: declarator.childForFieldName('name')?.text ?? '',
      type,
      isStatic: constant || words.has('static'),
      isFinal: constant || words.has('final'),
      annotations,
      value: value === null ? null : readExpr(value),
      line: lineOf(declarator),
    };
  });
}

function readMethod(node: Node): Method {
  const returns = node.childForFieldName('type');
  const params = node.childForFieldName('parameters');
  const body = node.childForFieldName('body');
  return {
    name: node.childForFieldName('name')?.text ?? '',
    returns: returns === null ? null : readTypeRef(returns),
    params: params === null ? [] : readParams(params),
    annotations: annotationsOf(node),
    body: body === null ? null : readBody(body),
    line: lineOf(node),
  };
}

function readParams(node: Node): Param[] {
  const params: Param[] = [];
  for (const param of named(node)) {
    if (param.type === 'formal_parameter') {
      const type = param.childForFieldName('type');
      params.push({
        name: param.childForFieldName('name')?.text ?? '',
        type: type === null ? null : readTypeRef(type),
        annotations: annotationsOf(param),
        line: lineOf(param),
      });
    } else if (param.type === 'spread_parameter') {
      const type = param.childForFieldName('type');
      const declarator = named(param).find((each) => each.type === 'variable_declarator');
      params.push({
        name: declarator?.childForFieldName('name')?.text ?? '',
        type: type === null ? null : { name: `${stripGenerics(type.text)}[]`, args: [] },
        annotations: annotationsOf(param),
        line: lineOf(param),
      });
    } else if (param.type === 'identifier') {
      params.push({ name: param.text, type: null, annotations: [], line: lineOf(param) });
    }
  }
  return params;
}

function readTypeRef(node: Node): TypeRef {
  switch (node.type) {
    case 'generic_type': {
      const [base, args] = named(node);
      return {
        name: base === undefined ? '?' : stripGenerics(base.text),
        args: args === undefined ? [] : named(args).map(readTypeRef),
      };
    }
    case 'annotated_type': {
      const type = named(node).find(
        (each) => each.type !== 'annotation' && each.type !== 'marker_annotation',
      );
      return type === undefined ? { name: '?', args: [] } : readTypeRef(type);
    }
    case 'wildcard': {
      const bound = named(node).find(
        (each) => each.type !== 'annotation' && each.type !== 'marker_annotation',
      );
      return bound === undefined ? { name: '?', args: [] } : readTypeRef(bound);
    }
    default:
      return { name: stripGenerics(node.text), args: [] };
  }
}

/** A type's name without its type arguments, annotations or spaces: `Map.Entry` for `Map.Entry<K, V>`. */
function stripGenerics(text: string): string {
  let out = '';
  let depth = 0;
  for (const char of text.replace(/@[\w.]+(\([^)]*\))?/g, '')) {
    if (char === '<') depth++;
    else if (char === '>') depth--;
    else if (depth === 0) out += char;
  }
  return compact(out);
}

function compact(text: string): string {
  return text.replace(/\s+/g, '');
}

function readBody(node: Node): Body {
  const body: Body = { locals: [], returns: [], exprs: [] };
  const statement = (each: Node): void => {
    switch (each.type) {
      case 'local_variable_declaration':
      case 'resource':
        declare(each);
        return;
      case 'expression_statement':
      case 'throw_statement':
      case 'yield_statement':
        for (const child of named(each)) body.exprs.push(readExpr(child));
        return;
      case 'return_statement':
        for (const child of named(each)) {
          const value = readExpr(child);
          body.returns.push(value);
          body.exprs.push(value);
        }
        return;
      case 'class_declaration':
      case 'record_declaration':
      case 'interface_declaration':
      case 'enum_declaration':
        return;
      default:
        for (const child of named(each)) {
          if (EXPRESSIONS.has(child.type)) body.exprs.push(readExpr(child));
          else statement(child);
        }
    }
  };
  const declare = (each: Node): void => {
    const typeNode = each.childForFieldName('type');
    const type = typeNode === null ? null : readTypeRef(typeNode);
    const declarators = each.type === 'resource' ? [each] : each.childrenForFieldName('declarator');
    for (const declarator of declarators) {
      const valueNode = declarator.childForFieldName('value');
      const value = valueNode === null ? null : readExpr(valueNode);
      const local: Local = {
        name: declarator.childForFieldName('name')?.text ?? '',
        type: type?.name === 'var' ? null : type,
        value,
        line: lineOf(declarator),
      };
      body.locals.push(local);
      if (value !== null) body.exprs.push(value);
    }
  };
  if (EXPRESSIONS.has(node.type)) {
    const value = readExpr(node);
    return { locals: [], returns: [value], exprs: [value] };
  }
  statement(node);
  return body;
}

function readExpr(node: Node): Expr {
  const line = lineOf(node);
  switch (node.type) {
    case 'string_literal':
      return stringOf(node) ?? other(node);
    case 'identifier':
      return { t: 'name', name: node.text, line };
    case 'this':
    case 'super':
      return { t: 'this', line };
    case 'field_access': {
      const object = node.childForFieldName('object');
      return {
        t: 'field',
        object: object === null ? { t: 'this', line } : readExpr(object),
        name: node.childForFieldName('field')?.text ?? '',
        line,
      };
    }
    case 'method_invocation': {
      const object = node.childForFieldName('object');
      const args = node.childForFieldName('arguments');
      return {
        t: 'call',
        object: object === null ? null : readExpr(object),
        name: node.childForFieldName('name')?.text ?? '',
        args: args === null ? [] : named(args).map(readExpr),
        line,
      };
    }
    case 'object_creation_expression': {
      const type = node.childForFieldName('type');
      const args = node.childForFieldName('arguments');
      return {
        t: 'new',
        type: type === null ? { name: '?', args: [] } : readTypeRef(type),
        args: args === null ? [] : named(args).map(readExpr),
        line,
      };
    }
    case 'binary_expression': {
      const left = node.childForFieldName('left');
      const right = node.childForFieldName('right');
      if (left === null || right === null) return other(node);
      if (node.childForFieldName('operator')?.type !== '+') return other(node);
      const parts = [readExpr(left), readExpr(right)].flatMap((part) =>
        part.t === 'plus' ? part.parts : [part],
      );
      return { t: 'plus', parts, line };
    }
    case 'ternary_expression': {
      const options = [
        node.childForFieldName('consequence'),
        node.childForFieldName('alternative'),
      ].filter((each) => each !== null);
      return { t: 'either', options: options.map(readExpr), line };
    }
    case 'parenthesized_expression': {
      const inner = named(node)[0];
      return inner === undefined ? other(node) : readExpr(inner);
    }
    case 'cast_expression': {
      const value = node.childForFieldName('value');
      return value === null ? other(node) : readExpr(value);
    }
    case 'class_literal': {
      const type = named(node)[0];
      return {
        t: 'class',
        type: type === undefined ? { name: '?', args: [] } : readTypeRef(type),
        line,
      };
    }
    case 'lambda_expression': {
      const params = node.childForFieldName('parameters');
      const body = node.childForFieldName('body');
      return {
        t: 'lambda',
        params:
          params === null
            ? []
            : params.type === 'identifier'
              ? [{ name: params.text, type: null, annotations: [], line }]
              : readParams(params),
        body: body === null ? { locals: [], returns: [], exprs: [] } : readBody(body),
        line,
      };
    }
    case 'assignment_expression': {
      const target = node.childForFieldName('left');
      const value = node.childForFieldName('right');
      if (target === null || value === null) return other(node);
      if (node.childForFieldName('operator')?.type !== '=') return other(node);
      return { t: 'assign', target: readExpr(target), value: readExpr(value), line };
    }
    case 'array_initializer':
    case 'element_value_array_initializer':
      return { t: 'array', items: named(node).map(readExpr), line };
    case 'array_creation_expression': {
      const value = node.childForFieldName('value');
      return value === null ? other(node) : readExpr(value);
    }
    case 'annotation':
    case 'marker_annotation':
      return { t: 'annotation', annotation: readAnnotation(node), line };
    default:
      return other(node);
  }
}

/** A string literal's value, with escapes read; null for a string template, which is not text. */
function stringOf(node: Node): Expr | null {
  let value = '';
  const block = node.text.startsWith('"""');
  for (const part of named(node)) {
    switch (part.type) {
      case 'string_fragment':
      case 'multiline_string_fragment':
        value += part.text;
        break;
      case 'escape_sequence':
        value += unescape(part.text);
        break;
      default:
        return null;
    }
  }
  return { t: 'string', value: block ? textBlock(value) : value, line: lineOf(node) };
}

const ESCAPES: Record<string, string> = {
  b: '\b',
  t: '\t',
  n: '\n',
  f: '\f',
  r: '\r',
  s: ' ',
  '"': '"',
  "'": "'",
  '\\': '\\',
};

function unescape(text: string): string {
  const body = text.slice(1);
  if (body.startsWith('u')) return String.fromCharCode(parseInt(body.replace(/^u+/, ''), 16));
  if (/^[0-7]+$/.test(body)) return String.fromCharCode(parseInt(body, 8));
  if (body.startsWith('\n')) return '';
  return ESCAPES[body] ?? body;
}

/** A text block's content with its incidental indentation removed, as the compiler does. */
function textBlock(raw: string): string {
  const lines = raw.replace(/^[ \t]*\n/, '').split('\n');
  const indents = lines
    .filter((line) => line.trim() !== '')
    .map((line) => /^[ \t]*/.exec(line)?.[0].length ?? 0);
  const last = lines.at(-1) ?? '';
  if (last.trim() === '') indents.push(last.length);
  const indent = indents.length === 0 ? 0 : Math.min(...indents);
  return lines.map((line) => line.slice(indent).replace(/[ \t]+$/, '')).join('\n');
}

function other(node: Node): Expr {
  const inner: Expr[] = [];
  const collect = (each: Node): void => {
    for (const child of named(each)) {
      if (EXPRESSIONS.has(child.type)) inner.push(readExpr(child));
      else if (!(child.type in TYPE_DECLARATIONS)) collect(child);
    }
  };
  collect(node);
  return { t: 'other', text: node.text, inner, line: lineOf(node) };
}
