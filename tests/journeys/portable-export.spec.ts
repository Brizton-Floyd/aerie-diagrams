import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { button, node, settled, wordedFor } from './reader.ts';

const TITLE = 'Café notes </title></script><img src=x onerror="globalThis.aerieInjected=1">';
const SOURCE = `model portable-notes: ${TITLE}
  > A complete model for an offline reader.

audiences exec "Executive", manager "Manager", engineer "Engineer" (code)

reader: Team member [person]

suite: Team notes [system]
  api: Notes app [service]
    handler: Store a note [module]
      > Literal </script><script>globalThis.aerieInjected=2</script>
      @engineer: Note command handler
  db: Notes database [store]

reader sends a note to handler
handler stores the note in db

view overview: Big picture
  show reader, suite +1

view modules: Inside the app
  show reader, suite +2

scenario save: Save a note
  reader sends a note to handler
    > A team member submits a note.
  handler stores the note in db
    > The note is saved for the team.

walkthrough tour: A tour of team notes
  step overview: suite
    > One system keeps the team's notes.
  step modules: handler
    > The handler accepts a note.
  step save: 1-2
    > Follow a note as it is saved.
`;

test.use({ viewport: { width: 1600, height: 900 } });

async function openCustomModel(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('Open your own .aerie file').setInputFiles({
    name: 'portable-notes.aerie',
    mimeType: 'text/plain',
    buffer: Buffer.from(SOURCE),
  });
  await expect(page.locator('.cover-title')).toHaveText(TITLE);
  await settled(page);
}

async function findElement(page: Page, query: string, id = query): Promise<void> {
  await page.getByRole('button', { name: 'Find element', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Find an element' });
  await dialog.getByRole('searchbox', { name: 'Search the model' }).fill(query);
  await dialog.locator(`[data-find-element="${id}"]`).click();
  await expect(dialog).not.toBeVisible();
  await expect(node(page, id)).toBeVisible();
  await settled(page);
}

/** Download to a new folder, so the reader cannot depend on its authoring server or assets. */
async function exportToFile(
  page: Page,
  info: TestInfo,
  name = 'relocated/notes.html',
): Promise<string> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  const downloaded = await pending;
  expect(downloaded.suggestedFilename()).toBe('portable-notes.html');
  const path = info.outputPath(name);
  mkdirSync(dirname(path), { recursive: true });
  await downloaded.saveAs(path);
  return path;
}

test('INT-1021 INT-1022 INT-1024 relocated HTML preserves a selected picture and every reader tool offline', async ({
  page,
  context,
}, info) => {
  test.setTimeout(60000);
  await openCustomModel(page);
  await page.keyboard.press('3');
  await findElement(page, 'handler');
  await page.getByRole('button', { name: 'Switch to the light theme', exact: true }).click();
  const opening = new URL(page.url()).hash;
  expect(opening).toContain('sel=handler');
  expect(opening).toContain('open=');
  const exporting = page.getByRole('button', { name: 'Export HTML', exact: true });
  await expect(exporting).toHaveAttribute('title', /whole model and all audience wording/);
  const path = await exportToFile(page, info);
  const html = readFileSync(path, 'utf8');
  expect(html).not.toContain('</script><img src=x');
  expect(html).not.toContain('<script>globalThis.aerieInjected=2</script>');

  const reader = await context.newPage();
  const requests: string[] = [];
  const errors: string[] = [];
  reader.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  reader.on('pageerror', (error) => errors.push(error.message));
  await context.setOffline(true);
  await reader.goto(pathToFileURL(path).href);
  await expect(reader.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(reader).toHaveTitle(`${TITLE} - Aerie`);
  await expect(reader.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(reader.locator('svg.aerie[data-view]')).toHaveAttribute('data-view', 'overview');
  await expect(reader.locator('svg.aerie[data-view]')).toHaveAttribute('data-audience', 'engineer');
  await expect(button(reader, 'handler')).toHaveAttribute('aria-pressed', 'true');
  await expect(node(reader, 'api')).toHaveClass(/\bopen\b/);
  expect(new URL(reader.url()).hash).toBe(opening);
  await expect(reader.locator('aside.panel')).toContainText('Literal </script><script>');
  await expect(reader.locator('img[src="x"], script[src], link[rel="stylesheet"]')).toHaveCount(0);
  expect(await reader.evaluate(() => 'aerieInjected' in globalThis)).toBe(false);
  expect(await reader.evaluate(() => document.fonts.check('600 14px "Inter"'))).toBe(true);
  expect(await reader.evaluate(() => document.fonts.check('500 13.5px "JetBrains Mono"'))).toBe(
    true,
  );
  await expect(reader.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(reader.getByRole('button', { name: 'Export', exact: true })).toHaveCount(0);
  await expect(reader.locator('.export-dialog')).toHaveCount(0);
  await expect(reader.getByRole('dialog', { name: 'Export diagram', exact: true })).toHaveCount(0);
  await expect(reader.getByRole('combobox', { name: 'Model', exact: true })).toHaveCount(0);
  await expect(reader.getByLabel('Open your own .aerie file')).toHaveCount(0);

  const first = reader.url();
  await reader.locator('aside.panel button[data-follow-view="modules"]').click();
  await expect(reader.locator('svg.aerie[data-view]')).toHaveAttribute('data-view', 'modules');
  await expect(button(reader, 'handler')).toHaveAttribute('aria-pressed', 'true');
  const followed = reader.url();
  expect(new URL(followed).hash).toContain('view=modules');
  await reader.goBack();
  await expect(reader).toHaveURL(first);
  await expect(reader.locator('svg.aerie[data-view]')).toHaveAttribute('data-view', 'overview');
  await reader.goForward();
  await expect(reader).toHaveURL(followed);
  await reader.reload();
  await expect(reader.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(reader.locator('svg.aerie[data-view]')).toHaveAttribute('data-view', 'modules');
  await expect(button(reader, 'handler')).toHaveAttribute('aria-pressed', 'true');

  await reader.keyboard.press('1');
  await wordedFor(reader, 'plain');
  await findElement(reader, 'Note command handler', 'handler');
  await expect(reader.locator('aside.panel h1')).toContainText('Store a note');
  await reader.locator('button[data-view="overview"]').click();
  await expect(node(reader, 'handler')).toHaveCount(0);
  await button(reader, 'api').focus();
  await reader.keyboard.press('o');
  await expect(node(reader, 'handler')).toBeVisible();
  await button(reader, 'api').focus();
  await reader.keyboard.press('o');
  await expect(node(reader, 'handler')).toHaveCount(0);

  await reader.locator('button[data-scenario="save"]').click();
  await expect(reader.locator('.caption-bar .count')).toHaveText('Step 1 of 2');
  await reader.locator('aside.panel button[data-control="next"]').click();
  await expect(reader.locator('.caption-bar .count')).toHaveText('Step 2 of 2');
  await reader.locator('aside.panel button[data-control="lanes"]').click();
  await expect(reader.locator('svg.aerie[data-view] g.rows')).toBeVisible();
  await reader.locator('aside.panel button[data-control="done"]').click();
  await reader.locator('button[data-walkthrough="tour"]').click();
  await expect(reader.locator('.narration-bar .narration-meta .count')).toHaveText('1 of 3');
  await reader.keyboard.press('ArrowRight');
  await expect(reader.locator('.narration-bar .narration-meta .count')).toHaveText('2 of 3');
  await reader.keyboard.press('Escape');
  await expect(reader.locator('#app')).not.toHaveClass(/\bpresenting\b/);
  await settled(reader);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test('INT-1021 INT-1022 HTML reopens the exported scenario step and lanes rather than the default view', async ({
  page,
  context,
}, info) => {
  await openCustomModel(page);
  await page.locator('button[data-scenario="save"]').click();
  await page.locator('aside.panel button[data-control="next"]').click();
  await page.locator('aside.panel button[data-control="lanes"]').click();
  await expect(page.locator('.caption-bar .count')).toHaveText('Step 2 of 2');
  const fragment = new URL(page.url()).hash;
  const path = await exportToFile(page, info);
  await context.setOffline(true);
  const reader = await context.newPage();
  await reader.goto(pathToFileURL(path).href);
  await expect(reader.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(reader.locator('.caption-bar .count')).toHaveText('Step 2 of 2');
  await expect(reader.locator('svg.aerie[data-view] g.rows')).toBeVisible();
  expect(new URL(reader.url()).hash).toBe(fragment);
});

test('INT-1021 INT-1023 export captures a valid pending edit and normalizes a removed selection', async ({
  page,
  context,
}, info) => {
  await openCustomModel(page);
  await findElement(page, 'handler');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Lines source', exact: true });
  await expect(editor).toBeVisible();
  await settled(page);
  const moment = new Date('2026-10-26T12:00:00Z');
  await page.clock.install({ time: moment });
  await page.clock.pauseAt(new Date(moment.getTime() + 1000));
  const edited = SOURCE.replaceAll('handler', 'replacement-handler');
  await editor.fill(edited);
  // The selected original is still drawn because the debounced editor check has not run.
  await expect(button(page, 'handler')).toHaveAttribute('aria-pressed', 'true');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export HTML', exact: true }).dispatchEvent('click');
  const downloaded = await pending;
  const path = info.outputPath('pending-edit/notes.html');
  mkdirSync(dirname(path), { recursive: true });
  await downloaded.saveAs(path);
  const serialized = /<script type="application\/json" id="aerie-export">([\s\S]*?)<\/script>/.exec(
    readFileSync(path, 'utf8'),
  )?.[1];
  expect(serialized).toBeDefined();
  const snapshot = JSON.parse(serialized ?? 'null') as { source: string; fragment: string };
  expect(snapshot.source).toBe(edited);
  expect(new URLSearchParams(snapshot.fragment.replace(/^#/, '')).get('sel')).not.toBe('handler');

  // The snapshot is already captured; allow the new reader's layout and rendering timers to run.
  await page.clock.resume();
  await context.setOffline(true);
  const reader = await context.newPage();
  await reader.goto(pathToFileURL(path).href);
  await expect(reader.locator('#app')).toHaveAttribute('data-ready', 'true');
  expect(new URLSearchParams(new URL(reader.url()).hash.slice(1)).get('sel')).not.toBe('handler');
  await expect(node(reader, 'handler')).toHaveCount(0);
  await findElement(reader, 'replacement-handler');
  await expect(button(reader, 'replacement-handler')).toHaveAttribute('aria-pressed', 'true');
});

test('INT-1023 invalid source is rejected before its delayed check and after diagnostics appear', async ({
  page,
}) => {
  await openCustomModel(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Lines source', exact: true });
  await expect(editor).toBeVisible();
  const downloads: string[] = [];
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  const moment = new Date('2026-10-26T12:00:00Z');
  await page.clock.install({ time: moment });
  await page.clock.pauseAt(new Date(moment.getTime() + 1000));
  await editor.fill(`${SOURCE}\ninvalid\n`);
  await expect(page.getByRole('list', { name: 'Problems', exact: true }).locator('li')).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Export HTML', exact: true }).dispatchEvent('click');
  await expect(page.locator('.notice')).toContainText('before exporting HTML');
  expect(downloads).toEqual([]);
  await page.clock.runFor(300);
  await expect(
    page.getByRole('list', { name: 'Problems', exact: true }).locator('li'),
  ).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Export HTML', exact: true }).dispatchEvent('click');
  await expect(page.locator('.notice')).toContainText('before exporting HTML');
  await expect(page.getByRole('button', { name: 'Export HTML', exact: true })).toBeEnabled();
  expect(downloads).toEqual([]);
});

test('INT-1023 a reader-runtime load failure restores the export control and can be retried', async ({
  page,
}) => {
  await openCustomModel(page);
  let attempts = 0;
  await page.route(/\/reader(?:-[^/?]+)?\.txt(?:\?.*)?$/, async (route) => {
    attempts++;
    if (attempts === 1)
      await route.fulfill({ status: 503, body: 'Reader temporarily unavailable' });
    else await route.continue();
  });
  const exporting = page.getByRole('button', { name: 'Export HTML', exact: true });
  await exporting.click();
  await expect(page.locator('.notice')).toHaveText(
    'Aerie could not prepare the HTML file. Try exporting again.',
  );
  await expect(exporting).toBeEnabled();
  expect(attempts).toBe(1);
  const pending = page.waitForEvent('download');
  await exporting.click();
  expect((await pending).suggestedFilename()).toBe('portable-notes.html');
  await expect(exporting).toBeEnabled();
  expect(attempts).toBe(2);
});
