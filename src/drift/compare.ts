// The comparison (docs/spec/drift.md, sections 5 and 6; DRIFT-414 to DRIFT-427): the code's links
// lifted to the elements that stand for their ends, set against the diagram's lines, its code lines
// and its ignore lines, giving findings at their levels, suggestions, what is not checked and what
// is confirmed.
import { unitText, type Extraction } from '../extract/index.ts';
import type { CodeUnit, DriftEnd, DriftSubject, Id, Model, Span } from '../lines/index.ts';
import { CodeIndex, UNIT_KINDS, type UnitKind } from './code.ts';
import { ModelFile, type Op } from './file.ts';
import {
  andList,
  code,
  orList,
  type Confirmed,
  type Drift,
  type Finding,
  type FindingKind,
  type Ignored,
  type Level,
  type NotChecked,
  type Suggestion,
} from './findings.ts';
import {
  evidenceLine,
  factEvidence as factLine,
  linksOf,
  type End,
  type EvidenceLine,
  type Link,
} from './links.ts';
import { Matching, type Proposal } from './match.ts';

export interface CompareInput {
  /** The model file's text, from which the suggested edits are made. */
  source: string;
  /** Its canonical model and source map (`parse(source)`), which must have no errors. */
  model: Model;
  sourceMap: Readonly<Record<string, Span>>;
  /** What the code shows: `extract(...)` on the model's system root. */
  extraction: Extraction;
}

/** What the ends of a finding about a connection stand for, for matching ignore lines. */
interface EndSet {
  element: Id;
  units: string[];
}

type About =
  | { presence: true; elements: Id[]; units: string[] }
  | { presence: false; from: EndSet; to: EndSet };

/** A finding before its level, order and edits are settled. */
interface Draft {
  key: string;
  kind: FindingKind;
  /** Set for an exact check or a fixed level; otherwise the techniques decide. */
  level: Level | null;
  title: string;
  /** Why an exact check failed, when one did. */
  exact: string | null;
  elements: Id[];
  diagram: number | null;
  evidence: EvidenceLine[];
  ops: Op[];
  instead: Op[];
  about: About;
}

/** A pair of elements the code joins, with the links that join them. */
interface Pair {
  s: Id;
  t: Id;
  links: Link[];
}

const WHAT: Record<UnitKind, string> = {
  compose: 'Compose service',
  maven: 'Maven module',
  npm: 'npm package',
};

const TAGS: Record<UnitKind, string> = { compose: 'service', maven: 'module', npm: 'service' };

/** DRIFT-414 to DRIFT-427: compares a model with what its code shows. */
export function compare(input: CompareInput): Drift {
  return new Comparison(input).result();
}

class Comparison {
  private readonly model: Model;
  private readonly file: ModelFile;
  private readonly code: CodeIndex;
  private readonly matching: Matching;
  private readonly links: Link[];
  private readonly unanswered: ReturnType<typeof linksOf>['unanswered'];
  private readonly drafts: Draft[] = [];
  private readonly notChecked: NotChecked[] = [];
  private readonly confirmed: Confirmed[] = [];
  private readonly runtime = new Map<string, Pair>();
  private readonly build = new Map<string, Pair>();
  /** Links with an end no element stands for: by unit, and by outside host. */
  private readonly loose = new Map<string, Link[]>();
  private readonly hosts = new Map<string, Link[]>();
  private readonly taken = new Set<Id>();

  constructor(input: CompareInput) {
    this.model = input.model;
    this.file = new ModelFile(input.source, input.model, input.sourceMap);
    this.code = new CodeIndex(input.extraction);
    this.matching = new Matching(input.model, this.code);
    const found = linksOf(this.code, this.matching);
    this.links = found.links;
    this.unanswered = found.unanswered;
  }

  private name(id: Id): string {
    return this.matching.tree.has(id) ? (this.matching.tree.get(id).name.base ?? id) : id;
  }

  private sentence(index: number): string {
    const relationship = this.model.relationships[index];
    if (relationship === undefined) return '';
    const verb = relationship.verb.base ?? '';
    return `${this.name(relationship.subject)} ${verb} ${this.name(relationship.object)}`;
  }

  result(): Drift {
    this.liftLinks();
    this.missingCode();
    this.relationships();
    this.undrawnConnections();
    this.undrawnDependencies();
    this.undrawnUnits();
    this.unansweredCalls();
    this.elements();
    this.outsideHosts();
    this.model.scenarios.forEach((scenario, index) => {
      this.notChecked.push({
        subject: { scenario: scenario.id },
        reason: 'scenario',
        text: `Scenario ${code(scenario.id)} is not checked: scenarios are checked against real call paths in phase 2.`,
        elements: [],
        diagram: this.file.lineOf(`/scenarios/${String(index)}`),
        evidence: [],
      });
    });
    this.notChecked.push({
      subject: { wording: true },
      reason: 'wording',
      text: 'The wording (names, taglines and descriptions) is not checked: wrong details are checked in phase 2.',
      elements: [],
      diagram: null,
      evidence: [],
    });
    return this.settle();
  }

  // ----------------------------------------------------------------------------- lifting

  /**
   * DRIFT-410: the elements a link's end runs in, or none. The target of a link that stays in its
   * program runs in the apps that run its source.
   */
  private lift(end: End, packaged: boolean, within?: ReadonlySet<string>): Id[] {
    if ('host' in end) {
      const owner = this.matching.hostOwner.get(end.host);
      return owner === undefined ? [] : [owner];
    }
    if (end.className !== null && end.unit.kind === 'maven') {
      return this.matching.liftClass(end.className, end.unit, within);
    }
    return this.matching.liftUnit(end.unit, packaged, within);
  }

  /**
   * DRIFT-410: every link lifted to the pairs of elements it joins. A link that stays in its
   * program is lifted once in each app that runs its source, both ends in that app.
   */
  private liftLinks(): void {
    for (const link of this.links) {
      const packaged = link.kind === 'runtime';
      const apps =
        link.inProcess && 'unit' in link.from && link.from.unit.kind === 'maven'
          ? this.code.packagedBy(link.from.unit.name)
          : [];
      const runs = apps.length === 0 ? [undefined] : apps.map((app) => new Set([app]));
      const pairs = link.kind === 'runtime' ? this.runtime : this.build;
      for (const within of runs) {
        const from = this.lift(link.from, packaged, within);
        const to = this.lift(link.to, packaged, within);
        if (from.length === 0) this.looseEnd(link.from, link);
        if (to.length === 0) this.looseEnd(link.to, link);
        for (const s of from) {
          for (const t of to) {
            if (this.matching.related(s, t)) continue;
            const key = `${s}>${t}`;
            const pair = pairs.get(key) ?? { s, t, links: [] };
            if (!pair.links.includes(link)) pair.links.push(link);
            pairs.set(key, pair);
          }
        }
      }
    }
  }

  private looseEnd(end: End, link: Link): void {
    const key = 'host' in end ? end.host : unitText(end.unit);
    const into = 'host' in end ? this.hosts : this.loose;
    const known = into.get(key) ?? [];
    if (!known.includes(link)) into.set(key, [...known, link]);
  }

  // ------------------------------------------------------------------------ code lines

  /** DRIFT-418: a code line that names code the system does not have, and what it became. */
  private missingCode(): void {
    for (const missing of this.matching.missing) {
      const { element, unit, index, rename } = missing;
      const written = unitText(unit);
      const what = unit.kind === 'class' ? 'Java type' : WHAT[unit.kind];
      const named = this.name(element);
      const line = this.file.codeLine(element, index);
      const about: About = { presence: true, elements: [element], units: [written] };
      if (rename !== null) {
        this.drafts.push({
          key: `renamed-code:${element}:${written}>${unitText(rename)}`,
          kind: 'renamed-code',
          level: 'drift',
          title: `The code line of ${named} names ${code(written)}, which the code no longer has; it has ${code(unitText(rename))} instead, which no element names.`,
          exact: `An exact check: the code has no ${what} of that name, and ${code(unitText(rename))} is the closest one no element names.`,
          elements: [element],
          diagram: line,
          evidence: this.existence(rename),
          ops: this.file.renameUnit(element, index, rename),
          instead: [this.file.addIgnore(written)],
          about,
        });
        continue;
      }
      // An element whose only code is gone is gone from the code; a part keeps its place.
      const owned = this.matching.unitsOf(element);
      const holds = this.matching.tree
        .descendants(element)
        .some((each) => this.matching.checked(each.id));
      const all = this.model.elements.find((each) => each.id === element)?.code ?? [];
      const gone =
        unit.kind !== 'class' &&
        owned.length === 0 &&
        !holds &&
        all.every((each) => each.kind !== 'class');
      this.drafts.push({
        key: `missing-code:${element}:${written}`,
        kind: 'missing-code',
        level: 'drift',
        title: `The code line of ${named} names ${code(written)}, which the code does not have.`,
        exact: `An exact check: the code has no ${what} of that name.`,
        elements: [element],
        diagram: line,
        evidence: [],
        ops: gone ? this.file.removeElement(element) : this.file.removeUnit(element, index),
        instead: [this.file.addIgnore(written)],
        about,
      });
    }
  }

  /** The facts that show a unit exists. */
  private existence(unit: CodeUnit): EvidenceLine[] {
    const facts = this.code.units.get(unitText(unit))?.facts ?? [];
    if (unit.kind === 'class') {
      const declared = this.code.classes.get(unit.name);
      return declared === undefined ? [] : [factLine(declared)];
    }
    return facts.map((fact) => factLine(fact));
  }

  // ----------------------------------------------------------------------- relationships

  /**
   * DRIFT-414, DRIFT-415: each line of the diagram, compared at its anchors: a runtime line with
   * the calls, messages and references between them, a `[code]` line with the build dependencies.
   */
  private relationships(): void {
    this.model.relationships.forEach((relationship, index) => {
      const line = this.file.relationshipLine(index);
      const a = this.matching.anchor(relationship.subject);
      const b = this.matching.anchor(relationship.object);
      const isCode = relationship.kind === 'code';
      const said = this.sentence(index);
      const elements = [relationship.subject, relationship.object];
      const skip = (reason: NotChecked['reason'], why: string): void => {
        this.notChecked.push({
          subject: { relationship: index },
          reason,
          text: `The line “${said}” is not checked: ${why}`,
          elements,
          diagram: line,
          evidence: [],
        });
      };
      if (a === null || b === null) {
        const end = a === null ? relationship.subject : relationship.object;
        skip('end', `${this.name(end)} stands for no code drift can read.`);
        return;
      }
      if (this.matching.related(a, b)) {
        const inner = this.matching.tree.contains(a, b) ? b : a;
        const outer = inner === a ? b : a;
        skip(
          'same-code',
          a === b
            ? `both ends are checked as ${this.name(a)}, so drift cannot tell them apart.`
            : `its ends are checked as ${this.name(inner)} and ${this.name(outer)}, which holds it, so drift cannot tell them apart.`,
        );
        return;
      }
      if (isCode && (!this.standsForModules(a) || !this.standsForModules(b))) {
        skip(
          'not-maven',
          'build dependencies are read only from Maven poms, and an end stands for no Maven module.',
        );
        return;
      }
      const pairs = [...(isCode ? this.build : this.runtime).values()].filter(
        (pair) => this.matching.related(pair.s, a) && this.matching.related(pair.t, b),
      );
      const links = pairs.flatMap((pair) => pair.links);
      const evidence = unique(links.map((link) => link.evidence));
      const counted = evidence.filter((each) => !each.corroborates);
      const as =
        a === relationship.subject && b === relationship.object
          ? ''
          : ` (checked as ${this.name(a)} to ${this.name(b)})`;
      if (counted.length > 0) {
        this.confirmed.push({
          subject: { relationship: index },
          diagram: line,
          text: `The line “${said}” is in the code${as}.`,
          techniques: techniquesOf(evidence),
          evidence,
        });
        return;
      }
      if (evidence.length > 0) {
        skip(
          'corroborated',
          `only ${andList(unique(evidence.map((each) => each.name)))}, which only corroborates, shows it.`,
        );
        return;
      }
      const ends = this.ends(a, b);
      this.drafts.push(
        isCode
          ? {
              key: `missing-dependency:${relationship.subject}>${relationship.object}`,
              kind: 'missing-dependency',
              level: 'drift',
              title: `The diagram says ${said}, but in the code ${this.name(a)} does not depend on ${this.name(b)}${as}.`,
              exact:
                'An exact check: the Maven poms list every dependency between modules, and none runs this way.',
              elements,
              diagram: line,
              evidence: [],
              ops: [this.file.removeRelationship(index)],
              instead: [this.file.addIgnore(`${relationship.subject} to ${relationship.object}`)],
              about: { presence: false, ...ends },
            }
          : {
              key: `missing-connection:${relationship.subject}>${relationship.object}:${relationship.verb.base ?? ''}`,
              kind: 'missing-connection',
              level: 'likely',
              title: `The diagram says ${said}, but the code shows no call from ${this.name(a)} to ${this.name(b)}.`,
              exact: null,
              elements,
              diagram: line,
              evidence: [],
              ops: [this.file.removeRelationship(index)],
              instead: [this.file.addIgnore(`${relationship.subject} to ${relationship.object}`)],
              about: { presence: false, ...ends },
            },
      );
    });
  }

  /** Whether an element, or something inside it, stands for a Maven module. */
  private standsForModules(element: Id): boolean {
    return [element, ...this.matching.tree.descendants(element).map((each) => each.id)].some((id) =>
      this.matching.unitsOf(id).some((owned) => owned.unit.kind === 'maven'),
    );
  }

  /** The units at each end of a connection between two elements, for matching ignore lines. */
  private ends(s: Id, t: Id, links: readonly Link[] = []): { from: EndSet; to: EndSet } {
    const unitsAt = (element: Id, side: 'from' | 'to'): string[] =>
      unique([
        ...this.matching.unitsOf(element).map((owned) => unitText(owned.unit)),
        ...links.flatMap((link) => {
          const end = link[side];
          return 'host' in end ? [] : [unitText(end.unit)];
        }),
      ]);
    return {
      from: { element: s, units: unitsAt(s, 'from') },
      to: { element: t, units: unitsAt(t, 'to') },
    };
  }

  /** Whether a diagram line of the kinds given explains a pair of elements the code joins. */
  private explains(pair: Pair, code: boolean): boolean {
    return this.model.relationships.some((relationship) => {
      if ((relationship.kind === 'code') !== code) return false;
      const a = this.matching.anchor(relationship.subject);
      const b = this.matching.anchor(relationship.object);
      return (
        a !== null &&
        b !== null &&
        this.matching.related(pair.s, a) &&
        this.matching.related(pair.t, b)
      );
    });
  }

  /**
   * DRIFT-416: the pairs the code joins that no runtime line explains (a `[code]` line explains a
   * type reference too), each reported once, at the finest grain the code shows: a coarser pair's
   * links count for the finer pairs inside it.
   */
  private undrawnConnections(): void {
    const open: Pair[] = [];
    for (const pair of this.runtime.values()) {
      if (this.explains(pair, false)) continue;
      // A type reference between two Maven modules is a build dependency, which the poms show
      // exactly and the `[code]` lines are compared with; only one inside a module tells more.
      const code = this.explains(pair, true);
      const links = pair.links.filter((link) => !link.either || (!code && !crossesModules(link)));
      if (links.some((link) => !link.evidence.corroborates)) open.push({ ...pair, links });
    }
    const tree = this.matching.tree;
    const within = (inner: Id, outer: Id): boolean =>
      inner === outer || tree.contains(outer, inner);
    const finer = (p: Pair, q: Pair): boolean => p !== q && within(p.s, q.s) && within(p.t, q.t);
    const leaves = open.filter((q) => !open.some((p) => finer(p, q)));
    for (const leaf of leaves) {
      const links = [...leaf.links, ...open.filter((q) => finer(leaf, q)).flatMap((q) => q.links)];
      this.drafts.push({
        key: `undrawn-connection:${leaf.s}>${leaf.t}`,
        kind: 'undrawn-connection',
        level: null,
        title: `${this.name(leaf.s)} ${uses(links) ? 'uses the code of' : 'calls'} ${this.name(leaf.t)} in the code, but no line in the diagram joins them.`,
        exact: null,
        elements: tree.sort([leaf.s, leaf.t]),
        diagram: null,
        evidence: unique(links.map((link) => link.evidence)),
        ops: [this.file.addRelationship(leaf.s, leaf.t, 'runtime')],
        instead: [this.file.addIgnore(`${leaf.s} to ${leaf.t}`)],
        about: { presence: false, ...this.ends(leaf.s, leaf.t, links) },
      });
    }
  }

  /** DRIFT-417: build dependencies between drawn elements that no `[code]` line explains. */
  private undrawnDependencies(): void {
    const hasCodeLines = this.model.relationships.some((each) => each.kind === 'code');
    if (!hasCodeLines) {
      if (this.build.size > 0) {
        this.notChecked.push({
          subject: { kind: 'code' },
          reason: 'no-code-lines',
          text: 'The diagram has no `[code]` lines, so the build dependencies between its modules are not checked.',
          elements: [],
          diagram: null,
          evidence: unique(
            [...this.build.values()].flatMap((pair) => pair.links.map((link) => link.evidence)),
          ),
        });
      }
      return;
    }
    for (const pair of this.build.values()) {
      if (this.explains(pair, true)) continue;
      this.drafts.push({
        key: `undrawn-dependency:${pair.s}>${pair.t}`,
        kind: 'undrawn-dependency',
        level: 'drift',
        title: `${this.name(pair.s)} depends on ${this.name(pair.t)} in the code, but no \`[code]\` line in the diagram joins them.`,
        exact: 'An exact check: the Maven poms list every dependency between modules.',
        elements: this.matching.tree.sort([pair.s, pair.t]),
        diagram: null,
        evidence: unique(pair.links.map((link) => link.evidence)),
        ops: [this.file.addRelationship(pair.s, pair.t, 'code')],
        instead: [this.file.addIgnore(`${pair.s} to ${pair.t}`)],
        about: { presence: false, ...this.ends(pair.s, pair.t, pair.links) },
      });
    }
  }

  // ------------------------------------------------------------------------------ units

  /**
   * DRIFT-419: the services, modules and packages no element stands for, of each kind the diagram
   * draws at all. A module that a drawn module depends on is an exact check.
   */
  private undrawnUnits(): void {
    const drawn = this.matching.drawnKinds();
    const hasCodeLines = this.model.relationships.some((each) => each.kind === 'code');
    const reported: { kind: UnitKind; unit: CodeUnit }[] = [];
    for (const kind of UNIT_KINDS) {
      const units = this.code
        .unitsOf(kind)
        .filter((unit) => !this.matching.owner.has(unitText(unit)))
        .filter((unit) => kind !== 'maven' || !this.code.isPom(unit.name));
      if (units.length === 0) continue;
      if (!drawn.has(kind)) {
        const count =
          units.length === 1 ? `the one in the code` : `the ${String(units.length)} in the code`;
        this.notChecked.push({
          subject: { kind },
          reason: 'kind-not-drawn',
          text: `The diagram names no ${WHAT[kind]}s, so ${count} (${andList(units.map((unit) => code(unitText(unit))))}) ${units.length === 1 ? 'is' : 'are'} not checked.`,
          elements: [],
          diagram: null,
          evidence: [],
        });
        continue;
      }
      for (const unit of units) if (this.checksUnit(kind, unit)) reported.push({ kind, unit });
    }
    // Every new element gets its id first, so the lines between two new elements are suggested too.
    const ids = new Map<string, Id>();
    for (const { unit } of reported) {
      const id = this.file.freshId(unit.name, this.taken);
      this.taken.add(id);
      ids.set(unitText(unit), id);
    }
    for (const { kind, unit } of reported) this.undrawnUnit(kind, unit, hasCodeLines, ids);
  }

  /** Whether a unit no element names is reported, or not checked (uncertain, test support). */
  private checksUnit(kind: UnitKind, unit: CodeUnit): boolean {
    const key = unitText(unit);
    const uncertain = this.matching.uncertain.get(key);
    if (uncertain !== undefined) {
      const elements = unique(uncertain.map((each) => each.element));
      this.notChecked.push({
        subject: { unit },
        reason: 'uncertain',
        text: `${code(key)} may be what ${orList(elements.map((each) => this.name(each)))} stands for; until a code line says so, it is not checked.`,
        elements,
        diagram: null,
        evidence: this.existence(unit),
      });
      return false;
    }
    if (kind === 'maven') {
      const dependents = this.code.dependents(unit.name);
      if (dependents.length > 0 && dependents.every((each) => each.scope === 'test')) {
        this.notChecked.push({
          subject: { unit },
          reason: 'test-support',
          text: `The Maven module ${code(key)} is used only by tests, so it is not checked.`,
          elements: [],
          diagram: null,
          evidence: dependents.map((each) => factLine(each)),
        });
        return false;
      }
    }
    return true;
  }

  private undrawnUnit(
    kind: UnitKind,
    unit: CodeUnit,
    hasCodeLines: boolean,
    ids: ReadonlyMap<string, Id>,
  ): void {
    const key = unitText(unit);
    // A drawn module that depends on it, directly or through modules no element names.
    const drawnDependents =
      kind !== 'maven'
        ? []
        : unique(
            [...this.matching.owner.entries()].flatMap(([owned, element]) => {
              if (!owned.startsWith('maven:')) return [];
              const name = owned.slice('maven:'.length);
              const direct = this.code.dependencies.some(
                (each) =>
                  each.from.name === name && each.to.name === unit.name && each.scope !== 'test',
              );
              return direct || this.code.closure(name).has(unit.name) ? [element] : [];
            }),
          );
    const links = this.loose.get(key) ?? [];
    const evidence = unique([
      ...this.existence(unit),
      ...(this.code.apps.get(key) ?? []).map((fact) => factLine(fact)),
      ...links.map((link) => link.evidence),
    ]);
    const first = drawnDependents[0];
    const id = ids.get(key) ?? key;
    const ops: Op[] = [
      this.file.addElement(this.parentFor(kind, first), id, unit.name, TAGS[kind], unit),
    ];
    const lines = new Set<string>();
    const line = (s: Id, t: Id, kind: Link['kind']): void => {
      const lineKey = `${s}>${t}>${kind}`;
      if (lines.has(lineKey)) return;
      lines.add(lineKey);
      ops.push(this.file.addRelationship(s, t, kind === 'build' ? 'code' : 'runtime'));
    };
    for (const link of links) {
      if (link.evidence.corroborates) continue;
      if (link.kind === 'build' ? !hasCodeLines : link.either && crossesModules(link)) continue;
      const outward = 'unit' in link.from && unitText(link.from.unit) === key;
      const end = outward ? link.to : link.from;
      const within =
        outward && link.inProcess ? new Set(this.code.packagedBy(unit.name)) : undefined;
      const other = this.lift(end, link.kind === 'runtime', within);
      for (const element of other) line(outward ? id : element, outward ? element : id, link.kind);
      // A link to another unit no element names is suggested once, from its source's new element.
      const partner = 'unit' in end ? ids.get(unitText(end.unit)) : undefined;
      if (other.length === 0 && outward && partner !== undefined && partner !== id) {
        line(id, partner, link.kind);
      }
    }
    const title =
      first === undefined
        ? `The code has the ${WHAT[kind]} ${code(key)}, but no element stands for it.`
        : `${this.name(first)} depends on the Maven module ${code(key)}, but no element stands for it.`;
    this.drafts.push({
      key: `undrawn-code:${key}`,
      kind: 'undrawn-code',
      level: first === undefined ? null : 'drift',
      title,
      exact:
        first === undefined
          ? null
          : 'An exact check: a drawn module depends on it, and the Maven poms list every dependency.',
      elements: drawnDependents,
      diagram: null,
      evidence,
      ops,
      instead: [this.file.addIgnore(key)],
      about: { presence: true, elements: [], units: [key] },
    });
  }

  /**
   * Where a new element goes: beside the drawn module that depends on it, or beside the elements
   * that stand for units of its kind (inside the parent most of them share), or at the top level.
   */
  private parentFor(kind: UnitKind, dependent: Id | undefined): Id | null {
    if (dependent !== undefined) return this.matching.tree.parent(dependent);
    const parents = new Map<string, number>();
    for (const [owned, element] of this.matching.owner) {
      if (!owned.startsWith(`${kind}:`)) continue;
      const parent = this.matching.tree.parent(element) ?? '';
      parents.set(parent, (parents.get(parent) ?? 0) + 1);
    }
    let best: string | null = null;
    let most = 0;
    for (const [parent, count] of parents) {
      if (count > most) {
        best = parent;
        most = count;
      }
    }
    return best === null || best === '' ? null : best;
  }

  /** DRIFT-420: calls no endpoint of the system answers, by the element that makes them. */
  private unansweredCalls(): void {
    const byElement = new Map<Id, EvidenceLine[]>();
    const unitsOf = new Map<Id, string[]>();
    for (const call of this.unanswered) {
      for (const element of this.lift({ unit: call.unit, className: call.className }, true)) {
        byElement.set(element, [...(byElement.get(element) ?? []), call.evidence]);
        unitsOf.set(element, unique([...(unitsOf.get(element) ?? []), unitText(call.unit)]));
      }
    }
    for (const [element, evidence] of byElement) {
      const count = evidence.length;
      const calls = count === 1 ? 'a call' : `${String(count)} calls`;
      this.drafts.push({
        key: `unanswered-calls:${element}`,
        kind: 'unanswered-calls',
        level: 'likely',
        title: `${this.name(element)} makes ${calls} that no endpoint of the system answers.`,
        exact: null,
        elements: [element],
        diagram: this.file.elementLine(element),
        evidence,
        ops: [],
        instead: [this.file.addIgnore(element)],
        about: { presence: true, elements: [element], units: unitsOf.get(element) ?? [] },
      });
    }
  }

  // --------------------------------------------------------------------------- elements

  /** DRIFT-425, DRIFT-424: each element the code confirms, and each it cannot show. */
  private elements(): void {
    for (const element of this.model.elements) {
      const id = element.id;
      const line = this.file.elementLine(id);
      const unchecked = this.matching.uncheckedClasses.get(id);
      if (unchecked !== undefined) {
        this.notChecked.push({
          subject: { element: id },
          reason: unchecked === 'typescript' ? 'typescript-classes' : 'java-not-read',
          text:
            unchecked === 'typescript'
              ? `The \`class:\` hints of ${element.name.base ?? id} name TypeScript, whose classes drift does not read yet, so they are not checked.`
              : `The Java of the system was not read, so the \`class:\` hints of ${element.name.base ?? id} are not checked.`,
          elements: [id],
          diagram: line,
          evidence: [],
        });
      }
      if (this.matching.checked(id)) {
        this.confirmElement(id, line);
        continue;
      }
      if (this.matching.covers(id) || unchecked !== undefined) continue;
      if (element.code.length > 0) continue;
      const proposals = this.matching.proposals.filter((each) => each.element === id && !each.used);
      const anchor = this.matching.anchor(id);
      const named = element.name.base ?? id;
      const [reason, text]: [NotChecked['reason'], string] = element.tags.includes('person')
        ? ['person', `${named} is a person, which code cannot show.`]
        : proposals.length > 0
          ? [
              'uncertain',
              `${named} may stand for ${andList(proposals.map((each) => code(unitText(each.unit))))}; until a code line says so, it is not checked.`,
            ]
          : anchor !== null
            ? [
                'part',
                `${named} has no \`class:\` hints, so it is not checked, and its lines are checked as ${this.name(anchor)}'s.`,
              ]
            : ['no-code', `${named} has no code line, and its name matches no code drift reads.`];
      this.notChecked.push({
        subject: { element: id },
        reason,
        text,
        elements: [id],
        diagram: line,
        evidence: [],
      });
    }
  }

  private confirmElement(id: Id, line: number): void {
    const owned = this.matching.unitsOf(id);
    const hints = this.matching.classHints.get(id) ?? [];
    const host = this.matching.hostOf.get(id);
    const what = [
      ...owned.map((each) => code(unitText(each.unit))),
      ...hints.map((each) => code(`class:${each.hint}`)),
      ...(host === undefined ? [] : [`the host ${code(host)}`]),
    ];
    const evidence = unique([
      ...owned.flatMap((each) => this.existence(each.unit)),
      ...hints.flatMap((each) =>
        [...this.code.classes.values()]
          .filter(
            (declared) => this.matching.hintMatches(each.hint, declared.className, id) !== null,
          )
          .slice(0, 1)
          .map((declared) => factLine(declared)),
      ),
      ...(host === undefined ? [] : (this.hosts.get(host) ?? []).map((link) => link.evidence)),
      ...(host === undefined
        ? []
        : [...this.runtime.values()]
            .filter((pair) => pair.t === id || pair.s === id)
            .flatMap((pair) => pair.links.map((link) => link.evidence))),
    ]);
    this.confirmed.push({
      subject: { element: id },
      diagram: line,
      text: `${this.name(id)} stands for ${andList(what)}, which the code has.`,
      techniques: techniquesOf(evidence),
      evidence,
    });
  }

  /** DRIFT-424: hosts outside the system the code calls, which no element stands for. */
  private outsideHosts(): void {
    for (const [host, links] of [...this.hosts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (this.matching.hostOwner.has(host)) continue;
      const callers = unique(
        links.flatMap((link) => ('host' in link.from ? [] : this.lift(link.from, true))),
      );
      const who =
        callers.length === 0 ? 'The code' : andList(callers.map((each) => this.name(each)));
      this.notChecked.push({
        subject: { host },
        reason: 'outside-host',
        text: `${who} ${callers.length > 1 ? 'call' : 'calls'} ${code(host)}, outside the system, and no element stands for that host, which a code line cannot name.`,
        elements: this.matching.tree.sort([...callers]),
        diagram: null,
        evidence: unique(links.map((link) => link.evidence)),
      });
    }
  }

  // ---------------------------------------------------------------------------- settling

  /**
   * DRIFT-421 to DRIFT-423, DRIFT-426: ignore lines applied, levels settled, findings ordered and
   * numbered.
   */
  private settle(): Drift {
    const leveled = this.drafts.flatMap((draft) => {
      const settled = level(draft);
      return settled === null ? [] : [{ draft, ...settled }];
    });
    const excused = new Map<number, typeof leveled>();
    const reported: typeof leveled = [];
    for (const each of leveled) {
      const index = this.model.ignores.findIndex((ignore) =>
        this.ignores(ignore.subject, each.draft.about),
      );
      if (index < 0) reported.push(each);
      else excused.set(index, [...(excused.get(index) ?? []), each]);
    }
    this.model.ignores.forEach((ignore, index) => {
      if (excused.has(index)) return;
      const subject = subjectText(ignore.subject);
      const draft: Draft = {
        key: `unused-ignore:${subject}`,
        kind: 'unused-ignore',
        level: 'likely',
        title: `The ignore line for ${code(subject)} excuses nothing: the diagram and the code agree there.`,
        exact: null,
        elements: endsOf(ignore.subject).flatMap((end) => ('element' in end ? [end.element] : [])),
        diagram: this.file.lineOf(`/ignores/${String(index)}`),
        evidence: [],
        ops: [this.file.removeIgnore(index)],
        instead: [],
        about: { presence: true, elements: [], units: [] },
      };
      reported.push({
        draft,
        level: 'likely',
        detail: 'Nothing it names differs any more, so it can go.',
      });
    });
    const order = (a: (typeof leveled)[number], b: (typeof leveled)[number]): number =>
      (a.level === b.level ? 0 : a.level === 'drift' ? -1 : 1) ||
      (a.draft.diagram ?? Infinity) - (b.draft.diagram ?? Infinity) ||
      (a.draft.key < b.draft.key ? -1 : a.draft.key > b.draft.key ? 1 : 0);
    const ops = new Map<string, Op[]>();
    const counters = { drift: 0, likely: 0 };
    const finding = (each: (typeof leveled)[number], numbered: boolean): Finding => {
      ops.set(each.draft.key, each.draft.ops);
      let id = '';
      if (numbered) {
        counters[each.level]++;
        id = `${each.level === 'drift' ? 'D' : 'L'}${String(counters[each.level]).padStart(2, '0')}`;
      }
      return {
        id,
        key: each.draft.key,
        level: each.level,
        kind: each.draft.kind,
        title: each.draft.title,
        detail: each.detail,
        elements: each.draft.elements,
        diagram: each.draft.diagram,
        techniques: techniquesOf(each.draft.evidence),
        evidence: each.draft.evidence,
        edits: this.file.hunks(each.draft.ops),
        instead: this.file.hunks(each.draft.instead),
      };
    };
    const findings = reported.sort(order).map((each) => finding(each, true));
    const ignored: Ignored[] = this.model.ignores.flatMap((ignore, index) => {
      const list = excused.get(index);
      if (list === undefined) return [];
      return [
        {
          index,
          diagram: this.file.lineOf(`/ignores/${String(index)}`),
          subject: subjectText(ignore.subject),
          reason: ignore.reason,
          findings: list.sort(order).map((each) => finding(each, false)),
        },
      ];
    });
    const suggestions = this.suggestions(ops);
    const file = this.file;
    const reportedKeys = findings.map((each) => each.key);
    return {
      findings,
      suggestions,
      notChecked: this.notChecked,
      ignored,
      confirmed: this.confirmed,
      patch(keys?: readonly string[]): ReturnType<Drift['patch']> {
        const chosen = keys ?? reportedKeys;
        return file.hunks(chosen.flatMap((key) => ops.get(key) ?? []));
      },
    };
  }

  /** DRIFT-422: whether an ignore line's subject is what a finding is about. */
  private ignores(subject: DriftSubject, about: About): boolean {
    if ('from' in subject) {
      if (about.presence) return false;
      return this.endMatches(subject.from, about.from) && this.endMatches(subject.to, about.to);
    }
    if (!about.presence) return false;
    return 'element' in subject
      ? about.elements.includes(subject.element)
      : about.units.includes(unitText(subject.unit));
  }

  /** Whether an ignore line's end names a finding's end: its element, one around it, or a unit. */
  private endMatches(end: DriftEnd, set: EndSet): boolean {
    const tree = this.matching.tree;
    if ('element' in end)
      return end.element === set.element || tree.contains(end.element, set.element);
    const unit = unitText(end.unit);
    if (set.units.includes(unit)) return true;
    return [set.element, ...tree.ancestors(set.element)].some((id) =>
      this.matching.unitsOf(id).some((owned) => unitText(owned.unit) === unit),
    );
  }

  /** DRIFT-427: the code lines drift suggests, each with the edit that adds it. */
  private suggestions(ops: Map<string, Op[]>): Suggestion[] {
    const seen = new Set<string>();
    const out: Suggestion[] = [];
    const proposals = [...this.matching.proposals].sort(
      (a, b) =>
        this.matching.tree.order(a.element) - this.matching.tree.order(b.element) ||
        (unitText(a.unit) < unitText(b.unit) ? -1 : 1),
    );
    for (const proposal of proposals) {
      const key = `suggestion:${proposal.element}:${unitText(proposal.unit)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const add = [this.file.addUnit(proposal.element, proposal.unit)];
      ops.set(key, add);
      out.push({
        id: `S${String(out.length + 1).padStart(2, '0')}`,
        key,
        element: proposal.element,
        unit: proposal.unit,
        title: `${this.name(proposal.element)} may stand for ${code(unitText(proposal.unit))}: add ${code(`code ${unitText(proposal.unit)}`)}?`,
        detail: why(proposal),
        used: proposal.used,
        evidence: unique([
          ...this.existence(proposal.unit),
          ...this.code.extraction.facts
            .filter((fact) => proposal.at.some((at) => sameAt(at, fact.at)) && fact.kind === 'unit')
            .map((fact) => factLine(fact)),
        ]),
        edits: this.file.hunks(add),
      });
    }
    return out;
  }
}

function why(proposal: Proposal): string {
  switch (proposal.why) {
    case 'name':
      return 'Its name matches, so drift compares it as standing for that unit already; a code line makes it certain.';
    case 'ambiguous':
      return 'Its name matches, but so does another element’s, so drift does not compare it until a code line says which.';
    case 'partial-name':
      return 'Part of its name matches, which is not enough to compare it until a code line says so.';
    case 'tagline':
      return 'Its tagline names it, which is not enough to compare it until a code line says so.';
    case 'port':
      return 'The service runs the Spring Boot app: its image is built from the module, and listens on the port the module sets.';
    case 'build-source':
      return 'The service’s image is built from the package.';
  }
}

function sameAt(a: { repo: string | null; path: string; line: number }, b: typeof a): boolean {
  return a.repo === b.repo && a.path === b.path && a.line === b.line;
}

/**
 * DRIFT-421: a finding's level and why: an exact check is drift; otherwise drift when several
 * techniques found it, likely when one did, and nothing when only corroborating ones did.
 */
function level(draft: Draft): { level: Level; detail: string } | null {
  if (draft.level !== null && draft.exact !== null)
    return { level: draft.level, detail: draft.exact };
  const counted = unique(
    draft.evidence.filter((each) => !each.corroborates).map((each) => each.name),
  );
  const weak = unique(draft.evidence.filter((each) => each.corroborates).map((each) => each.name));
  const also =
    weak.length === 0
      ? ''
      : ` ${andList(weak)} ${weak.length === 1 ? 'agrees' : 'agree'} too, but only ${weak.length === 1 ? 'corroborates' : 'corroborate'}.`;
  if (draft.level === 'likely' && draft.kind === 'missing-connection') {
    return {
      level: 'likely',
      detail:
        'No technique found a call between them, and reading the code cannot rule one out, so this is only likely.',
    };
  }
  if (draft.kind === 'unanswered-calls') {
    return {
      level: 'likely',
      detail: `${andList(counted)} found the calls, and no endpoint of the system matches their verbs and paths, so this is only likely.`,
    };
  }
  if (counted.length === 0) return null;
  if (counted.length === 1) {
    return { level: 'likely', detail: `One technique found it: ${counted[0] ?? ''}.${also}` };
  }
  return {
    level: 'drift',
    detail: `${String(counted.length)} techniques found it: ${andList(counted)}.${also}`,
  };
}

/** Whether every link that counts is a type reference: code that uses other code, not a call. */
function uses(links: readonly Link[]): boolean {
  const counted = links.filter((link) => !link.evidence.corroborates);
  return (
    counted.length > 0 && counted.every((link) => link.evidence.technique === 'java-reference')
  );
}

/** Whether a link joins code of two different Maven modules. */
function crossesModules(link: Link): boolean {
  return (
    'unit' in link.from &&
    'unit' in link.to &&
    link.from.unit.kind === 'maven' &&
    link.to.unit.kind === 'maven' &&
    link.from.unit.name !== link.to.unit.name
  );
}

/** The techniques of some evidence, each once, those that only corroborate last. */
function techniquesOf(evidence: readonly EvidenceLine[]): string[] {
  return unique([
    ...evidence.filter((each) => !each.corroborates).map((each) => each.technique),
    ...evidence.filter((each) => each.corroborates).map((each) => each.technique),
  ]);
}

function unique<T>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = typeof item === 'string' ? item : evidenceLine(item as EvidenceLine);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function endsOf(subject: DriftSubject): DriftEnd[] {
  return 'from' in subject ? [subject.from, subject.to] : [subject];
}

function endText(end: DriftEnd): string {
  return 'element' in end ? end.element : unitText(end.unit);
}

/** An ignore line's subject as written: `maven:orders-legacy`, `web to api`. */
function subjectText(subject: DriftSubject): string {
  return 'from' in subject
    ? `${endText(subject.from)} to ${endText(subject.to)}`
    : endText(subject);
}
