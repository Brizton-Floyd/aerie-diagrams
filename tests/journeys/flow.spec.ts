import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { boxes, settled } from './reader.ts';

for (const theme of ['dark', 'light'] as const) {
  test(`INT-620 INT-621 INT-622 INT-623 an Aerie flow overview selects steps, shares, hands off and clears (${theme})`, async ({
    page,
    context,
  }) => {
    await page.addInitScript((chosen) => {
      localStorage.setItem('aerie.theme', chosen);
    }, theme);
    await page.goto('/');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await page
      .getByLabel('Open your own .aerie file')
      .setInputFiles(join(import.meta.dirname, '../fixtures/aerie-flow.aerie'));
    await expect(page.locator('.cover-title')).toHaveText('How Aerie works');
    await settled(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole('button', {
        name: 'Show flow overview of Create a diagram, step by step',
        exact: true,
      })
      .click();
    await expect(page.locator('.flow-caption')).toContainText('Step 1 of 8');
    await settled(page);
    await expect(page.locator('.overview-step')).toHaveCount(8);
    await expect(page.locator('.overview-trail .step.now .curve')).toHaveCSS(
      'animation-name',
      'none',
    );
    await expect(page.locator('.overview-trail .step.now .curve')).toHaveCSS(
      'stroke-dasharray',
      'none',
    );
    const before = await boxes(page);
    const marker = page.getByRole('button', {
      name: 'Step 2: Model editor sends model text to Model semantics.',
      exact: true,
    });
    await marker.focus();
    await marker.press('Enter');
    await expect(page.locator('.flow-caption')).toContainText('Step 2 of 8');
    await expect(page).toHaveURL(/flow=full-flow\.2/);
    await settled(page);
    expect(await boxes(page)).toEqual(before);
    const selected = page.getByRole('button', {
      name: 'Step 3: Model semantics checks the text with Lines language.',
      exact: true,
    });
    await selected.focus();
    await selected.press('Space');
    await expect(page.locator('.flow-caption')).toContainText('Step 3 of 8');
    await settled(page);
    const listStep = page.locator('[data-flow-step="4"]');
    await listStep.focus();
    await listStep.press('Enter');
    await expect(page.locator('.flow-caption')).toContainText('Step 4 of 8');
    await settled(page);
    await expect(page.locator('[data-flow-step="4"]')).toBeFocused();
    await page.locator('[data-flow-step="3"]').click();
    await expect(page.locator('.flow-caption')).toContainText('Step 3 of 8');
    await settled(page);
    await expect(page.getByRole('heading', { name: 'Wording', exact: true })).toHaveCount(0);
    await expect(page.locator('.wording')).toBeHidden();
    await page.keyboard.press('3');
    await settled(page);
    expect(await boxes(page)).toEqual(before);
    await expect(page.locator('.flow-caption')).toContainText('Step 3 of 8');
    await page.getByRole('button', { name: 'Back to plain wording', exact: true }).click();
    await settled(page);
    const audit = await new AxeBuilder({ page }).analyze();
    expect(audit.violations).toEqual([]);
    const fragment = new URL(page.url()).hash;
    // A local model has no public source URL: reopening its source with the copied fragment restores it.
    const shared = await context.newPage();
    await shared.goto(`/${fragment}`);
    await expect(shared.locator('#app')).toHaveAttribute('data-ready', 'true');
    await shared
      .getByLabel('Open your own .aerie file')
      .setInputFiles(join(import.meta.dirname, '../fixtures/aerie-flow.aerie'));
    await shared.goto(`${shared.url().split('#')[0] ?? '/'}${fragment}`);
    await expect(shared.locator('.flow-caption')).toContainText('Step 3 of 8');
    await shared.close();
    await page.getByRole('button', { name: 'Follow the steps', exact: true }).click();
    await expect(page.locator('.caption-bar')).toContainText('Step 3 of 8');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.locator('.flow-caption')).toContainText('Step 3 of 8');
    await page.getByRole('button', { name: 'Clear flow', exact: true }).click();
    await expect(page.locator('.overview-step')).toHaveCount(0);
    await expect(page.locator('.cover-title')).toHaveText('How Aerie works');
  });
}
