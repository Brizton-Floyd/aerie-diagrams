// The viewer page as a reader opens it (docs/spec/look.md): it draws the Lotto sample, opens dark
// until the reader picks the light theme and remembers that choice (LOOK-002), prints in the light
// theme (LOOK-814), and its Reduce motion checkbox makes every change instant (LOOK-903). Later slices add the full journeys of
// docs/spec/acceptance.md.
import { expect, test, type Page } from '@playwright/test';

test('INT-002 the page opens the first bundled model, the Lotto sample, and draws its first view', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Aerie');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('svg.aerie')).toHaveAttribute('data-view', 'big-picture');
  await expect(page).toHaveURL(/\?model=samples\/lotto\.aerie$/);
  await expect(page.locator('svg.aerie g.node[data-id="website"] text').first()).toHaveText(
    'Website',
  );
});

test('INT-002 the model parameter chooses another bundled model by name', async ({ page }) => {
  await page.goto('/?model=samples/shapes.aerie');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  await expect(page).toHaveURL(/\?model=samples\/shapes\.aerie$/);
  await expect(page.locator('svg.aerie g.node[data-id="visitor"] text').first()).toHaveText(
    'Visitor',
  );
  await expect(page.locator('svg.aerie g.node[data-id="website"]')).toHaveCount(0);
});

const background = (page: Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/** The drawing as markup, without the camera's transform, to show a theme switch redraws nothing. */
const drawing = (page: Page): Promise<string> =>
  page
    .locator('svg.aerie')
    .evaluate((svg) =>
      svg.outerHTML.replace(/ style="[^"]*"/, '').replace(/ class="aerie[^"]*"/, ''),
    );

test.describe('in a light system', () => {
  test.use({ colorScheme: 'light' });

  test('LOOK-002 dark is the default; the theme button switches to light, redraws nothing, and is remembered', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    // Dark even though the system is light.
    expect(await background(page)).toBe('rgb(9, 11, 16)');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const toLight = page.getByRole('button', { name: 'Switch to the light theme' });
    await expect(toLight).toBeVisible();
    const before = await drawing(page);
    await toLight.click();
    expect(await background(page)).toBe('rgb(243, 244, 248)');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await drawing(page)).toBe(before);
    await page.reload();
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    expect(await background(page)).toBe('rgb(243, 244, 248)');
    // The theme is not part of the picture, so the address does not carry it.
    expect(new URL(page.url()).hash).toBe('');
    await page.getByRole('button', { name: 'Switch to the dark theme' }).click();
    expect(await background(page)).toBe('rgb(9, 11, 16)');
    await page.reload();
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    expect(await background(page)).toBe('rgb(9, 11, 16)');
  });
});

test('LOOK-814 printed, the page is the light theme without the sidebar and the stage controls', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  expect(await background(page)).toBe('rgb(9, 11, 16)');
  await page.emulateMedia({ media: 'print' });
  expect(await background(page)).toBe('rgb(243, 244, 248)');
  await expect(page.locator('nav.side-wrap')).toBeHidden();
  await expect(page.locator('.camera')).toBeHidden();
  await expect(page.locator('.travel')).toBeHidden();
  await expect(page.locator('svg.aerie')).toBeVisible();
  await expect(page.locator('aside.panel')).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  expect(await background(page)).toBe('rgb(9, 11, 16)');
});

test('LOOK-903 Reduce motion sets every duration to zero, and the choice is remembered', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const glide = (): Promise<string> =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--aerie-glide').trim(),
    );
  expect(await glide()).toBe('520ms');
  await page.getByLabel('Reduce motion').check();
  expect(await glide()).toBe('0ms');
  const tool = page.locator('.tool.copy');
  expect(await tool.evaluate((node) => getComputedStyle(node).transitionDuration)).toBe('0s, 0s');
  await page.reload();
  await expect(page.getByLabel('Reduce motion')).toBeChecked();
  expect(await glide()).toBe('0ms');
});

test.describe('with reduced motion asked for by the system', () => {
  test.use({ reducedMotion: 'reduce' });

  test('LOOK-903 reduced motion is on until the reader changes the checkbox', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await expect(page.getByLabel('Reduce motion')).toBeChecked();
    const glide = (): Promise<string> =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--aerie-glide').trim(),
      );
    expect(await glide()).toBe('0ms');
    await page.getByLabel('Reduce motion').uncheck();
    expect(await glide()).toBe('520ms');
  });
});
