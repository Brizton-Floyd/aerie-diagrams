// Watch mode on the Lotto sample (docs/spec/interaction.md, INT-851 to INT-855): `aerie watch` serves
// the production build, and the page follows the author's file as it is saved in another editor.
import { spawn, type ChildProcess } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

const ROOT = join(import.meta.dirname, '../..');
const LOTTO = readFileSync(join(ROOT, 'samples/lotto.aerie'), 'utf8');
const TYPO = LOTTO.replace(
  'website gets screen data from screen-api',
  'website gets screen data from screen-apu',
);

const TYPO_MESSAGE =
  'Line 213, column 31: There is no element called `screen-apu`. Did you mean `screen-api`?';

test.use({ viewport: { width: 1600, height: 900 } });

let folder = '';
let file = '';
let server: ChildProcess | null = null;
let printed = '';

/** Starts `aerie watch` on any free port and resolves with the address it prints. */
async function startWatching(): Promise<string> {
  server = spawn(
    process.execPath,
    [join(ROOT, 'src/cli/aerie.ts'), 'watch', file, '--port', '0', '--no-open'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return new Promise((done, fail) => {
    server?.stdout?.setEncoding('utf8');
    server?.stdout?.on('data', (chunk: string) => {
      printed += chunk;
      const url = /The diagram is at (http:\/\/127\.0\.0\.1:\d+\/)/.exec(printed)?.[1];
      if (url !== undefined) done(url);
    });
    server?.stderr?.on('data', (chunk: Buffer) => {
      fail(new Error(chunk.toString()));
    });
  });
}

test.beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'aerie-journey-'));
  file = join(folder, 'lotto.aerie');
  copyFileSync(join(ROOT, 'samples/lotto.aerie'), file);
  printed = '';
});

test.afterEach(() => {
  server?.kill('SIGKILL');
  server = null;
  rmSync(folder, { recursive: true, force: true });
});

const websiteName = (page: Page): Locator =>
  page.locator('svg.aerie g.node[data-id="website"] text').first();

async function openPage(page: Page): Promise<void> {
  await page.goto(await startWatching());
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(websiteName(page)).toHaveText('Website');
}

test('JOURNEY-009 and SCOPE-008 watch a file: saves update the page, an error keeps the picture, Ctrl+C stops', async ({
  page,
}) => {
  await openPage(page);
  await page.locator('button[data-view="services"]').click();
  await page.getByRole('tab', { name: 'Engineer' }).click();
  await expect(page.locator('svg.aerie')).toHaveAttribute('data-audience', 'engineer');

  writeFileSync(file, LOTTO.replace('website: Website |', 'website: Web shop |'));
  await expect(websiteName(page)).toHaveText('Web shop');
  await expect(page.locator('svg.aerie')).toHaveAttribute('data-view', 'services');
  await expect(page.locator('svg.aerie')).toHaveAttribute('data-audience', 'engineer');

  const before = await page.locator('svg.aerie').innerHTML();
  writeFileSync(file, TYPO);
  await expect(page.locator('.overlay')).toHaveText(TYPO_MESSAGE);
  await expect(page.locator('.notice')).toHaveText('Showing the last version without errors');
  expect(await page.locator('svg.aerie').innerHTML()).toBe(before);

  writeFileSync(file, LOTTO);
  await expect(websiteName(page)).toHaveText('Website');
  await expect(page.locator('.overlay')).toBeHidden();
  await expect(page.locator('.notice')).toBeHidden();

  const stopped = new Promise<number | null>((done) => server?.on('close', done));
  server?.kill('SIGINT');
  expect(await stopped).toBe(0);
  expect(printed).toMatch(/Stopped watching\.\n$/);
});

test('INT-851 INT-855 the page shows the file, offers no other model and has no Edit button', async ({
  page,
}) => {
  await openPage(page);
  await expect(page.locator('svg.aerie')).toHaveAttribute('data-view', 'big-picture');
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await expect(page.getByLabel('Model')).toHaveCount(0);
  await expect(page.getByLabel('Open a .aerie file')).toHaveCount(0);
  expect(new URL(page.url()).search).toBe('');
});

test('INT-852 saving the file updates the page, keeping the view and audience the reader chose', async ({
  page,
}) => {
  await openPage(page);
  await page.locator('button[data-view="services"]').click();
  await page.getByRole('tab', { name: 'Engineer' }).click();
  await expect(page.locator('svg.aerie')).toHaveAttribute('data-audience', 'engineer');
  writeFileSync(file, LOTTO.replace('website: Website |', 'website: Web shop |'));
  await expect(websiteName(page)).toHaveText('Web shop');
  await expect(page.locator('svg.aerie')).toHaveAttribute('data-view', 'services');
  await expect(page.locator('svg.aerie')).toHaveAttribute('data-audience', 'engineer');
  await expect(page.locator('.notice')).toBeHidden();
  expect(printed).toMatch(/Updated\.\n.*Updated\.\n$/s);
});

test('INT-852 an error keeps the last picture and shows the error list over the stage; fixing it updates', async ({
  page,
}) => {
  await openPage(page);
  const before = await page.locator('svg.aerie').innerHTML();
  writeFileSync(file, TYPO);
  await expect(page.locator('.notice')).toHaveText('Showing the last version without errors');
  await expect(page.locator('.overlay')).toHaveText(TYPO_MESSAGE);
  expect(await page.locator('svg.aerie').innerHTML()).toBe(before);
  await expect.poll(() => printed).toContain('Showing the last version without errors.\n');
  expect(printed).toContain(
    `${file}:213:31: error E008: There is no element called \`screen-apu\`. Did you mean \`screen-api\`?\n`,
  );

  writeFileSync(file, LOTTO.replace('website: Website |', 'website: Web shop |'));
  await expect(websiteName(page)).toHaveText('Web shop');
  await expect(page.locator('.notice')).toBeHidden();
  await expect(page.locator('.overlay')).toBeHidden();
});

test('INT-854 a deleted file keeps the picture and says so, and the page recovers when it is back', async ({
  page,
}) => {
  await openPage(page);
  const before = await page.locator('svg.aerie').innerHTML();
  unlinkSync(file);
  await expect(page.locator('.notice')).toHaveText(
    'Aerie cannot read lotto.aerie: there is no file with that name any more.',
  );
  expect(await page.locator('svg.aerie').innerHTML()).toBe(before);
  writeFileSync(file, LOTTO.replace('website: Website |', 'website: Web shop |'));
  await expect(websiteName(page)).toHaveText('Web shop');
  await expect(page.locator('.notice')).toBeHidden();
});

test('INT-855 Ctrl+C in the terminal stops the server', async ({ page }) => {
  await openPage(page);
  const stopped = new Promise<number | null>((done) => server?.on('close', done));
  server?.kill('SIGINT');
  expect(await stopped).toBe(0);
  expect(printed).toMatch(/Stopped watching\.\n$/);
});
