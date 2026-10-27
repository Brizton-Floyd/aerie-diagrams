import { expect, test } from '@playwright/test';
import { HIDE_TEXT, openModel, still, useTheme } from './page.ts';

test.use({ viewport: { width: 1600, height: 900 } });

for (const theme of ['dark', 'light'] as const) {
  test(`INT-1002 the element finder, ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await openModel(page, 'samples/lotto.aerie');
    await page.getByRole('button', { name: 'Find element', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Find an element' });
    await dialog.getByRole('searchbox', { name: 'Search the model' }).fill('request-handling');
    await expect(dialog.locator('[data-find-element="request-handling"]')).toBeVisible();
    await page.addStyleTag({ content: HIDE_TEXT });
    await page.mouse.move(0, 0);
    await still(page);
    await expect(page).toHaveScreenshot(`element-finder-${theme}.png`);
  });
}
