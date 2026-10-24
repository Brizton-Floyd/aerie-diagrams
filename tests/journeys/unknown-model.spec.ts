import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { settled } from './reader.ts';

test.use({ viewport: { width: 1280, height: 720 } });

test('INT-002 unknown model links name the request and fallback, then recover through the model chooser', async ({
  page,
}) => {
  const requested = 'missing model.aerie';
  await page.goto(
    `/?model=${encodeURIComponent(requested)}#view=services&aud=engineer&sel=website`,
  );
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const notice = page.getByRole('status').filter({ hasText: requested });
  await expect(notice).toContainText('Showing "samples/lotto.aerie" instead.');
  await expect(notice).toContainText('Choose another model or open your own .aerie file.');
  await expect(page.locator('svg.aerie')).toHaveAttribute('data-view', 'big-picture');
  await expect(page.getByLabel('Model', { exact: true })).toHaveValue('samples/lotto.aerie');
  expect(new URL(page.url()).searchParams.get('model')).toBe('samples/lotto.aerie');
  expect(new URL(page.url()).hash).toBe('');
  await settled(page);
  const noticeBox = await notice.boundingBox();
  const stageBox = await page.locator('.aerie-stage').boundingBox();
  if (noticeBox === null || stageBox === null)
    throw new Error('The notice and stage must be visible');
  expect(noticeBox.x).toBeGreaterThanOrEqual(stageBox.x);
  expect(noticeBox.x + noticeBox.width).toBeLessThanOrEqual(stageBox.x + stageBox.width);
  await test.info().attach('unknown-model-notice', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await page.getByRole('button', { name: 'Services', exact: true }).click();
  await page.keyboard.press('3');
  await expect(notice).toBeVisible();
  await page.getByLabel('Model', { exact: true }).selectOption('samples/shapes.aerie');
  await expect(page.locator('svg.aerie')).toHaveAttribute('data-view', 'shapes');
  await expect(page.locator('.notice')).toBeHidden();
  expect(new URL(page.url()).searchParams.get('model')).toBe('samples/shapes.aerie');
});

test('INT-002 an unknown model link can recover by opening a local file', async ({ page }) => {
  await page.goto('/?model=missing-model.aerie');
  await expect(page.getByRole('status').filter({ hasText: 'missing-model.aerie' })).toBeVisible();
  await page
    .getByLabel('Open your own .aerie file')
    .setInputFiles(join(import.meta.dirname, '../../skills/aerie/examples/first-file.aerie'));
  await expect(page.locator('.cover-title')).toHaveText('Team notes');
  await expect(page.locator('.notice')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Share model', exact: true })).toBeVisible();
});
