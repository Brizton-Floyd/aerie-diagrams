// What a canonical model means, computed once per model: lookups, wording per audience, drawings
// per view and zoom state, scenarios and walkthroughs (docs/spec/model.md). Pure computation over
// the model, with no layout or drawing.
import type { Audience, IconName, Id, Model, Scenario, View, Walkthrough } from '../lines/index.ts';
import { drawnEdges, type DrawnEdge } from './lift.ts';
import { Joins, stageView, trail, type StepRole, type Trail } from './scenarios.ts';
import { InvalidModelError, Tree } from './tree.ts';
import {
  DEFAULT_ZOOM,
  OVERVIEW,
  ViewScope,
  type DrawnSet,
  type DrawnState,
  type Zoom,
} from './views.ts';
import { proseFor, sentence, wordsFor } from './words.ts';

/** One drawn element, as every audience sees it: nothing here depends on wording. */
export interface DrawnNode {
  id: Id;
  /** The parent, which is always drawn too; null for a top-level element. */
  parent: Id | null;
  /** MODEL-002: the number of ancestors. */
  depth: number;
  /** MODEL-003: placed on the outer edge of the picture. */
  rim: boolean;
  /** MODEL-004. */
  icon: IconName;
  /** MODEL-203: a leaf box, an open container or a closed container. */
  state: DrawnState;
  /** MODEL-203: an open container that draws only some of its children. */
  partly: boolean;
  /** How many children the element holds, drawn or not; a closed box says this number. */
  inside: number;
}

/**
 * What one view draws at one zoom state. It is the same for every audience, so switching audience
 * moves nothing (RULE-005); wording comes from `Semantics.scene`.
 */
export interface Drawing {
  view: Id;
  /** MODEL-210: the relationship kinds the view draws. */
  kinds: Id[];
  /** The normalised zoom state (MODEL-208). */
  zoom: Zoom;
  /** Drawn elements in model order, parents before children. */
  nodes: DrawnNode[];
  /** Drawn edges in the order of MODEL-303. */
  edges: DrawnEdge[];
}

/** A drawn element with its wording for one audience. */
export interface SceneNode extends DrawnNode {
  name: string;
  /** Null when the audience reads no tagline. */
  tagline: string | null;
  /** MODEL-005: the kicker of the side panel. */
  kindLabel: string;
  /** The description (MODEL-102), shown in the side panel; null when empty. */
  about: string | null;
}

/** MODEL-305: a relationship an edge carries, read with its own subject and object. */
export interface CarriedRelationship {
  /** Index into the model's `relationships`. */
  index: number;
  subject: Id;
  object: Id;
  kind: Id;
  verb: string;
  /** MODEL-104, for the side panel and the label's hover text. */
  sentence: string;
  about: string | null;
}

/** A drawn edge with its wording for one audience. */
export interface SceneEdge extends DrawnEdge {
  /** MODEL-304: the first relationship's verb phrase, then " (+N more)" when it carries more. */
  label: string;
  relationships: CarriedRelationship[];
}

/** A drawing worded for one audience: everything a renderer needs to draw a view. */
export interface Scene {
  view: Id;
  /** The audience, with its `code` flag (MODEL-105): taglines, verb phrases, descriptions and captions in the monospace face; names never. */
  audience: Audience;
  /** The view's title for the audience. */
  title: string;
  about: string | null;
  zoom: Zoom;
  nodes: SceneNode[];
  edges: SceneEdge[];
}

/** A scenario step worded for one audience. */
export interface ResolvedStep {
  /** From 1, in written order (LANG-604). */
  number: number;
  subject: Id;
  object: Id;
  /** MODEL-401. */
  role: StepRole;
  /** MODEL-402: false when no relationship joins the two elements (W601). */
  backed: boolean;
  verb: string;
  /** MODEL-104. */
  sentence: string;
  /** The step's description, or null. */
  about: string | null;
  /** INT-603: the description or, when there is none, the sentence. */
  caption: string;
}

/** The picture of one walkthrough step (MODEL-501 to MODEL-503). */
export interface WalkPicture {
  view: Id;
  zoom: Zoom;
  /** MODEL-502: the elements the step highlights; empty for a scenario step. */
  focus: Id[];
  /** MODEL-503: the scenario the step plays and its range, or null for a view step. */
  scenario: { id: Id; from: number; to: number } | null;
  /** MODEL-505: the audience the step switches to with `for`, or null to keep the current one. */
  audience: Id | null;
}

/** The meaning of one canonical model. Build it once with `new Semantics(model)` and share it. */
export class Semantics {
  readonly model: Model;
  readonly tree: Tree;
  /** The model's views, or the implicit `overview` when it declares none (LANG-506). */
  readonly views: readonly View[];
  readonly joins: Joins;
  private readonly scopes = new Map<Id, ViewScope>();
  private readonly scenarioById = new Map<Id, Scenario>();
  private readonly walkthroughById = new Map<Id, Walkthrough>();
  private readonly walkPicturesById = new Map<Id, WalkPicture[]>();

  constructor(model: Model) {
    this.model = model;
    this.tree = new Tree(model);
    this.views = model.views.length > 0 ? model.views : [OVERVIEW];
    for (const view of this.views) this.scopes.set(view.id, new ViewScope(this.tree, view));
    for (const scenario of model.scenarios) this.scenarioById.set(scenario.id, scenario);
    for (const walkthrough of model.walkthroughs) {
      this.walkthroughById.set(walkthrough.id, walkthrough);
    }
    this.joins = new Joins(model.relationships);
    this.validate();
  }

  // ------------------------------------------------------------ lookups

  hasView(id: Id): boolean {
    return this.scopes.has(id);
  }

  /** The first view, the one a reader sees first (LANG-501). */
  get firstView(): Id {
    return this.views[0]?.id ?? OVERVIEW.id;
  }

  /** The selection, default drawn set and zoom operations of a view. */
  scope(view: Id): ViewScope {
    const scope = this.scopes.get(view);
    if (scope === undefined) throw new InvalidModelError(`There is no view ${view}.`);
    return scope;
  }

  hasAudience(id: Id): boolean {
    return this.model.audiences.some((audience) => audience.id === id);
  }

  audience(id: Id): Audience {
    const audience = this.model.audiences.find((each) => each.id === id);
    if (audience === undefined) throw new InvalidModelError(`There is no audience ${id}.`);
    return audience;
  }

  scenario(id: Id): Scenario {
    const scenario = this.scenarioById.get(id);
    if (scenario === undefined) throw new InvalidModelError(`There is no scenario ${id}.`);
    return scenario;
  }

  hasScenario(id: Id): boolean {
    return this.scenarioById.has(id);
  }

  walkthrough(id: Id): Walkthrough {
    const walkthrough = this.walkthroughById.get(id);
    if (walkthrough === undefined) throw new InvalidModelError(`There is no walkthrough ${id}.`);
    return walkthrough;
  }

  hasWalkthrough(id: Id): boolean {
    return this.walkthroughById.has(id);
  }

  // ------------------------------------------------------------ wording

  /** The model's title for an audience; null when the file has no model line (LANG-101). */
  title(audience: Id): string | null {
    return wordsFor(this.model.title, audience);
  }

  name(element: Id, audience: Id): string {
    return wordsFor(this.tree.get(element).name, audience) ?? element;
  }

  tagline(element: Id, audience: Id): string | null {
    return wordsFor(this.tree.get(element).tagline, audience);
  }

  about(element: Id, audience: Id): string | null {
    return proseFor(this.tree.get(element).about, audience);
  }

  /** MODEL-005, with the parent's name in the audience's wording. */
  kindLabel(element: Id, audience: Id): string {
    const parent = this.tree.parent(element);
    return this.tree.kindLabel(element, parent === null ? null : this.name(parent, audience));
  }

  viewTitle(view: Id, audience: Id): string {
    return wordsFor(this.scope(view).view.title, audience) ?? view;
  }

  verb(relationship: number, audience: Id): string {
    const found = this.model.relationships[relationship];
    if (found === undefined)
      throw new InvalidModelError(`There is no relationship ${String(relationship)}.`);
    return wordsFor(found.verb, audience) ?? '';
  }

  /** MODEL-104: "Website gets screen data from Screen API." */
  sentence(relationship: number, audience: Id): string {
    const found = this.model.relationships[relationship];
    if (found === undefined)
      throw new InvalidModelError(`There is no relationship ${String(relationship)}.`);
    return sentence(
      this.name(found.subject, audience),
      this.verb(relationship, audience),
      this.name(found.object, audience),
    );
  }

  // ------------------------------------------------------------ views

  /** MODEL-205: the drawn set of a view at a zoom state. */
  drawn(view: Id, zoom: Zoom = DEFAULT_ZOOM): DrawnSet {
    return this.scope(view).drawn(zoom);
  }

  /** What a view draws at a zoom state, the same for every audience. The zoom state is normalised. */
  drawing(view: Id, zoom: Zoom = DEFAULT_ZOOM): Drawing {
    const scope = this.scope(view);
    const normal = scope.normalise(zoom);
    const drawn = scope.drawn(normal);
    const tree = this.tree;
    const nodes = [...drawn].map((id): DrawnNode => ({
      id,
      parent: tree.parent(id),
      depth: tree.depth(id),
      rim: tree.isRim(id),
      icon: tree.icon(id),
      state: scope.state(drawn, id),
      partly: scope.partly(drawn, id),
      inside: tree.children(id).length,
    }));
    const kinds = [...scope.view.kinds];
    return {
      view,
      kinds,
      zoom: normal,
      nodes,
      edges: drawnEdges(tree, this.model.relationships, kinds, drawn),
    };
  }

  /** MODEL-304: the edge's label for an audience. */
  label(edge: DrawnEdge, audience: Id): string {
    const [first] = edge.carries;
    if (first === undefined) return '';
    const more = edge.carries.length - 1;
    const verb = this.verb(first, audience);
    return more > 0 ? `${verb} (+${String(more)} more)` : verb;
  }

  /** A drawing worded for one audience (MODEL-101 to MODEL-105, MODEL-304, MODEL-305). */
  scene(drawing: Drawing, audience: Id): Scene {
    const scope = this.scope(drawing.view);
    return {
      view: drawing.view,
      audience: this.audience(audience),
      title: this.viewTitle(drawing.view, audience),
      about: proseFor(scope.view.about, audience),
      zoom: drawing.zoom,
      nodes: drawing.nodes.map((node) => ({
        ...node,
        name: this.name(node.id, audience),
        tagline: this.tagline(node.id, audience),
        kindLabel: this.kindLabel(node.id, audience),
        about: this.about(node.id, audience),
      })),
      edges: drawing.edges.map((edge) => ({
        ...edge,
        label: this.label(edge, audience),
        relationships: edge.carries.map((index) => this.carried(index, audience)),
      })),
    };
  }

  private carried(index: number, audience: Id): CarriedRelationship {
    const relationship = this.model.relationships[index];
    if (relationship === undefined)
      throw new InvalidModelError(`There is no relationship ${String(index)}.`);
    return {
      index,
      subject: relationship.subject,
      object: relationship.object,
      kind: relationship.kind,
      verb: this.verb(index, audience),
      sentence: this.sentence(index, audience),
      about: proseFor(relationship.about, audience),
    };
  }

  // ------------------------------------------------------------ scenarios

  /**
   * MODEL-404: the view a scenario plays on when the reader is on `current`: `current` itself if it
   * gives every participant a lift, else the first view that does. Null only for a scenario no view
   * can hold (E604).
   */
  stage(scenario: Id, current: Id | null): Id | null {
    const scope = current === null ? null : this.scope(current);
    return stageView([...this.scopes.values()], scope, this.scenario(scenario))?.view.id ?? null;
  }

  /** A scenario's steps worded for one audience (MODEL-104, MODEL-401, MODEL-402). */
  steps(scenario: Id, audience: Id): ResolvedStep[] {
    return this.scenario(scenario).steps.map((step, index) => {
      const verb = wordsFor(step.verb, audience) ?? '';
      const said = sentence(
        this.name(step.subject, audience),
        verb,
        this.name(step.object, audience),
      );
      const about = proseFor(step.about, audience);
      return {
        number: index + 1,
        subject: step.subject,
        object: step.object,
        role: this.joins.role(step.subject, step.object),
        backed: this.joins.backs(step.subject, step.object),
        verb,
        sentence: said,
        about,
        caption: about ?? said,
      };
    });
  }

  /** MODEL-405 and MODEL-406: steps 1 to `step` drawn on a view at a zoom state. */
  trail(scenario: Id, view: Id, zoom: Zoom, step: number): Trail {
    return trail(this.tree, this.joins, this.drawn(view, zoom), this.scenario(scenario), step);
  }

  // ------------------------------------------------------------ walkthroughs

  /**
   * MODEL-501 to MODEL-503: the picture of every step of a walkthrough, in order. Step `k`'s picture
   * is the result of applying steps 1 to `k` from the first view with an empty zoom state.
   */
  walkPictures(walkthrough: Id): readonly WalkPicture[] {
    const cached = this.walkPicturesById.get(walkthrough);
    if (cached !== undefined) return cached;
    const pictures: WalkPicture[] = [];
    let view = this.firstView;
    let zoom: Zoom = DEFAULT_ZOOM;
    for (const step of this.walkthrough(walkthrough).steps) {
      let scenario: WalkPicture['scenario'] = null;
      if (this.hasView(step.target)) {
        if (step.target !== view) {
          view = step.target;
          zoom = DEFAULT_ZOOM;
        }
      } else {
        const stage = this.stage(step.target, view) ?? view;
        if (stage !== view) {
          view = stage;
          zoom = DEFAULT_ZOOM;
        }
        const count = this.scenario(step.target).steps.length;
        scenario = { id: step.target, ...(step.range ?? { from: 1, to: count }) };
      }
      const scope = this.scope(view);
      for (const id of this.tree.sort([...step.close])) zoom = scope.close(zoom, id);
      for (const id of this.tree.sort([...step.open])) zoom = scope.open(zoom, id);
      pictures.push({
        view,
        zoom,
        focus: scenario === null ? [...step.focus] : [],
        scenario,
        audience: step.audience,
      });
    }
    this.walkPicturesById.set(walkthrough, pictures);
    return pictures;
  }

  /** MODEL-506: a step's narration, its description for the audience; null when it has none. */
  narration(walkthrough: Id, step: number, audience: Id): string | null {
    const found = this.walkthrough(walkthrough).steps[step - 1];
    return found === undefined ? null : proseFor(found.about, audience);
  }

  // ------------------------------------------------------------ checks

  /**
   * Checks the references the parser guarantees, so every lookup above can trust the model. A model
   * built by hand or by another tool that breaks one is not a canonical model.
   */
  private validate(): void {
    const model = this.model;
    const fail = (why: string): never => {
      throw new InvalidModelError(why);
    };
    const audiences = new Set(model.audiences.map((audience) => audience.id));
    if (audiences.size !== model.audiences.length || audiences.size === 0) {
      fail('The audiences must be 1 to 6 different ids.');
    }
    if (!audiences.has(model.defaultAudience)) fail('The default audience is not an audience.');
    const element = (id: Id): void => {
      if (!this.tree.has(id)) fail(`There is no element ${id}.`);
    };
    for (const relationship of model.relationships) {
      element(relationship.subject);
      element(relationship.object);
    }
    for (const view of model.views) {
      for (const item of view.show) if ('element' in item) element(item.element);
    }
    for (const scenario of model.scenarios) {
      for (const step of scenario.steps) {
        element(step.subject);
        element(step.object);
      }
    }
    for (const walkthrough of model.walkthroughs) {
      for (const step of walkthrough.steps) {
        if (!this.hasView(step.target) && !this.hasScenario(step.target)) {
          fail(`There is no view or scenario ${step.target}.`);
        }
        [...step.focus, ...step.open, ...step.close].forEach(element);
        if (step.audience !== null && !audiences.has(step.audience)) {
          fail(`There is no audience ${step.audience}.`);
        }
        const count = this.scenarioById.get(step.target)?.steps.length;
        if (step.range !== null) {
          const { from, to } = step.range;
          if (count === undefined || from < 1 || to > count || from > to) {
            fail(`The step range of ${walkthrough.id} on ${step.target} cannot be played.`);
          }
        }
      }
    }
  }
}
