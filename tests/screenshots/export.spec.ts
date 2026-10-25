import { expect, test } from '@playwright/test';
import { HIDE_TEXT, openModel, useTheme, still } from './page.ts';

test.use({ viewport: { width: 1600, height: 900 } });
for (const theme of ['dark', 'light'] as const) {
  test(`EXPORT-007 complete export preview controls, ${theme}`, async ({ page }) => {
    await useTheme(page, theme);
    await openModel(page, 'samples/aerie.aerie');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Export diagram', exact: true });
    await expect(panel.getByRole('button', { name: 'Download PNG', exact: true })).toBeEnabled();
    // Export image typography is verified in real-file journeys and local PDF rendering.
    // Hide it here, like other text, to compare dialog chrome independently of platform glyphs.
    await page.addStyleTag({
      content: HIDE_TEXT + '\n.export-preview figure { visibility:hidden!important; }',
    });
    await page.mouse.move(0, 0);
    await still(page);
    await expect(page).toHaveScreenshot(`export-preview-${theme}.png`);
  });
}
