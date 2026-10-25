import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { PDFDocument } from 'pdf-lib';
import { expect, test, type Page } from '@playwright/test';
import { settled } from './reader.ts';

const source = readFileSync(join(import.meta.dirname, '../../samples/aerie.aerie'), 'utf8');
test.use({ viewport: { width: 1600, height: 1000 } });
test.setTimeout(90_000);
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Export diagram', exact: true });
async function open(page: Page): Promise<void> {
  await page.goto('/?model=samples/aerie.aerie');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await settled(page);
}
async function ready(page: Page): Promise<void> {
  await expect(dialog(page).locator('.export-preview')).toHaveAttribute('aria-busy', 'false');
}
async function words(page: Page): Promise<string> {
  const images = await dialog(page)
    .locator('.export-preview img')
    .evaluateAll((elements) =>
      Promise.all(
        elements.map(async (element) => {
          const text = await (await fetch((element as HTMLImageElement).src)).text();
          const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
          return [...doc.querySelectorAll('text')].map((node) => node.textContent).join('\n');
        }),
      ),
    );
  return images.join('\n');
}

test('EXPORT-001 EXPORT-006 EXPORT-007 EXPORT-010 downloads a complete PNG and leaves picture, camera and keyboard flow unchanged', async ({
  page,
}) => {
  await open(page);
  await page.locator('[data-flow-step="3"]').click();
  await settled(page);
  const address = page.url();
  const before = await page.locator('.aerie-stage svg.aerie').getAttribute('viewBox');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await ready(page);
  await expect(
    dialog(page).getByRole('button', { name: 'Download PNG', exact: true }),
  ).toBeEnabled();
  const content = await words(page);
  expect(content).toContain('Lines language');
  expect(content).toContain('Step 8:');
  expect(content).toContain('Stage 4:');
  expect(content).not.toContain('Component reference');
  await dialog(page).getByLabel('Preview size', { exact: true }).selectOption('actual');
  await expect(dialog(page).locator('.export-preview')).toHaveClass(/actual-size/);
  const event = page.waitForEvent('download');
  await dialog(page).getByRole('button', { name: 'Download PNG', exact: true }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe('Big-picture-Create-a-diagram-Plain.png');
  const bytes = readFileSync(await download.path());
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.readUInt32BE(16)).toBeGreaterThan(1000);
  expect(bytes.readUInt32BE(20)).toBeLessThanOrEqual(8192);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeFocused();
  expect(page.url()).toBe(address);
  expect(await page.locator('.aerie-stage svg.aerie').getAttribute('viewBox')).toBe(before);
  await expect(page.locator('.flow-caption')).toContainText('Stage 3 of 4');
});

test('EXPORT-003 EXPORT-005 EXPORT-006 EXPORT-007 EXPORT-010 oversized complete PNG offers a paginated PDF with authored reference content', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await ready(page);
  await dialog(page).getByLabel('Include component reference', { exact: true }).check();
  await ready(page);
  await expect(
    dialog(page).getByRole('button', { name: 'Download PNG', exact: true }),
  ).toBeDisabled();
  await expect(dialog(page).locator('.export-status')).toContainText('Try PDF');
  await dialog(page).getByLabel('Format', { exact: true }).selectOption('pdf');
  await ready(page);
  const previews = await dialog(page).locator('.export-preview img').count();
  expect(previews).toBeGreaterThan(2);
  const content = await words(page);
  expect(content).toContain('Component reference');
  expect(content).toContain('Incoming connections');
  expect(content).toContain('Step 8:');
  // The prototype's extra repository-sourced rationale must not become production content.
  expect(content).not.toContain('Reserve space for every audience');
  const event = page.waitForEvent('download');
  await dialog(page).getByRole('button', { name: 'Download PDF', exact: true }).click();
  const download = await event;
  const pdf = await PDFDocument.load(readFileSync(await download.path()), {
    updateMetadata: false,
  });
  expect(download.suggestedFilename()).toBe('Big-picture-Create-a-diagram-Plain.pdf');
  expect(pdf.getPageCount()).toBe(previews);
  expect(pdf.getCreator()).toBe('');
  expect(pdf.getProducer()).toBe('');
  for (const pdfPage of pdf.getPages()) {
    expect(pdfPage.getWidth()).toBeGreaterThan(0);
    expect(pdfPage.getHeight()).toBeGreaterThan(0);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('EXPORT-004 EXPORT-007 custom wording, unstaged flow and architecture-only choices stay isolated', async ({
  page,
}) => {
  await open(page);
  const custom = `model customer: Customer system
audiences plain "Overview", specialist "Operations" (code)
root: Customer system
  child: Worker
    > Base authored description.
    @specialist >> Specialist authored note.
  store: Storage
child writes to store
view one: Architecture
  show root
scenario write: Save data
  child writes to store
    > Retain this complete step explanation.
`;
  await page
    .getByLabel('Open your own .aerie file')
    .setInputFiles({ name: 'customer.aerie', mimeType: 'text/plain', buffer: Buffer.from(custom) });
  await expect(page.locator('.cover-title')).toHaveText('Customer system');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await ready(page);
  await expect(dialog(page).getByLabel('Wording', { exact: true })).toHaveValue('plain');
  await dialog(page).getByLabel('Flow', { exact: true }).selectOption('write');
  await dialog(page).getByLabel('Wording', { exact: true }).selectOption('specialist');
  await ready(page);
  let content = await words(page);
  expect(content).toContain('Operations');
  expect(content).toContain('Retain this complete step explanation.');
  expect(content).not.toContain('Aerie');
  await dialog(page).getByLabel('Flow', { exact: true }).selectOption('');
  await ready(page);
  content = await words(page);
  expect(content).not.toContain('Retain this complete step explanation.');
  expect(content).toContain('Worker');
  await page.keyboard.press('Escape');
  await expect(page.locator('.aerie-stage svg.aerie')).toHaveAttribute('data-audience', 'plain');
});

test('EXPORT-008 exports a coherent last-valid edited model with warning outside the file', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Lines source', exact: true });
  const edited = source.replace(
    'Writes the architecture once in a Lines file.',
    'Last valid authored reference note.',
  );
  await editor.fill(edited);
  await page.waitForTimeout(400);
  await editor.fill(edited + '\nthis is invalid model text\n');
  await expect(
    page.getByRole('list', { name: 'Problems', exact: true }).locator('li'),
  ).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(dialog(page).locator('.export-warning')).toContainText('last valid model');
  await dialog(page).getByLabel('Format', { exact: true }).selectOption('pdf');
  await dialog(page).getByLabel('Include component reference', { exact: true }).check();
  await ready(page);
  const content = await words(page);
  expect(content).toContain('Last valid authored reference note.');
  expect(content).not.toContain('this is invalid model text');
  expect(content).not.toContain('Your latest edits contain errors.');
  await page.keyboard.press('Escape');
  await expect(editor).toContainText('this is invalid model text');
});

test('EXPORT-008 an invalid first model offers no export rather than substituting another model', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Open your own .aerie file').setInputFiles({
    name: 'invalid.aerie',
    mimeType: 'text/plain',
    buffer: Buffer.from('invalid model\n'),
  });
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.locator('.notice')).toContainText('There is no valid diagram to export yet');
  await expect(dialog(page)).toHaveCount(0);
});

test('EXPORT-007 EXPORT-009 failed font loading retains controls and can retry without reload', async ({
  page,
}) => {
  await open(page);
  await page.route('**/*inter-latin-400-normal*.woff2', (route) => route.abort());
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await ready(page);
  await expect(
    dialog(page).getByRole('button', { name: 'Download PNG', exact: true }),
  ).toBeDisabled();
  await expect(
    dialog(page).getByRole('button', { name: 'Retry preview', exact: true }),
  ).toBeVisible();
  await page.unroute('**/*inter-latin-400-normal*.woff2');
  await dialog(page).getByRole('button', { name: 'Retry preview', exact: true }).click();
  await ready(page);
  await expect(
    dialog(page).getByRole('button', { name: 'Download PNG', exact: true }),
  ).toBeEnabled();
});
