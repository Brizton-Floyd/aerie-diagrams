// The page as a whole (docs/spec/interaction.md, INT-001 to INT-003) and its accessibility audit
// (docs/spec/layout.md, SCORE-005; LOOK-014): an automated audit of every Lotto picture finds no
// problems, with nothing selected and with an element selected with every "More technical" layer
// open, in every wording and in both themes.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { clickElement, openLotto, settled, useTheme } from './reader.ts';

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
    test(`SCORE-005 and LOOK-014 an accessibility audit finds no problems in any Lotto picture, ${theme}`, async ({
      page,
    }) => {
      // Eighteen pictures, each audited twice: longer than one journey's default time.
      test.slow();
      await useTheme(page, theme);
      await openLotto(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const view of Object.keys(SELECTED)) {
        await page.locator(`button[data-view="${view}"]`).click();
        for (const [key, audience] of [
          ['1', 'Executive'],
          ['2', 'Manager'],
          ['3', 'Engineer'],
        ] as const) {
          await page.keyboard.press(key);
          await expect(page.locator(`svg.aerie[data-view="${view}"]`)).toBeVisible();
          await settled(page);
          expect(await audit(page), `${view}, ${audience}`).toEqual([]);
          await clickElement(page, SELECTED[view] ?? '');
          // Every deeper layer open, as far as this wording has any.
          const more = page.locator('aside.panel button.more');
          while (await more.isVisible()) await more.click();
          await settled(page);
          expect(await audit(page), `${view}, ${audience}, selected`).toEqual([]);
          await page.keyboard.press('Escape');
        }
      }
    });
  });
}

test('INT-001, LOOK-801 and LOOK-802 the top bar, the sidebar, the stage and the side panel, with no audience switch', async ({
  page,
}) => {
  await openLotto(page, 'services');
  const top = await page.locator('header.top').boundingBox();
  const side = await page.locator('.side-wrap').boundingBox();
  const stage = await page.locator('main.aerie-stage').boundingBox();
  const panel = await page.locator('aside.panel').boundingBox();
  // LOOK-801: a 52 px top bar; below it a 232 px sidebar, the stage and a 368 px side panel.
  expect(top).toMatchObject({ x: 0, y: 0, width: 1600, height: 52 });
  expect(side).toMatchObject({ x: 0, y: 52, width: 232 });
  expect(stage).toMatchObject({ x: 232, y: 52, width: 1600 - 232 - 368 });
  expect(panel).toMatchObject({ x: 1600 - 368, y: 52, width: 368 });
  // LOOK-802: the wordmark and breadcrumb, then Copy link, Edit and the theme button.
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(page.locator('header.top .tools button')).toHaveText(['Copy link', 'Edit', '']);
  await expect(page.locator('header.top .tool.theme')).toHaveAccessibleName(
    'Switch to the light theme',
  );
  for (const [name, width] of [
    ['copy', 100],
    ['edit', 64],
    ['theme', 30],
  ] as const) {
    expect((await page.locator(`header.top .tool.${name}`).boundingBox())?.width, name).toBe(width);
  }
  // The top bar stays in view however the side panel scrolls.
  await page.getByRole('button', { name: 'Move closer (+)' }).click();
  await page.locator('aside.panel').hover();
  await page.mouse.wheel(0, 2000);
  await expect(page.locator('header.top .tool.theme')).toBeInViewport();
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
