// Shared steps for the screenshot suite: opening a model on the page and choosing what it draws,
// as a reader does, with clicks.
import { expect, type Page } from '@playwright/test';

/**
 * ACC-006: screenshot runs hide text glyphs, so pixels compare shapes, colours and positions on
 * every platform while goldens and rule checks cover the text. Native form controls are made
 * transparent too, since each platform draws its own. The side panel's content is hidden as well:
 * its rules, shading and buttons sit where its paragraphs wrap, and each platform wraps HTML text
 * by its own font rendering; the journeys check what it says. The glass over the stage (LOOK-806,
 * LOOK-808) blurs what is behind it, which each platform rounds in its own way at the edges.
 */
export const HIDE_TEXT = `
  * { color: transparent !important; text-shadow: none !important; caret-color: transparent !important; }
  svg.aerie text { fill: transparent !important; stroke: transparent !important; }
  input, select { opacity: 0 !important; }
  .panel-content { visibility: hidden !important; }
  * { backdrop-filter: none !important; }
`;

/** Opens a bundled model and waits for its first drawing and the fonts. */
export async function openModel(page: Page, model: string): Promise<void> {
  await page.goto(`/?model=${model}`);
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('svg.aerie')).toBeVisible();
}

/**
 * The audiences of every bundled sample, in declared order: the page has no list of them, since
 * readers start plain (INT-101), so the digit keys word the diagram for each (INT-102).
 */
export const AUDIENCES = ['exec', 'manager', 'engineer'];

/** Opens the page in a theme, as a reader who chose it earlier on this device (LOOK-002). */
export async function useTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.addInitScript((chosen) => {
    localStorage.setItem('aerie.theme', chosen);
  }, theme);
}

/** The ids of the views and audiences the page offers, in order. */
export async function choices(page: Page): Promise<{ views: string[]; audiences: string[] }> {
  const views = await page
    .locator('[data-view]')
    .evaluateAll((all) =>
      all
        .filter((each) => each.tagName === 'BUTTON')
        .map((each) => (each as HTMLElement).dataset['view'] ?? ''),
    );
  return { views, audiences: AUDIENCES };
}

/** Shows a view in an audience and waits until it is drawn. */
export async function show(page: Page, view: string, audience: string): Promise<void> {
  // One change at a time: the view first, then the wording, so no glide and wording swap overlap.
  await page.locator(`button[data-view="${view}"]`).click();
  await expect(page.locator(`svg.aerie[data-view="${view}"]`)).toBeVisible();
  await still(page);
  await page.locator('body').press(String(AUDIENCES.indexOf(audience) + 1));
  await expect(
    page.locator(`svg.aerie[data-view="${view}"][data-audience="${audience}"]`),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await still(page);
}

/** The animations of the page that end, as a count: the light flowing along a line never does. */
const moving = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((each) => each.effect?.getComputedTiming().iterations !== Infinity).length,
  );

/**
 * Waits until the picture is still: the wording swaps out and in (LOOK-901) and a label's pill fits
 * the new words. Lines and labels fade in from timed steps, not animations, so between two of
 * them nothing is moving: the picture is still only when nothing starts again within 0.4 s.
 */
export async function still(page: Page): Promise<void> {
  for (let tries = 0; tries < 5; tries++) {
    await expect.poll(() => moving(page)).toBe(0);
    await page.waitForTimeout(400);
    if ((await moving(page)) === 0) return;
  }
  throw new Error('The picture never came to rest.');
}
