import { expect, test } from '@playwright/test';
import { clickElement, openLotto } from '../journeys/reader.ts';
import { HIDE_TEXT, still, useTheme } from './page.ts';

for (const theme of ['dark', 'light'] as const) {
  test(`INT-305 LOOK-002 exploring Lotto preserves Signal in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await useTheme(page, theme);
    await openLotto(page);
    await clickElement(page, 'engine');
    await page.getByRole('button', { name: 'Explore this part', exact: true }).click();
    await expect(page).toHaveURL(/explore=engine/);
    await still(page);
    await page.addStyleTag({ content: HIDE_TEXT });
    await expect(page).toHaveScreenshot(`lotto-exploration-${theme}.png`);
  });
}
