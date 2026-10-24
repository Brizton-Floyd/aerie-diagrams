import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { boxes, settled, useTheme } from './reader.ts';

test.use({ viewport: { width: 1600, height: 900 } });

for (const theme of ['dark', 'light'] as const) {
  test(`INT-624 INT-625 MODEL-607 LAYOUT-506 Big picture opens on Aerie's authored stages (${theme})`, async ({
    page,
    context,
  }) => {
    await useTheme(page, theme);
    await page.goto('/?model=samples/aerie.aerie');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('.flow-caption')).toContainText('Stage 1 of 4');
    await expect(page.locator('.overview-step')).toHaveCount(4);
    await expect(
      page.getByRole('button', { name: 'Stage 1: Write the model', exact: true }),
    ).toHaveAttribute('aria-current', 'step');
    await expect(page).toHaveURL(/\?model=samples\/aerie\.aerie$/);
    await settled(page);
    const before = await boxes(page);
    const third = page.getByRole('button', { name: 'Stage 3: Build the picture', exact: true });
    await third.focus();
    await third.press('Enter');
    await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
    await expect(page.locator('.flow-caption')).toContainText('Build the picture');
    await expect(page).toHaveURL(/flow=full-flow\.3/);
    await settled(page);
    expect(await boxes(page)).toEqual(before);
    await page.keyboard.press('3');
    await expect(page.locator('.flow-caption')).toContainText('Lay out and render SVG');
    await settled(page);
    expect(await boxes(page)).toEqual(before);
    await page.getByRole('button', { name: 'Back to plain wording', exact: true }).click();
    await settled(page);
    await expect(page.getByRole('heading', { name: 'Wording', exact: true })).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const shared = await context.newPage();
    await shared.goto(page.url());
    await expect(shared.locator('.flow-caption')).toContainText('Stage 3 of 4');
    await expect(
      shared.getByRole('button', { name: 'Stage 3: Build the picture', exact: true }),
    ).toHaveAttribute('aria-current', 'step');
    await shared.close();
    await page.getByRole('button', { name: 'Follow the full flow', exact: true }).click();
    await expect(page.locator('.caption-bar')).toContainText('Step 5 of 8');
    await settled(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
    await page.getByRole('button', { name: 'Clear flow', exact: true }).click();
    await expect(page.locator('.overview-step')).toHaveCount(0);
    await expect(page).toHaveURL(/flow=none/);
    await page.reload();
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('.overview-step')).toHaveCount(0);
    await expect(page.locator('.cover-title')).toHaveText('How Aerie works');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
    await page.getByRole('button', { name: 'Inside Aerie', exact: true }).click();
    await expect(page.locator('.overview-step')).toHaveCount(0);
    await page.getByRole('button', { name: 'Big picture', exact: true }).click();
    await expect(page.locator('.flow-caption')).toContainText('Stage 1 of 4');
    await expect(page).toHaveURL(/\?model=samples\/aerie\.aerie$/);
  });
}
