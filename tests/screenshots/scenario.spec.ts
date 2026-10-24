// Screenshots of the Lotto sample's Generate picks scenario played on the page (acceptance A8):
// trail frames on the map, with the Analysis engine closed and open, and the lanes, with the caption
// bar, in both themes at 1600 x 900, compared only with Aerie's earlier screenshots (ACC-003,
// ACC-006). Update deliberately: `npx playwright test --project screenshots --update-snapshots`.
import { expect, test, type Page } from '@playwright/test';
import { HIDE_TEXT, openModel, useTheme } from './page.ts';

test.use({ viewport: { width: 1600, height: 900 } });

/** Waits until every glide, fade, swap and drawing trail has ended, with the pointer off the stage. */
async function still(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            // The light flowing along a selected line runs without end (LOOK-601).
            document
              .getAnimations()
              .filter((each) => each.effect?.getComputedTiming().iterations !== Infinity).length,
        ),
      { timeout: 5000 },
    )
    .toBe(0);
}

/**
 * Chooses a step of the playing scenario in the side panel. Screenshot runs hide the panel's
 * content (HIDE_TEXT), so its controls are pressed without a pointer.
 */
async function choose(page: Page, step: number): Promise<void> {
  await page
    .locator(`aside.panel button.step-choice[data-step="${String(step)}"]`)
    .dispatchEvent('click');
  await expect(page.locator('.caption-bar .count')).toHaveText(`Step ${String(step)} of 14`);
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await useTheme(page, theme);
    });

    test(`LOOK-701 to LOOK-706 and LOOK-805 Generate picks on the map and as lanes, ${theme}`, async ({
      page,
    }) => {
      await openModel(page, 'samples/lotto.aerie');
      await page.addStyleTag({ content: HIDE_TEXT });
      await page.locator('button[data-scenario="generate-picks"]').click();
      await choose(page, 2);
      await expect(page.locator('svg.aerie .badge.now')).toHaveAttribute('data-step', '2');
      await still(page);
      await expect(page).toHaveScreenshot(`lotto-generate-picks-2-${theme}.png`);
      // A reply (step 7) and folded steps on the closed Analysis engine and Results store.
      await choose(page, 9);
      await expect(page.locator('svg.aerie .badge.now')).toHaveAttribute('data-step', '9');
      await still(page);
      await expect(page).toHaveScreenshot(`lotto-generate-picks-9-${theme}.png`);
      // Opened, the steps inside the engine run between its parts (MODEL-405).
      await page.locator('svg.aerie g.node[data-id="engine"] .control').click();
      await expect(page.locator('svg.aerie g.node[data-id="engine-service"]')).toBeAttached();
      await still(page);
      await page.locator('svg.aerie g.node[data-id="engine-service"] .control').click();
      await expect(page.locator('svg.aerie g.node[data-id="pick-generation"]')).toBeAttached();
      await still(page);
      await expect(page).toHaveScreenshot(`lotto-generate-picks-9-engine-open-${theme}.png`);
      await page.locator('aside.panel button[data-control="lanes"]').dispatchEvent('click');
      await expect(page.locator('svg.aerie g.rows rect.row.now')).toHaveAttribute('data-step', '9');
      await still(page);
      await expect(page).toHaveScreenshot(`lotto-generate-picks-9-lanes-${theme}.png`);
    });
  });
}
