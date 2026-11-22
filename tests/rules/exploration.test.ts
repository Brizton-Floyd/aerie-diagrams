import { describe, expect, it } from 'vitest';
import { DEFAULT_ZOOM } from '../../src/model/index.ts';
import { checkStructure } from '../../src/layout/index.ts';
import { SOURCES } from './pictures.ts';

describe.each(SOURCES)('exploration: $path', ({ semantics, layouter }) => {
  for (const view of semantics.views) {
    for (const root of semantics.model.elements.filter((element) =>
      semantics.tree.isContainer(element.id),
    )) {
      it(`MODEL-212 RULE-001 RULE-005 RULE-006 ${view.id}/${root.id} fits every audience and preserves geometry`, async () => {
        const scope = semantics.scope(view.id, root.id);
        for (const zoom of [DEFAULT_ZOOM, scope.everythingOpen(), scope.allClosed()]) {
          const layouts = await Promise.all(
            semantics.model.audiences.map((audience) =>
              layouter.picture(view.id, zoom, audience.id, root.id),
            ),
          );
          const first = layouts[0];
          expect(first).toBeDefined();
          if (first === undefined) return;
          expect(
            checkStructure(
              semantics,
              first,
              layouts.map((layout) => layout.text),
            ),
          ).toEqual([]);
          for (const layout of layouts) expect(layout.result).toEqual(first.result);
        }
      });
    }
  }
});
