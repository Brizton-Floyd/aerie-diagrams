// A reader exploring the Lotto sample (docs/spec/interaction.md; acceptance A6): switching the
// audience moves nothing, selecting explains an element in the side panel, containers open in place
// with a glide, the camera magnifies and moves, everything works from the keyboard and is announced
// to screen readers, and reduced motion makes every change instant. Real clicks and keys only.
import { expect, test, type Page } from '@playwright/test';
import {
  boxOf,
  boxes,
  button,
  clickElement,
  edge,
  label,
  node,
  openLotto,
  scale,
  settled,
} from './reader.ts';

test.use({ viewport: { width: 1600, height: 900 } });

const panel = (page: Page) => page.locator('aside.panel');
const tab = (page: Page, name: string) => page.getByRole('tab', { name });

const ENGINE_PARTS = ['request-handling', 'game-analysis', 'pick-generation', 'history-lookup'];

test.describe('the audience switch', () => {
  test('JOURNEY-001 switching audience rewords the page and moves nothing', async ({ page }) => {
    await openLotto(page, 'services');
    const before = await boxes(page);
    expect(Object.keys(before).length).toBeGreaterThan(20);
    await page.keyboard.press('3');
    // INT-103: nothing moves, not even while the wording fades.
    expect(await boxes(page)).toEqual(before);
    await expect(node(page, 'website').locator('text').nth(1)).toHaveText(
      'lotto-options-ui, Angular 21',
    );
    await expect(label(page, 'website->screen-api').locator('text')).toHaveText('calls /ui/* on');
    await settled(page);
    expect(await boxes(page)).toEqual(before);
    await page.keyboard.press('1');
    await expect(node(page, 'screen-api').locator('text').first()).toHaveText('Website back end');
    await settled(page);
    expect(await boxes(page)).toEqual(before);
  });

  test('INT-101 and INT-105 one tab per audience in declared order, an accessible tab list', async ({
    page,
  }) => {
    await openLotto(page);
    const list = page.getByRole('tablist', { name: 'Written for' });
    await expect(list.getByRole('tab')).toHaveText(['Executive', 'Manager', 'Engineer']);
    await expect(tab(page, 'Manager')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.audience .written')).toHaveText('Written for');
    await tab(page, 'Engineer').click();
    await expect(tab(page, 'Engineer')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'Manager')).toHaveAttribute('aria-selected', 'false');
    // The underline glides under the current tab.
    await settled(page);
    const thumb = await page.locator('.tabs .thumb').boundingBox();
    const engineer = await tab(page, 'Engineer').boundingBox();
    expect(thumb?.x).toBeCloseTo(engineer?.x ?? Number.NaN, 0);
    await expect(page.getByText('Now written for Engineer')).toBeAttached();
    // The tab list's own arrow keys move along the tabs.
    await tab(page, 'Engineer').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(tab(page, 'Manager')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'Manager')).toBeFocused();
    await expect(page.getByText('Now written for Manager')).toBeAttached();
  });

  test('INT-102 every piece of wording changes: names, taglines, labels, the side panel and the crumb', async ({
    page,
  }) => {
    await openLotto(page, 'engineering');
    await clickElement(page, 'screen-api');
    await expect(panel(page).locator('h1')).toHaveText('Screen API');
    await page.keyboard.press('1');
    await expect(page.locator('.crumb')).toContainText('How the code is organised');
    await expect(node(page, 'screen-api').locator('text').first()).toHaveText('Website back end');
    await expect(panel(page).locator('h1')).toHaveText('Website back end');
    await expect(panel(page).locator('.lead')).toHaveText('Gets each screen its data');
    await expect(page.locator('button[data-view="engineering"]')).toHaveText(
      'How the code is organised',
    );
  });

  test('INT-103 the selection and the zoom state stay as they were', async ({ page }) => {
    await openLotto(page, 'services');
    await node(page, 'engine-service').locator('.control').click();
    await expect(node(page, 'pick-generation')).toBeVisible();
    await clickElement(page, 'pick-generation');
    await expect(button(page, 'pick-generation')).toHaveAttribute('aria-pressed', 'true');
    await settled(page);
    const before = await boxes(page);
    await tab(page, 'Executive').click();
    await expect(page.getByText('Now written for Executive')).toBeAttached();
    await settled(page);
    expect(await boxes(page)).toEqual(before);
    await expect(button(page, 'pick-generation')).toHaveAttribute('aria-pressed', 'true');
    await expect(button(page, 'engine-service')).toHaveAttribute('aria-expanded', 'true');
  });
});

test.describe('selecting and the side panel', () => {
  test('JOURNEY-003 select the Results store, read it, follow a name, and clear', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    await clickElement(page, 'store');
    // INT-202 and LOOK-601: it is outlined, its lines highlight, unrelated parts dim.
    await expect(node(page, 'store')).toHaveClass(/\bsel\b/);
    await expect(button(page, 'store')).toHaveAttribute('aria-pressed', 'true');
    await expect(node(page, 'user')).toHaveClass(/\bdim\b/);
    // Engine service is closed here, so the line from its Draw history lookup ends at it.
    await expect(edge(page, 'engine-service->history-service')).toHaveClass(/\bon\b/);
    await expect(node(page, 'engine-service')).toHaveClass(/\brel\b/);
    await expect(edge(page, 'user->website')).toHaveClass(/\bdim\b/);
    // INT-205: the kind label, the name, the tagline, every level and the connections.
    const side = panel(page);
    await expect(side.locator('.kicker')).toHaveText('Service in Lotto suite');
    await expect(side.locator('h1')).toHaveText('Results store');
    await expect(side.locator('.lead')).toHaveText("Keeps each game's past draws");
    await expect(side.getByRole('heading', { name: 'At every level' })).toBeVisible();
    await expect(side.locator('.levels li')).toHaveText([
      /Executive\s*Results store\s*Keeps each game's past draws/i,
      /Manager\s*Results store\s*Keeps each game's past draws/i,
      /Engineer\s*Results service\s*lottery-result-persistence-service :8001/i,
    ]);
    await expect(side.locator('.levels li.on')).toHaveAttribute('data-audience', 'manager');
    await expect(side.locator('.sentences li').first()).toHaveText(
      'Draw history lookup fetches draw history from Draw history service.',
    );
    await expect(side.locator('.sentences')).toContainText(
      'Draw history service reads Saved draws.',
    );
    // Following a name in a sentence selects that element.
    await side.locator('.sentences .name', { hasText: 'Saved draws' }).first().click();
    await expect(button(page, 'saved-draws')).toHaveAttribute('aria-pressed', 'true');
    await expect(side.locator('h1')).toHaveText('Saved draws');
    await expect(side.locator('.kicker')).toHaveText('Store in Results store');
    await page.keyboard.press('Escape');
    await expect(page.locator('svg.aerie g.node > .shape[aria-pressed="true"]')).toHaveCount(0);
    await expect(side.locator('.kicker')).toHaveText('View');
  });

  test('INT-205 a name in a sentence reveals its element when it is not drawn (MODEL-207)', async ({
    page,
  }) => {
    await openLotto(page, 'big-picture');
    await clickElement(page, 'store');
    await expect(node(page, 'saved-draws')).toHaveCount(0);
    await panel(page).locator('.sentences .name', { hasText: 'Saved draws' }).first().click();
    await expect(button(page, 'saved-draws')).toHaveAttribute('aria-pressed', 'true');
    await expect(button(page, 'store')).toHaveAttribute('aria-expanded', 'true');
  });

  test('INT-201 clicking the element again, or empty stage, clears the selection', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    await clickElement(page, 'website');
    await expect(button(page, 'website')).toHaveAttribute('aria-pressed', 'true');
    await clickElement(page, 'website');
    await expect(button(page, 'website')).toHaveAttribute('aria-pressed', 'false');
    await clickElement(page, 'website');
    await expect(button(page, 'website')).toHaveAttribute('aria-pressed', 'true');
    // Empty stage: the top left corner of the stage, outside the picture.
    const stage = await page.locator('main.aerie-stage').boundingBox();
    await page.mouse.click((stage?.x ?? 0) + 8, (stage?.y ?? 0) + 8);
    await expect(button(page, 'website')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('svg.aerie .dim')).toHaveCount(0);
  });

  test('INT-204 with nothing selected the panel describes the view and offers its scenarios', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    const side = panel(page);
    await expect(side.locator('.kicker')).toHaveText('View');
    await expect(side.locator('h1')).toHaveText('Services');
    await expect(side.locator('.lead').first()).toHaveText(
      'The same suite one level down: what each part contains and which parts talk to each other.',
    );
    await expect(side.getByRole('heading', { name: 'Read it' })).toBeVisible();
    await expect(side).toContainText(
      'Click any box to see what it does and how it connects. Use the round button on a box to open it in place. Switch who it is written for at the top; nothing moves.',
    );
    await expect(side.getByRole('heading', { name: 'Play a scenario' })).toBeVisible();
    await expect(side.locator('[data-play]')).toHaveText(['Generate picks', 'Results poll']);
  });

  test('INT-205 relationships of kinds the view does not draw, the inside of a container, and its scenarios', async ({
    page,
  }) => {
    await openLotto(page, 'big-picture');
    await clickElement(page, 'engine');
    const side = panel(page);
    await expect(side.getByRole('heading', { name: 'Not drawn in this view' })).toBeVisible();
    await expect(side.locator('.hidden-kind')).toContainText(
      'Engine service depends on Strategies library.',
    );
    await expect(side.locator('.sentences').first()).not.toContainText('depends on');
    await expect(side.getByRole('heading', { name: 'Inside' })).toBeVisible();
    await expect(side.locator('.inside .name')).toHaveText([
      'Engine service',
      'Strategies library',
      'Shared data formats',
      'Legacy desktop support',
    ]);
    await expect(side.getByRole('heading', { name: 'In scenarios' })).toBeVisible();
    await expect(side.locator('[data-play]')).toHaveText(['Generate picks']);
    // The panel's button opens the container in place, and then closes it.
    await side.getByRole('button', { name: 'Open in place' }).click();
    await expect(node(page, 'engine-service')).toBeVisible();
    await expect(button(page, 'engine')).toHaveAttribute('aria-expanded', 'true');
    await expect(side.getByRole('button', { name: 'Close in place' })).toBeVisible();
    await side.getByRole('button', { name: 'Close in place' }).click();
    await expect(node(page, 'engine-service')).toHaveCount(0);
  });

  test('INT-206 hovering a box thickens its outline; a label shows its full sentences', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    const outline = () =>
      node(page, 'website')
        .locator('.shape')
        .evaluate((shape) => getComputedStyle(shape).strokeWidth);
    expect(await outline()).toBe('1px');
    await node(page, 'website').hover();
    await expect.poll(outline).toBe('1.6px');
    await expect(label(page, 'website->screen-api').locator('title')).toHaveText(
      'Website gets screen data from Screen API.',
    );
  });
});

test.describe('opening in place', () => {
  test('JOURNEY-002 open Engine service in place and close it again', async ({ page }) => {
    await openLotto(page, 'services');
    const control = node(page, 'engine-service').locator('.control');
    await expect(control.locator('title')).toHaveText('Open in place');
    await control.click();
    for (const id of ENGINE_PARTS) await expect(node(page, id)).toBeVisible();
    await expect(edge(page, 'screen-api->request-handling')).toBeAttached();
    await expect(edge(page, 'screen-api->engine-service')).toHaveCount(0);
    await settled(page);
    await expect(control.locator('title')).toHaveText('Close in place');
    await node(page, 'engine-service').locator('.control').click();
    for (const id of ENGINE_PARTS) await expect(node(page, id)).toHaveCount(0);
    await expect(edge(page, 'screen-api->engine-service')).toBeAttached();
  });

  test('LAYOUT-403 a change during a glide first finishes the glide at once, then starts', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    const control = node(page, 'engine-service').locator('.control');
    await control.click();
    await settled(page);
    const opened = await boxes(page);
    await control.click();
    await settled(page);
    // Open again, and switch the audience while the picture is still gliding.
    await control.click();
    expect(await page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
    await page.keyboard.press('3');
    // The glide has ended at once, and the switch itself moves nothing (INT-103).
    expect(await boxes(page)).toEqual(opened);
    await settled(page);
    expect(await boxes(page)).toEqual(opened);
    await expect(page.getByRole('tab', { name: 'Engineer' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('INT-302 double-clicking a container opens it; LAYOUT-402 the picture glides', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    const before = await boxOf(page, 'store');
    await node(page, 'engine-service').locator('text').first().dblclick();
    await expect(node(page, 'request-handling')).toBeAttached();
    // Still moving: the change takes its time, and the Results store glides to its new place.
    expect(await page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
    await settled(page);
    const after = await boxOf(page, 'store');
    expect(after).not.toEqual(before);
    await expect(button(page, 'engine-service')).toHaveAttribute('aria-expanded', 'true');
  });

  test('INT-203 closing a container around the selection moves the selection to it', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    await node(page, 'engine-service').locator('.control').click();
    await clickElement(page, 'pick-generation');
    await expect(button(page, 'pick-generation')).toHaveAttribute('aria-pressed', 'true');
    await settled(page);
    await node(page, 'engine-service').locator('.control').click();
    await expect(node(page, 'pick-generation')).toHaveCount(0);
    await expect(button(page, 'engine-service')).toHaveAttribute('aria-pressed', 'true');
    await expect(panel(page).locator('h1')).toHaveText('Engine service');
  });

  test('INT-304 there is no global depth control', async ({ page }) => {
    await openLotto(page, 'services');
    await expect(page.getByRole('combobox', { name: /zoom|depth/i })).toHaveCount(0);
    await expect(page.getByRole('slider')).toHaveCount(0);
  });
});

test.describe('the camera', () => {
  test('INT-351 the wheel magnifies around the pointer and dragging moves the picture', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    const fitted = await scale(page);
    const target = await boxOf(page, 'website');
    const pointer = { x: target.x + 10, y: target.y + 10 };
    await page.mouse.move(pointer.x, pointer.y);
    await page.mouse.wheel(0, -200);
    await expect.poll(() => scale(page)).toBeGreaterThan(fitted);
    const zoomed = await boxOf(page, 'website');
    // The point under the pointer stays where it is.
    expect(zoomed.x).toBeCloseTo(target.x - (10 * (await scale(page))) / fitted + 10, 0);
    expect(zoomed.width).toBeGreaterThan(target.width);
    const stage = await page.locator('main.aerie-stage').boundingBox();
    const start = { x: (stage?.x ?? 0) + 20, y: (stage?.y ?? 0) + 300 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 60, start.y + 30, { steps: 4 });
    await page.mouse.up();
    const moved = await boxOf(page, 'website');
    expect(moved.x).toBeCloseTo(zoomed.x + 60, 0);
    expect(moved.y).toBeCloseTo(zoomed.y + 30, 0);
    // A drag is not a click: nothing was selected or cleared by it.
    await expect(page.locator('svg.aerie g.node > .shape[aria-pressed="true"]')).toHaveCount(0);
  });

  test('INT-351 a drag shorter than 4 px is a click', async ({ page }) => {
    await openLotto(page, 'services');
    const target = await boxOf(page, 'website');
    const before = await boxes(page);
    await page.mouse.move(target.x + 20, target.y + 20);
    await page.mouse.down();
    await page.mouse.move(target.x + 22, target.y + 21);
    await page.mouse.up();
    await expect(button(page, 'website')).toHaveAttribute('aria-pressed', 'true');
    await settled(page);
    expect(await boxes(page)).toEqual(before);
  });

  test('INT-352, INT-353 and LAYOUT-452 the buttons and keys magnify by 1.25, shrink by 0.8, fit, and stay between 0.2 and 2.5', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    const fitted = await scale(page);
    await page.getByRole('button', { name: 'Magnify' }).click();
    await settled(page);
    expect(await scale(page)).toBeCloseTo(fitted * 1.25, 5);
    await page.getByRole('button', { name: 'Shrink' }).click();
    await settled(page);
    expect(await scale(page)).toBeCloseTo(fitted, 5);
    await page.locator('body').press('+');
    await settled(page);
    expect(await scale(page)).toBeCloseTo(fitted * 1.25, 5);
    await page.locator('body').press('-');
    await settled(page);
    expect(await scale(page)).toBeCloseTo(fitted, 5);
    for (let i = 0; i < 15; i++) await page.getByRole('button', { name: 'Magnify' }).click();
    await settled(page);
    expect(await scale(page)).toBeCloseTo(2.5, 5);
    for (let i = 0; i < 25; i++) await page.getByRole('button', { name: 'Shrink' }).click();
    await settled(page);
    expect(await scale(page)).toBeCloseTo(0.2, 5);
    await page.getByRole('button', { name: 'Fit all' }).click();
    await settled(page);
    expect(await scale(page)).toBeCloseTo(fitted, 5);
    await page.getByRole('button', { name: 'Magnify' }).click();
    await page.locator('body').press('0');
    await settled(page);
    expect(await scale(page)).toBeCloseTo(fitted, 5);
  });

  test('LAYOUT-404 once magnified, opening a container keeps its corner in place on screen', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    await page.getByRole('button', { name: 'Magnify' }).click();
    await settled(page);
    const before = await boxOf(page, 'engine-service');
    const zoomed = await scale(page);
    await node(page, 'engine-service').locator('.control').click();
    await expect(node(page, 'request-handling')).toBeAttached();
    await settled(page);
    const after = await boxOf(page, 'engine-service');
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
    expect(await scale(page)).toBeCloseTo(zoomed, 5);
    // In fit mode, the camera follows the closed container instead (LAYOUT-453), never below 1.
    await page.getByRole('button', { name: 'Fit all' }).click();
    await settled(page);
    const fitted = await scale(page);
    await node(page, 'engine-service').locator('.control').click();
    await expect(node(page, 'request-handling')).toHaveCount(0);
    await settled(page);
    expect(await scale(page)).not.toBeCloseTo(fitted, 3);
    expect(await scale(page)).toBeGreaterThanOrEqual(1);
  });
});

test.describe('the keyboard and screen readers', () => {
  test('INT-901 Tab reaches the top bar, the sidebar, the diagram in model order, then the side panel', async ({
    page,
  }) => {
    await openLotto(page);
    const order: string[] = [];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(() => {
        const active = document.activeElement;
        if (active === null) return 'none';
        const area = active.closest('header, nav, main, aside')?.tagName ?? 'other';
        const id = active.closest('g.node')?.getAttribute('data-id') ?? null;
        return id === null ? area.toLowerCase() : `node ${id}`;
      });
      if (order.at(-1) !== where) order.push(where);
      if (where === 'aside') break;
    }
    const nodes = order.filter((each) => each.startsWith('node ')).map((each) => each.slice(5));
    const drawn = await page
      .locator('svg.aerie g.boxes > g.node')
      .evaluateAll((all) => all.map((each) => each.getAttribute('data-id')));
    expect(nodes).toEqual(drawn);
    const areas = order.map((each) => (each.startsWith('node ') ? 'diagram' : each));
    const collapsed = areas.filter((each, at) => areas[at - 1] !== each);
    expect(collapsed).toEqual(['header', 'nav', 'diagram', 'main', 'aside']);
  });

  test('INT-902 on a focused element Enter selects it and o opens or closes it; focus is visible', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    await button(page, 'engine-service').focus();
    // LOOK-306: the keyboard focus ring.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(button(page, 'engine-service')).toBeFocused();
    await expect(node(page, 'engine-service').locator('.ring')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(button(page, 'engine-service')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('o');
    await expect(node(page, 'request-handling')).toBeAttached();
    // The focus stays on the element through the change.
    await expect(button(page, 'engine-service')).toBeFocused();
    await expect(button(page, 'engine-service')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('o');
    await expect(node(page, 'request-handling')).toHaveCount(0);
    await expect(button(page, 'engine-service')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(button(page, 'engine-service')).toHaveAttribute('aria-pressed', 'false');
  });

  test('INT-004 shortcuts do nothing while the focus is in a text field', async ({ page }) => {
    await openLotto(page, 'services');
    await page.locator('select[name="model"]').focus();
    await page.keyboard.press('3');
    await expect(tab(page, 'Manager')).toHaveAttribute('aria-selected', 'true');
    await page.locator('aside.panel h1').click();
    await page.keyboard.press('3');
    await expect(tab(page, 'Engineer')).toHaveAttribute('aria-selected', 'true');
  });

  test('INT-903 elements are announced with name and tagline, containers say whether they are open, and the relationships are read as sentences', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    await expect(
      page.getByRole('button', { name: 'Website: Picks a game, generates numbers' }),
    ).toBeVisible();
    await expect(button(page, 'engine-service')).toHaveAttribute('aria-expanded', 'false');
    await expect(button(page, 'engine')).toHaveAttribute('aria-expanded', 'true');
    const sentences = page.getByRole('list', { name: 'Relationships in this picture' });
    await expect(sentences.getByRole('listitem').first()).toHaveText('User uses Website.');
    await expect(sentences).toContainText('Website gets screen data from Screen API.');
    await page.keyboard.press('3');
    await expect(sentences).toContainText('Website calls /ui/* on BFF.');
    await expect(
      page.getByRole('button', { name: 'Website: lotto-options-ui, Angular 21' }),
    ).toBeVisible();
  });
});

test.describe('reduced motion', () => {
  test('LOOK-903 and INT-905 with Reduce motion every change is instant', async ({ page }) => {
    await openLotto(page, 'services');
    await page.getByLabel('Reduce motion').check();
    await node(page, 'engine-service').locator('.control').click();
    await expect(node(page, 'request-handling')).toBeAttached();
    // The new picture is already in place: nothing glides, fades or waits.
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    const opened = await boxes(page);
    await page.waitForTimeout(700);
    expect(await boxes(page)).toEqual(opened);
    // Wording swaps in place, and the side panel changes at once.
    await page.keyboard.press('3');
    await expect(node(page, 'website').locator('text').nth(1)).toHaveText(
      'lotto-options-ui, Angular 21',
    );
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    // Selecting changes at once too, and so does the camera bringing what is selected into view.
    await clickElement(page, 'request-handling');
    await expect(panel(page).locator('h1')).toHaveText('Request handling');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    // The camera jumps.
    await page.getByRole('button', { name: 'Magnify' }).click();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('LOOK-901 without it, changes move: the glide, the fade and the dimming take their time', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    await clickElement(page, 'website');
    expect(await page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
    await settled(page);
    await page.keyboard.press('3');
    expect(await page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
    await settled(page);
  });
});
