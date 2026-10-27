import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { button, settled } from './reader.ts';

test('INT-1031 INT-1032 INT-1033 authored documentation stays formatted, audience-specific and inert', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith('https://example.test/')) requests.push(request.url());
  });
  await page.goto('/?model=samples/lotto.aerie');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page
    .getByLabel('Open your own .aerie file')
    .setInputFiles(join(import.meta.dirname, '../fixtures/rich-documentation.aerie'));
  await expect(page.locator('.cover-title')).toHaveText('Service handbook');
  await button(page, 'api').focus();
  await page.keyboard.press('Enter');
  await settled(page);
  const panel = page.getByRole('complementary', { name: 'About', exact: true });
  await expect(panel.getByRole('heading', { name: 'Orders API', exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Ownership', exact: true })).toHaveAttribute(
    'class',
    'about doc-heading',
  );
  await expect(panel.locator('em')).toHaveText('Platform');
  await expect(panel.locator('ul.doc-list > li')).toHaveCount(2);
  await expect(panel.locator('ol.doc-list')).toHaveAttribute('start', '3');
  const runbook = panel.getByRole('link', { name: 'Diagnose failures', exact: true });
  await expect(runbook).toHaveAttribute('href', 'https://example.test/runbooks/orders');
  await expect(runbook).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(panel.getByRole('link', { name: 'Contact the owner' })).toHaveAttribute(
    'href',
    'mailto:platform@example.test',
  );
  await expect(panel.getByRole('heading', { name: 'Code references', exact: true })).toBeVisible();
  await expect(panel).toContainText('npm:aerie-diagrams');
  await expect(panel.locator('pre code')).toContainText('const healthy = true;');
  await expect(panel.getByRole('link', { name: 'Unsafe action', exact: true })).toHaveCount(0);
  await expect(panel.locator('img, script')).toHaveCount(0);
  expect(await page.evaluate(() => 'documentationRan' in window)).toBe(false);
  expect(requests).toEqual([]);

  await panel.getByRole('button', { name: 'More technical', exact: false }).click();
  await expect(
    panel.locator('.layer').getByRole('heading', { name: 'Technical notes' }),
  ).toBeVisible();
  await expect(
    panel.locator('.layer').getByRole('link', { name: 'API documentation' }),
  ).toHaveAttribute('href', 'https://example.test/apis/orders');
  await page.locator('body').press('2');
  await expect(panel.getByRole('heading', { name: 'OrdersController', exact: true })).toBeVisible();
  await expect(panel.getByRole('link', { name: 'API documentation', exact: true })).toBeVisible();
});
