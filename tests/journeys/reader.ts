// Shared steps for the journeys: opening the Lotto sample as a reader does, finding what the page
// draws, and measuring where it is on screen. Journeys use real clicks and keys only; these steps
// read the page and never call its code.
import { expect, type Locator, type Page } from '@playwright/test';

/** A box on screen, rounded to a hundredth of a pixel. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Opens the Lotto sample, optionally on a view, and waits until it is drawn. */
export async function openLotto(page: Page, view?: string): Promise<void> {
  await page.goto('/?model=samples/lotto.aerie');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  if (view !== undefined) {
    await page.locator(`button[data-view="${view}"]`).click();
    await expect(page.locator(`svg.aerie[data-view="${view}"]`)).toBeVisible();
  }
  await settled(page);
}

/**
 * Opens the page in a theme (LOOK-002): as a reader who chose it earlier on this device, so the
 * page remembers it from the start. Dark is the default.
 */
export async function useTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.addInitScript((chosen) => {
    localStorage.setItem('aerie.theme', chosen);
  }, theme);
}

/** An element's box group. */
export const node = (page: Page, id: string): Locator =>
  page.locator(`svg.aerie g.boxes > g.node[data-id="${id}"]`);

/** An element's button on the page: its outline, focusable and announced (INT-901, INT-903). */
export const button = (page: Page, id: string): Locator =>
  node(page, id).locator(':scope > .shape');

/** An edge's line group. */
export const edge = (page: Page, id: string): Locator =>
  page.locator(`svg.aerie g.edges > g.edge[data-id="${id}"]`);

/** An edge's label group. */
export const label = (page: Page, id: string): Locator =>
  page.locator(`svg.aerie g.labels > g.label[data-id="${id}"]`);

/**
 * Where a reader clicks to select an element: a box's own text, or an open container's header
 * text, which is drawn above the lines.
 */
export async function clickElement(page: Page, id: string): Promise<void> {
  const head = page.locator(`svg.aerie g.heads > g.head[data-id="${id}"] text`).first();
  if ((await head.count()) > 0) await head.click();
  else await node(page, id).locator('text').first().click();
}

/**
 * Waits until nothing on the page is moving: every glide, fade and swap has ended. The light that
 * flows along a selected line (LOOK-601) runs without end, so it never counts.
 */
export async function settled(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter((each) => each.effect?.getComputedTiming().iterations !== Infinity).length,
        ),
      { timeout: 5000 },
    )
    .toBe(0);
}

/**
 * Expects the diagram worded for an audience (INT-104): the stage's chip names a deeper one, and
 * there is no chip for the plain wording.
 */
export async function wordedFor(page: Page, audience: string): Promise<void> {
  const chip = page.locator('.wording');
  if (audience === 'plain') await expect(chip).toBeHidden();
  else await expect(chip).toContainText(`Worded for ${audience}`);
}

const round = (value: number): number => Math.round(value * 100) / 100;

/** The on-screen box of every drawn element's outline and every label's reserved space. */
export async function boxes(page: Page): Promise<Record<string, Rect>> {
  const found = await page.evaluate(() => {
    const out: [string, { x: number; y: number; width: number; height: number }][] = [];
    for (const shape of document.querySelectorAll(
      'svg.aerie g.boxes > g.node > .shape, svg.aerie g.labels > g.label > .hit',
    )) {
      const group = shape.parentElement;
      const kind = group?.classList.contains('node') === true ? 'node' : 'label';
      const r = shape.getBoundingClientRect();
      out.push([
        `${kind} ${group?.getAttribute('data-id') ?? ''}`,
        { x: r.x, y: r.y, width: r.width, height: r.height },
      ]);
    }
    return out;
  });
  return Object.fromEntries(
    found.map(([key, r]) => [
      key,
      { x: round(r.x), y: round(r.y), width: round(r.width), height: round(r.height) },
    ]),
  );
}

/** One element's outline on screen. */
export async function boxOf(page: Page, id: string): Promise<Rect> {
  const found = (await boxes(page))[`node ${id}`];
  if (found === undefined) throw new Error(`${id} is not drawn.`);
  return found;
}

/** The camera's scale: how much the drawing is magnified on screen. */
export async function scale(page: Page): Promise<number> {
  return page
    .locator('svg.aerie[data-view]')
    .evaluate((svg) => new DOMMatrix(getComputedStyle(svg).transform).a);
}
