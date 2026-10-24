// A reader going back to where they were on the Lotto sample (docs/spec/interaction.md, INT-551 to
// INT-557; acceptance JOURNEY-011): every change they make is a visit, and Back, Forward, the list
// of recent visits, Alt+Left and Alt+Right and the browser's own Back and Forward return to each
// one's exact picture, camera included. Real clicks and keys only; the address and the camera are
// read, never written by the test.
import { expect, test, type Page } from '@playwright/test';
import { button, clickElement, node, openLotto, settled, wordedFor } from './reader.ts';

test.use({ viewport: { width: 1600, height: 900 } });

const panel = (page: Page) => page.locator('aside.panel');
const travel = (page: Page) => page.getByRole('group', { name: 'Visits' });
const back = (page: Page) => travel(page).getByRole('button', { name: 'Back', exact: true });
const forward = (page: Page) => travel(page).getByRole('button', { name: 'Forward', exact: true });
const recent = (page: Page) => travel(page).getByRole('list', { name: 'Recent visits' });
const scenario = (page: Page, id: string) => page.locator(`button[data-scenario="${id}"]`);
const walkthrough = (page: Page, id: string) => page.locator(`button[data-walkthrough="${id}"]`);

/** The picture part of the page's address: the fragment, without its `#`. */
const fragment = (page: Page): string => new URL(page.url()).hash.replace(/^#/, '');

/** The camera: the drawing's place and scale on the stage, as the page last set it. */
const camera = (page: Page): Promise<string> =>
  page.locator('svg.aerie[data-view]').evaluate((svg) => (svg as SVGSVGElement).style.transform);

/** What the reader sees at a visit: the address, the selection's panel and the camera. */
interface Seen {
  fragment: string;
  title: string;
  camera: string;
}

async function seen(page: Page): Promise<Seen> {
  await settled(page);
  return {
    fragment: fragment(page),
    title: (await panel(page).locator('h1').textContent()) ?? '',
    camera: await camera(page),
  };
}

/** Waits until the page shows a visit again, exactly as it was seen. */
async function returnsTo(page: Page, was: Seen): Promise<void> {
  await expect.poll(() => fragment(page)).toBe(was.fragment);
  await settled(page);
  await expect(panel(page).locator('h1')).toHaveText(was.title);
  expect(await camera(page)).toBe(was.camera);
}

/** Opens a container with the keyboard, as a reader whose control is off the stage does. */
async function open(page: Page, id: string): Promise<void> {
  await button(page, id).focus();
  await page.keyboard.press('o');
  await expect(button(page, id)).toHaveAttribute('aria-expanded', 'true');
  await settled(page);
}

/** Drags the stage by an amount, as a reader moves the camera. */
async function drag(page: Page, dx: number, dy: number): Promise<void> {
  const stage = await page.locator('main.aerie-stage').boundingBox();
  if (stage === null) throw new Error('The stage is not shown.');
  // An empty spot near the stage's bottom left, clear of the buttons and of the drawing.
  const x = stage.x + 40;
  const y = stage.y + stage.height - 40;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
}

/**
 * The walk of JOURNEY-011: drill into the Number engine on the Big picture, select Pick
 * generation, then follow its connections to Draw history lookup and on to the Draw history service
 * in the Results store, another part of the diagram.
 */
async function walk(page: Page): Promise<{ start: Seen; picked: Seen; followed: Seen }> {
  await openLotto(page);
  const start = await seen(page);
  await open(page, 'engine');
  await open(page, 'engine-service');
  await clickElement(page, 'pick-generation');
  await expect(button(page, 'pick-generation')).toHaveAttribute('aria-pressed', 'true');
  const picked = await seen(page);
  await panel(page).locator('button[data-select="history-lookup"]').first().click();
  await expect(panel(page).locator('h1')).toHaveText('Draw history lookup');
  await settled(page);
  await panel(page).locator('button[data-select="history-service"]').first().click();
  await expect(panel(page).locator('h1')).toHaveText('Draw history service');
  const followed = await seen(page);
  // The Results store opened around it, and the camera went with it.
  expect(followed.fragment).toContain('store');
  expect(followed.camera).not.toBe(picked.camera);
  return { start, picked, followed };
}

test.describe('Back and Forward through visits', () => {
  test('JOURNEY-011 INT-554 Back returns to the exact picture and camera, Forward comes back', async ({
    page,
  }) => {
    const { picked, followed } = await walk(page);
    // Back twice: Draw history lookup, then Pick generation, as it was, camera included.
    await back(page).click();
    await expect(panel(page).locator('h1')).toHaveText('Draw history lookup');
    await back(page).click();
    await returnsTo(page, picked);
    await expect(button(page, 'pick-generation')).toHaveAttribute('aria-pressed', 'true');
    await expect(button(page, 'engine')).toHaveAttribute('aria-expanded', 'true');
    await expect(button(page, 'engine-service')).toHaveAttribute('aria-expanded', 'true');
    await expect(node(page, 'history-service')).toHaveCount(0);
    // Forward twice returns to the Draw history service, with its camera.
    await forward(page).click();
    await expect(panel(page).locator('h1')).toHaveText('Draw history lookup');
    await forward(page).click();
    await returnsTo(page, followed);
    await expect(button(page, 'history-service')).toHaveAttribute('aria-pressed', 'true');
    await expect(forward(page)).toHaveAttribute('aria-disabled', 'true');
  });

  test('INT-552 and INT-553 the browser Back and Forward, Alt+Left and Alt+Right move between the same visits', async ({
    page,
  }) => {
    const { picked, followed } = await walk(page);
    await page.goBack();
    await expect(panel(page).locator('h1')).toHaveText('Draw history lookup');
    await page.goBack();
    await returnsTo(page, picked);
    await page.goForward();
    await page.goForward();
    await returnsTo(page, followed);
    // INT-553: Alt+Left and Alt+Right, with the focus anywhere but a text field.
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(panel(page).locator('h1')).toHaveText('Draw history lookup');
    await page.keyboard.press('Alt+ArrowLeft');
    await returnsTo(page, picked);
    await page.keyboard.press('Alt+ArrowRight');
    await page.keyboard.press('Alt+ArrowRight');
    await returnsTo(page, followed);
  });

  test('INT-555 the recent visits are named, the current one marked, and one goes straight back several visits', async ({
    page,
  }) => {
    const { start, followed } = await walk(page);
    const names = recent(page).getByRole('button');
    await expect(names).toHaveText([
      'Number engine',
      'Engine service',
      'Pick generation',
      'Draw history lookup',
      'Draw history service',
    ]);
    await expect(names.last()).toHaveAttribute('aria-current', 'true');
    // Choosing Number engine goes back three visits at once.
    await names.first().click();
    await expect.poll(() => fragment(page)).toBe('open=engine');
    await settled(page);
    await expect(button(page, 'engine-service')).toHaveAttribute('aria-expanded', 'false');
    await expect(names.first()).toHaveAttribute('aria-current', 'true');
    // The list keeps the visits ahead, so the reader can go straight forward again.
    await expect(names).toHaveCount(5);
    await names.last().click();
    await returnsTo(page, followed);
    // Six visits: the oldest, the first picture, has left the list but Back still reaches it.
    for (let at = 0; at < 5; at++) await back(page).click();
    await returnsTo(page, start);
    await expect(back(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(names.first()).toHaveText('Big picture');
    await expect(names.first()).toHaveAttribute('aria-current', 'true');
  });

  test('INT-551 moving the camera adds no visit: the visit keeps the camera where the reader left it', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    const length = await page.evaluate(() => history.length);
    await clickElement(page, 'website');
    await expect(panel(page).locator('h1')).toHaveText('Website');
    // Three drags and a magnification make one camera for this visit, not four visits.
    await drag(page, 60, 0);
    await drag(page, 0, -40);
    await drag(page, -20, 30);
    await page.getByRole('button', { name: 'Move closer (+)' }).click();
    const moved = await seen(page);
    expect(await page.evaluate(() => history.length)).toBe(length + 1);
    await clickElement(page, 'screen-api');
    await expect(panel(page).locator('h1')).toHaveText('Website back end');
    await drag(page, 80, 0);
    expect(await page.evaluate(() => history.length)).toBe(length + 2);
    await back(page).click();
    await returnsTo(page, moved);
  });

  test('INT-551 changing the wording is a visit; Back changes it back, moving nothing', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    await clickElement(page, 'website');
    const before = await seen(page);
    await page.keyboard.press('3');
    await expect(panel(page).locator('h1')).toHaveText('Website');
    await expect.poll(() => fragment(page)).toContain('aud=engineer');
    await back(page).click();
    await returnsTo(page, before);
    await wordedFor(page, 'plain');
  });

  test('INT-557 scenario steps and walkthrough steps keep their own controls and stay one visit', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    await clickElement(page, 'website');
    const before = await seen(page);
    await scenario(page, 'generate-picks').click();
    await expect(page.locator('.caption-bar .count')).toHaveText('Step 1 of 14');
    await settled(page);
    // The Right arrow moves the scenario on; it is still one visit.
    for (let at = 0; at < 4; at++) await page.keyboard.press('ArrowRight');
    await expect(page.locator('.caption-bar .count')).toHaveText('Step 5 of 14');
    await expect(recent(page).getByRole('button').last()).toHaveText('Generate picks');
    // Back leaves the scenario for the visit before it.
    await back(page).click();
    await returnsTo(page, before);
    await expect(page.locator('.caption-bar')).toBeHidden();
    // Forward plays it again at the step it was left on.
    await forward(page).click();
    await expect(page.locator('.caption-bar .count')).toHaveText('Step 5 of 14');
    // A presentation hides Back, Forward and the list, and has its own Back and Next.
    await walkthrough(page, 'tour').click();
    await expect(travel(page)).toBeHidden();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await expect(travel(page)).toBeVisible();
    await expect(recent(page).getByRole('button').last()).toHaveAttribute('aria-current', 'true');
  });

  test('INT-556 a reload keeps the visits, and Back still returns with the camera', async ({
    page,
  }) => {
    const { picked, followed } = await walk(page);
    await page.reload();
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await settled(page);
    expect(fragment(page)).toBe(followed.fragment);
    await expect(recent(page).getByRole('button').last()).toHaveText('Draw history service');
    await back(page).click();
    await back(page).click();
    await returnsTo(page, picked);
  });
});
