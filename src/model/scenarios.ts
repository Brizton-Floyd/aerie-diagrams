// Scenarios: replies, unbacked steps, participants, the stage view and the trail of a playing
// scenario (docs/spec/model.md, MODEL-401 to MODEL-406).
import type { Id, Relationship, Scenario } from '../lines/index.ts';
import { lift } from './lift.ts';
import type { Tree } from './tree.ts';
import type { DrawnSet, ViewScope } from './views.ts';

/** MODEL-401: a step that answers an earlier one is a reply; every other step is a call. */
export type StepRole = 'call' | 'reply';

/** Which ordered pairs of elements the model joins with a relationship, of any kind. */
export class Joins {
  private readonly pairs = new Set<string>();

  constructor(relationships: readonly Relationship[]) {
    for (const relationship of relationships) {
      this.pairs.add(`${relationship.subject}\n${relationship.object}`);
    }
  }

  /** True when the model has a relationship from `subject` to `object`, between exactly these two. */
  has(subject: Id, object: Id): boolean {
    return this.pairs.has(`${subject}\n${object}`);
  }

  /** MODEL-401: a step from `p` to `q` is a reply when only `q` to `p` is in the model. */
  role(subject: Id, object: Id): StepRole {
    return this.has(object, subject) && !this.has(subject, object) ? 'reply' : 'call';
  }

  /** MODEL-402: false for a step whose elements no relationship joins, in either direction (W601). */
  backs(subject: Id, object: Id): boolean {
    return this.has(subject, object) || this.has(object, subject);
  }
}

/** MODEL-403: the elements a scenario's steps name, each once, in the order they first appear. */
export function participants(scenario: Scenario): Id[] {
  const out = new Set<Id>();
  for (const step of scenario.steps) {
    out.add(step.subject);
    out.add(step.object);
  }
  return [...out];
}

/**
 * MODEL-404: the view a scenario plays on: `current` when it gives every participant a lift,
 * otherwise the first view, in declaration order, that does. Null when no view can (E604).
 */
export function stageView(
  scopes: readonly ViewScope[],
  current: ViewScope | null,
  scenario: Scenario,
): ViewScope | null {
  const ids = participants(scenario);
  const holdsAll = (scope: ViewScope): boolean => ids.every((id) => scope.holds(id));
  if (current !== null && holdsAll(current)) return current;
  return scopes.find(holdsAll) ?? null;
}

/**
 * MODEL-405: how one step is drawn. A `line` runs between the lifts of its two ends. A `loop` is a
 * folded step: both ends lift to one element, or one lift contains the other, and the loop sits on
 * the inner one.
 */
export type TrailStep =
  | { number: number; role: StepRole; kind: 'line'; from: Id; to: Id }
  | { number: number; role: StepRole; kind: 'loop'; on: Id };

/** MODEL-405 and MODEL-406: steps 1 to `step` of a playing scenario, drawn on one drawn set. */
export interface Trail {
  steps: TrailStep[];
  /** The lifts of the ends of steps 1 to `step`, in model order. */
  visited: Id[];
  /** The lifts of the current step's ends, in model order. */
  current: Id[];
}

/**
 * Works out the trail of `scenario` up to step `step` (from 1) on a drawn set of its stage view,
 * where every end has a lift. Lifting is redone for each drawn set, so opening or closing during
 * playback redraws the trail (MODEL-405).
 */
export function trail(
  tree: Tree,
  joins: Joins,
  drawn: DrawnSet,
  scenario: Scenario,
  step: number,
): Trail {
  const steps: TrailStep[] = [];
  const visited = new Set<Id>();
  let current: Id[] = [];
  scenario.steps.slice(0, Math.max(0, step)).forEach((each, index) => {
    const from = lift(tree, drawn, each.subject);
    const to = lift(tree, drawn, each.object);
    if (from === null || to === null) {
      throw new Error(
        `Step ${String(index + 1)} of ${scenario.id} has an end with no lift: play it on its stage view.`,
      );
    }
    const number = index + 1;
    const role = joins.role(each.subject, each.object);
    if (from === to || tree.contains(to, from)) {
      steps.push({ number, role, kind: 'loop', on: from });
    } else if (tree.contains(from, to)) {
      steps.push({ number, role, kind: 'loop', on: to });
    } else {
      steps.push({ number, role, kind: 'line', from, to });
    }
    visited.add(from).add(to);
    current = [...new Set([from, to])];
  });
  return {
    steps,
    visited: tree.sort([...visited]),
    current: tree.sort(current),
  };
}
