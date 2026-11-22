// Exploration derives a small picture from the model, never from audience wording (MODEL-212).
import type { Id, Relationship, View } from '../lines/index.ts';
import type { Tree } from './tree.ts';
import { ViewScope } from './views.ts';

/** Whether either end belongs to the explored subtree, including its root. */
export function touches(tree: Tree, root: Id, relationship: Relationship): boolean {
  return [relationship.subject, relationship.object].some(
    (id) => id === root || tree.contains(root, id),
  );
}

/**
 * The explored part opens one level. Each outside endpoint is represented by the highest part
 * below its common ancestor with the explored root, or by its top-level part in another tree.
 * These neighbours start closed. Parents above the roots are context in the breadcrumb, not boxes.
 */
export function explorationScope(
  tree: Tree,
  view: View,
  relationships: readonly Relationship[],
  root: Id,
): ViewScope {
  const ancestors = new Set(tree.ancestors(root));
  const neighbours = new Set<Id>();
  for (const relationship of relationships) {
    if (!view.kinds.includes(relationship.kind) || !touches(tree, root, relationship)) continue;
    for (const endpoint of [relationship.subject, relationship.object]) {
      if (endpoint === root || tree.contains(root, endpoint)) continue;
      const path = [...tree.ancestors(endpoint).reverse(), endpoint];
      const outside = path.find((id) => !ancestors.has(id));
      if (outside !== undefined) neighbours.add(outside);
    }
  }
  const roots = new Set([root, ...neighbours]);
  return new ViewScope(
    tree,
    {
      ...view,
      show: [
        { element: root, depth: 1 },
        ...tree.sort([...neighbours]).map((element) => ({ element, depth: 0 })),
      ],
    },
    roots,
  );
}
