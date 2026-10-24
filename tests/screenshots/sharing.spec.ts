import { expect, test } from '@playwright/test';
import { HIDE_TEXT, openModel, useTheme, still } from './page.ts';

test.use({ viewport: { width: 1600, height: 900 } });

for (const theme of ['dark', 'light'] as const) {
  test(`INT-508 local-copy sharing dialog, ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await openModel(page, 'samples/aerie.aerie');
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Lines source', exact: true });
    await editor.press('ControlOrMeta+End');
    await editor.press('Enter');
    await editor.pressSequentially('// A local copy for sharing.');
    await page
      .getByRole('button', { name: 'Share model', exact: true })
      .waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Share model', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Share this model', exact: true })).toBeVisible();
    await page.addStyleTag({ content: HIDE_TEXT });
    await page.mouse.move(0, 0);
    await still(page);
    await expect(page).toHaveScreenshot(`local-model-share-${theme}.png`);
  });
}
