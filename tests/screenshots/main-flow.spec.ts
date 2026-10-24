import { expect, test } from '@playwright/test';
import { HIDE_TEXT, openModel, useTheme } from './page.ts';
import { settled } from '../journeys/reader.ts';

test.use({ viewport: { width: 1600, height: 900 } });
for (const theme of ['dark', 'light'] as const) {
  test(`INT-624 LAYOUT-506 Aerie's default numbered Big picture, ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await openModel(page, 'samples/aerie.aerie');
    await expect(page.locator('.overview-step')).toHaveCount(4);
    await page.addStyleTag({ content: HIDE_TEXT });
    await page.mouse.move(0, 0);
    await settled(page);
    await expect(page).toHaveScreenshot(`aerie-main-flow-${theme}.png`);
  });
}
