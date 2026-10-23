// The page as a whole (docs/spec/interaction.md, INT-001 to INT-003) and its accessibility audit
// (docs/spec/layout.md, SCORE-005): an automated audit of every Lotto picture finds no problems,
// with nothing selected and with an element selected, in both themes.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { clickElement, openLotto, settled } from './reader.ts';

test.use({ viewport: { width: 1600, height: 900 } });

/** The audit's findings, one line each, so a failure says what and where. */
async function audit(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.flatMap((violation) =>
    violation.nodes.map((found) => `${violation.id}: ${found.target.join(' ')}`),
  );
}

/** An element each Lotto view draws, to audit a selection on. */
const SELECTED: Record<string, string> = {
  'big-picture': 'engine',
  services: 'store',
  engineering: 'formats',
};

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: theme });

    test(`SCORE-005 an accessibility audit finds no problems in any Lotto picture, ${theme}`, async ({
      page,
    }) => {
      // Eighteen pictures, each audited twice: longer than one journey's default time.
      test.slow();
      await openLotto(page);
      for (const view of Object.keys(SELECTED)) {
        await page.locator(`button[data-view="${view}"]`).click();
        for (const audience of ['Executive', 'Manager', 'Engineer']) {
          await page.getByRole('tab', { name: audience }).click();
          await expect(page.locator(`svg.aerie[data-view="${view}"]`)).toBeVisible();
          await settled(page);
          expect(await audit(page), `${view}, ${audience}`).toEqual([]);
          await clickElement(page, SELECTED[view] ?? '');
          await settled(page);
          expect(await audit(page), `${view}, ${audience}, selected`).toEqual([]);
          await page.keyboard.press('Escape');
        }
      }
    });
  });
}

test('INT-001 the top bar, the sidebar, the stage and the side panel, with the audience switch always in view', async ({
  page,
}) => {
  await openLotto(page, 'services');
  const top = await page.locator('header.top').boundingBox();
  const side = await page.locator('.side-wrap').boundingBox();
  const stage = await page.locator('main.aerie-stage').boundingBox();
  const panel = await page.locator('aside.panel').boundingBox();
  // LOOK-801: a 58 px top bar; below it a 214 px sidebar, the stage and a 344 px side panel.
  expect(top).toMatchObject({ x: 0, y: 0, width: 1600, height: 58 });
  expect(side).toMatchObject({ x: 0, y: 58, width: 214 });
  expect(stage).toMatchObject({ x: 214, y: 58, width: 1600 - 214 - 344 });
  expect(panel).toMatchObject({ x: 1600 - 344, y: 58, width: 344 });
  await expect(page.getByRole('tablist', { name: 'Written for' })).toBeInViewport();
  await page.getByRole('button', { name: 'Magnify' }).click();
  await page.locator('aside.panel').hover();
  await page.mouse.wheel(0, 2000);
  await expect(page.getByRole('tablist', { name: 'Written for' })).toBeInViewport();
});

test('INT-003 while the model loads, the stage says so', async ({ page }) => {
  // Hold back the layout engine's script, so the first picture takes a while to lay out.
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/elk-worker*', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/?model=samples/lotto.aerie');
  await expect(page.locator('main.aerie-stage')).toContainText('Loading the diagram');
  release();
  await expect(page.locator('svg.aerie')).toBeVisible();
  await expect(page.locator('main.aerie-stage')).not.toContainText('Loading the diagram');
});
