// The class graph of the system's Java (docs/spec/drift.md, DRIFT-401 and DRIFT-402): every type
// the Maven modules declare, with its supertypes in the system, and every type of the system that
// another type's code names. Matching (src/drift/) lifts these to the parts of a diagram that carry
// `class:` hints, which is how part-level lines are checked (#51).
import type { Loading } from '../compose/load.ts';
import type { ClassFact, Fact, ReferenceFact } from '../facts.ts';
import type { Annotation, Body, Expr, TypeRef } from '../java/model.ts';
import { walkScoped, type ClassInfo, type Codebase, type Scope } from './code.ts';

/** DRIFT-401, DRIFT-402: a fact for each type, and a reference fact for each type it names. */
export function classFacts(code: Codebase, loading: Loading): Fact[] {
  const facts: Fact[] = [];
  for (const cls of code.all()) {
    const supertypes = [
      ...(cls.decl.superclass === null ? [] : [cls.decl.superclass]),
      ...cls.decl.interfaces,
    ].flatMap((each) => {
      const info = code.resolve(bare(each.name), cls).info;
      return info === undefined || info === cls ? [] : [info.name];
    });
    const declared: ClassFact = {
      kind: 'class',
      technique: 'java-class',
      at: loading.locator.evidence(cls.file.path, cls.decl.line),
      unit: cls.file.module.unit,
      className: cls.name,
      type: cls.decl.kind,
      supertypes: [...new Set(supertypes)],
    };
    facts.push(declared);
    for (const [target, line] of namedTypes(code, cls)) {
      const reference: ReferenceFact = {
        kind: 'reference',
        technique: 'java-reference',
        at: loading.locator.evidence(cls.file.path, line),
        unit: cls.file.module.unit,
        className: cls.name,
        to: target.name,
        toUnit: target.file.module.unit,
      };
      facts.push(reference);
    }
  }
  return facts;
}

/** A type name without array brackets or varargs dots: `Draw` for `Draw[]`. */
function bare(name: string): string {
  return name.replace(/(?:\[\]|\.\.\.)+$/, '');
}

/** The outermost type a type is declared in, or the type itself. */
function outermost(cls: ClassInfo): ClassInfo {
  let at = cls;
  while (at.outer !== null) at = at.outer;
  return at;
}

/**
 * The types of the system a type's own code names, each at the first line that names it: in its
 * fields, record components, method signatures and bodies, and annotations, through type arguments,
 * `new`, class literals and the types of static calls and constants. Its supertypes are in its
 * class fact instead, and types declared in the same outermost type are its own code.
 */
function namedTypes(code: Codebase, cls: ClassInfo): Map<ClassInfo, number> {
  const found = new Map<ClassInfo, number>();
  const own = outermost(cls);
  const note = (written: string, line: number): void => {
    const info = code.resolve(bare(written), cls).info;
    if (info === undefined || outermost(info) === own) return;
    const before = found.get(info);
    if (before === undefined || line < before) found.set(info, line);
  };
  const type = (ref: TypeRef | null, line: number): void => {
    if (ref === null) return;
    if (ref.name !== '?') note(ref.name, line);
    for (const arg of ref.args) type(arg, line);
  };
  const expr = (each: Expr, scope: Scope): void => {
    walkScoped(each, scope, (inner, at) => {
      switch (inner.t) {
        case 'new':
        case 'class':
          type(inner.type, inner.line);
          break;
        case 'name':
          // A bare name that is no variable where it runs is a type: the receiver of a static call
          // (`Ranges.of(...)`) or of a constant (`Limits.DEFAULT`).
          if (!code.isVariable(inner.name, at)) note(inner.name, inner.line);
          break;
        case 'lambda':
          for (const param of inner.params) type(param.type, param.line);
          for (const local of inner.body.locals) type(local.type, local.line);
          break;
        default:
          break;
      }
    });
  };
  const annotations = (list: readonly Annotation[], scope: Scope): void => {
    for (const annotation of list) {
      note(annotation.name, annotation.line);
      for (const arg of annotation.args) expr(arg.value, scope);
    }
  };
  const body = (value: Body | null, scope: Scope): void => {
    if (value === null) return;
    for (const local of value.locals) type(local.type, local.line);
    for (const each of value.exprs) expr(each, scope);
  };
  const scope: Scope = { cls, method: null, lambdas: [] };
  annotations(cls.decl.annotations, scope);
  for (const component of cls.decl.components) {
    type(component.type, component.line);
    annotations(component.annotations, scope);
  }
  for (const field of cls.decl.fields) {
    type(field.type, field.line);
    annotations(field.annotations, scope);
    if (field.value !== null) expr(field.value, scope);
  }
  for (const method of cls.decl.methods) {
    const inMethod: Scope = { cls, method, lambdas: [] };
    type(method.returns, method.line);
    annotations(method.annotations, inMethod);
    for (const param of method.params) {
      type(param.type, param.line);
      annotations(param.annotations, inMethod);
    }
    body(method.body, inMethod);
  }
  return found;
}
