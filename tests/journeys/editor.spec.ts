// The live split editor on the Lotto sample (docs/spec/interaction.md, INT-801 to INT-808, and
// JOURNEY-007), used as an author would: real clicks and keys in the production build.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

const LOTTO = readFileSync(join(import.meta.dirname, '../../samples/lotto.aerie'), 'utf8');
const RELATIONSHIP = 'website gets screen data from screen-api';
const TYPO_MESSAGE =
  'Line 168, column 31: There is no element called `screen-apu`. Did you mean `screen-api`?';

test.use({ viewport: { width: 1600, height: 900 } });

const editor = (page: Page): Locator => page.locator('.editor-host .cm-content');
const websiteName = (page: Page): Locator =>
  page.locator('svg.aerie g.node[data-id="website"] text').first();

async function openEditor(page: Page): Promise<void> {
  await page.goto('/?model=samples/lotto.aerie');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(editor(page)).toBeVisible();
}

/** Scrolls the editor until a line that reads `text` is drawn, and puts the cursor at its end. */
async function goToLine(page: Page, text: string): Promise<Locator> {
  const line = page.locator('.editor-host .cm-line').filter({ hasText: text }).first();
  await editor(page).focus();
  await page.keyboard.press('ControlOrMeta+Home');
  const box = await page.locator('.editor-host .cm-scroller').boundingBox();
  if (box === null) throw new Error('the editor is not on screen');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let tries = 0; tries < 40 && !(await line.isVisible()); tries++) {
    await page.mouse.wheel(0, 500);
  }
  await line.click();
  await page.keyboard.press('End');
  return line;
}

/** Moves the cursor to `column` characters after the start of its line's text, with the keys. */
async function toColumn(page: Page, column: number): Promise<void> {
  await page.keyboard.press('Home');
  for (let moved = 0; moved < column; moved++) await page.keyboard.press('ArrowRight');
}

/** The editor's lines that read exactly `text`, among those drawn (near the cursor). */
const line = (page: Page, text: string): Locator =>
  page
    .locator('.editor-host .cm-line')
    .filter({ hasText: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });

test('INT-801 Edit opens the source where the sidebar was, 40% of the window; Done closes it', async ({
  page,
}) => {
  await openEditor(page);
  await expect(page.getByRole('navigation', { name: 'Diagram' })).toBeHidden();
  const pane = page.getByRole('region', { name: 'Split editor' });
  expect((await pane.boundingBox())?.width).toBe(640);
  await expect(page.locator('main.aerie-stage svg.aerie')).toBeVisible();
  await expect(page.locator('aside.panel')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(pane).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Diagram' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
});

test('INT-801 the divider can be dragged, and the editor keeps at least 360 px', async ({
  page,
}) => {
  await openEditor(page);
  const pane = page.getByRole('region', { name: 'Split editor' });
  const divider = page.getByRole('separator', { name: 'Editor width' });
  const at = await divider.boundingBox();
  if (at === null) throw new Error('no divider');
  const y = at.y + at.height / 2;
  await page.mouse.move(at.x + at.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(800, y, { steps: 4 });
  await page.mouse.up();
  expect(Math.abs(((await pane.boundingBox())?.width ?? 0) - 800)).toBeLessThanOrEqual(4);
  const moved = await divider.boundingBox();
  if (moved === null) throw new Error('no divider');
  await page.mouse.move(moved.x + moved.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(100, y, { steps: 4 });
  await page.mouse.up();
  expect((await pane.boundingBox())?.width).toBe(360);
});

test('INT-801 while editing, the breadcrumb view title opens a menu of views, scenarios and walkthroughs', async ({
  page,
}) => {
  await openEditor(page);
  await page.locator('.crumb').getByRole('button', { name: 'Big picture' }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem')).toHaveText([
    'Big picture',
    'Services',
    'Engineering: code modules',
    'Generate picks',
    'Results poll',
    'A tour of the Lotto suite',
  ]);
  await menu.getByRole('menuitem', { name: 'Services' }).click();
  await expect(page.locator('svg.aerie')).toHaveAttribute('data-view', 'services');
  await expect(page.locator('.crumb').getByRole('button', { name: 'Services' })).toBeVisible();
});

test('INT-802 the editor shows line numbers and colours lines by kind, in Source Code Pro', async ({
  page,
}) => {
  await openEditor(page);
  const numbers = page.locator('.editor-host .cm-lineNumbers .cm-gutterElement');
  await expect(numbers.filter({ hasText: /^1$/ })).toBeVisible();
  await expect(numbers.filter({ hasText: /^2$/ })).toBeVisible();
  const modelLine = page.locator('.editor-host .cm-line').filter({ hasText: /^model lotto:/ });
  await expect(modelLine.locator('.lines-keyword')).toHaveText('model');
  await expect(modelLine.locator('.lines-id')).toHaveText('lotto');
  await expect(page.locator('.editor-host .lines-comment').first()).toHaveText(/^\/\/ The Lotto/);
  await expect(page.locator('.editor-host .lines-tag').first()).toHaveText('default');
  const face = await editor(page).evaluate((node) => getComputedStyle(node).fontFamily);
  expect(face).toMatch(/^"Source Code Pro"/);
});

test('INT-803 Enter keeps the indent and adds two spaces after a line that opens a block; Tab indents', async ({
  page,
}) => {
  await openEditor(page);
  await goToLine(page, 'website: Website | Picks a game, generates numbers [service]');
  await page.keyboard.press('Enter');
  await page.keyboard.type('icon box');
  await page.keyboard.press('Enter');
  await page.keyboard.type('> Where readers start.');
  await expect(line(page, '    icon box')).toHaveCount(1);
  await expect(line(page, '    > Where readers start.')).toHaveCount(1);
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+Tab');
  await expect(line(page, '  > Where readers start.')).toHaveCount(1);
  await page.keyboard.press('Tab');
  await expect(line(page, '    > Where readers start.')).toHaveCount(1);
});

test('INT-804 completion offers element ids at the end of a sentence', async ({ page }) => {
  await openEditor(page);
  await goToLine(page, RELATIONSHIP);
  await page.keyboard.press('Enter');
  await page.keyboard.type('website reads from scr');
  const list = page.locator('.cm-tooltip-autocomplete');
  await expect(list.getByRole('option', { name: /^screen-api/ })).toBeVisible();
  // CodeMirror ignores Enter for 75 ms after the list opens (interactionDelay), as a person would.
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await expect(line(page, 'website reads from screen-api')).toHaveCount(1);
});

test('INT-805 the diagram updates after typing stops, keeping the view and audience', async ({
  page,
}) => {
  await openEditor(page);
  await page.locator('.crumb').getByRole('button', { name: 'Big picture' }).click();
  await page.getByRole('menuitem', { name: 'Services' }).click();
  await page.getByRole('tab', { name: 'Engineer' }).click();
  await expect(page.locator('svg.aerie')).toHaveAttribute('data-audience', 'engineer');
  await expect(websiteName(page)).toHaveText('Website');
  await goToLine(page, 'website: Website | Picks a game, generates numbers [service]');
  await toColumn(page, 'website: Website'.length);
  await page.keyboard.type(' shop');
  await expect(websiteName(page)).toHaveText('Website shop');
  await expect(page.locator('svg.aerie')).toHaveAttribute('data-view', 'services');
  await expect(page.locator('svg.aerie')).toHaveAttribute('data-audience', 'engineer');
  await expect(page.locator('.notice')).toBeHidden();
});

test('JOURNEY-007 INT-806 an error keeps the last diagram and lists the error in plain words; undo brings it back', async ({
  page,
}) => {
  await openEditor(page);
  const before = await page.locator('svg.aerie').innerHTML();
  await goToLine(page, RELATIONSHIP);
  await page.keyboard.press('Backspace');
  await page.keyboard.type('u');
  const errors = page.getByRole('list', { name: 'Problems' });
  await expect(errors.locator('li').first()).toHaveText(TYPO_MESSAGE);
  await expect(errors.locator('li.error')).toHaveCount(1);
  await expect(errors.locator('li.warning')).toHaveCount(3);
  await expect(page.locator('.notice')).toHaveText('Showing the last version without errors');
  expect(await page.locator('svg.aerie').innerHTML()).toBe(before);

  // Underlined in the text and marked in the margin; hovering shows the message.
  const mark = page.locator('.editor-host .cm-lintRange-error');
  await expect(mark).toHaveText('screen-apu');
  await expect(page.locator('.editor-host .cm-lint-marker-error')).toHaveCount(1);
  await mark.hover();
  await expect(page.locator('.cm-tooltip-hover')).toContainText(
    'There is no element called `screen-apu`. Did you mean `screen-api`?',
  );

  // Choosing the error moves the cursor to it.
  await page.mouse.move(0, 0);
  await page.locator('.editor-host .cm-content').press('ControlOrMeta+Home');
  await errors.locator('li.error button').click();
  await expect(page.locator('.editor-host .cm-activeLine')).toHaveText(
    'website gets screen data from screen-apu',
  );

  // Undo the change: the deletion and the typing, whether the history joined them or not.
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(line(page, RELATIONSHIP)).toHaveCount(1);
  await expect(errors.locator('li.error')).toHaveCount(0);
  await expect(page.locator('.notice')).toBeHidden();
  await expect(page.locator('.editor-host .cm-lintRange-error')).toHaveCount(0);
  expect(await page.locator('svg.aerie').innerHTML()).toBe(before);
});

test('INT-806 warnings are listed after errors and never stop the diagram from updating', async ({
  page,
}) => {
  await openEditor(page);
  const errors = page.getByRole('list', { name: 'Problems' });
  await expect(errors.locator('li')).toHaveText([
    'Line 281, column 3: No relationship joins `updater` and `saved-draws` in the model. Add one, such as `updater saves draws into saved-draws`, or check this step.',
  ]);
  await goToLine(page, 'updater saves draws into saved-draws');
  await expect(page.locator('.editor-host .cm-lintRange-warning')).toHaveCount(1);
  await expect(page.locator('.editor-host .cm-lint-marker-warning')).toHaveCount(1);
  await goToLine(page, 'website: Website | Picks a game, generates numbers [service]');
  await toColumn(page, 'website: Website'.length);
  await page.keyboard.type('s');
  await expect(websiteName(page)).toHaveText('Websites');
  await expect(page.locator('.notice')).toBeHidden();
});

test('INT-807 Format and Shift+Alt+F tidy the spacing', async ({ page }) => {
  await openEditor(page);
  const spaced = RELATIONSHIP.replace('website gets', 'website    gets');
  const typeSpaces = async (): Promise<void> => {
    await toColumn(page, 'website'.length);
    await page.keyboard.type('   ');
    await expect(line(page, spaced)).toHaveCount(1);
  };
  await goToLine(page, RELATIONSHIP);
  await typeSpaces();
  await page.getByRole('button', { name: 'Format' }).click();
  await expect(line(page, RELATIONSHIP)).toHaveCount(1);
  await expect(line(page, spaced)).toHaveCount(0);
  await goToLine(page, RELATIONSHIP);
  await typeSpaces();
  await page.keyboard.press('Shift+Alt+F');
  await expect(line(page, RELATIONSHIP)).toHaveCount(1);
  await expect(line(page, spaced)).toHaveCount(0);
});

test('INT-808 the copy is kept on the device until Discard changes; Download saves it', async ({
  page,
}) => {
  await openEditor(page);
  const discard = page.getByRole('button', { name: 'Discard changes' });
  await expect(discard).toBeDisabled();
  await goToLine(page, 'website: Website | Picks a game, generates numbers [service]');
  await toColumn(page, 'website: Website'.length);
  await page.keyboard.type(' shop');
  await expect(websiteName(page)).toHaveText('Website shop');
  await expect(discard).toBeEnabled();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('lotto.aerie');
  const saved = await download.path();
  expect(readFileSync(saved, 'utf8')).toBe(
    LOTTO.replace('website: Website |', 'website: Website shop |'),
  );

  // The published model is what the page shows; the copy comes back in the editor.
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(websiteName(page)).toHaveText('Website');
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(websiteName(page)).toHaveText('Website shop');
  await expect(
    line(page, '  website: Website shop | Picks a game, generates numbers [service]'),
  ).toHaveCount(1);

  await discard.click();
  await expect(websiteName(page)).toHaveText('Website');
  await expect(discard).toBeDisabled();
  await page.reload();
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(editor(page)).toBeVisible();
  await expect(websiteName(page)).toHaveText('Website');
});
