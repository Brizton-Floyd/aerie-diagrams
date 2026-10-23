// The viewer page as a reader opens it (docs/spec/look.md): it draws the Lotto sample, follows the
// system's theme until the reader picks one and remembers that choice (LOOK-002), and its Reduce
// motion checkbox makes every change instant (LOOK-903). Later slices add the full journeys of
// docs/spec/acceptance.md.
import { expect, test } from '@playwright/test';

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

test.describe('in a dark system', () => {
  test.use({ colorScheme: 'dark' });

  test('LOOK-002 the theme follows the system until the reader picks one, remembered on this device', async ({
    page,
  }) => {
    const background = (): Promise<string> =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.goto('/');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    expect(await background()).toBe('rgb(27, 29, 26)');
    await page.getByRole('button', { name: 'Light' }).click();
    expect(await background()).toBe('rgb(243, 238, 226)');
    await page.reload();
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    expect(await background()).toBe('rgb(243, 238, 226)');
    await expect(page.getByRole('button', { name: 'Dark' })).toBeVisible();
  });
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
  expect(await glide()).toBe('560ms');
  await page.getByLabel('Reduce motion').check();
  expect(await glide()).toBe('0ms');
  const thumb = page.locator('.tabs .thumb');
  expect(await thumb.evaluate((node) => getComputedStyle(node).transitionDuration)).toBe('0s');
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
    expect(await glide()).toBe('560ms');
  });
});
