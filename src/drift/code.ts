// What the extraction says the system holds, indexed for matching (docs/spec/drift.md, section 5):
// its code units by kind, the Maven module graph and the applications that package each module, its
// Java types, and the outside hosts its code names.
import type {
  AppFact,
  ClassFact,
  DependencyFact,
  Extraction,
  Fact,
  ModuleFact,
  PortFact,
  PropertyFact,
  SourceFact,
  UnitFact,
} from '../extract/index.ts';
import { unitText } from '../extract/index.ts';
import type { CodeUnit } from '../lines/index.ts';

/** The kinds of code unit a diagram draws and drift checks for completeness (not `class`). */
export const UNIT_KINDS = ['compose', 'maven', 'npm'] as const;

export type UnitKind = (typeof UNIT_KINDS)[number];

/** The dependency scopes that put a module's code into the application that packages it. */
const PACKAGED = new Set(['compile', 'runtime']);

/** A host with no name of its own: the machine itself, with or without a port. */
const LOOPBACK = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1?\]?)(?::\d+)?$/;

export class CodeIndex {
  readonly extraction: Extraction;
  /** The code units the code has, by `kind:name`, with the facts that show each exists. */
  readonly units = new Map<string, { unit: CodeUnit; facts: UnitFact[] }>();
  readonly modules = new Map<string, ModuleFact>();
  /** Dependencies between modules of the system, test ones included. */
  readonly dependencies: (DependencyFact & { to: CodeUnit })[] = [];
  /** The facts that make a unit an application: a Spring Boot app, an Angular application. */
  readonly apps = new Map<string, AppFact[]>();
  readonly classes = new Map<string, ClassFact>();
  /** Types by the type they extend or implement, directly. */
  private readonly subtypesOf = new Map<string, string[]>();
  /** Whether the Java of the Maven modules was read, so that `class:` hints can be checked. */
  readonly javaRead: boolean;
  private readonly closures = new Map<string, Set<string>>();
  private readonly prefixesOf = new Map<string, string[]>();

  constructor(extraction: Extraction) {
    this.extraction = extraction;
    for (const fact of extraction.facts) {
      switch (fact.kind) {
        case 'unit': {
          const key = unitText(fact.unit);
          const known = this.units.get(key) ?? { unit: fact.unit, facts: [] };
          known.facts.push(fact);
          this.units.set(key, known);
          break;
        }
        case 'module':
          this.modules.set(fact.unit.name, fact);
          break;
        case 'dependency':
          if (!('artifact' in fact.to)) this.dependencies.push({ ...fact, to: fact.to });
          break;
        case 'app':
          if ('className' in fact || fact.type === 'application') {
            const key = unitText(fact.unit);
            this.apps.set(key, [...(this.apps.get(key) ?? []), fact]);
          }
          break;
        case 'class':
          this.classes.set(fact.className, fact);
          for (const each of fact.supertypes) {
            this.subtypesOf.set(each, [...(this.subtypesOf.get(each) ?? []), fact.className]);
          }
          break;
        default:
          break;
      }
    }
    this.javaRead = !extraction.problems.some((each) => each.id === 'java-not-loaded');
  }

  has(unit: CodeUnit): boolean {
    return this.units.has(unitText(unit));
  }

  /** The units of one kind the code has, in the order of their facts. */
  unitsOf(kind: UnitKind): CodeUnit[] {
    return [...this.units.values()].flatMap((each) => (each.unit.kind === kind ? [each.unit] : []));
  }

  /** A Maven module that is only a parent or an aggregator: it packages no code of its own. */
  isPom(name: string): boolean {
    return this.modules.get(name)?.packaging === 'pom';
  }

  isApp(unit: CodeUnit): boolean {
    return this.apps.has(unitText(unit));
  }

  /** The modules a module's code needs at run time: its compile and runtime dependency closure. */
  closure(name: string): Set<string> {
    const known = this.closures.get(name);
    if (known !== undefined) return known;
    const out = new Set<string>();
    const visit = (at: string): void => {
      for (const each of this.dependencies) {
        if (each.from.name !== at || !PACKAGED.has(each.scope)) continue;
        if (out.has(each.to.name) || each.to.name === name) continue;
        out.add(each.to.name);
        visit(each.to.name);
      }
    };
    visit(name);
    this.closures.set(name, out);
    return out;
  }

  /** The apps whose code includes a module's: itself when it is one, and those that package it. */
  packagedBy(name: string): string[] {
    const apps = [...this.apps.keys()].flatMap((key) =>
      key.startsWith('maven:') ? [key.slice('maven:'.length)] : [],
    );
    return apps.filter((app) => app === name || this.closure(app).has(name));
  }

  /** The modules that depend on a module, by the scope of each dependency. */
  dependents(name: string): (DependencyFact & { to: CodeUnit })[] {
    return this.dependencies.filter((each) => each.to.name === name);
  }

  /** The package a type is declared in: its name less its own and its outer types' names. */
  packageOf(className: string): string {
    let at = className;
    while (at.includes('.') && this.classes.has(at)) at = at.slice(0, at.lastIndexOf('.'));
    return at === className ? '' : at;
  }

  /** Every type that extends or implements a type, directly or through others. */
  subtypes(className: string): string[] {
    const out: string[] = [];
    const visit = (at: string): void => {
      for (const each of this.subtypesOf.get(at) ?? []) {
        if (out.includes(each) || each === className) continue;
        out.push(each);
        visit(each);
      }
    };
    visit(className);
    return out;
  }

  /**
   * The paths a module's endpoints are reached at: its own path, and under the context path or base
   * path of the module or of an application that packages it.
   */
  prefixes(name: string): string[] {
    const known = this.prefixesOf.get(name);
    if (known !== undefined) return known;
    const owners = new Set([name, ...this.packagedBy(name)]);
    const out = new Set<string>(['']);
    for (const fact of this.extraction.facts) {
      if (fact.kind !== 'property' || !owners.has(fact.unit.name)) continue;
      if (!['server.servlet.context-path', 'spring.webflux.base-path'].includes(fact.key)) continue;
      const value = fact.value.replace(/\/+$/, '');
      if (value !== '' && value.startsWith('/')) out.add(value);
    }
    this.prefixesOf.set(name, [...out]);
    return [...out];
  }

  /** The ports a Compose service listens on inside its container. */
  containerPorts(service: string): string[] {
    return this.factsOf<PortFact>('port').flatMap((fact) =>
      fact.unit.kind === 'compose' && fact.unit.name === service ? [fact.target] : [],
    );
  }

  /** The `server.port` a module sets. */
  serverPorts(name: string): string[] {
    return this.factsOf<PropertyFact>('property').flatMap((fact) =>
      fact.unit.name === name && fact.key === 'server.port' ? [fact.value] : [],
    );
  }

  /** The places a Compose service's image is built from. */
  sources(service: string): SourceFact[] {
    return this.factsOf<SourceFact>('source').filter(
      (fact) => fact.unit.kind === 'compose' && fact.unit.name === service,
    );
  }

  factsOf<F extends Fact>(kind: F['kind']): F[] {
    return this.extraction.facts.filter((fact): fact is F => fact.kind === kind);
  }
}

/** Whether a host is the machine itself rather than a host outside the system. */
export function isLoopback(host: string): boolean {
  return LOOPBACK.test(host.toLowerCase());
}
