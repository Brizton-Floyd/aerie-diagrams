import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { boxes, settled } from './reader.ts';

test.use({ viewport: { width: 1600, height: 900 } });

test('INT-506 INT-554 switching models preserves the previous picture and camera for browser Back', async ({
  page,
}) => {
  await page.goto('/?model=samples/aerie.aerie');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: '3. Build the picture', exact: true }).click();
  await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
  await page.getByRole('button', { name: 'Move closer (+)', exact: true }).click();
  await settled(page);
  const before = await boxes(page);
  const address = page.url();
  const entries = await page.evaluate(() => history.length);
  await page.getByLabel('Model', { exact: true }).selectOption('samples/shapes.aerie');
  await expect(page.locator('.cover-title')).toHaveText('Every Contour shape');
  expect(await page.evaluate(() => history.length)).toBe(entries + 1);
  await page.getByRole('button', { name: 'Move closer (+)', exact: true }).click();
  await settled(page);
  const shapes = await boxes(page);
  await page.goBack();
  await expect(page).toHaveURL(address);
  await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
  await settled(page);
  expect(await boxes(page)).toEqual(before);
  await page.goForward();
  await expect(page.locator('.cover-title')).toHaveText('Every Contour shape');
  await settled(page);
  expect(await boxes(page)).toEqual(shapes);
  expect(await page.evaluate(() => history.length)).toBe(entries + 1);
});

test('INT-506 INT-556 choosing a model again starts a separate run, while reload adds no history entry', async ({
  page,
}) => {
  await page.goto('/?model=samples/aerie.aerie#flow=full-flow.3');
  await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
  const initial = await page.evaluate(() => history.length);
  await page.reload();
  await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
  expect(await page.evaluate(() => history.length)).toBe(initial);
  await page.getByLabel('Model', { exact: true }).selectOption('samples/shapes.aerie');
  await expect(page.locator('.cover-title')).toHaveText('Every Contour shape');
  await page.getByLabel('Model', { exact: true }).selectOption('samples/aerie.aerie');
  await expect(page.locator('.flow-caption')).toContainText('Stage 1 of 4');
  expect(await page.evaluate(() => history.length)).toBe(initial + 2);
  await page.goBack();
  await expect(page.locator('.cover-title')).toHaveText('Every Contour shape');
  await page.goBack();
  await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
  await page.goForward();
  await expect(page.locator('.cover-title')).toHaveText('Every Contour shape');
  await page.goForward();
  await expect(page.locator('.flow-caption')).toContainText('Stage 1 of 4');
});

test('INT-506 INT-556 local model entries preserve distinct sources even when filenames match', async ({
  page,
}) => {
  await page.goto('/?model=samples/aerie.aerie#flow=full-flow.3');
  await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
  for (const title of ['First local model', 'Second local model']) {
    await page.getByLabel('Open your own .aerie file').setInputFiles({
      name: 'same.aerie',
      mimeType: 'text/plain',
      buffer: Buffer.from(`model local: ${title}\n\na: A part\n`),
    });
    await expect(page.locator('.cover-title')).toHaveText(title);
  }
  await page.getByLabel('Model', { exact: true }).selectOption('samples/shapes.aerie');
  await expect(page.locator('.cover-title')).toHaveText('Every Contour shape');
  await page.goBack();
  await expect(page.locator('.cover-title')).toHaveText('Second local model');
  await page.goBack();
  await expect(page.locator('.cover-title')).toHaveText('First local model');
  await page.goBack();
  await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
  await page.goForward();
  await expect(page.locator('.cover-title')).toHaveText('First local model');
  await page.goForward();
  await expect(page.locator('.cover-title')).toHaveText('Second local model');
});

test('INT-506 INT-556 edited model history restores its last good picture and keeps its original for discard', async ({
  page,
}) => {
  const source = readFileSync(new URL('../../samples/aerie.aerie', import.meta.url), 'utf8');
  const edited = source.replace('How Aerie works', 'Edited Aerie');
  await page.goto('/?model=samples/aerie.aerie#flow=full-flow.3');
  await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Lines source', exact: true });
  await editor.fill(edited);
  await expect(page.locator('.crumb')).toContainText('Edited Aerie');
  await editor.fill(edited + '\ninvalid\n');
  await expect(
    page.getByRole('list', { name: 'Problems', exact: true }).locator('li'),
  ).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByLabel('Model', { exact: true }).selectOption('samples/shapes.aerie');
  await expect(page.locator('.cover-title')).toHaveText('Every Contour shape');
  await page.goBack();
  await expect(page.locator('.crumb')).toContainText('Edited Aerie');
  await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
  await expect(
    page.getByText('Your last edit has an error, so this is the last version that worked', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share model', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await editor.press('ControlOrMeta+End');
  await expect(editor).toContainText('invalid');
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.locator('.crumb')).toContainText('How Aerie works');
  await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toBeVisible();
});

test('INT-556 restored local models open their own editor source despite another same-name draft', async ({
  page,
}) => {
  await page.goto('/?model=samples/aerie.aerie');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const first = 'model first: First local\n\na: A part\n';
  const second = 'model second: Second local\n\nb: B part\n';
  await page
    .getByLabel('Open your own .aerie file')
    .setInputFiles({ name: 'same.aerie', mimeType: 'text/plain', buffer: Buffer.from(first) });
  await expect(page.locator('.cover-title')).toHaveText('First local');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Lines source', exact: true })
    .fill(first.replace('First local', 'First edited'));
  await expect(page.locator('.cover-title')).toHaveText('First edited');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page
    .getByLabel('Open your own .aerie file')
    .setInputFiles({ name: 'same.aerie', mimeType: 'text/plain', buffer: Buffer.from(second) });
  await expect(page.locator('.cover-title')).toHaveText('Second local');
  await page.goBack();
  await expect(page.locator('.cover-title')).toHaveText('First edited');
  await page.goForward();
  await expect(page.locator('.cover-title')).toHaveText('Second local');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Lines source', exact: true })).toContainText(
    'Second local',
  );
  await expect(page.locator('.cover-title')).toHaveText('Second local');
});

test('INT-506 INT-556 browser model navigation closes the old editor and retains pending edits', async ({
  page,
}) => {
  await page.goto('/?model=samples/aerie.aerie');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('Model', { exact: true }).selectOption('samples/shapes.aerie');
  await expect(page.locator('.cover-title')).toHaveText('Every Contour shape');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Lines source', exact: true })
    .fill('model pending: Pending edit\n\na: Part\n');
  await page.goBack();
  await expect(page.locator('.flow-caption')).toContainText('Stage 1 of 4');
  await expect(page.getByRole('textbox', { name: 'Lines source', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.locator('.cover-title')).toHaveText('Pending edit');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Lines source', exact: true })).toContainText(
    'Pending edit',
  );
});
