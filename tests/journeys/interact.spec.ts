// A reader exploring the Lotto sample (docs/spec/interaction.md; acceptance A6): the wording is plain
// first with more on demand, and changing it moves nothing; selecting explains an element in the side
// panel, containers open in place
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
/** INT-104: the stage's chip while the diagram is worded for a deeper audience. */
const chip = (page: Page) => page.locator('.wording');
const more = (page: Page) => panel(page).locator('button.more');

const ENGINE_PARTS = ['request-handling', 'game-analysis', 'pick-generation', 'history-lookup'];

test.describe('wording for the reader', () => {
  test('JOURNEY-001 changing the wording rewords the page and moves nothing', async ({ page }) => {
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

  test('INT-101 and INT-001 every reader starts with the plain wording, with no switch to set first', async ({
    page,
  }) => {
    await openLotto(page);
    // Lotto declares Executive first, though Manager is its default (LANG-104).
    await expect(node(page, 'engine').locator('text').first()).toHaveText('Number engine');
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await expect(page.getByText('Written for')).toHaveCount(0);
    await expect(chip(page)).toBeHidden();
    // The plain wording is the default picture, so the address holds no audience.
    expect(new URL(page.url()).hash).toBe('');
    // A link still carries a level.
    await page.goto('/?model=samples/lotto.aerie#aud=manager');
    await expect(node(page, 'engine').locator('text').first()).toHaveText('Analysis engine');
    await expect(chip(page)).toContainText('Worded for Manager');
  });

  test('INT-102 every piece of wording changes: names, taglines, labels, the side panel and the crumb', async ({
    page,
  }) => {
    await openLotto(page, 'engineering');
    await clickElement(page, 'screen-api');
    await expect(panel(page).locator('h1')).toHaveText('Website back end');
    await page.keyboard.press('2');
    await expect(page.locator('.crumb')).toContainText('Engineering');
    await expect(node(page, 'screen-api').locator('text').first()).toHaveText('Screen API');
    await expect(panel(page).locator('h1')).toHaveText('Screen API');
    await expect(panel(page).locator('.lead')).toHaveText('Prepares data for each screen');
    await expect(page.locator('button[data-view="engineering"]')).toContainText('Engineering');
  });

  test('INT-103 the selection and the zoom state stay as they were', async ({ page }) => {
    await openLotto(page, 'services');
    await node(page, 'engine-service').locator('.control').click();
    await expect(node(page, 'pick-generation')).toBeVisible();
    await clickElement(page, 'pick-generation');
    await expect(button(page, 'pick-generation')).toHaveAttribute('aria-pressed', 'true');
    await settled(page);
    const before = await boxes(page);
    await page.keyboard.press('2');
    await expect(page.getByText('Now worded for Manager')).toBeAttached();
    await settled(page);
    expect(await boxes(page)).toEqual(before);
    await expect(button(page, 'pick-generation')).toHaveAttribute('aria-pressed', 'true');
    await expect(button(page, 'engine-service')).toHaveAttribute('aria-expanded', 'true');
  });

  test('INT-104, INT-105 and LOOK-812 a chip says the diagram is worded for a deeper audience, and goes back to plain', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    await expect(chip(page)).toBeHidden();
    const before = await boxes(page);
    await page.keyboard.press('3');
    await expect(chip(page)).toBeVisible();
    await expect(chip(page)).toContainText('Worded for Engineer');
    await expect(page.getByText('Now worded for Engineer')).toBeAttached();
    expect(new URL(page.url()).hash).toContain('aud=engineer');
    await chip(page).getByRole('button', { name: 'Back to plain wording' }).click();
    await expect(chip(page)).toBeHidden();
    await expect(node(page, 'screen-api').locator('text').first()).toHaveText('Website back end');
    await expect(page.getByText('Now worded for Executive')).toBeAttached();
    await settled(page);
    expect(await boxes(page)).toEqual(before);
  });

  test('INT-207 and LOOK-811 More technical uncovers each deeper wording in turn, then words the whole diagram', async ({
    page,
  }) => {
    await openLotto(page, 'big-picture');
    await clickElement(page, 'engine');
    const side = panel(page);
    await expect(side.locator('h1')).toHaveText('Number engine');
    await expect(more(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(more(page)).toHaveText(/^More technical\s*Manager wording$/);
    await expect(side.locator('.layer')).toHaveCount(2);
    await expect(side.locator('.layer:visible')).toHaveCount(0);
    // The first press opens the Manager layer: only what Manager words differently.
    await more(page).click();
    const manager = side.locator('.layer[data-audience="manager"]');
    await expect(manager).toBeVisible();
    await expect(manager.locator('.layer-who')).toHaveText('Manager wording');
    await expect(manager.locator('.layer-name')).toHaveText('Analysis engine');
    await expect(manager.locator('.layer-line')).toHaveText('Generates and scores picks');
    await expect(more(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(more(page)).toHaveText(/^Even more technical\s*Engineer wording$/);
    await expect(
      side.getByRole('button', { name: 'Word the whole diagram for Manager' }),
    ).toBeVisible();
    // The second opens the Engineer layer, in the code voice; then there is no more to open.
    await more(page).click();
    const engineer = side.locator('.layer[data-audience="engineer"]');
    await expect(engineer.locator('.layer-name')).toHaveText('Core API');
    await expect(engineer.locator('.layer-line')).toHaveText('lotto-options-core-server :8002');
    await expect(engineer.locator('.layer-line')).toHaveClass(/\bcode\b/);
    await expect(more(page)).toBeHidden();
    // The depth is remembered: the next element opens as far.
    await clickElement(page, 'store');
    await expect(side.locator('h1')).toHaveText('Results store');
    await expect(side.locator('.layer[data-audience="engineer"]')).toBeVisible();
    await expect(side.locator('.layer[data-audience="engineer"] .layer-name')).toHaveText(
      'Results service',
    );
    // A layer shows only what changes: Manager keeps the name and tagline, words it anew.
    const store = side.locator('.layer[data-audience="manager"]');
    await expect(store.locator('.layer-name')).toHaveCount(0);
    await expect(store.locator('.layer-about')).toBeVisible();
    // An audience that words the element as the one before adds no layer.
    await clickElement(page, 'website');
    await expect(side.locator('h1')).toHaveText('Website');
    await expect(side.locator('.layer[data-audience="manager"]')).toHaveCount(0);
    await expect(side.locator('.layer[data-audience="engineer"]')).toBeVisible();
    // Word the whole diagram that way; the diagram's wording changes, nothing moves.
    const before = await boxes(page);
    await side.getByRole('button', { name: 'Word the whole diagram for Engineer' }).click();
    await expect(node(page, 'engine').locator('text').first()).toHaveText('Core API');
    await expect(chip(page)).toContainText('Worded for Engineer');
    await expect(side).toContainText('Worded for Engineer.');
    await settled(page);
    expect(await boxes(page)).toEqual(before);
    await side.getByRole('button', { name: 'Back to the plain wording' }).click();
    await expect(node(page, 'engine').locator('text').first()).toHaveText('Number engine');
    // Less closes every layer, and the next element opens closed.
    await side.getByRole('button', { name: 'Less' }).click();
    await expect(side.locator('.layer:visible')).toHaveCount(0);
    await clickElement(page, 'engine');
    await expect(side.locator('h1')).toHaveText('Number engine');
    await expect(side.locator('.layer:visible')).toHaveCount(0);
  });

  test('INT-207 the depth lasts for the session: a reload keeps it, a new tab starts plain', async ({
    page,
    context,
  }) => {
    await openLotto(page, 'big-picture');
    await clickElement(page, 'engine');
    await more(page).click();
    await expect(panel(page).locator('.layer[data-audience="manager"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await expect(panel(page).locator('h1')).toHaveText('Number engine');
    await expect(panel(page).locator('.layer[data-audience="manager"]')).toBeVisible();
    await expect(panel(page).locator('.layer[data-audience="engineer"]')).toBeHidden();
    const other = await context.newPage();
    await other.goto('/?model=samples/lotto.aerie#sel=engine');
    await expect(other.locator('#app')).toHaveAttribute('data-ready', 'true');
    await expect(other.locator('aside.panel h1')).toHaveText('Number engine');
    await expect(other.locator('aside.panel .layer:visible')).toHaveCount(0);
    // The diagram itself stays plain: only the panel opens deeper.
    await expect(node(page, 'engine').locator('text').first()).toHaveText('Number engine');
  });

  test('INT-208 and LOOK-810 resting on a box shows its hover card with the deeper names; leaving hides it', async ({
    page,
  }) => {
    await openLotto(page, 'big-picture');
    const card = page.locator('.peek');
    await expect(card).toBeHidden();
    await node(page, 'engine').locator('text').first().hover();
    await expect(card).toBeVisible();
    await expect(card).toHaveClass(/\bon\b/);
    await expect(card).toHaveAttribute('aria-hidden', 'true');
    await expect(card.locator('.peek-kind')).toHaveText('Service in Lotto suite');
    await expect(card.locator('.peek-layers dt')).toHaveText(['Manager', 'Engineer']);
    await expect(card.locator('.peek-layers dd')).toHaveText([
      'Analysis engine · Generates and scores picks',
      'Core API · lotto-options-core-server :8002',
    ]);
    await expect(card.locator('.peek-hint')).toHaveText(
      'Click to read more, double-click to open it',
    );
    // It sits beside the box, never over it.
    const box = await boxOf(page, 'engine');
    const placed = await card.boundingBox();
    expect(
      (placed?.x ?? 0) >= box.x + box.width || (placed?.x ?? 0) + (placed?.width ?? 0) <= box.x,
    ).toBe(true);
    await page.mouse.move(2, 2);
    await expect(card).toBeHidden();
    // Pressing hides it too, and it never shows while presenting.
    await node(page, 'website').locator('text').first().hover();
    await expect(card).toBeVisible();
    await expect(card.locator('.peek-hint')).toHaveText('Click to read more');
    await page.mouse.down();
    await expect(card).toBeHidden();
    await page.mouse.up();
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
    // INT-205: the kind label, the name, the tagline, More technical and the connections.
    const side = panel(page);
    await expect(side.locator('.kicker')).toHaveText('Service in Lotto suite');
    await expect(side.locator('h1')).toHaveText('Results store');
    await expect(side.locator('.lead')).toHaveText("Keeps each game's past draws");
    await expect(more(page)).toHaveText(/^More technical\s*Manager wording$/);
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
    await expect(side.locator('.kicker')).toHaveText('Architecture');
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

  test('INT-204 and LOOK-809 with nothing selected the panel opens on the cover, then the view and its scenarios', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    const side = panel(page);
    const cover = side.locator('.cover');
    await expect(cover.locator('.kicker')).toHaveText('Architecture');
    await expect(cover.locator('h1')).toHaveText('The Lotto suite');
    await expect(cover.locator('.cover-lead')).toHaveText(
      'How results come in, how picks are generated, and what each part does.',
    );
    await expect(cover.locator('.cover-stats span')).toHaveText([
      '19 parts',
      '3 views',
      '2 scenarios',
    ]);
    const tour = cover.getByRole('button', { name: /Take the tour/ });
    await expect(tour).toHaveText(/^Take the tour\s*8 steps$/);
    await expect(side.getByRole('heading', { name: 'This view' })).toBeVisible();
    await expect(side.locator('.view-title')).toHaveText('Services');
    await expect(side.locator('.this-view .lead').first()).toHaveText(
      'The same suite one level down: what each part contains and which parts talk to each other.',
    );
    await expect(side.getByRole('heading', { name: 'How to read it' })).toBeVisible();
    await expect(side).toContainText(
      'Click a box to see what it does and what it talks to. Boxes with a + hold more inside: press it, or double-click the box, to open it right here. Rest the pointer on a box for a quick look.',
    );
    await expect(side.getByRole('heading', { name: 'Watch it work' })).toBeVisible();
    await expect(side.locator('[data-play]')).toHaveText([
      /^Generate picks\s*14 steps$/,
      /^Results poll\s*6 steps$/,
    ]);
    // The cover's button presents the tour (INT-701).
    await tour.click();
    await expect(page.locator('#app')).toHaveClass(/\bpresenting\b/);
    await expect(page.locator('.narration-meta .count')).toHaveText('1 of 8');
  });

  test('INT-205 relationships of kinds the view does not draw, the inside of a container, and its scenarios', async ({
    page,
  }) => {
    await openLotto(page, 'big-picture');
    await clickElement(page, 'engine');
    const side = panel(page);
    await expect(
      side.getByRole('heading', { name: 'Also connected, not drawn in this view' }),
    ).toBeVisible();
    await expect(side.locator('.hidden-kind')).toContainText(
      'Engine service depends on Strategies library.',
    );
    await expect(side.locator('.sentences').first()).not.toContainText('depends on');
    await expect(side.getByRole('heading', { name: 'Inside (4)' })).toBeVisible();
    await expect(side.locator('.inside .name')).toHaveText([
      'Engine service',
      'Strategies library',
      'Shared data formats',
      'Legacy desktop support',
    ]);
    await expect(side.getByRole('heading', { name: 'Takes part in' })).toBeVisible();
    await expect(side.locator('[data-play]')).toHaveText([/^Generate picks\s*14 steps$/]);
    // The panel's button opens the container in place, and then closes it.
    await side.getByRole('button', { name: 'Open it here' }).click();
    await expect(node(page, 'engine-service')).toBeVisible();
    await expect(button(page, 'engine')).toHaveAttribute('aria-expanded', 'true');
    await expect(side.getByRole('button', { name: 'Close it' })).toBeVisible();
    await side.getByRole('button', { name: 'Close it' }).click();
    await expect(node(page, 'engine-service')).toHaveCount(0);
  });

  test('INT-206 and LOOK-306 hovering a box lights its outline; a label shows its full sentences', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    const look = () =>
      node(page, 'website')
        .locator('.shape')
        .evaluate((shape) => {
          const style = getComputedStyle(shape);
          return { stroke: style.stroke, glow: style.filter.includes('drop-shadow(') };
        });
    const before = await look();
    await node(page, 'website').hover();
    await expect.poll(async () => (await look()).stroke).not.toBe(before.stroke);
    expect((await look()).glow).toBe(true);
    await expect(label(page, 'website->screen-api').locator('title')).toHaveText(
      'Website works through Website back end.',
    );
  });
});

test.describe('opening in place', () => {
  test('JOURNEY-002 open Engine service in place and close it again', async ({ page }) => {
    await openLotto(page, 'services');
    const control = node(page, 'engine-service').locator('.control');
    await expect(control.locator('title')).toHaveText('Open it here');
    await control.click();
    for (const id of ENGINE_PARTS) await expect(node(page, id)).toBeVisible();
    await expect(edge(page, 'screen-api->request-handling')).toBeAttached();
    await expect(edge(page, 'screen-api->engine-service')).toHaveCount(0);
    await settled(page);
    await expect(control.locator('title')).toHaveText('Close it');
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
    await expect(chip(page)).toContainText('Worded for Engineer');
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
    await page.getByRole('button', { name: 'Move closer (+)' }).click();
    await settled(page);
    expect(await scale(page)).toBeCloseTo(fitted * 1.25, 5);
    await page.getByRole('button', { name: 'Move back (-)' }).click();
    await settled(page);
    expect(await scale(page)).toBeCloseTo(fitted, 5);
    await page.locator('body').press('+');
    await settled(page);
    expect(await scale(page)).toBeCloseTo(fitted * 1.25, 5);
    await page.locator('body').press('-');
    await settled(page);
    expect(await scale(page)).toBeCloseTo(fitted, 5);
    for (let i = 0; i < 15; i++)
      await page.getByRole('button', { name: 'Move closer (+)' }).click();
    await settled(page);
    expect(await scale(page)).toBeCloseTo(2.5, 5);
    for (let i = 0; i < 25; i++) await page.getByRole('button', { name: 'Move back (-)' }).click();
    await settled(page);
    expect(await scale(page)).toBeCloseTo(0.2, 5);
    await page.getByRole('button', { name: 'Show everything (0)' }).click();
    await settled(page);
    expect(await scale(page)).toBeCloseTo(fitted, 5);
    await page.getByRole('button', { name: 'Move closer (+)' }).click();
    await page.locator('body').press('0');
    await settled(page);
    expect(await scale(page)).toBeCloseTo(fitted, 5);
  });

  test('LAYOUT-404 once magnified, opening a container keeps its corner in place on screen', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    await page.getByRole('button', { name: 'Move closer (+)' }).click();
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
    await page.getByRole('button', { name: 'Show everything (0)' }).click();
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
        const area = active.closest('header.top, nav, main, aside')?.tagName ?? 'other';
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
    await expect(chip(page)).toBeHidden();
    await page.locator('aside.panel h1').click();
    await page.keyboard.press('3');
    await expect(chip(page)).toContainText('Worded for Engineer');
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
    await expect(sentences).toContainText('Website works through Website back end.');
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
    await page.getByRole('button', { name: 'Move closer (+)' }).click();
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
