// The Lines parser: from text to the canonical model, with every diagnostic it can find
// (docs/spec/language.md, sections 2 to 13). Checks that need the model's meaning (E604, E703)
// belong to the model stage.
import {
  diagnostic,
  sortDiagnostics,
  type CATALOGUE,
  type Diagnostic,
  type DiagnosticId,
  type OutOfPlace,
} from './catalogue.ts';
import { CODE_KINDS, CODE_NAMES, isCodeKind, isInside, relativePath } from './code.ts';
import { ICON_NAMES } from './icons.ts';
import type {
  Audience,
  CodeUnit,
  DriftEnd,
  DriftSubject,
  Element,
  Ignore,
  Model,
  Prose,
  Relationship,
  Scenario,
  ShowItem,
  Span,
  Step,
  System,
  View,
  WalkStep,
  Walkthrough,
  Words,
} from './model.ts';
import {
  readDocument,
  spanAt,
  trimmed,
  type AudiencesRead,
  type CodeRead,
  type ElementRead,
  type IgnoreRead,
  type List,
  type Piece,
  type RewordingRead,
  type SentenceRead,
  type Statement,
  type SystemRead,
  type TagGroup,
  type TitleRead,
  type WalkStepRead,
} from './read.ts';
import {
  KEYWORDS,
  closest,
  codeList,
  collapseSpaces,
  decodeWords,
  isId,
  isKeyword,
  nameFromId,
  suggestion,
} from './text.ts';

export interface ParseResult {
  /** The canonical model, or null when the file has errors (LANG-808). */
  model: Model | null;
  /** Every diagnostic, sorted by line, column and id (LANG-902). */
  diagnostics: Diagnostic[];
  /** Where each part of the model came from, by JSON Pointer (LANG-807). Empty without a model. */
  sourceMap: Record<string, Span>;
}

/** LANG-103: the audiences of a file with no `audiences` line; `manager` is the default. */
export const DEFAULT_AUDIENCES: readonly Audience[] = [
  { id: 'exec', name: 'Executive', code: false },
  { id: 'manager', name: 'Manager', code: false },
  { id: 'engineer', name: 'Engineer', code: true },
];
const DEFAULT_AUDIENCE = 'manager';

// ---------------------------------------------------------------- builders

/** A piece of text with the span it came from. */
interface Located {
  text: string;
  span: Span;
}

/** A piece of a line, with the statement whose line it is on. */
interface Placed {
  piece: Piece;
  statement: Statement;
}

interface WordsB {
  base: Located | null;
  set: Map<string, Located>;
}

interface ProseB {
  base: Located[];
  set: Map<string, Located[]>;
  add: Map<string, Located[]>;
}

type OwnerKind =
  | 'root'
  | 'model'
  | 'element'
  | 'relationship'
  | 'view'
  | 'scenario'
  | 'scenario-step'
  | 'walkthrough'
  | 'walk-step'
  | 'system'
  | 'leaf';

/** What a block's statements belong to: where their descriptions and rewordings go. */
interface Owner {
  kind: OwnerKind;
  /** The one-line wording `@level:` rewords: a title, a name or a verb phrase. */
  words: WordsB | null;
  tagline: WordsB | null;
  prose: ProseB | null;
  /** The line of each audience's `@level:` line under this owner (E302). */
  reworded: Map<string, number>;
  /** For a line that holds nothing, how E003 names it. */
  leafName: string;
}

interface ElementB {
  id: string;
  parent: string | null;
  span: Span;
  idSpan: Span;
  name: WordsB;
  tagline: WordsB;
  tags: Located[];
  tagsSpan: Span | null;
  icon: Located | null;
  code: { unit: CodeUnit; span: Span }[];
  about: ProseB;
}

/** A path of the `system` block: as written, and normalised for comparing (LANG-753). */
interface PathB {
  path: Located;
  normal: string;
}

interface SystemB {
  span: Span;
  repos: PathB[];
  compose: PathB[];
}

/** An end of an ignore line's subject: a code unit, or an element still to check (E008). */
type EndB = { unit: CodeUnit } | { element: Placed };

interface IgnoreB {
  statement: Statement;
  subject: EndB | { from: EndB; to: EndB };
  subjectSpan: Span;
  reason: Located;
}

interface RelationshipB {
  statement: Statement;
  subject: Piece;
  verb: WordsB;
  verbWords: Piece[];
  objects: Piece[];
  kind: Located;
  about: ProseB;
}

type ShowPending =
  | { form: 'element'; id: Placed; depth: number; span: Span }
  | { form: 'tag'; tag: Placed; span: Span };

interface ViewB {
  id: string;
  span: Span;
  idSpan: Span;
  title: WordsB;
  about: ProseB;
  /** Items and kinds, checked once every element and relationship is known. */
  pendingShow: ShowPending[];
  pendingKinds: Placed[];
  show: { item: ShowItem; span: Span }[];
  kinds: Located[];
}

interface StepB {
  statement: Statement;
  subject: Piece;
  verb: WordsB;
  verbWords: Piece[];
  object: Piece;
  about: ProseB;
  /** False when the step has its own errors (E602, E603), so W601 does not apply. */
  sound: boolean;
}

interface ScenarioB {
  id: string;
  /** False when the id itself is in error, so E601 would only repeat the problem. */
  valid: boolean;
  head: Located;
  span: Span;
  idSpan: Span;
  title: WordsB;
  about: ProseB;
  steps: StepB[];
  /** Every step line, sound or not (E601, E706). */
  stepCount: number;
}

interface WalkStepB {
  statement: Statement;
  read: WalkStepRead;
  open: Placed[];
  close: Placed[];
  audience: Located | null;
  about: ProseB;
}

interface WalkthroughB {
  id: string;
  /** False when the id itself is in error, so E701 would only repeat the problem. */
  valid: boolean;
  head: Located;
  span: Span;
  idSpan: Span;
  title: WordsB;
  about: ProseB;
  steps: WalkStepB[];
}

interface Declaration {
  id: string;
  line: number;
  span: Span;
}

const newWords = (): WordsB => ({ base: null, set: new Map() });
const newProse = (): ProseB => ({ base: [], set: new Map(), add: new Map() });

function owner(kind: OwnerKind, fields: Partial<Omit<Owner, 'kind' | 'reworded'>> = {}): Owner {
  return {
    kind,
    words: fields.words ?? null,
    tagline: fields.tagline ?? null,
    prose: fields.prose ?? null,
    reworded: new Map(),
    leafName: fields.leafName ?? '',
  };
}

/** LANG-006: what each owner may hold. */
const ALLOWED: Record<OwnerKind, readonly string[]> = {
  root: [
    'model',
    'audiences',
    'system',
    'element',
    'sentence',
    'view',
    'scenario',
    'walkthrough',
    'ignore',
  ],
  model: ['description', 'rewording'],
  element: ['element', 'icon', 'code', 'description', 'rewording'],
  relationship: ['description', 'rewording'],
  view: ['show', 'kind', 'description', 'rewording'],
  scenario: ['sentence', 'description', 'rewording'],
  'scenario-step': ['description', 'rewording'],
  walkthrough: ['walk-step', 'description', 'rewording'],
  'walk-step': ['open', 'close', 'for', 'description', 'rewording'],
  system: ['repo', 'compose'],
  leaf: [],
};

/** Which E003 message a line out of place gets. */
function outOfPlace(statement: Statement, holder: Owner): OutOfPlace {
  const read = statement.read;
  if (holder.kind === 'leaf') {
    return { rule: 'holds-nothing', line: holder.leafName };
  }
  switch (read.kind) {
    case 'model':
    case 'audiences':
    case 'view':
    case 'scenario':
    case 'walkthrough':
    case 'system':
    case 'ignore':
      return { rule: 'top-level', keyword: read.kind };
    case 'show':
    case 'kind':
      return { rule: 'in-view', keyword: read.kind };
    case 'icon':
    case 'code':
      return { rule: 'in-element', keyword: read.kind };
    case 'repo':
    case 'compose':
      return { rule: 'in-system', keyword: read.kind };
    case 'walk-step':
      return { rule: 'in-walkthrough' };
    case 'open':
    case 'close':
    case 'for':
      return { rule: 'in-walk-step', keyword: read.kind };
    case 'element':
      return { rule: 'element' };
    case 'description':
      return { rule: 'description' };
    case 'rewording':
      return { rule: 'rewording', audience: read.audience.text };
    case 'sentence':
    case 'unreadable': // never out of place: unreadable lines are skipped before this
      return { rule: 'sentence' };
  }
}

const unionSpan = (first: Span, last: Span): Span => ({
  line: first.line,
  column: first.column,
  endLine: last.endLine,
  endColumn: last.endColumn,
});

const trailingSpace = /[ \t]+$/;

// ------------------------------------------------------------------ parser

class Parser {
  readonly diagnostics: Diagnostic[] = [];
  /** Element ids declared in place, in declaration order. */
  readonly elementIds = new Set<string>();

  modelLine: { statement: Statement; read: TitleRead; id: string | null } | null = null;
  readonly modelTitle = newWords();
  readonly modelAbout = newProse();
  audiencesLine: { statement: Statement; read: AudiencesRead } | null = null;
  declaredAudiences: Audience[] | null = null;
  declaredDefault: string | null = null;

  readonly elements: ElementB[] = [];
  readonly relationships: RelationshipB[] = [];
  readonly views: ViewB[] = [];
  readonly scenarios: ScenarioB[] = [];
  readonly walkthroughs: WalkthroughB[] = [];
  /** The first `system` block, or null (LANG-752). */
  system: SystemB | null = null;
  readonly ignores: IgnoreB[] = [];
  /** Each code unit's element and the line that names it (E809), by `kind:name`. */
  readonly unitOwners = new Map<string, { element: ElementB; line: number }>();
  /** Each ignored subject's line (E814), by the subject as written. */
  readonly ignored = new Map<string, number>();
  /** Element, view, scenario and walkthrough ids, which share one set (LANG-008). */
  readonly declarations: Declaration[] = [];
  /** Rewordings and `for` lines, checked once the audiences are known (E301). */
  readonly audienceRefs: Placed[] = [];
  /** `>>` lines with no audience (E304), which name the last declared audience. */
  readonly doubled: { text: string; span: Span }[] = [];

  report<K extends DiagnosticId>(
    id: K,
    span: Span,
    ...args: Parameters<(typeof CATALOGUE)[K]>
  ): void {
    this.diagnostics.push(diagnostic(id, span, ...args));
  }

  span(statement: Statement, piece: { start: number; end: number }): Span {
    return spanAt(statement.raw, statement.line, piece.start, piece.end);
  }

  at(statement: Statement, offset: number): Span {
    return spanAt(statement.raw, statement.line, offset, offset + 1);
  }

  placed(place: Placed): Span {
    return this.span(place.statement, place.piece);
  }

  located(statement: Statement, piece: Piece, text = piece.text): Located {
    return { text, span: this.span(statement, piece) };
  }

  /** The whole statement on its line, without its indent. */
  lineSpan(statement: Statement): Span {
    const end = statement.raw.replace(trailingSpace, '').length;
    return spanAt(statement.raw, statement.line, statement.indent, end);
  }

  /** The point just after the last character of the line (E011). */
  endOfLine(statement: Statement): Span {
    const end = statement.raw.replace(trailingSpace, '').length;
    return spanAt(statement.raw, statement.line, end, end);
  }

  // ---------------------------------------------- pass 0: declared elements

  /** So that a sentence can tell an unknown element from a misspelt keyword (LANG-904). */
  collectElementIds(statements: Statement[]): void {
    for (const statement of statements) {
      if (statement.read.kind === 'element') {
        const id = statement.read.id.text;
        if (isId(id) && !isKeyword(id)) {
          this.elementIds.add(id);
        }
        this.collectElementIds(statement.children);
      }
    }
  }

  // ------------------------------------------ pass 1: blocks and statements

  visit(statement: Statement, holder: Owner, parent: ElementB | null): void {
    const read = statement.read;
    if (read.kind === 'sentence' && !this.elementIds.has(read.head.text)) {
      const keyword = closest(read.head.text, KEYWORDS);
      if (keyword !== undefined) {
        // LANG-904: a misspelt keyword is the only problem reported for its line.
        const hint = ` Did you mean \`${keyword}\`?`;
        this.report('E008', this.span(statement, read.head), read.head.text, hint);
        return;
      }
    }
    if (!ALLOWED[holder.kind].includes(read.kind)) {
      this.report('E003', this.span(statement, read.head), outOfPlace(statement, holder));
      return;
    }
    switch (read.kind) {
      case 'model':
        this.visitModel(statement, read);
        return;
      case 'audiences':
        this.visitAudiences(statement, read);
        return;
      case 'element':
        this.visitElement(statement, read, parent);
        return;
      case 'icon':
        this.leafChildren(statement, 'icon');
        if (parent !== null) {
          this.visitIcon(statement, read.head, read.value, parent);
        }
        return;
      case 'code':
        this.leafChildren(statement, 'code');
        if (parent !== null) {
          this.visitCode(statement, read, parent);
        }
        return;
      case 'system':
        this.visitSystem(statement, read);
        return;
      case 'repo':
      case 'compose':
        this.leafChildren(statement, read.kind);
        if (read.value === null) {
          this.report('E010', this.span(statement, read.head), read.kind);
        }
        return;
      case 'ignore':
        this.leafChildren(statement, 'ignore');
        this.visitIgnore(statement, read);
        return;
      case 'view':
      case 'scenario':
      case 'walkthrough':
        this.visitTitled(statement, read);
        return;
      case 'show':
      case 'kind':
      case 'open':
      case 'close':
      case 'for':
        this.leafChildren(statement, read.kind);
        this.visitLeaf(statement);
        return;
      case 'sentence':
        if (holder.kind === 'root') {
          this.visitRelationship(statement, read);
        } else {
          this.visitStep(statement, read);
        }
        return;
      case 'walk-step':
        this.visitWalkStep(statement, read);
        return;
      case 'description':
        this.visitDescription(statement, holder);
        return;
      case 'rewording':
        this.visitRewording(statement, read, holder);
        return;
      case 'unreadable':
        return;
    }
  }

  visitChildren(statement: Statement, holder: Owner, parent: ElementB | null = null): void {
    for (const child of statement.children) {
      this.visit(child, holder, parent);
    }
  }

  /** The block of a line that holds nothing: every statement in it is out of place. */
  leafChildren(statement: Statement, leafName: string): void {
    this.visitChildren(statement, owner('leaf', { leafName }));
  }

  /** E005 and E006 for an id being declared; true when it can be used. */
  checkDeclaredId(statement: Statement, id: Piece): boolean {
    if (isKeyword(id.text)) {
      this.report('E006', this.span(statement, id), id.text);
      return false;
    }
    if (!isId(id.text)) {
      this.report('E005', this.span(statement, id), id.text);
      return false;
    }
    return true;
  }

  /** The id and title of a `model`, `view`, `scenario` or `walkthrough` line (E010, E011). */
  readTitle(statement: Statement, read: TitleRead, title: WordsB): string | null {
    if (read.id === null) {
      this.report('E010', this.span(statement, read.head), read.kind);
      return null;
    }
    if (!this.checkDeclaredId(statement, read.id)) {
      return null;
    }
    const id = read.id.text;
    const text = read.title === null ? '' : decodeWords(read.title.text);
    if (text === '' || read.title === null) {
      const example = `${read.kind} ${id}: ${nameFromId(id)}`;
      this.report('E011', this.endOfLine(statement), id, 'title', example);
    } else {
      title.base = this.located(statement, read.title, text);
    }
    return id;
  }

  visitModel(statement: Statement, read: TitleRead): void {
    if (this.modelLine !== null) {
      this.report('E101', this.span(statement, read.head), this.modelLine.statement.line);
      this.visitChildren(statement, owner('model', { words: newWords(), prose: newProse() }));
      return;
    }
    const id = this.readTitle(statement, read, this.modelTitle);
    this.modelLine = { statement, read, id };
    this.visitChildren(
      statement,
      owner('model', { words: this.modelTitle, prose: this.modelAbout }),
    );
  }

  visitAudiences(statement: Statement, read: AudiencesRead): void {
    this.leafChildren(statement, 'audiences');
    if (this.audiencesLine !== null) {
      this.report('E102', this.span(statement, read.head), this.audiencesLine.statement.line);
      return;
    }
    this.audiencesLine = { statement, read };
    if (read.entries === null) {
      this.report('E010', this.span(statement, read.head), 'audiences');
      return;
    }
    for (const comma of read.empties) {
      this.report('E014', this.at(statement, comma));
    }
    const audiences: Audience[] = [];
    let defaultId: string | null = null;
    let index = 0;
    for (const entry of read.entries) {
      index++;
      if (index === 7) {
        this.report('E105', this.span(statement, entry.piece), read.entries.length);
      }
      if (entry.id === null || (entry.name !== null && entry.name.text.trim() === '')) {
        this.report('E107', this.span(statement, entry.piece), entry.piece.text);
        continue;
      }
      if (!this.checkDeclaredId(statement, entry.id)) {
        continue;
      }
      const id = entry.id.text;
      if (audiences.some((audience) => audience.id === id)) {
        this.report('E103', this.span(statement, entry.id), id);
        continue;
      }
      let code = false;
      const flags = entry.flags;
      if (flags !== null && entry.flagsAt !== null) {
        if (flags.items.length === 0) {
          this.report('E106', this.span(statement, entry.flagsAt), '');
        } else {
          for (const comma of flags.empties) {
            this.report('E014', this.at(statement, comma));
          }
        }
        for (const flag of flags.items) {
          if (flag.text === 'code') {
            code = true;
          } else if (flag.text !== 'default') {
            this.report('E106', this.span(statement, flag), flag.text);
          } else if (defaultId === null) {
            defaultId = id;
          } else if (defaultId !== id) {
            this.report('E104', this.span(statement, flag), defaultId, id);
          }
        }
      }
      const name = entry.name === null ? nameFromId(id) : entry.name.text;
      audiences.push({ id, name, code });
    }
    this.declaredAudiences = audiences;
    this.declaredDefault = defaultId;
  }

  visitElement(statement: Statement, read: ElementRead, parent: ElementB | null): void {
    const valid = this.checkDeclaredId(statement, read.id);
    const id = read.id.text;
    const element: ElementB = {
      id,
      parent: parent?.id ?? null,
      span: this.lineSpan(statement),
      idSpan: this.span(statement, read.id),
      name: newWords(),
      tagline: newWords(),
      tags: [],
      tagsSpan: null,
      icon: null,
      code: [],
      about: newProse(),
    };
    const name = decodeWords(read.name.text);
    if (name !== '') {
      element.name.base = this.located(statement, read.name, name);
    } else if (valid) {
      this.report('E011', this.endOfLine(statement), id, 'name', `${id}: ${nameFromId(id)}`);
    }
    if (read.bar !== null && read.tagline !== null) {
      const tagline = decodeWords(read.tagline.text);
      if (tagline === '') {
        this.report('E010', this.at(statement, read.bar), '|');
      } else {
        element.tagline.base = this.located(statement, read.tagline, tagline);
      }
    }
    if (read.tags !== null) {
      for (const tag of this.readTags(statement, read.tags)) {
        if (!element.tags.some((known) => known.text === tag.text)) {
          element.tags.push(tag);
        }
      }
      const close = read.tags.close ?? read.tags.open;
      element.tagsSpan = this.span(statement, { start: read.tags.open, end: close + 1 });
    }
    if (valid) {
      this.declarations.push({ id, line: statement.line, span: this.span(statement, read.id) });
    }
    this.elements.push(element);
    const holder = owner('element', {
      words: element.name,
      tagline: element.tagline,
      prose: element.about,
    });
    this.visitChildren(statement, holder, element);
  }

  /** The tags of an element line (E009, E012, E013, E005). */
  readTags(statement: Statement, group: TagGroup): Located[] {
    if (group.close === null) {
      this.report('E009', this.at(statement, group.open));
      return [];
    }
    if (group.after !== null) {
      this.report('E012', this.span(statement, group.after), group.after.text);
      return [];
    }
    if (group.items.length === 0) {
      this.report('E013', this.span(statement, { start: group.open, end: group.close + 1 }));
      return [];
    }
    const tags: Located[] = [];
    for (const item of group.items) {
      if (isId(item.text)) {
        tags.push(this.located(statement, item));
      } else {
        this.report('E005', this.span(statement, item), item.text);
      }
    }
    return tags;
  }

  visitIcon(statement: Statement, head: Piece, value: Piece | null, element: ElementB): void {
    if (element.icon !== null) {
      this.report('E202', this.span(statement, head), element.id, element.icon.span.line);
      return;
    }
    if (value === null) {
      this.report('E010', this.span(statement, head), 'icon');
      return;
    }
    const icons: readonly string[] = ICON_NAMES;
    if (!icons.includes(value.text)) {
      const hint = suggestion(value.text, icons);
      this.report('E201', this.span(statement, value), value.text, hint, codeList(icons));
    }
    element.icon = this.located(statement, value);
  }

  /** A code unit, `kind:name` (E806, E807, E808); null when it is in error. */
  readUnit(statement: Statement, piece: Piece): CodeUnit | null {
    const colon = piece.text.indexOf(':');
    if (colon <= 0) {
      this.report('E806', this.span(statement, piece), piece.text.slice(colon + 1));
      return null;
    }
    const kind = piece.text.slice(0, colon);
    const name = piece.text.slice(colon + 1);
    if (!isCodeKind(kind)) {
      const at = this.span(statement, { start: piece.start, end: piece.start + colon });
      this.report('E807', at, kind, suggestion(kind, CODE_KINDS), codeList(CODE_KINDS));
      return null;
    }
    const rule = CODE_NAMES[kind];
    if (!rule.pattern.test(name)) {
      this.report('E808', this.span(statement, piece), piece.text, rule.what, rule.how);
      return null;
    }
    return { kind, name };
  }

  /** `code` lines (E010, E103, E809; LANG-755 to LANG-757). */
  visitCode(statement: Statement, read: CodeRead, element: ElementB): void {
    if (read.units.length === 0) {
      this.report('E010', this.span(statement, read.head), 'code');
      return;
    }
    for (const piece of read.units) {
      const unit = this.readUnit(statement, piece);
      if (unit === null) {
        continue;
      }
      const key = `${unit.kind}:${unit.name}`;
      const span = this.span(statement, piece);
      const owner = this.unitOwners.get(key);
      if (owner?.element === element) {
        this.report('E103', span, key);
        continue;
      }
      if (owner !== undefined) {
        this.report('E809', span, key, owner.element.id, owner.line);
        continue;
      }
      this.unitOwners.set(key, { element, line: statement.line });
      element.code.push({ unit, span });
    }
  }

  /** The `system` block and its `repo` and `compose` lines (LANG-752 to LANG-754). */
  visitSystem(statement: Statement, read: SystemRead): void {
    const system: SystemB = { span: this.lineSpan(statement), repos: [], compose: [] };
    if (this.system !== null) {
      this.report('E802', this.span(statement, read.head), this.system.span.line);
    } else {
      this.system = system;
    }
    if (read.rest !== null) {
      this.report('E801', this.span(statement, read.rest));
    }
    if (statement.children.length === 0) {
      this.report('E803', this.span(statement, read.head));
    }
    const holder = owner('system');
    for (const child of statement.children) {
      this.visit(child, holder, null);
      this.fillSystem(child, system);
    }
  }

  /** A `repo` or `compose` line fills in its block (E804, E103). */
  fillSystem(statement: Statement, system: SystemB): void {
    const read = statement.read;
    if ((read.kind !== 'repo' && read.kind !== 'compose') || read.value === null) {
      return;
    }
    const path = this.located(statement, read.value);
    const normal = relativePath(path.text);
    if (normal === null) {
      this.report('E804', path.span, path.text);
      return;
    }
    const into = read.kind === 'repo' ? system.repos : system.compose;
    if (into.some((known) => known.normal === normal)) {
      this.report('E103', path.span, path.text);
      return;
    }
    into.push({ path, normal });
  }

  /** `ignore drift <subject> - <reason>` (E810, E811, E812, E813, E814; LANG-758, LANG-759). */
  visitIgnore(statement: Statement, read: IgnoreRead): void {
    const words = read.subject;
    const first = words[0];
    const last = words.at(-1);
    if (read.what?.text !== 'drift' || first === undefined || last === undefined) {
      this.report('E810', this.lineSpan(statement));
      return;
    }
    const subjectText = words.map((word) => word.text).join(' ');
    const subjectSpan = this.span(statement, { start: first.start, end: last.end });
    const pair = words.length === 3 && words[1]?.text === 'to';
    if (words.length !== 1 && !pair) {
      this.report('E812', subjectSpan, subjectText);
      return;
    }
    const reason = read.reason === null ? '' : collapseSpaces(read.reason.text);
    if (read.reason === null || reason === '') {
      this.report('E811', this.endOfLine(statement), subjectText);
    }
    const end = (piece: Piece): EndB | null => {
      if (!piece.text.includes(':')) {
        return { element: { piece, statement } };
      }
      const unit = this.readUnit(statement, piece);
      return unit === null ? null : { unit };
    };
    let subject: IgnoreB['subject'] | null;
    if (pair) {
      const from = end(first);
      const to = end(last);
      subject = from === null || to === null ? null : { from, to };
      if (first.text === last.text) {
        this.report('E813', subjectSpan, subjectText, first.text);
        subject = null;
      }
    } else {
      subject = end(first);
    }
    const seen = this.ignored.get(subjectText);
    if (seen !== undefined) {
      this.report('E814', subjectSpan, subjectText, seen);
      return;
    }
    this.ignored.set(subjectText, statement.line);
    if (subject !== null) {
      // Pushed even without a reason, so its element ids are still checked (E008).
      const at = read.reason ?? {
        text: '',
        start: statement.raw.length,
        end: statement.raw.length,
      };
      this.ignores.push({
        statement,
        subject,
        subjectSpan,
        reason: this.located(statement, at, reason),
      });
    }
  }

  visitTitled(statement: Statement, read: TitleRead): void {
    const title = newWords();
    const about = newProse();
    const declared = this.readTitle(statement, read, title);
    const id = declared ?? read.id?.text ?? '';
    const valid = read.id !== null && isId(read.id.text) && !isKeyword(read.id.text);
    if (declared !== null && read.id !== null) {
      this.declarations.push({ id, line: statement.line, span: this.span(statement, read.id) });
    }
    const head = this.located(statement, read.head);
    const span = this.lineSpan(statement);
    const idSpan = read.id === null ? head.span : this.span(statement, read.id);
    const holder = owner(read.kind, { words: title, prose: about });
    if (read.kind === 'view') {
      this.views.push({
        id,
        span,
        idSpan,
        title,
        about,
        pendingShow: [],
        pendingKinds: [],
        show: [],
        kinds: [],
      });
    } else if (read.kind === 'scenario') {
      this.scenarios.push({
        id,
        valid,
        head,
        span,
        idSpan,
        title,
        about,
        steps: [],
        stepCount: 0,
      });
    } else {
      this.walkthroughs.push({ id, valid, head, span, idSpan, title, about, steps: [] });
    }
    this.visitChildren(statement, holder);
  }

  /** `show`, `kind`, `open`, `close` and `for` lines (E010, E014, E009, E013, E501). */
  visitLeaf(statement: Statement): void {
    const read = statement.read;
    if (read.kind === 'for') {
      if (read.value === null) {
        this.report('E010', this.span(statement, read.head), 'for');
      }
      return;
    }
    if (read.kind === 'kind' || read.kind === 'open' || read.kind === 'close') {
      if (read.list === null) {
        this.report('E010', this.span(statement, read.head), read.kind);
        return;
      }
      this.reportEmpties(statement, read.list);
      if (read.kind === 'kind') {
        const kinds = read.list.items.map((piece) => ({ piece, statement }));
        this.views.at(-1)?.pendingKinds.push(...kinds);
      }
      return;
    }
    if (read.kind !== 'show') {
      return;
    }
    if (read.items === null) {
      this.report('E010', this.span(statement, read.head), 'show');
      return;
    }
    for (const comma of read.empties) {
      this.report('E014', this.at(statement, comma));
    }
    const view = this.views.at(-1);
    for (const item of read.items) {
      const span = this.span(statement, item.piece);
      if (item.form === 'element') {
        const depth = item.depth === null ? 0 : Number(item.depth.text);
        const id = { piece: item.id, statement };
        view?.pendingShow.push({ form: 'element', id, depth, span });
        continue;
      }
      if (item.form === 'tag') {
        const group = item.group;
        const only = group.items[0];
        if (group.close === null) {
          this.report('E009', this.at(statement, group.open));
        } else if (group.items.length === 0) {
          this.report('E013', span);
        } else if (group.items.length === 1 && only !== undefined) {
          view?.pendingShow.push({ form: 'tag', tag: { piece: only, statement }, span });
        } else {
          this.report('E501', span, item.piece.text, this.showExample(item.piece.text));
        }
        continue;
      }
      this.report('E501', span, item.piece.text, this.showExample(item.piece.text));
    }
  }

  /** The `{id}` of E501: the item's leading id when it names an element, or the first element. */
  showExample(item: string): string {
    const lead = /^[a-z][a-z0-9-]*/.exec(item)?.[0];
    if (lead !== undefined && this.elementIds.has(lead)) {
      return lead;
    }
    return this.elementIds.values().next().value ?? 'web';
  }

  reportEmpties(statement: Statement, list: List): void {
    for (const comma of list.empties) {
      this.report('E014', this.at(statement, comma));
    }
  }

  /**
   * Splits a sentence into subject, verb phrase and objects (LANG-013), with E009, E402 and E014.
   * Returns null when it cannot be split.
   */
  splitSentence(
    statement: Statement,
    read: SentenceRead,
  ): { verb: Piece[]; objects: Piece[] } | null {
    if (read.unclosed !== null) {
      this.report('E009', this.at(statement, read.unclosed));
      return null;
    }
    const all = read.words;
    const objects: Piece[] = [];
    const last = all.at(-1);
    if (last !== undefined && all.length > 1) {
      objects.push(last);
    }
    let index = all.length - 2;
    for (; index >= 1; index--) {
      const word = all[index];
      if (!word?.text.endsWith(',')) {
        break;
      }
      objects.unshift({ text: word.text.slice(0, -1), start: word.start, end: word.end - 1 });
    }
    const verb = all.slice(1, index + 1);
    if (objects.length === 0 || verb.length === 0) {
      this.report('E402', this.lineSpan(statement));
      return null;
    }
    const empty = objects.filter((object) => object.text === '');
    for (const object of empty) {
      this.report('E014', this.at(statement, object.end));
    }
    return empty.length === 0 ? { verb, objects } : null;
  }

  /** The verb phrase of a sentence as words (LANG-011). */
  verbBase(statement: Statement, verb: Piece[]): Located | null {
    const first = verb[0];
    const last = verb.at(-1);
    if (first === undefined || last === undefined) {
      return null;
    }
    const text = decodeWords(verb.map((word) => word.text).join(' '));
    return { text, span: this.span(statement, { start: first.start, end: last.end }) };
  }

  /** A bracket group's span, from `[` to `]`. */
  groupSpan(statement: Statement, group: TagGroup): Span {
    return this.span(statement, { start: group.open, end: (group.close ?? group.open) + 1 });
  }

  visitRelationship(statement: Statement, read: SentenceRead): void {
    const verb = newWords();
    const about = newProse();
    const split = this.splitSentence(statement, read);
    let kind: Located = { text: 'runtime', span: this.lineSpan(statement) };
    let sound = split !== null;
    if (read.kind_ !== null) {
      const only = read.kind_.items[0];
      if (read.kind_.items.length !== 1 || only === undefined) {
        this.report('E406', this.groupSpan(statement, read.kind_), read.kind_.items.length);
        sound = false;
      } else if (!isId(only.text)) {
        this.report('E005', this.span(statement, only), only.text);
        sound = false;
      } else {
        kind = this.located(statement, only);
      }
    }
    if (split !== null) {
      verb.base = this.verbBase(statement, split.verb);
      if (sound) {
        this.relationships.push({
          statement,
          subject: read.head,
          verb,
          verbWords: split.verb,
          objects: split.objects,
          kind,
          about,
        });
      }
    }
    this.visitChildren(statement, owner('relationship', { words: verb, prose: about }));
  }

  visitStep(statement: Statement, read: SentenceRead): void {
    const scenario = this.scenarios.at(-1);
    const verb = newWords();
    const about = newProse();
    const split = this.splitSentence(statement, read);
    let sound = true;
    if (scenario !== undefined) {
      scenario.stepCount++;
    }
    if (read.kind_ !== null) {
      const close = read.kind_.close ?? statement.raw.length;
      const content = collapseSpaces(statement.raw.slice(read.kind_.open + 1, close));
      this.report('E603', this.groupSpan(statement, read.kind_), content);
      sound = false;
    }
    const second = split?.objects[1];
    if (split !== null && second !== undefined) {
      this.report('E602', this.span(statement, second), split.objects.length);
      sound = false;
    }
    const object = split?.objects.at(-1);
    if (split !== null && object !== undefined) {
      verb.base = this.verbBase(statement, split.verb);
      scenario?.steps.push({
        statement,
        subject: read.head,
        verb,
        verbWords: split.verb,
        object,
        about,
        sound,
      });
    }
    this.visitChildren(statement, owner('scenario-step', { words: verb, prose: about }));
  }

  visitWalkStep(statement: Statement, read: WalkStepRead): void {
    const about = newProse();
    const step: WalkStepB = { statement, read, open: [], close: [], audience: null, about };
    if (read.target === null) {
      this.report('E010', this.span(statement, read.head), 'step');
    } else if (read.colon !== null && read.after?.text === '') {
      const marker = { start: read.head.start, end: read.colon + 1 };
      this.report('E010', this.span(statement, marker), `step ${read.target.text}:`);
    } else if (read.list !== null) {
      this.reportEmpties(statement, read.list);
    }
    this.walkthroughs.at(-1)?.steps.push(step);
    const holder = owner('walk-step', { prose: about });
    for (const child of statement.children) {
      this.visit(child, holder, null);
      this.fillWalkStep(child, step);
    }
  }

  /** `open`, `close` and `for` lines fill in their step (E708). */
  fillWalkStep(statement: Statement, step: WalkStepB): void {
    const read = statement.read;
    if ((read.kind === 'open' || read.kind === 'close') && read.list !== null) {
      const into = read.kind === 'open' ? step.open : step.close;
      into.push(...read.list.items.map((piece) => ({ piece, statement })));
    } else if (read.kind === 'for' && read.value !== null) {
      if (step.audience !== null) {
        this.report('E708', this.span(statement, read.head), step.audience.span.line);
        return;
      }
      step.audience = this.located(statement, read.value);
      this.audienceRefs.push({ piece: read.value, statement });
    }
  }

  /** A paragraph: its first line and every continuation line, joined by spaces (LANG-010). */
  paragraph(statement: Statement, first: Piece): Located {
    const parts = [first.text, ...statement.continuations.map((line) => line.text.text)];
    const start = this.span(statement, first);
    const last = statement.continuations.at(-1);
    const end =
      last === undefined ? start : spanAt(last.raw, last.line, last.text.start, last.text.end);
    return { text: parts.join(' '), span: unionSpan(start, end) };
  }

  visitDescription(statement: Statement, holder: Owner): void {
    const read = statement.read;
    if (read.kind !== 'description' || holder.prose === null) {
      return;
    }
    if (read.head.text === '>>') {
      this.doubled.push({ text: read.text.text, span: this.span(statement, read.head) });
    } else if (read.text.text === '') {
      this.report('E010', this.span(statement, read.head), '>');
    } else {
      holder.prose.base.push(this.paragraph(statement, read.text));
    }
  }

  visitRewording(statement: Statement, read: RewordingRead, holder: Owner): void {
    if (read.form === ':') {
      this.leafChildren(statement, `@${read.audience.text}:`);
    }
    this.audienceRefs.push({ piece: read.audience, statement });
    const audience = read.audience.text;
    const marker = read.form === ':' ? `@${audience}:` : `@${audience} ${read.form}`;
    const markerSpan = this.span(statement, read.marker);
    if (read.form !== ':') {
      if (read.text.text === '') {
        this.report('E010', markerSpan, marker);
        return;
      }
      const into = read.form === '>' ? holder.prose?.set : holder.prose?.add;
      if (into !== undefined) {
        into.set(audience, [...(into.get(audience) ?? []), this.paragraph(statement, read.text)]);
      }
      return;
    }
    const at = this.at(statement, read.head.start);
    if (holder.kind === 'walk-step') {
      this.report('E303', at, { rule: 'walk-step', audience });
      return;
    }
    const isElement = holder.kind === 'element';
    if (!isElement && read.bar !== null) {
      const reworded = holder.kind === 'relationship' || holder.kind === 'scenario-step';
      this.report('E303', at, { rule: 'bar', audience, what: reworded ? 'verb phrase' : 'title' });
      return;
    }
    const raw = statement.raw;
    const text = read.text;
    const bar = isElement ? read.bar : null;
    const head = bar === null ? text : trimmed(raw, text.start, bar);
    const tail = bar === null ? null : trimmed(raw, bar + 1, text.end);
    const name = decodeWords(head.text);
    const tagline = tail === null ? '' : decodeWords(tail.text);
    if (name === '' && tagline === '') {
      this.report('E010', markerSpan, marker);
      return;
    }
    const first = holder.reworded.get(audience);
    if (first !== undefined) {
      this.report('E302', at, audience, first);
      return;
    }
    holder.reworded.set(audience, statement.line);
    if (name !== '') {
      holder.words?.set.set(audience, this.located(statement, head, name));
    }
    if (tail !== null && tagline !== '') {
      holder.tagline?.set.set(audience, this.located(statement, tail, tagline));
    }
  }

  // ------------------------------------------------ pass 2: cross-references

  get audiences(): readonly Audience[] {
    return this.declaredAudiences ?? DEFAULT_AUDIENCES;
  }

  get defaultAudience(): string {
    if (this.declaredAudiences === null) {
      return DEFAULT_AUDIENCE;
    }
    return this.declaredDefault ?? this.declaredAudiences[0]?.id ?? DEFAULT_AUDIENCE;
  }

  /** E007: each id once across elements, views, scenarios and walkthroughs. */
  checkDuplicates(): void {
    const first = new Map<string, Declaration>();
    for (const declaration of this.declarations) {
      const seen = first.get(declaration.id);
      if (seen === undefined) {
        first.set(declaration.id, declaration);
      } else {
        this.report('E007', declaration.span, declaration.id, seen.line);
      }
    }
  }

  /** E301 for rewordings and `for` lines, and E304 for `>>` lines without an audience. */
  checkAudienceRefs(): void {
    const ids = this.audiences.map((audience) => audience.id);
    for (const reference of this.audienceRefs) {
      const id = reference.piece.text;
      if (!ids.includes(id)) {
        this.report('E301', this.placed(reference), id, suggestion(id, ids), codeList(ids));
      }
    }
    const last = ids.at(-1) ?? 'engineer';
    for (const { text, span } of this.doubled) {
      this.report('E304', span, last, text);
    }
  }

  /** E008 for a word that should name an element; true when it does. */
  checkElement(place: Placed): boolean {
    const id = place.piece.text;
    if (this.elementIds.has(id)) {
      return true;
    }
    this.report('E008', this.placed(place), id, suggestion(id, this.elementIds));
    return false;
  }

  /**
   * The last word of a sentence: E008 when it is spelled like an id and no element is named in
   * the verb phrase, E401 otherwise (LANG-402).
   */
  checkObject(statement: Statement, object: Piece, verb: Piece[]): boolean {
    if (this.elementIds.has(object.text)) {
      return true;
    }
    const moved = verb
      .map((word) => word.text.replace(/,$/, ''))
      .find((word) => this.elementIds.has(word));
    if (moved === undefined && isId(object.text)) {
      return this.checkElement({ piece: object, statement });
    }
    const hint = suggestion(object.text, this.elementIds);
    const movedText =
      moved === undefined
        ? ''
        : ` If you meant \`${moved}\`, reword the line so \`${moved}\` comes last.`;
    this.report('E401', this.span(statement, object), object.text, hint, movedText);
    return false;
  }

  parents(): Map<string, string | null> {
    return new Map(this.elements.map((element) => [element.id, element.parent]));
  }

  /** True when `inner` is nested anywhere inside `outer`. */
  isInside(inner: string, outer: string, parents: Map<string, string | null>): boolean {
    const seen = new Set<string>();
    for (
      let at = parents.get(inner) ?? null;
      at !== null && !seen.has(at);
      at = parents.get(at) ?? null
    ) {
      if (at === outer) {
        return true;
      }
      seen.add(at);
    }
    return false;
  }

  /** E008, E401, E403, E404 and E405; returns the relationships with no errors. */
  checkRelationships(): RelationshipB[] {
    const parents = this.parents();
    const sound: RelationshipB[] = [];
    const declared = new Map<string, number>();
    for (const relationship of this.relationships) {
      const { statement, subject, objects } = relationship;
      let known = this.checkElement({ piece: subject, statement });
      objects.forEach((object, index) => {
        const ok =
          index === objects.length - 1
            ? this.checkObject(statement, object, relationship.verbWords)
            : this.checkElement({ piece: object, statement });
        known = known && ok;
      });
      if (!known) {
        continue;
      }
      const line = this.lineSpan(statement);
      let clean = true;
      for (const object of objects) {
        if (object.text === subject.text) {
          this.report('E403', line, subject.text);
        } else if (this.isInside(object.text, subject.text, parents)) {
          this.report('E404', line, object.text, subject.text);
        } else if (this.isInside(subject.text, object.text, parents)) {
          this.report('E404', line, subject.text, object.text);
        } else {
          const verb = relationship.verb.base?.text ?? '';
          const key = [subject.text, verb, object.text, relationship.kind.text].join('\n');
          const first = declared.get(key);
          if (first === undefined) {
            declared.set(key, statement.line);
            continue;
          }
          this.report('E405', line, first);
        }
        clean = false;
      }
      if (clean) {
        sound.push(relationship);
      }
    }
    return sound;
  }

  /** E008, E502 and E503 for what views show and draw. */
  checkViews(): void {
    const tags: string[] = [];
    for (const element of this.elements) {
      for (const tag of element.tags) {
        if (!tags.includes(tag.text)) tags.push(tag.text);
      }
    }
    const kinds = ['runtime'];
    for (const relationship of this.relationships) {
      if (!kinds.includes(relationship.kind.text)) kinds.push(relationship.kind.text);
    }
    for (const view of this.views) {
      for (const item of view.pendingShow) {
        if (item.form === 'element') {
          if (this.checkElement(item.id)) {
            view.show.push({
              item: { element: item.id.piece.text, depth: item.depth },
              span: item.span,
            });
          }
          continue;
        }
        const tag = item.tag.piece.text;
        if (tags.includes(tag)) {
          view.show.push({ item: { tag }, span: item.span });
        } else {
          this.report('E502', this.placed(item.tag), tag, suggestion(tag, tags));
        }
      }
      for (const place of view.pendingKinds) {
        const kind = place.piece.text;
        if (!kinds.includes(kind)) {
          this.report('E503', this.placed(place), kind, suggestion(kind, kinds));
        } else if (!view.kinds.some((known) => known.text === kind)) {
          view.kinds.push({ text: kind, span: this.placed(place) });
        }
      }
    }
  }

  /** E805: with `repo` lines, every Compose file is inside one of the repos (LANG-754). */
  checkSystem(): void {
    const system = this.system;
    if (system === null || system.repos.length === 0) {
      return;
    }
    for (const file of system.compose) {
      if (!system.repos.some((repo) => isInside(file.normal, repo.normal))) {
        this.report('E805', file.path.span, file.path.text);
      }
    }
  }

  /** E008 for the element ids an ignore line names (LANG-759). */
  checkIgnores(): void {
    for (const ignore of this.ignores) {
      const subject = ignore.subject;
      for (const end of 'from' in subject ? [subject.from, subject.to] : [subject]) {
        if ('element' in end) {
          this.checkElement(end.element);
        }
      }
    }
  }

  /** E601, E008, E401 and W601 for scenario steps. */
  checkScenarios(relationships: RelationshipB[]): void {
    const joined = new Set<string>();
    for (const relationship of relationships) {
      for (const object of relationship.objects) {
        joined.add(`${relationship.subject.text}\n${object.text}`);
        joined.add(`${object.text}\n${relationship.subject.text}`);
      }
    }
    const [first, second] = this.elementIds;
    const example =
      first !== undefined && second !== undefined ? `${first} uses ${second}` : 'web calls api';
    for (const scenario of this.scenarios) {
      if (scenario.stepCount === 0 && scenario.valid) {
        this.report('E601', scenario.head.span, scenario.id, example);
      }
      for (const step of scenario.steps) {
        const { statement } = step;
        const subjectOk = this.checkElement({ piece: step.subject, statement });
        const objectOk = this.checkObject(statement, step.object, step.verbWords);
        if (!subjectOk || !objectOk || !step.sound) {
          continue;
        }
        if (!joined.has(`${step.subject.text}\n${step.object.text}`)) {
          const verb = step.verb.base?.text ?? '';
          this.report('W601', this.lineSpan(statement), step.subject.text, step.object.text, verb);
        }
      }
    }
  }

  /** E701, E702, E704 to E707 and E008 for walkthrough steps. */
  checkWalkthroughs(): void {
    const views = new Set(this.views.map((view) => view.id));
    const scenarios = new Map(this.scenarios.map((scenario) => [scenario.id, scenario]));
    const targets = this.declarations
      .map((declaration) => declaration.id)
      .filter((id) => views.has(id) || scenarios.has(id));
    const containers = new Set(this.elements.map((element) => element.parent));
    for (const walkthrough of this.walkthroughs) {
      if (walkthrough.steps.length === 0 && walkthrough.valid) {
        const view = this.views[0]?.id ?? 'overview';
        this.report('E701', walkthrough.head.span, walkthrough.id, view);
      }
      for (const step of walkthrough.steps) {
        if (step.read.target !== null) {
          this.checkTarget(step, step.read.target, views, scenarios, targets);
        }
        for (const place of [...step.open, ...step.close]) {
          if (this.checkElement(place) && !containers.has(place.piece.text)) {
            this.report('E707', this.placed(place), place.piece.text);
          }
        }
      }
    }
  }

  checkTarget(
    step: WalkStepB,
    target: Piece,
    views: Set<string>,
    scenarios: Map<string, ScenarioB>,
    targets: string[],
  ): void {
    const { statement, read } = step;
    const range = read.range;
    const rangeSpan =
      range === null
        ? null
        : this.span(statement, { start: range.from.start, end: (range.to ?? range.from).end });
    if (views.has(target.text)) {
      if (rangeSpan !== null) {
        this.report('E704', rangeSpan, target.text);
      }
      for (const piece of read.list?.items ?? []) {
        this.checkElement({ piece, statement });
      }
      return;
    }
    const scenario = scenarios.get(target.text);
    if (scenario === undefined) {
      this.report(
        'E702',
        this.span(statement, target),
        target.text,
        suggestion(target.text, targets),
      );
      return;
    }
    const firstId = read.list?.items[0];
    if (firstId !== undefined) {
      this.report('E705', this.span(statement, firstId), target.text);
    }
    if (range !== null && rangeSpan !== null && scenario.stepCount > 0) {
      const from = Number(range.from.text);
      const to = range.to === null ? from : Number(range.to.text);
      if (from < 1 || to > scenario.stepCount || from > to) {
        const written = range.to === null ? String(from) : `${String(from)}-${String(to)}`;
        this.report('E706', rangeSpan, target.text, scenario.stepCount, written);
      }
    }
  }

  // ------------------------------------------------------------- the model

  run(source: string): ParseResult {
    const document = readDocument(source);
    this.diagnostics.push(...document.diagnostics);
    this.collectElementIds(document.top);
    const root = owner('root');
    for (const statement of document.top) {
      this.visit(statement, root, null);
    }
    this.checkDuplicates();
    this.checkAudienceRefs();
    const relationships = this.checkRelationships();
    this.checkViews();
    this.checkScenarios(relationships);
    this.checkWalkthroughs();
    this.checkSystem();
    this.checkIgnores();
    if (this.elements.length === 0) {
      this.report('W001', { line: 1, column: 1, endLine: 1, endColumn: 1 });
    }
    const diagnostics = sortDiagnostics(this.diagnostics);
    if (diagnostics.some((found) => found.severity === 'error')) {
      return { model: null, diagnostics, sourceMap: {} };
    }
    const sourceMap: Record<string, Span> = {};
    return { model: new ModelWriter(this, sourceMap).model(), diagnostics, sourceMap };
  }
}

/** Writes the canonical model from a parser with no errors, in the key order of LANG-801. */
class ModelWriter {
  readonly parser: Parser;
  readonly map: Record<string, Span>;
  readonly order: string[];

  constructor(parser: Parser, map: Record<string, Span>) {
    this.parser = parser;
    this.map = map;
    this.order = parser.audiences.map((audience) => audience.id);
  }

  put(pointer: string, span: Span | null | undefined): void {
    if (span !== null && span !== undefined) {
      this.map[pointer] = span;
    }
  }

  words(pointer: string, value: WordsB): Words {
    this.put(pointer, value.base?.span);
    const set: Record<string, string> = {};
    for (const id of this.order) {
      const entry = value.set.get(id);
      if (entry !== undefined) {
        set[id] = entry.text;
        this.put(`${pointer}/set/${id}`, entry.span);
      }
    }
    return { base: value.base?.text ?? null, set };
  }

  paragraphs(pointer: string, list: Located[] | undefined): string | null {
    const first = list?.[0];
    const last = list?.at(-1);
    if (list === undefined || first === undefined || last === undefined) {
      return null;
    }
    this.put(pointer, unionSpan(first.span, last.span));
    return list.map((entry) => entry.text).join('\n\n');
  }

  prose(pointer: string, value: ProseB): Prose {
    const base = this.paragraphs(pointer, value.base);
    const set: Record<string, string> = {};
    const add: Record<string, string> = {};
    for (const id of this.order) {
      const replaced = this.paragraphs(`${pointer}/set/${id}`, value.set.get(id));
      if (replaced !== null) set[id] = replaced;
    }
    for (const id of this.order) {
      const added = this.paragraphs(`${pointer}/add/${id}`, value.add.get(id));
      if (added !== null) add[id] = added;
    }
    return { base, set, add };
  }

  model(): Model {
    const parser = this.parser;
    const line = parser.modelLine;
    if (line !== null) {
      this.put('/id', line.read.id === null ? null : parser.span(line.statement, line.read.id));
    }
    const title = this.words('/title', parser.modelTitle);
    const about = this.prose('/about', parser.modelAbout);
    const audiencesLine = parser.audiencesLine;
    audiencesLine?.read.entries?.forEach((entry, index) => {
      this.put(`/audiences/${String(index)}`, parser.span(audiencesLine.statement, entry.piece));
    });
    return {
      format: 'aerie-model/1',
      id: line?.id ?? null,
      title,
      about,
      audiences: parser.audiences.map((audience) => ({ ...audience })),
      defaultAudience: parser.defaultAudience,
      system: this.system(),
      elements: parser.elements.map((element, index) => this.element(element, index)),
      relationships: this.relationships(),
      views: parser.views.map((view, index) => this.view(view, index)),
      scenarios: parser.scenarios.map((scenario, index) => this.scenario(scenario, index)),
      walkthroughs: parser.walkthroughs.map((walkthrough, index) =>
        this.walkthrough(walkthrough, index),
      ),
      ignores: parser.ignores.map((ignore, index) => this.ignore(ignore, index)),
    };
  }

  system(): System | null {
    const system = this.parser.system;
    if (system === null) {
      return null;
    }
    this.put('/system', system.span);
    const paths = (list: PathB[], name: string): string[] =>
      list.map((entry, index) => {
        this.put(`/system/${name}/${String(index)}`, entry.path.span);
        return entry.path.text;
      });
    return { repos: paths(system.repos, 'repos'), compose: paths(system.compose, 'compose') };
  }

  ignore(ignore: IgnoreB, index: number): Ignore {
    const at = `/ignores/${String(index)}`;
    this.put(at, this.parser.lineSpan(ignore.statement));
    this.put(`${at}/subject`, ignore.subjectSpan);
    this.put(`${at}/reason`, ignore.reason.span);
    const end = (value: EndB): DriftEnd =>
      'unit' in value ? { unit: { ...value.unit } } : { element: value.element.piece.text };
    const subject = ignore.subject;
    const written: DriftSubject =
      'from' in subject ? { from: end(subject.from), to: end(subject.to) } : end(subject);
    return { subject: written, reason: ignore.reason.text };
  }

  element(element: ElementB, index: number): Element {
    const at = `/elements/${String(index)}`;
    this.put(at, element.span);
    this.put(`${at}/id`, element.idSpan);
    this.put(`${at}/tags`, element.tagsSpan);
    this.put(`${at}/icon`, element.icon?.span);
    element.code.forEach((entry, j) => {
      this.put(`${at}/code/${String(j)}`, entry.span);
    });
    return {
      id: element.id,
      parent: element.parent,
      name: this.words(`${at}/name`, element.name),
      tagline: this.words(`${at}/tagline`, element.tagline),
      tags: element.tags.map((tag) => tag.text),
      icon: element.icon?.text ?? null,
      code: element.code.map((entry) => ({ ...entry.unit })),
      about: this.prose(`${at}/about`, element.about),
    };
  }

  relationships(): Relationship[] {
    const out: Relationship[] = [];
    for (const relationship of this.parser.relationships) {
      const statement = relationship.statement;
      for (const object of relationship.objects) {
        const at = `/relationships/${String(out.length)}`;
        this.put(at, this.parser.lineSpan(statement));
        this.put(`${at}/subject`, this.parser.span(statement, relationship.subject));
        this.put(`${at}/object`, this.parser.span(statement, object));
        this.put(`${at}/kind`, relationship.kind.span);
        out.push({
          subject: relationship.subject.text,
          verb: this.words(`${at}/verb`, relationship.verb),
          object: object.text,
          kind: relationship.kind.text,
          about: this.prose(`${at}/about`, relationship.about),
        });
      }
    }
    return out;
  }

  view(view: ViewB, index: number): View {
    const at = `/views/${String(index)}`;
    this.put(at, view.span);
    this.put(`${at}/id`, view.idSpan);
    view.show.forEach((item, j) => {
      this.put(`${at}/show/${String(j)}`, item.span);
    });
    view.kinds.forEach((kind, j) => {
      this.put(`${at}/kinds/${String(j)}`, kind.span);
    });
    return {
      id: view.id,
      title: this.words(`${at}/title`, view.title),
      about: this.prose(`${at}/about`, view.about),
      show: view.show.map((item) => item.item),
      kinds: view.kinds.length === 0 ? ['runtime'] : view.kinds.map((kind) => kind.text),
    };
  }

  scenario(scenario: ScenarioB, index: number): Scenario {
    const at = `/scenarios/${String(index)}`;
    this.put(at, scenario.span);
    this.put(`${at}/id`, scenario.idSpan);
    return {
      id: scenario.id,
      title: this.words(`${at}/title`, scenario.title),
      about: this.prose(`${at}/about`, scenario.about),
      steps: scenario.steps.map((step, j): Step => {
        const stepAt = `${at}/steps/${String(j)}`;
        this.put(stepAt, this.parser.lineSpan(step.statement));
        this.put(`${stepAt}/subject`, this.parser.span(step.statement, step.subject));
        this.put(`${stepAt}/object`, this.parser.span(step.statement, step.object));
        return {
          subject: step.subject.text,
          verb: this.words(`${stepAt}/verb`, step.verb),
          object: step.object.text,
          about: this.prose(`${stepAt}/about`, step.about),
        };
      }),
    };
  }

  walkthrough(walkthrough: WalkthroughB, index: number): Walkthrough {
    const at = `/walkthroughs/${String(index)}`;
    this.put(at, walkthrough.span);
    this.put(`${at}/id`, walkthrough.idSpan);
    return {
      id: walkthrough.id,
      title: this.words(`${at}/title`, walkthrough.title),
      about: this.prose(`${at}/about`, walkthrough.about),
      steps: walkthrough.steps.map((step, j) => this.walkStep(`${at}/steps/${String(j)}`, step)),
    };
  }

  walkStep(at: string, step: WalkStepB): WalkStep {
    const parser = this.parser;
    const { statement, read } = step;
    this.put(at, parser.lineSpan(statement));
    this.put(`${at}/target`, read.target === null ? null : parser.span(statement, read.target));
    const focus = read.list?.items ?? [];
    focus.forEach((piece, k) => {
      this.put(`${at}/focus/${String(k)}`, parser.span(statement, piece));
    });
    let range: WalkStep['range'] = null;
    if (read.range !== null) {
      const from = Number(read.range.from.text);
      const to = read.range.to === null ? from : Number(read.range.to.text);
      range = { from, to };
      const end = (read.range.to ?? read.range.from).end;
      this.put(`${at}/range`, parser.span(statement, { start: read.range.from.start, end }));
    }
    const ids = (list: Placed[], name: string): string[] =>
      list.map((place, k) => {
        this.put(`${at}/${name}/${String(k)}`, parser.placed(place));
        return place.piece.text;
      });
    this.put(`${at}/audience`, step.audience?.span);
    return {
      target: read.target?.text ?? '',
      focus: focus.map((piece) => piece.text),
      range,
      open: ids(step.open, 'open'),
      close: ids(step.close, 'close'),
      audience: step.audience?.text ?? null,
      about: this.prose(`${at}/about`, step.about),
    };
  }
}

/** Parses a Lines file into its canonical model and diagnostics. */
export function parse(source: string): ParseResult {
  return new Parser().run(source);
}
