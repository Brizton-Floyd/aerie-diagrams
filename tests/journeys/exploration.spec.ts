import { expect, test, type Page } from '@playwright/test';
import { boxes, button, clickElement, edge, node, openLotto, settled } from './reader.ts';

test.use({ viewport: { width: 1600, height: 900 } });

const camera = (page: Page) =>
  page.locator('svg.aerie[data-view]').evaluate((svg) => (svg as SVGSVGElement).style.transform);

async function exploreEngine(page: Page): Promise<void> {
  await clickElement(page, 'engine');
  await page.getByRole('button', { name: 'Explore this part', exact: true }).click();
  await expect(page).toHaveURL(/explore=engine/);
  await settled(page);
}

test('INT-305 MODEL-213 explore keeps outside connections, wording geometry and exact return', async ({
  page,
}) => {
  await openLotto(page);
  await clickElement(page, 'engine');
  await settled(page);
  const previous = { url: page.url(), camera: await camera(page) };
  const action = page.getByRole('button', { name: 'Explore this part', exact: true });
  await expect(action).toBeInViewport();
  await action.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/explore=engine/);
  await settled(page);
  await expect(button(page, 'engine')).toHaveAttribute('aria-expanded', 'true');
  for (const id of ['suite', 'user', 'website', 'texas'])
    await expect(node(page, id)).toHaveCount(0);
  for (const id of ['screen-api', 'store']) {
    await expect(node(page, id)).toHaveCount(1);
  }
  await expect(button(page, 'store')).toHaveAttribute('aria-expanded', 'false');
  await expect(edge(page, 'screen-api->engine-service')).toHaveCount(1);
  await expect(edge(page, 'engine-service->store')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Exploration' })).toContainText(
    'Connected outside parts remain visible',
  );
  const positions = await boxes(page);
  for (const key of ['2', '3', '1']) {
    await page.locator('body').press(key);
    await settled(page);
    expect(await boxes(page)).toEqual(positions);
    await expect(page).toHaveURL(/explore=engine/);
  }
  await page.getByRole('button', { name: 'Return to previous picture', exact: true }).click();
  await expect(page).toHaveURL(previous.url);
  await settled(page);
  expect(await camera(page)).toBe(previous.camera);
  await expect(node(page, 'suite')).toHaveCount(1);
  await page.goForward();
  await expect(page).toHaveURL(/explore=engine/);
  await expect(node(page, 'suite')).toHaveCount(0);
});

test('INT-305 MODEL-213 nested exploration shares its scope and a fresh link can show the full view', async ({
  page,
  browser,
}) => {
  await openLotto(page);
  await exploreEngine(page);
  await button(page, 'engine-service').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Explore this part', exact: true }).click();
  await expect(page).toHaveURL(/explore=engine-service/);
  await settled(page);
  await expect(node(page, 'pick-generation')).toHaveCount(1);
  await expect(node(page, 'engine')).toHaveCount(0);
  await page.locator('body').press('3');
  await settled(page);
  const url = page.url();
  const fresh = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  try {
    await fresh.goto(url);
    await expect(fresh.locator('#app')).toHaveAttribute('data-ready', 'true');
    await settled(fresh);
    await expect(fresh).toHaveURL(url);
    await expect(node(fresh, 'pick-generation')).toHaveCount(1);
    await expect(fresh.locator('svg.aerie[data-audience="engineer"]')).toBeVisible();
    await fresh.getByRole('button', { name: 'Show full view', exact: true }).click();
    await expect(fresh).not.toHaveURL(/explore=/);
    await expect(node(fresh, 'suite')).toHaveCount(1);
    await expect(fresh.locator('svg.aerie[data-audience="engineer"]')).toBeVisible();
  } finally {
    await fresh.close();
  }
  await page.getByRole('button', { name: 'Return to previous picture', exact: true }).click();
  await expect(page).toHaveURL(/explore=engine&/);
  await page.locator('button[data-scenario="generate-picks"]').click();
  await expect(page).not.toHaveURL(/explore=/);
  await expect(node(page, 'suite')).toHaveCount(1);
});
