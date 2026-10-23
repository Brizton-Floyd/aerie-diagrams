// Screenshots of the Lotto sample's tour presented on the page (acceptance A9): presenter mode with
// a focus step, a scenario step and the last step, with the narration bar, the audience tabs and
// the controls, in both themes at 1600 x 900, compared only with Aerie's earlier screenshots
// (ACC-003, ACC-006). Update deliberately: `npx playwright test --project screenshots
// --update-snapshots`.
import { expect, test, type Page } from '@playwright/test';
import { HIDE_TEXT, openModel } from './page.ts';

test.use({ viewport: { width: 1600, height: 900 } });

/** Waits until the tour shows `count` ("4 / 8") and every glide, fade and trail has ended. */
async function atStep(page: Page, count: string): Promise<void> {
  await expect(page.locator('.narration-bar .narration-meta .count')).toHaveText(count);
  await still(page);
}

async function still(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.getAnimations().length), { timeout: 5000 })
    .toBe(0);
}

/**
 * Rests the pointer on the gap between Back and Next, so the controls stay in view without any
 * button looking hovered.
 */
async function restOnControls(page: Page): Promise<void> {
  const back = await page.getByRole('button', { name: 'Back', exact: true }).boundingBox();
  if (back === null) throw new Error('Back is not shown.');
  await page.mouse.move(back.x + back.width + 3, back.y + back.height / 2);
}

/** Moves the pointer off the drawing and waits until the controls have hidden (LOOK-901). */
async function idle(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await expect(page.locator('.presenter-controls.idle')).toBeAttached({ timeout: 5000 });
  await still(page);
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: theme });

    test(`LOOK-603 the tour presented: a focus step, a scenario step and the last step, ${theme}`, async ({
      page,
    }) => {
      await openModel(page, 'samples/lotto.aerie');
      await page.addStyleTag({ content: HIDE_TEXT });
      await page.locator('button[data-walkthrough="tour"]').click();
      await atStep(page, '1 / 8');
      // Step 4: Services with Engine service open and Pick generation focused, the controls shown.
      for (let at = 1; at < 4; at++) await page.keyboard.press('ArrowRight');
      await atStep(page, '4 / 8');
      await restOnControls(page);
      await still(page);
      await expect(page).toHaveScreenshot(`lotto-tour-4-${theme}.png`);
      // Step 7 at Generate picks' step 9, the controls hidden.
      for (let at = 4; at < 7 + 8; at++) await page.keyboard.press('ArrowRight');
      await expect(page.locator('.narration-bar .scenario-count')).toHaveText('9/14');
      await atStep(page, '7 / 8');
      await idle(page);
      await expect(page).toHaveScreenshot(`lotto-tour-7-9-${theme}.png`);
      // The last step, with "End of the walkthrough" under the narration (INT-706).
      await page.keyboard.press('End');
      await atStep(page, '8 / 8');
      await expect(page.locator('.narration-bar .narration-end')).toBeAttached();
      await idle(page);
      await expect(page).toHaveScreenshot(`lotto-tour-8-${theme}.png`);
    });
  });
}
