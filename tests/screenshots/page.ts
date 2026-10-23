// Shared steps for the screenshot suite: opening a model on the page and choosing what it draws,
// as a reader does, with clicks.
import { expect, type Page } from '@playwright/test';

/**
 * ACC-006: screenshot runs hide text glyphs, so pixels compare shapes, colours and positions on
 * every platform while goldens and rule checks cover the text. Native form controls are made
 * transparent too, since each platform draws its own. The side panel's content is hidden as well:
 * its rules, shading and buttons sit where its paragraphs wrap, and each platform wraps HTML text
 * by its own font rendering; the journeys check what it says.
 */
export const HIDE_TEXT = `
  * { color: transparent !important; text-shadow: none !important; caret-color: transparent !important; }
  svg.aerie text { fill: transparent !important; stroke: transparent !important; }
  input, select { opacity: 0 !important; }
  .panel-content { visibility: hidden !important; }
`;

/** Opens a bundled model and waits for its first drawing and the fonts. */
export async function openModel(page: Page, model: string): Promise<void> {
  await page.goto(`/?model=${model}`);
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('svg.aerie')).toBeVisible();
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
  const audiences = await page
    .locator('[role=tab][data-audience]')
    .evaluateAll((all) => all.map((each) => (each as HTMLElement).dataset['audience'] ?? ''));
  return { views, audiences };
}

/** Shows a view in an audience and waits until it is drawn. */
export async function show(page: Page, view: string, audience: string): Promise<void> {
  await page.locator(`button[data-view="${view}"]`).click();
  await page.locator(`[role=tab][data-audience="${audience}"]`).click();
  await expect(
    page.locator(`svg.aerie[data-view="${view}"][data-audience="${audience}"]`),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
