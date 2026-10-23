// Screenshots of a reader's changes to the Lotto sample (acceptance A6): a selection, a container
// opened in place, two opened one inside the other with the camera following (LAYOUT-453), and Back
// and Forward with the recent visits after following connections (LOOK-808), in both themes at
// 1600 x 900, compared only with Aerie's earlier screenshots (ACC-003, ACC-006).
// Update deliberately:
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

    test(`LOOK-302 and LAYOUT-453 the Analysis engine and Engine service opened in place on the Big picture, followed by the camera, ${theme}`, async ({
      page,
    }) => {
      await openModel(page, 'samples/lotto.aerie');
      await page.addStyleTag({ content: HIDE_TEXT });
      await show(page, 'big-picture', 'manager');
      for (const [id, inside] of [
        ['engine', 'engine-service'],
        ['engine-service', 'request-handling'],
      ] as const) {
        await page.locator(`svg.aerie g.node[data-id="${id}"] .control`).click();
        await expect(page.locator(`svg.aerie g.node[data-id="${inside}"]`)).toBeAttached();
        await still(page);
      }
      await expect(page).toHaveScreenshot(`lotto-big-picture-drilled-${theme}.png`);
    });

    test(`LOOK-808 Back, Forward and the recent visits after following connections and going back, ${theme}`, async ({
      page,
    }) => {
      await openModel(page, 'samples/lotto.aerie');
      await page.addStyleTag({ content: HIDE_TEXT });
      for (const id of ['engine', 'engine-service']) {
        await page.locator(`svg.aerie g.node[data-id="${id}"] > .shape`).focus();
        await page.keyboard.press('o');
        await expect(
          page.locator(`svg.aerie g.node[data-id="${id}"] > .shape[aria-expanded="true"]`),
        ).toBeAttached();
        await still(page);
      }
      await page.locator('svg.aerie g.node[data-id="pick-generation"] text').first().click();
      await still(page);
      // The side panel's content is hidden in screenshot runs, so its links are pressed directly.
      for (const id of ['history-lookup', 'history-service']) {
        await page
          .locator(`aside.panel button[data-select="${id}"]`)
          .first()
          .dispatchEvent('click');
        await expect(
          page.locator(`svg.aerie g.node[data-id="${id}"] > .shape[aria-pressed="true"]`),
        ).toBeAttached();
        await still(page);
      }
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(
        page.locator('svg.aerie g.node[data-id="history-lookup"] > .shape[aria-pressed="true"]'),
      ).toBeAttached();
      await still(page);
      await expect(page).toHaveScreenshot(`lotto-big-picture-visits-${theme}.png`);
    });
  });
}
