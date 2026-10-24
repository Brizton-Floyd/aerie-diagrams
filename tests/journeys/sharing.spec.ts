import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { settled, useTheme } from './reader.ts';

const localPath = join(import.meta.dirname, '../../skills/aerie/examples/first-file.aerie');
const localSource = readFileSync(localPath, 'utf8');
const bundled = readFileSync(join(import.meta.dirname, '../../samples/aerie.aerie'), 'utf8');
const edited = bundled.replace(
  'model aerie-flow: How Aerie works',
  'model aerie-flow: Edited Aerie',
);
const sentinel = 'Keep the existing clipboard when sharing a file';

test.use({ viewport: { width: 1600, height: 900 } });

for (const theme of ['dark', 'light'] as const) {
  test(`INT-508 local models explain file sharing and download their exact source (${theme})`, async ({
    page,
    context,
  }) => {
    await useTheme(page, theme);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/?model=samples/aerie.aerie');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await page.getByLabel('Open your own .aerie file').setInputFiles(localPath);
    await expect(page.locator('.cover-title')).toHaveText('Team notes');
    await page.evaluate((text) => navigator.clipboard.writeText(text), sentinel);
    await page.getByRole('button', { name: 'Share model', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Share this model', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("A link won't include it.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(sentinel);
    await settled(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download model', exact: true }).click();
    const saved = await download;
    expect(saved.suggestedFilename()).toBe('first-file.aerie');
    expect(readFileSync(await saved.path(), 'utf8')).toBe(localSource);
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Share model', exact: true })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Link copied', exact: true })).toHaveCount(0);
  });

  test(`INT-507 INT-508 edited copies use file sharing, Escape keeps the flow, and discard restores links (${theme})`, async ({
    page,
    context,
  }) => {
    await useTheme(page, theme);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/?model=samples/aerie.aerie');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await page.locator('[data-flow-step="3"]').click();
    await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
    await page.getByRole('button', { name: 'Copy link', exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Lines source', exact: true });
    await editor.fill(edited);
    expect(await page.getByRole('button', { name: 'Share model', exact: true }).isVisible()).toBe(
      true,
    );
    await expect(page.locator('.crumb')).toContainText('Edited Aerie');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.evaluate((text) => navigator.clipboard.writeText(text), sentinel);
    await page.getByRole('button', { name: 'Share model', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Share this model', exact: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
    await expect(page.getByRole('button', { name: 'Share model', exact: true })).toBeFocused();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(sentinel);
    await page.getByRole('button', { name: 'Share model', exact: true }).click();
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download model', exact: true }).click();
    const saved = await download;
    expect(readFileSync(await saved.path(), 'utf8')).toBe(edited);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await editor.fill(edited + '\ninvalid\n');
    await expect(
      page.getByRole('list', { name: 'Problems', exact: true }).locator('li'),
    ).not.toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Share model', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Copy link', exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
    const invalid = bundled + '\ninvalid\n';
    await editor.fill(invalid);
    expect(await page.getByRole('button', { name: 'Share model', exact: true }).isVisible()).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Share model', exact: true }).click();
    const invalidDownload = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download model', exact: true }).click();
    expect(readFileSync(await (await invalidDownload).path(), 'utf8')).toBe(invalid);
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toBeVisible();
  });
}
