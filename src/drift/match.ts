// Matching (docs/spec/drift.md, section 5; DRIFT-403 to DRIFT-410): which code each element stands
// for. An element's code line comes first; an element without one is matched by its normalised id
// and names against the Compose services, Maven modules and apps of the code; anything uncertain is
// only a suggestion. Then every piece of code is lifted to the nearest element that stands for it.
import { unitText, type Evidence } from '../extract/index.ts';
import type { CodeUnit, Element, Id, Model } from '../lines/index.ts';
import { editDistance } from '../lines/index.ts';
import { Tree } from '../model/index.ts';
import { CodeIndex, UNIT_KINDS, isLoopback, type UnitKind } from './code.ts';

/** How an element came to stand for a unit. */
export type How = 'hint' | 'rename' | 'name';

/** A code unit an element stands for, and how drift knows. */
export interface Owned {
  unit: CodeUnit;
  how: How;
  /** For a hint or a rename: the unit's place in the element's code lines. */
  index: number | null;
  /** For a rename: the unit the code line names, which the code no longer has. */
  written: CodeUnit | null;
}

/** A unit a code line names that the code does not have. */
export interface Missing {
  element: Id;
  unit: CodeUnit;
  index: number;
  /** The unit it was most likely renamed to: one of the same kind no element names. */
  rename: CodeUnit | null;
}

/** Why drift suggests a code line it does not use. */
export type SuggestionWhy =
  'name' | 'ambiguous' | 'partial-name' | 'tagline' | 'port' | 'build-source';

/** A code line drift suggests: a name match, used or not, or a pairing it cannot be sure of. */
export interface Proposal {
  element: Id;
  unit: CodeUnit;
  why: SuggestionWhy;
  /** Whether drift compares with it already: a certain name match. */
  used: boolean;
  /** The code facts behind it. */
  at: Evidence[];
}

/** Words too common to match an element to a unit on their own. */
const GENERIC = new Set([
  'api',
  'app',
  'application',
  'backend',
  'client',
  'common',
  'core',
  'frontend',
  'lib',
  'library',
  'module',
  'server',
  'service',
  'shared',
  'the',
  'ui',
  'web',
]);

/** Lower case letters and digits only, so `Screen API`, `screen-api` and `screen_api` agree. */
export function normalise(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function tokens(text: string): string[] {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((each) => each !== '');
}

/** The names an element answers to: its id and its name for every audience. */
function namesOf(element: Element): string[] {
  return [element.id, element.name.base ?? '', ...Object.values(element.name.set)].filter(
    (each) => each !== '',
  );
}

function taglinesOf(element: Element): string[] {
  return [element.tagline.base ?? '', ...Object.values(element.tagline.set)].filter(
    (each) => each !== '',
  );
}

/** Everything an element's wording says, for every audience. */
function wordingOf(element: Element): string[] {
  const prose = [
    element.about.base,
    ...Object.values(element.about.set),
    ...Object.values(element.about.add),
  ];
  return [...namesOf(element), ...taglinesOf(element), ...prose.filter((each) => each !== null)];
}

export class Matching {
  readonly model: Model;
  readonly tree: Tree;
  readonly code: CodeIndex;
  /** What each element stands for. */
  readonly owned = new Map<Id, Owned[]>();
  /** The element that stands for each unit, by `kind:name`. */
  readonly owner = new Map<string, Id>();
  readonly missing: Missing[] = [];
  /** The outside host each element stands for, and the element of each host. */
  readonly hostOf = new Map<Id, string>();
  readonly hostOwner = new Map<string, Id>();
  /** Each element's `class:` hints that name Java types the code has. */
  readonly classHints = new Map<Id, { hint: string; index: number }[]>();
  readonly proposals: Proposal[] = [];
  /** Units with a suggestion drift cannot be sure of: neither drawn nor undrawn until pinned. */
  readonly uncertain = new Map<string, Proposal[]>();
  /** `class:` hints drift does not check: TypeScript ones, or any when Java was not read. */
  readonly uncheckedClasses = new Map<Id, 'typescript' | 'java-not-read'>();
  private readonly liftedClasses = new Map<string, Id | null>();

  constructor(model: Model, code: CodeIndex) {
    this.model = model;
    this.tree = new Tree(model);
    this.code = code;
    this.hints();
    this.names();
    this.hosts();
    this.pairings();
  }

  /**
   * DRIFT-403, DRIFT-405: each code line's units, as written; a unit the code lacks is missing, or
   * renamed.
   */
  private hints(): void {
    const named = new Set(
      this.model.elements.flatMap((element) => element.code.map((unit) => unitText(unit))),
    );
    for (const element of this.model.elements) {
      element.code.forEach((unit, index) => {
        if (unit.kind === 'class') {
          this.classHint(element, unit, index);
          return;
        }
        if (this.code.has(unit)) {
          this.own(element.id, { unit, how: 'hint', index, written: null });
          return;
        }
        const rename = this.renameOf(unit, named);
        this.missing.push({ element: element.id, unit, index, rename });
        if (rename !== null) {
          named.add(unitText(rename));
          this.own(element.id, { unit: rename, how: 'rename', index, written: unit });
        }
      });
    }
  }

  private classHint(element: Element, unit: CodeUnit, index: number): void {
    const inNode = [element.id, ...this.tree.ancestors(element.id)].some((id) =>
      this.tree.get(id).code.some((each) => each.kind === 'npm'),
    );
    if (inNode || !this.code.javaRead) {
      this.uncheckedClasses.set(element.id, inNode ? 'typescript' : 'java-not-read');
      return;
    }
    const matched = [...this.code.classes.keys()].some(
      (name) => this.hintMatches(unit.name, name, element.id) !== null,
    );
    if (matched) {
      this.classHints.set(element.id, [
        ...(this.classHints.get(element.id) ?? []),
        { hint: unit.name, index },
      ]);
      return;
    }
    const simple = unit.name.endsWith('.*')
      ? null
      : unit.name.slice(unit.name.lastIndexOf('.') + 1);
    const moved = [...this.code.classes.keys()].filter(
      (name) => simple !== null && unit.name.includes('.') && name.endsWith(`.${simple}`),
    );
    const rename = moved.length === 1 ? { kind: 'class' as const, name: moved[0] ?? '' } : null;
    this.missing.push({ element: element.id, unit, index, rename });
    if (rename !== null) {
      this.classHints.set(element.id, [
        ...(this.classHints.get(element.id) ?? []),
        { hint: rename.name, index },
      ]);
    }
  }

  /**
   * DRIFT-405: how closely a `class:` hint names a type, or null when it does not: 4 for the type
   * itself, 3 for a type nested in it, 2 for a simple name, 1 for a package written with `.*`.
   */
  hintMatches(hint: string, className: string, element: Id): number | null {
    let score: number | null = null;
    if (hint.endsWith('.*')) {
      score = this.code.packageOf(className) === hint.slice(0, -2) ? 1 : null;
    } else if (hint.includes('.')) {
      if (className === hint) score = 4;
      else if (className.startsWith(`${hint}.`) && this.code.classes.has(hint)) score = 3;
    } else {
      const parts = className.split('.');
      const at = parts.lastIndexOf(hint);
      if (at >= 0 && this.code.classes.has(parts.slice(0, at + 1).join('.'))) score = 2;
    }
    if (score === null || score === 4) return score;
    // A package or a simple name names only types of the modules the element's ancestors stand
    // for, when they stand for any: a package may be split across modules.
    const scope = this.moduleScope(element);
    const module = this.code.classes.get(className)?.unit.name;
    if (scope !== null && (module === undefined || !scope.has(module))) return null;
    return score;
  }

  /** The modules an element's nearest ancestor that stands for modules runs, or null for none. */
  private moduleScope(element: Id): Set<string> | null {
    for (const id of [element, ...this.tree.ancestors(element)]) {
      const modules = this.tree
        .get(id)
        .code.filter((unit) => unit.kind === 'maven')
        .map((unit) => unit.name);
      if (modules.length === 0) continue;
      const out = new Set<string>();
      for (const name of modules) {
        out.add(name);
        for (const each of this.code.closure(name)) out.add(each);
      }
      return out;
    }
    return null;
  }

  /**
   * DRIFT-404: the unit a missing one was most likely renamed to: a unit of the same kind that no
   * element names, sharing a word with it or within two edits of it, when one is closest.
   */
  private renameOf(unit: CodeUnit, named: ReadonlySet<string>): CodeUnit | null {
    if (unit.kind === 'class') return null;
    const words = new Set(tokens(unit.name).filter((word) => !GENERIC.has(word)));
    const scored = this.code
      .unitsOf(unit.kind)
      .filter((each) => !named.has(unitText(each)))
      .filter((each) => !(each.kind === 'maven' && this.code.isPom(each.name)))
      .flatMap((each) => {
        const shared = tokens(each.name).filter((word) => words.has(word)).length;
        const distance = editDistance(normalise(unit.name), normalise(each.name));
        return shared > 0 || distance <= 2 ? [{ each, shared, distance }] : [];
      })
      .sort((a, b) => b.shared - a.shared || a.distance - b.distance);
    const [best, next] = scored;
    if (best === undefined) return null;
    if (next?.shared === best.shared && next.distance === best.distance) {
      return null;
    }
    return best.each;
  }

  private own(element: Id, owned: Owned): void {
    this.owned.set(element, [...(this.owned.get(element) ?? []), owned]);
    this.owner.set(unitText(owned.unit), element);
  }

  /** The names a unit answers to: its own, and the name of each app it holds. */
  private unitNames(unit: CodeUnit): string[] {
    const apps = this.code.apps.get(unitText(unit)) ?? [];
    return [
      unit.name,
      ...apps.map((app) =>
        'className' in app
          ? app.className.slice(app.className.lastIndexOf('.') + 1).replace(/Application$/, '')
          : app.name,
      ),
    ];
  }

  /**
   * DRIFT-406, DRIFT-407: elements without a code line, matched by name. A unit whose normalised
   * name (or app name) is an element's normalised id or name, for exactly one element, is a certain
   * match: drift compares with it and suggests the code line that pins it. Anything less certain
   * (two elements, part of a name, a unit named in a tagline) is only a suggestion.
   */
  private names(): void {
    // A parent or aggregator pom packages no code, so no element stands for it.
    const free = UNIT_KINDS.flatMap((kind) => this.code.unitsOf(kind)).filter(
      (unit) =>
        !this.owner.has(unitText(unit)) && !(unit.kind === 'maven' && this.code.isPom(unit.name)),
    );
    const certain = new Map<string, Id[]>();
    for (const unit of free) {
      const keys = new Set(this.unitNames(unit).map(normalise));
      for (const element of this.model.elements) {
        if (element.code.length > 0) continue;
        if (namesOf(element).some((name) => keys.has(normalise(name)))) {
          const key = unitText(unit);
          certain.set(key, [...(certain.get(key) ?? []), element.id]);
        }
      }
    }
    for (const unit of free) {
      const key = unitText(unit);
      const elements = certain.get(key) ?? [];
      const at = this.unitEvidence(unit);
      if (elements.length === 1 && elements[0] !== undefined) {
        this.own(elements[0], { unit, how: 'name', index: null, written: null });
        this.proposals.push({ element: elements[0], unit, why: 'name', used: true, at });
        continue;
      }
      for (const element of elements) this.propose(element, unit, 'ambiguous', at);
      if (elements.length > 0) continue;
      for (const element of this.model.elements) {
        const why = this.partial(element, unit);
        if (why !== null) this.propose(element.id, unit, why, at);
      }
    }
  }

  /** Whether an element's names share a run of words with a unit's, or its tagline names it. */
  private partial(element: Element, unit: CodeUnit): SuggestionWhy | null {
    const names = this.unitNames(unit).map(tokens);
    const run = (outer: string[], inner: string[]): boolean => {
      if (inner.length === 0 || inner.length > outer.length) return false;
      if (inner.every((word) => GENERIC.has(word))) return false;
      const head = outer.slice(0, inner.length).join(' ') === inner.join(' ');
      const tail = outer.slice(outer.length - inner.length).join(' ') === inner.join(' ');
      return head || tail;
    };
    if (element.code.length === 0) {
      for (const name of namesOf(element).map(tokens)) {
        if (names.some((each) => run(each, name) || run(name, each))) return 'partial-name';
      }
    }
    const word = new RegExp(`(^|[^\\w@/.-])${escape(unit.name)}($|[^\\w/-])`, 'i');
    return taglinesOf(element).some((tagline) => word.test(tagline)) ? 'tagline' : null;
  }

  private propose(element: Id, unit: CodeUnit, why: SuggestionWhy, at: Evidence[]): void {
    const key = unitText(unit);
    if (this.owner.has(key)) return;
    if (this.proposals.some((each) => each.element === element && unitText(each.unit) === key)) {
      return;
    }
    const proposal: Proposal = { element, unit, why, used: false, at };
    this.proposals.push(proposal);
    this.uncertain.set(key, [...(this.uncertain.get(key) ?? []), proposal]);
  }

  /** Where the code shows a unit exists. */
  unitEvidence(unit: CodeUnit): Evidence[] {
    return (this.code.units.get(unitText(unit))?.facts ?? []).map((fact) => fact.at);
  }

  /**
   * DRIFT-408: hosts outside the system, matched to the elements that stand for no code: by a name
   * that is one of the host's own labels, or by wording that names the host. Only a host one
   * element matches is used; code lines cannot name hosts.
   */
  private hosts(): void {
    const hosts = new Set<string>();
    for (const fact of this.code.extraction.facts) {
      const to =
        fact.kind === 'connection' || (fact.kind === 'call' && 'className' in fact)
          ? fact.to
          : null;
      if (to !== null && 'host' in to && !isLoopback(to.host)) hosts.add(to.host);
    }
    const holds = (id: Id): boolean => this.owned.has(id) || this.classHints.has(id);
    const free = this.model.elements.filter(
      (element) =>
        !holds(element.id) && !this.tree.descendants(element.id).some((each) => holds(each.id)),
    );
    for (const host of [...hosts].sort()) {
      const lower = host.toLowerCase();
      const bare = lower.replace(/^www\./, '');
      const labels = bare
        .split('.')
        .slice(0, -1)
        .filter((label) => !GENERIC.has(label));
      const named = new RegExp(`(^|[^a-z0-9.-])(?:www\\.)?${escape(bare)}($|[^a-z0-9-])`, 'i');
      const matches = free.filter(
        (element) =>
          namesOf(element).some((name) => labels.includes(normalise(name))) ||
          wordingOf(element).some((text) => named.test(text)),
      );
      const [only] = matches;
      if (matches.length !== 1 || only === undefined || this.hostOf.has(only.id)) continue;
      this.hostOf.set(only.id, host);
      this.hostOwner.set(host, only.id);
    }
  }

  /**
   * DRIFT-407: code lines suggested from how units pair up: the Spring Boot app a Compose service
   * runs (its image is built from the module, and the module's `server.port` is a port the
   * service listens on), and the npm package a service's image is built from.
   */
  private pairings(): void {
    for (const service of this.code.unitsOf('compose')) {
      const owner = this.owner.get(unitText(service));
      const sources = this.code.sources(service.name).map((fact) => fact.place);
      const ports = new Set(this.code.containerPorts(service.name));
      const apps = this.code.unitsOf('maven').filter((module) => {
        const folder = this.code.modules.get(module.name)?.folder;
        return (
          this.code.isApp(module) &&
          folder !== undefined &&
          sources.some((place) => place.repo === folder.repo && within(place.path, folder.path)) &&
          this.code.serverPorts(module.name).some((port) => ports.has(port))
        );
      });
      const packages = this.code.unitsOf('npm').filter((pkg) => {
        const at = this.code.units.get(unitText(pkg))?.facts[0]?.at;
        if (at === undefined) return false;
        const folder = dirname(at.path);
        // The image copies the package's package.json, or a folder that holds the package.
        return sources.some(
          (place) =>
            place.repo === at.repo && (place.path === at.path || within(folder, place.path)),
        );
      });
      const partners = [...(apps.length === 1 ? apps : []), ...packages];
      for (const partner of partners) {
        const other = this.owner.get(unitText(partner));
        const why: SuggestionWhy = partner.kind === 'maven' ? 'port' : 'build-source';
        const at = [...this.unitEvidence(service), ...this.unitEvidence(partner)];
        if (owner !== undefined && other === undefined) this.propose(owner, partner, why, at);
        else if (owner === undefined && other !== undefined) this.propose(other, service, why, at);
      }
    }
  }

  /** The units an element stands for. */
  unitsOf(element: Id): Owned[] {
    return this.owned.get(element) ?? [];
  }

  /** DRIFT-409: an element is checked when it stands for code: units, `class:` hints or a host. */
  checked(element: Id): boolean {
    return (
      this.unitsOf(element).length > 0 || this.classHints.has(element) || this.hostOf.has(element)
    );
  }

  /** Whether an element or something inside it stands for code. */
  covers(element: Id): boolean {
    return (
      this.checked(element) || this.tree.descendants(element).some((each) => this.checked(each.id))
    );
  }

  /**
   * DRIFT-409: the element a diagram line's end is compared as: itself when it (or something inside
   * it) stands for code, or else its nearest ancestor that does, so that a part without `class:`
   * hints is checked as its module. Null when neither does: code cannot show it.
   */
  anchor(element: Id): Id | null {
    if (this.covers(element)) return element;
    return this.tree.ancestors(element).find((each) => this.checked(each)) ?? null;
  }

  /** Whether two elements are the same or one holds the other: lines between them are internal. */
  related(a: Id, b: Id): boolean {
    return a === b || this.tree.contains(a, b) || this.tree.contains(b, a);
  }

  /**
   * DRIFT-410: the elements a unit's code runs in: the element that stands for the unit, or for a
   * Maven library no element names (when `packaged`), the elements of the apps that package it;
   * of those `within`, when some of them are, for code that runs in one of those apps.
   */
  liftUnit(unit: CodeUnit, packaged: boolean, within?: ReadonlySet<string>): Id[] {
    const own = this.owner.get(unitText(unit));
    if (own !== undefined) return [own];
    if (!packaged || unit.kind !== 'maven') return [];
    const apps = this.code.packagedBy(unit.name);
    const shared = within === undefined ? [] : apps.filter((app) => within.has(app));
    const elements = (shared.length > 0 ? shared : apps).flatMap((app) => {
      const element = this.owner.get(`maven:${app}`);
      return element === undefined ? [] : [element];
    });
    return [...new Set(elements)];
  }

  /**
   * DRIFT-410: the elements a Java type's code runs in: the element whose `class:` hint names it
   * most closely (ties to the deepest, then the first), or else the element of its module.
   */
  liftClass(className: string, module: CodeUnit, within?: ReadonlySet<string>): Id[] {
    if (!this.liftedClasses.has(className)) {
      let best: { element: Id; score: number; depth: number } | null = null;
      for (const [element, hints] of this.classHints) {
        for (const { hint } of hints) {
          const score = this.hintMatches(hint, className, element);
          if (score === null) continue;
          const depth = this.tree.depth(element);
          if (best === null || score > best.score || (score === best.score && depth > best.depth)) {
            best = { element, score, depth };
          }
        }
      }
      this.liftedClasses.set(className, best?.element ?? null);
    }
    const hinted = this.liftedClasses.get(className);
    return hinted !== null && hinted !== undefined ? [hinted] : this.liftUnit(module, true, within);
  }

  /** The kinds of code unit the diagram names at all: only those are checked for completeness. */
  drawnKinds(): Set<UnitKind> {
    const out = new Set<UnitKind>();
    for (const key of this.owner.keys()) {
      const kind = key.slice(0, key.indexOf(':'));
      if ((UNIT_KINDS as readonly string[]).includes(kind)) out.add(kind as UnitKind);
    }
    for (const missing of this.missing) {
      if ((UNIT_KINDS as readonly string[]).includes(missing.unit.kind)) {
        out.add(missing.unit.kind as UnitKind);
      }
    }
    return out;
  }
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function within(path: string, folder: string): boolean {
  return folder === '.' || path === folder || path.startsWith(`${folder}/`);
}

function dirname(path: string): string {
  const at = path.lastIndexOf('/');
  return at < 0 ? '.' : path.slice(0, at);
}
