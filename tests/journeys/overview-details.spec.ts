import { expect, test } from '@playwright/test';
import { button, clickElement, node, settled, useTheme } from './reader.ts';

test.use({ viewport: { width: 1600, height: 900 } });

for (const theme of ['dark', 'light'] as const) {
  test(`INT-201 INT-205 INT-627 clicking an element from the main flow opens its details (${theme})`, async ({
    page,
    context,
  }) => {
    await useTheme(page, theme);
    await page.goto('/?model=samples/aerie.aerie');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('.flow-caption')).toContainText('Stage 1 of 4');
    await settled(page);
    await page.locator('[data-flow-step="3"]').click();
    await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
    await settled(page);
    await clickElement(page, 'meaning');
    await expect(page.locator('aside.panel h1')).toHaveText('Model tools');
    await expect(page.locator('aside.panel')).toContainText(
      'Checks the text and resolves the parts, views and wording.',
    );
    await expect(button(page, 'meaning')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.overview-step')).toHaveCount(0);
    await expect(page).toHaveURL(/sel=meaning/);
    await page
      .getByRole('button', { name: 'More technical Technical wording', exact: true })
      .click();
    await expect(page.locator('aside.panel')).toContainText('Language and semantics');
    const shared = await context.newPage();
    await shared.goto(page.url());
    await expect(shared.locator('aside.panel h1')).toHaveText('Model tools');
    await expect(button(shared, 'meaning')).toHaveAttribute('aria-pressed', 'true');
    await shared.close();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
    await expect(page.locator('.overview-step')).toHaveCount(4);
    await settled(page);
    // Opening a container retains the flow; choosing one of its children opens that child's details.
    await node(page, 'meaning').locator('.control').click();
    await expect(button(page, 'meaning')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
    await settled(page);
    await button(page, 'semantics').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('aside.panel h1')).toHaveText('Model semantics');
    await expect(button(page, 'semantics')).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
    await expect(button(page, 'meaning')).toHaveAttribute('aria-expanded', 'true');
  });
}
