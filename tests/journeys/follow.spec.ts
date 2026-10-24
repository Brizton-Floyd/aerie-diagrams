// A reader drilling down into the Lotto sample (docs/spec/layout.md, LAYOUT-453 to LAYOUT-455;
// docs/spec/interaction.md, INT-354; acceptance JOURNEY-010): opening containers in place brings the
// camera closer to them instead of shrinking the whole picture, so their text stays readable and
// they stay on screen; selecting brings an element into view without shrinking; closing returns the
// camera to where it was; Show everything still fits everything. Real clicks and keys only.
import { expect, test, type Page } from '@playwright/test';
import { boxOf, boxes, button, node, openLotto, scale, settled, type Rect } from './reader.ts';

test.use({ viewport: { width: 1600, height: 900 } });

/** RULE-008 and LAYOUT-453: the smallest size drawn text may have on screen. */
const READABLE = 13.5;

const panel = (page: Page) => page.locator('aside.panel');

/** The stage's box on the page. */
async function stage(page: Page): Promise<Rect> {
  const found = await page.locator('main.aerie-stage').boundingBox();
  if (found === null) throw new Error('The stage is not shown.');
  return found;
}

/** Whether a point of the page is on the stage. */
const onStage = (point: { x: number; y: number }, on: Rect): boolean =>
  point.x >= on.x && point.y >= on.y && point.x <= on.x + on.width && point.y <= on.y + on.height;

/** Whether a box is on the stage whole. */
async function inView(page: Page, id: string): Promise<boolean> {
  const box = await boxOf(page, id);
  const on = await stage(page);
  return onStage(box, on) && onStage({ x: box.x + box.width, y: box.y + box.height }, on);
}

/** The on-screen size of an open container's header name, or a box's name. */
async function nameSize(page: Page, id: string): Promise<number> {
  const head = page.locator(`svg.aerie g.heads > g.head[data-id="${id}"] text`).first();
  const text = (await head.count()) > 0 ? head : node(page, id).locator('text').first();
  const size = await text.evaluate((each) => parseFloat(getComputedStyle(each).fontSize));
  return size * (await scale(page));
}

/** Opens or closes a container with its control when the reader can see it, else with the keyboard. */
async function toggle(page: Page, id: string): Promise<void> {
  const was = await button(page, id).getAttribute('aria-expanded');
  const control = await node(page, id).locator('.control').boundingBox();
  const on = await stage(page);
  if (
    control !== null &&
    onStage(control, on) &&
    onStage({ x: control.x + control.width, y: control.y + control.height }, on)
  ) {
    await node(page, id).locator('.control').click();
  } else {
    await button(page, id).focus();
    await page.keyboard.press('o');
  }
  await expect(button(page, id)).not.toHaveAttribute('aria-expanded', was ?? '');
  await settled(page);
}

test.describe('following the reader', () => {
  test('JOURNEY-010, LAYOUT-453 and LAYOUT-455 drilling down keeps each opened container readable and in view, and closing returns to the first picture', async ({
    page,
  }) => {
    await openLotto(page);
    const first = await scale(page);
    const firstBoxes = await boxes(page);
    // The Big picture fits the stage only below scale 1: before this fix, every open shrank it.
    expect(first).toBeLessThan(1);
    for (const id of ['engine', 'engine-service', 'store']) {
      await toggle(page, id);
      await expect(button(page, id)).toHaveAttribute('aria-expanded', 'true');
      expect(await scale(page)).toBeGreaterThanOrEqual(1);
      expect(await nameSize(page, id)).toBeGreaterThanOrEqual(READABLE);
      const box = await boxOf(page, id);
      expect(onStage(box, await stage(page))).toBe(true);
    }
    // Every drawn text is readable, not just the opened container's.
    const smallest = await page
      .locator('svg.aerie[data-view]')
      .evaluate((svg) =>
        Math.min(
          ...[...svg.querySelectorAll('text')].map((each) =>
            parseFloat(getComputedStyle(each).fontSize),
          ),
        ),
      );
    expect(smallest * (await scale(page))).toBeGreaterThanOrEqual(READABLE);
    // Closing returns the camera to where it was before each container was opened.
    for (const id of ['store', 'engine-service', 'engine']) await toggle(page, id);
    expect(await scale(page)).toBeCloseTo(first, 5);
    const back = await boxes(page);
    expect(Object.keys(back).sort()).toEqual(Object.keys(firstBoxes).sort());
    for (const [key, box] of Object.entries(firstBoxes)) {
      expect(back[key]?.x).toBeCloseTo(box.x, 0);
      expect(back[key]?.y).toBeCloseTo(box.y, 0);
    }
  });

  test('LAYOUT-453 opening a container never shrinks the picture below scale 1, and Show everything still fits it whole', async ({
    page,
  }) => {
    await openLotto(page);
    const first = await scale(page);
    await toggle(page, 'engine');
    await toggle(page, 'store');
    expect(await scale(page)).toBeGreaterThanOrEqual(1);
    // Part of the picture is off the stage now, where the reader can drag to it.
    expect(await inView(page, 'user')).toBe(false);
    await page.getByRole('button', { name: 'Show everything (0)' }).click();
    await settled(page);
    expect(await scale(page)).toBeLessThan(first);
    for (const id of ['user', 'texas', 'suite', 'saved-draws'])
      expect(await inView(page, id)).toBe(true);
    // Show everything follows nothing: a resized stage fits the whole picture again.
    await page.setViewportSize({ width: 1500, height: 900 });
    await settled(page);
    for (const id of ['user', 'texas', 'suite']) expect(await inView(page, id)).toBe(true);
  });

  test('LAYOUT-453 a resized stage frames the followed container again', async ({ page }) => {
    await openLotto(page);
    await toggle(page, 'engine');
    await toggle(page, 'engine-service');
    await page.setViewportSize({ width: 1360, height: 800 });
    await expect.poll(() => inView(page, 'engine-service')).toBe(true);
    expect(await scale(page)).toBeGreaterThanOrEqual(1);
  });

  test('INT-354 selecting an element brings it and its connections into view without shrinking', async ({
    page,
  }) => {
    await openLotto(page);
    await toggle(page, 'engine');
    await toggle(page, 'engine-service');
    await toggle(page, 'store');
    const followed = await scale(page);
    // Following a name in a sentence brings that element into view, at the same scale.
    await button(page, 'store').focus();
    await page.keyboard.press('Enter');
    await expect(panel(page).locator('h1')).toHaveText('Results store');
    await settled(page);
    expect(await scale(page)).toBeCloseTo(followed, 5);
    expect(await inView(page, 'texas')).toBe(false);
    await panel(page)
      .locator('.sentences .name', { hasText: 'Texas Lottery website' })
      .first()
      .click();
    await expect(button(page, 'texas')).toHaveAttribute('aria-pressed', 'true');
    await settled(page);
    expect(await scale(page)).toBeCloseTo(followed, 5);
    expect(await inView(page, 'texas')).toBe(true);
    // Selecting with the keyboard: Draw history lookup comes into view, still at the same scale,
    // with its connection inside the Results store.
    expect(await inView(page, 'history-lookup')).toBe(false);
    await button(page, 'history-lookup').focus();
    await page.keyboard.press('Enter');
    await expect(button(page, 'history-lookup')).toHaveAttribute('aria-pressed', 'true');
    await settled(page);
    expect(await scale(page)).toBeCloseTo(followed, 5);
    expect(await inView(page, 'history-lookup')).toBe(true);
    expect(await inView(page, 'history-service')).toBe(true);
    // Selecting again what is already in view with its connections moves nothing.
    const before = await boxes(page);
    await node(page, 'history-lookup').locator('text').first().click();
    await expect(button(page, 'history-lookup')).toHaveAttribute('aria-pressed', 'false');
    await node(page, 'history-lookup').locator('text').first().click();
    await expect(button(page, 'history-lookup')).toHaveAttribute('aria-pressed', 'true');
    await settled(page);
    expect(await boxes(page)).toEqual(before);
  });

  test('INT-354 an element reached with the keyboard comes into view, and the browser never scrolls the stage', async ({
    page,
  }) => {
    await openLotto(page);
    await toggle(page, 'engine');
    await toggle(page, 'engine-service');
    expect(await inView(page, 'texas')).toBe(false);
    await button(page, 'store').focus();
    // Tab goes on in model order, to the Texas Lottery website, the last element.
    await page.keyboard.press('Tab');
    await expect(button(page, 'texas')).toBeFocused();
    await settled(page);
    expect(await inView(page, 'texas')).toBe(true);
    const scrolled = await page
      .locator('main.aerie-stage')
      .evaluate((each) => [each.scrollLeft, each.scrollTop]);
    expect(scrolled).toEqual([0, 0]);
  });
});
