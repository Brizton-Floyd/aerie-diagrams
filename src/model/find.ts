// Finding elements and following them between views, without depending on a browser.
import type { Id } from '../lines/index.ts';
import { select, stop, switchView, type Picture } from './picture.ts';
import type { Semantics } from './semantics.ts';

export interface ElementMatch {
  id: Id;
  name: string;
  path: string;
  /** Other audiences' names explain a match without rewording the diagram. */
  names: string[];
  views: Id[];
}

/** INT-1011: views in model order that can reveal this exact element. */
export function elementViews(semantics: Semantics, id: Id): Id[] {
  if (!semantics.tree.has(id)) return [];
  return semantics.views
    .filter((view) => semantics.scope(view.id).holds(id))
    .map((view) => view.id);
}

/** INT-1001: case-insensitive words match authored names, ids, tags and code units. */
export function findElements(semantics: Semantics, audience: Id, query: string): ElementMatch[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = semantics.model.elements.flatMap((element) => {
    const name = semantics.name(element.id, audience);
    const names = [
      ...new Set(semantics.model.audiences.map((each) => semantics.name(element.id, each.id))),
    ];
    const parents = semantics.tree.ancestors(element.id).reverse();
    const path = parents.map((id) => semantics.name(id, audience)).join(' / ');
    const content = [
      element.id,
      ...names,
      element.tagline.base ?? '',
      ...Object.values(element.tagline.set),
      ...element.tags,
      ...element.code.map((unit) => `${unit.kind}:${unit.name}`),
      path,
    ]
      .join(' ')
      .toLowerCase();
    if (!terms.every((term) => content.includes(term))) return [];
    return [
      {
        id: element.id,
        name,
        path,
        names: names.filter((each) => each !== name),
        views: elementViews(semantics, element.id),
      },
    ];
  });
  const text = query.trim().toLowerCase();
  const rank = (match: ElementMatch): number =>
    match.id.toLowerCase() === text || match.name.toLowerCase() === text
      ? 0
      : match.id.toLowerCase().startsWith(text) || match.name.toLowerCase().startsWith(text)
        ? 1
        : 2;
  return matches.sort((a, b) => rank(a) - rank(b));
}

/** INT-1011: follows an exact element into a supported view, preserving audience wording. */
export function followElement(semantics: Semantics, picture: Picture, id: Id, view: Id): Picture {
  if (!elementViews(semantics, id).includes(view)) return picture;
  const base =
    view === picture.view
      ? stop(semantics, picture)
      : stop(semantics, switchView(semantics, picture, view));
  return select(semantics, base, id);
}

/** INT-1003: keep the current view when possible, otherwise choose the first that holds it. */
export function locateElement(semantics: Semantics, picture: Picture, id: Id): Picture {
  const views = elementViews(semantics, id);
  const view = views.includes(picture.view) ? picture.view : views[0];
  return view === undefined ? picture : followElement(semantics, picture, id, view);
}
