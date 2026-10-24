import { expect, test } from '@playwright/test';
import { settled, useTheme } from './reader.ts';

const initial = 'model edit: Editing a model\n\na: Requester\nb: Service\na calls b\n';
const renamed = initial
  .replace('a: Requester', 'requester: Requester')
  .replace('a calls', 'requester calls');
const removed = 'model edit: Editing a model\n\nrequester: Requester\n';

test.use({ viewport: { width: 1600, height: 900 } });

for (const theme of ['dark', 'light'] as const) {
  for (const reduced of [false, true]) {
    test(`INT-805 LAYOUT-402 valid replacements, renames and removals keep drawing (${theme}, reduced=${String(reduced)})`, async ({
      page,
    }) => {
      await useTheme(page, theme);
      await page.goto('/?model=samples/aerie.aerie');
      await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
      await page.getByRole('checkbox', { name: 'Reduce motion', exact: true }).setChecked(reduced);
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      const editor = page.getByRole('textbox', { name: 'Lines source', exact: true });
      for (const [source, ids] of [
        [initial, ['a', 'b']],
        [renamed, ['requester', 'b']],
        [removed, ['requester']],
      ] as const) {
        await editor.fill(source);
        await expect(page.locator('svg.aerie g.boxes > g.node > .shape')).toHaveCount(ids.length);
        for (const id of ids)
          await expect(page.locator(`svg.aerie g.node[data-id="${id}"] > .shape`)).toBeVisible();
        await settled(page);
        await expect(
          page.getByRole('list', { name: 'Problems', exact: true }).locator('li'),
        ).toHaveCount(0);
        await expect(
          page.getByText('Aerie could not draw this picture:', { exact: true }),
        ).toHaveCount(0);
      }
      await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
      await expect(page.locator('svg.aerie[data-view="big-picture"]')).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Discard changes', exact: true }),
      ).toBeDisabled();
      await settled(page);
      await expect(
        page.getByText('Aerie could not draw this picture:', { exact: true }),
      ).toHaveCount(0);
    });
  }
}
