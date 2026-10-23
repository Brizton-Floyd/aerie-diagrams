// Screenshots of a reader's changes to the Lotto sample (acceptance A6): a selection, and a
// container opened in place, in both themes at 1600 x 900, compared only with Aerie's earlier
// screenshots (ACC-003, ACC-006). Update deliberately:
// `npx playwright test --project screenshots --update-snapshots`.
import { expect, test, type Page } from '@playwright/test';
import { HIDE_TEXT, openModel, show } from './page.ts';

test.use({ viewport: { width: 1600, height: 900 } });

/** Waits until every glide, fade and swap has ended, with the pointer off the drawing. */
async function still(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await expect
    .poll(() => page.evaluate(() => document.getAnimations().length), { timeout: 5000 })
    .toBe(0);
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: theme });

    test(`LOOK-601 and LOOK-602 the Results store selected on Services, ${theme}`, async ({
      page,
    }) => {
      await openModel(page, 'samples/lotto.aerie');
      await page.addStyleTag({ content: HIDE_TEXT });
      await show(page, 'services', 'manager');
      await page.locator('svg.aerie g.heads > g.head[data-id="store"] text').first().click();
      await expect(
        page.locator('svg.aerie g.node[data-id="store"] > .shape[aria-pressed="true"]'),
      ).toBeAttached();
      await still(page);
      await expect(page).toHaveScreenshot(`lotto-services-selected-${theme}.png`);
    });

    test(`LOOK-302 Engine service opened in place on Services, ${theme}`, async ({ page }) => {
      await openModel(page, 'samples/lotto.aerie');
      await page.addStyleTag({ content: HIDE_TEXT });
      await show(page, 'services', 'manager');
      await page.locator('svg.aerie g.node[data-id="engine-service"] .control').click();
      await expect(page.locator('svg.aerie g.node[data-id="request-handling"]')).toBeAttached();
      await still(page);
      await expect(page).toHaveScreenshot(`lotto-services-engine-open-${theme}.png`);
    });
  });
}
