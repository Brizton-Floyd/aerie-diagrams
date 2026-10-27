import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { node, openLotto, scale, settled, wordedFor } from './reader.ts';

test.use({ viewport: { width: 1600, height: 900 } });

const finder = (page: Page) => page.getByRole('dialog', { name: 'Find an element' });
const input = (page: Page) => finder(page).getByRole('searchbox', { name: 'Search the model' });

async function find(page: Page, query: string): Promise<void> {
  await page.getByRole('button', { name: 'Find element', exact: true }).click();
  await input(page).fill(query);
}

async function picked(page: Page, id: string): Promise<void> {
  await finder(page).locator(`[data-find-element="${id}"]`).click();
  await expect(finder(page)).not.toBeVisible();
  await expect(node(page, id)).toBeVisible();
  await expect.poll(() => new URL(page.url()).hash).toContain(`sel=${id}`);
  await settled(page);
}

test('INT-1001 INT-1003 search finds technical wording and reveals a deeply nested element', async ({
  page,
}) => {
  await openLotto(page);
  await find(page, 'BFF');
  const match = finder(page).locator('[data-find-element="screen-api"]');
  await expect(match).toContainText('Website back end');
  await expect(match).toContainText('BFF');
  await expect(match).toContainText('Lotto suite');
  await picked(page, 'screen-api');
  await wordedFor(page, 'plain');
  await find(page, 'request-handling');
  await input(page).press('ArrowDown');
  await expect(finder(page).locator('[data-find-element="request-handling"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(finder(page)).not.toBeVisible();
  await expect(node(page, 'request-handling')).toBeVisible();
  expect(new URL(page.url()).hash).toContain('sel=request-handling');
  expect(new URL(page.url()).hash).toContain('open=');
});

test('INT-1002 search owns its keys, reports no matches, restores focus and supports the shortcut', async ({
  page,
}) => {
  await openLotto(page);
  const trigger = page.getByRole('button', { name: 'Find element', exact: true });
  await trigger.click();
  await input(page).fill('nothing-matches-this-query');
  await expect(finder(page).getByRole('status')).toHaveText('No elements match your search.');
  await input(page).press('Enter');
  await expect(finder(page)).toBeVisible();
  await input(page).press('Escape');
  await expect(finder(page)).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(input(page)).toBeFocused();
  await input(page).fill('screen-api');
  await input(page).press('Enter');
  await expect(node(page, 'screen-api')).toBeVisible();
  const before = new URL(page.url()).hash;
  await page.keyboard.press('Meta+k');
  await expect(input(page)).toBeFocused();
  await input(page).press('Escape');
  expect(new URL(page.url()).hash).toBe(before);
});

test('INT-1002 the finder has no accessibility violations in either theme', async ({ page }) => {
  await openLotto(page);
  for (const theme of ['light', 'dark']) {
    await page.getByRole('button', { name: `Switch to the ${theme} theme` }).click();
    await find(page, 'api');
    const audit = await new AxeBuilder({ page }).include('.element-search').analyze();
    expect(audit.violations).toEqual([]);
    await input(page).press('Escape');
  }
});

test('INT-1011 INT-1012 following an element keeps its wording, selection, link and visit history', async ({
  page,
  context,
}) => {
  await openLotto(page);
  await page.keyboard.press('3');
  await find(page, 'request-handling');
  await picked(page, 'request-handling');
  const before = page.url();
  const follow = page.locator('aside.panel button[data-follow-view="engineering"]');
  await expect(follow).toBeVisible();
  await follow.click();
  await expect(page.locator('svg.aerie[data-view="engineering"]')).toBeVisible();
  await expect(node(page, 'request-handling')).toBeVisible();
  await wordedFor(page, 'Engineer');
  await settled(page);
  expect(await scale(page)).toBeGreaterThanOrEqual(1);
  const linked = page.url();
  expect(new URL(linked).hash).toContain('view=engineering');
  expect(new URL(linked).hash).toContain('sel=request-handling');
  const fresh = await context.newPage();
  await fresh.goto(linked);
  await expect(node(fresh, 'request-handling')).toBeVisible();
  await expect(fresh.locator('svg.aerie[data-view]')).toHaveAttribute('data-view', 'engineering');
  await page.goBack();
  await expect(page).toHaveURL(before);
  await expect(node(page, 'request-handling')).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(linked);
  await page.locator('button[data-view="services"]').click();
  expect(new URL(page.url()).hash).not.toContain('sel=');
});

const MODEL = `model islands: Islands
app: App [system]
  client: Client [service]
remote: Remote [external]
unused: Unused
view local: Local
  show app
view remote-view: Remote view
  show remote
`;

test('INT-1003 search changes view when needed and cannot select an element excluded from all views', async ({
  page,
}) => {
  await openLotto(page);
  await page
    .getByLabel('Open your own .aerie file')
    .setInputFiles({ name: 'islands.aerie', mimeType: 'text/plain', buffer: Buffer.from(MODEL) });
  await expect(page.locator('svg.aerie[data-view]')).toHaveAttribute('data-view', 'local');
  await find(page, 'unused');
  await expect(finder(page).locator('[data-find-element="unused"]')).toBeDisabled();
  await expect(finder(page)).toContainText('Not included in any view');
  await input(page).fill('remote');
  await picked(page, 'remote');
  await expect(page.locator('svg.aerie[data-view]')).toHaveAttribute('data-view', 'remote-view');
  await find(page, 'client');
  await picked(page, 'client');
  await expect(page.locator('svg.aerie[data-view]')).toHaveAttribute('data-view', 'local');
  await find(page, 'client');
  await page.goBack();
  await page.goBack();
  await page.goBack();
  await expect(finder(page)).not.toBeVisible();
  await expect(page.locator('svg.aerie[data-view]')).toHaveAttribute('data-view', 'big-picture');
});

test('INT-1003 choosing a search result ends scenario playback before revealing it', async ({
  page,
}) => {
  await openLotto(page);
  await page.locator('button[data-scenario="generate-picks"]').click();
  await expect(page.locator('.caption-bar')).toBeVisible();
  await find(page, 'request-handling');
  await picked(page, 'request-handling');
  await expect(page.locator('.caption-bar')).not.toBeVisible();
  expect(new URL(page.url()).hash).not.toContain('play=');
});

test('INT-1003 cross-view search brings a part in a large view into readable camera focus', async ({
  page,
}) => {
  await openLotto(page);
  const parts = Array.from(
    { length: 64 },
    (_, at) => `  part-${String(at)}: Part ${String(at)} [service]`,
  ).join('\n');
  const source = `model many: Many parts\nlocal: Local [system]\nremote: Remote [system]\n${parts}\nview home: Home\n  show local\nview detail: Detail\n  show remote +1\n`;
  await page.getByLabel('Open your own .aerie file').setInputFiles({
    name: 'many.aerie',
    mimeType: 'text/plain',
    buffer: Buffer.from(source),
  });
  await expect(page.locator('svg.aerie[data-view="home"]')).toBeVisible();
  await find(page, 'part-63');
  await picked(page, 'part-63');
  await expect(page.locator('svg.aerie[data-view="detail"]')).toBeVisible();
  expect(await scale(page)).toBeGreaterThanOrEqual(1);
  const target = await node(page, 'part-63').boundingBox();
  const stage = await page.locator('.aerie-stage').boundingBox();
  expect(target).not.toBeNull();
  expect(stage).not.toBeNull();
  if (target === null || stage === null) return;
  expect(target.x).toBeGreaterThanOrEqual(stage.x - 1);
  expect(target.y).toBeGreaterThanOrEqual(stage.y - 1);
  expect(target.x + target.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
  expect(target.y + target.height).toBeLessThanOrEqual(stage.y + stage.height + 1);
});
