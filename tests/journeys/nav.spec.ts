// A reader finding their way around the Lotto sample and sharing what they see
// (docs/spec/interaction.md; acceptance A7): the navigation sidebar, the address that always holds
// the picture, Back and Forward, Copy link, and a link reopening its exact picture. Real clicks and
// keys only; the address and the clipboard are read, never written by the test.
import { expect, test, type Page } from '@playwright/test';
import { boxes, button, clickElement, node, openLotto, scale, settled } from './reader.ts';

test.use({
  viewport: { width: 1600, height: 900 },
  permissions: ['clipboard-read', 'clipboard-write'],
});

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Diagram' });
const panel = (page: Page) => page.locator('aside.panel');
const view = (page: Page, id: string) => page.locator(`button[data-view="${id}"]`);
const scenario = (page: Page, id: string) => page.locator(`button[data-scenario="${id}"]`);
const walkthrough = (page: Page, id: string) => page.locator(`button[data-walkthrough="${id}"]`);
const copy = (page: Page) => page.getByRole('button', { name: /Copy link|Link copied/ });

/** The picture part of the page's address: the fragment, without its `#`. */
const fragment = (page: Page): string => new URL(page.url()).hash.replace(/^#/, '');

/** Waits until the page shows a view, drawn and still. */
async function shows(page: Page, id: string): Promise<void> {
  await expect(page.locator(`svg.aerie[data-view="${id}"]`)).toBeVisible();
  await settled(page);
}

/** A screenshot as a data address the page can load. */
const png = (shot: Buffer): string => `data:image/png;base64,${shot.toString('base64')}`;

/**
 * How many pixels of two screenshots of the same size differ by more than two steps in any colour
 * channel. Two tabs may anti-alias a rounded corner one step apart; anything more is a real change.
 */
async function differentPixels(page: Page, one: Buffer, two: Buffer): Promise<number> {
  return page.evaluate(
    async ({ a, b }) => {
      const pixels = async (data: string): Promise<Uint8ClampedArray> => {
        const image = await createImageBitmap(await (await fetch(data)).blob());
        const canvas = new OffscreenCanvas(image.width, image.height);
        const context = canvas.getContext('2d');
        if (context === null) throw new Error('No canvas.');
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height).data;
      };
      const [first, second] = [await pixels(a), await pixels(b)];
      if (first.length !== second.length) return Infinity;
      let count = 0;
      for (let i = 0; i < first.length; i += 4) {
        for (let c = 0; c < 4; c++) {
          if (Math.abs((first[i + c] ?? 0) - (second[i + c] ?? 0)) > 2) {
            count++;
            break;
          }
        }
      }
      return count;
    },
    { a: png(one), b: png(two) },
  );
}

const STALE =
  'Part of this link no longer matches the diagram, so Aerie is showing the closest picture.';

test.describe('SCOPE-005 the navigation sidebar', () => {
  test('JOURNEY-008 find your way with the sidebar, then step back with the browser', async ({
    page,
  }) => {
    await openLotto(page);
    const side = sidebar(page);
    await expect(side.locator('[data-view]')).toHaveText([
      'Big picture',
      'Services',
      'Engineering: code modules',
    ]);
    await expect(side.locator('[data-scenario]')).toHaveText(['Generate picks', 'Results poll']);
    await expect(side.locator('[data-walkthrough]')).toHaveText(['A tour of the Lotto suite']);
    const current = side.locator('[aria-current="true"]');
    await expect(current).toHaveText(['Big picture']);

    await view(page, 'services').click();
    await shows(page, 'services');
    await expect(current).toHaveText(['Services']);
    expect(fragment(page)).toBe('view=services');
    // The whole view fits the stage.
    const stage = await page.locator('main.aerie-stage').boundingBox();
    expect(stage).not.toBeNull();
    for (const [key, box] of Object.entries(await boxes(page))) {
      expect(box.x, key).toBeGreaterThanOrEqual(stage?.x ?? 0);
      expect(box.y, key).toBeGreaterThanOrEqual(stage?.y ?? 0);
      expect(box.x + box.width, key).toBeLessThanOrEqual((stage?.x ?? 0) + (stage?.width ?? 0));
      expect(box.y + box.height, key).toBeLessThanOrEqual((stage?.y ?? 0) + (stage?.height ?? 0));
    }

    await page.keyboard.press('1');
    await expect(view(page, 'engineering')).toHaveText('How the code is organised');
    await scenario(page, 'results-poll').click();
    await expect(current).toHaveText(['Results poll']);
    await expect(page.locator('.caption-bar .count')).toHaveText('1/6');

    await page.goBack();
    await shows(page, 'services');
    await expect(current).toHaveText(['Services']);
    await expect(page.locator('svg.aerie .trail')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Executive' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.goBack();
    await shows(page, 'big-picture');
    await expect(current).toHaveText(['Big picture']);
    expect(new URL(page.url()).hash).toBe('');
  });

  test('INT-401 lists views, scenarios and walkthroughs in declared order, titled for the audience', async ({
    page,
  }) => {
    await openLotto(page);
    const side = sidebar(page);
    await expect(side.locator('h2')).toHaveText(['Diagram', 'Views', 'Scenarios', 'Walkthroughs']);
    await expect(side.locator('[data-view]')).toHaveText([
      'Big picture',
      'Services',
      'Engineering: code modules',
    ]);
    await expect(side.locator('[data-scenario]')).toHaveText(['Generate picks', 'Results poll']);
    await expect(side.locator('[data-walkthrough]')).toHaveText(['A tour of the Lotto suite']);
    await page.keyboard.press('1');
    await expect(view(page, 'engineering')).toHaveText('How the code is organised');
  });

  test('INT-402 choosing a view shows its default zoom, clears the selection and fits the camera', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    const fitted = await scale(page);
    await button(page, 'engine-service').focus();
    await page.keyboard.press('o');
    await clickElement(page, 'pick-generation');
    await expect(panel(page).locator('h1')).toHaveText('Pick generation');
    await page.getByRole('button', { name: 'Magnify' }).click();
    await settled(page);
    expect(await scale(page)).not.toBe(fitted);
    await view(page, 'big-picture').click();
    await shows(page, 'big-picture');
    await view(page, 'services').click();
    await shows(page, 'services');
    // The view's own default: Engine service closed again, nothing selected, the camera fitted.
    await expect(node(page, 'pick-generation')).toHaveCount(0);
    await expect(panel(page).locator('.kicker')).toHaveText('View');
    expect(await scale(page)).toBe(fitted);
    expect(fragment(page)).toBe('view=services');
  });

  test('INT-402 choosing a view stops a playing scenario', async ({ page }) => {
    await openLotto(page);
    await scenario(page, 'generate-picks').click();
    await expect(scenario(page, 'generate-picks')).toHaveAttribute('aria-current', 'true');
    expect(fragment(page)).toBe('play=generate-picks.1');
    await view(page, 'services').click();
    await shows(page, 'services');
    await expect(scenario(page, 'generate-picks')).not.toHaveAttribute('aria-current');
    await expect(page.locator('svg.aerie .trail')).toHaveCount(0);
    expect(fragment(page)).toBe('view=services');
  });

  test('INT-403 choosing a scenario plays it, and a walkthrough presents it from its first step', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    await scenario(page, 'generate-picks').click();
    await expect(page.locator('svg.aerie .trail').first()).toBeAttached();
    // Services can show the scenario, so it plays there (MODEL-404).
    expect(fragment(page)).toBe('view=services&play=generate-picks.1');
    await walkthrough(page, 'tour').click();
    await shows(page, 'big-picture');
    expect(fragment(page)).toBe('present=tour.1');
    await expect(walkthrough(page, 'tour')).toHaveAttribute('aria-current', 'true');
  });

  test('INT-404 marks the current view or what plays, with Reduce motion at the bottom', async ({
    page,
  }) => {
    await openLotto(page);
    const current = sidebar(page).locator('[aria-current="true"]');
    await expect(current).toHaveText(['Big picture']);
    await expect(current).toHaveClass(/\bon\b/);
    await view(page, 'services').click();
    await expect(current).toHaveText(['Services']);
    // Selecting and opening keep the view marked.
    await clickElement(page, 'website');
    await expect(current).toHaveText(['Services']);
    await scenario(page, 'results-poll').click();
    await expect(current).toHaveText(['Results poll']);
    await walkthrough(page, 'tour').click();
    // Presenting hides the sidebar (INT-701), with the walkthrough marked in it; Esc ends it and
    // shows it again.
    await expect(sidebar(page)).toBeHidden();
    await expect(walkthrough(page, 'tour')).toHaveAttribute('aria-current', 'true');
    await expect(walkthrough(page, 'tour')).toHaveClass(/\bon\b/);
    await page.keyboard.press('Escape');
    await expect(sidebar(page)).toBeVisible();
    // Ending the walkthrough returns to reading at the view of its step (INT-707).
    await expect(current).toHaveText(['Big picture']);
    // The sidebar ends with the Reduce motion checkbox.
    const last = sidebar(page).locator(':scope > *').last();
    await expect(last.getByRole('checkbox', { name: 'Reduce motion' })).toBeVisible();
  });
});

test.describe('the address', () => {
  test('INT-501 the address always holds the current picture', async ({ page }) => {
    await openLotto(page);
    // The default picture has no fragment at all (INT-502).
    expect(new URL(page.url()).hash).toBe('');
    expect(new URL(page.url()).searchParams.get('model')).toBe('samples/lotto.aerie');
    await view(page, 'services').click();
    await shows(page, 'services');
    expect(fragment(page)).toBe('view=services');
    // JOURNEY-001 and JOURNEY-002: the audience, then an opened container.
    await page.keyboard.press('3');
    await expect.poll(() => fragment(page)).toBe('view=services&aud=engineer');
    await button(page, 'engine-service').focus();
    await page.keyboard.press('o');
    await expect.poll(() => fragment(page)).toBe('view=services&aud=engineer&open=engine-service');
    await clickElement(page, 'pick-generation');
    await expect
      .poll(() => fragment(page))
      .toBe('view=services&aud=engineer&open=engine-service&sel=pick-generation');
    // Closing the container moves the selection to it (INT-203), and the address follows.
    await page.keyboard.press('Escape');
    await button(page, 'engine-service').focus();
    await page.keyboard.press('o');
    await expect.poll(() => fragment(page)).toBe('view=services&aud=engineer');
  });

  test('INT-506 choosing a view or an activity adds a history entry; other changes replace it', async ({
    page,
  }) => {
    await openLotto(page);
    const start = await page.evaluate(() => history.length);
    await view(page, 'services').click();
    await shows(page, 'services');
    // Audience, opening and selecting change the address but stay in the same entry.
    await page.keyboard.press('3');
    await button(page, 'engine-service').focus();
    await page.keyboard.press('o');
    await clickElement(page, 'pick-generation');
    await settled(page);
    const services = 'view=services&aud=engineer&open=engine-service&sel=pick-generation';
    expect(fragment(page)).toBe(services);
    expect(await page.evaluate(() => history.length)).toBe(start + 1);
    // The scenario plays on Services, as it is (MODEL-404), so the selection is all that goes.
    await scenario(page, 'generate-picks').click();
    const playing = 'view=services&aud=engineer&open=engine-service&play=generate-picks.1';
    await expect.poll(() => fragment(page)).toBe(playing);
    await walkthrough(page, 'tour').click();
    await expect.poll(() => fragment(page)).toBe('aud=engineer&present=tour.1');
    await page.keyboard.press('Escape');
    await expect.poll(() => fragment(page)).toBe('aud=engineer');
    expect(await page.evaluate(() => history.length)).toBe(start + 4);

    // Back steps through them, each showing its exact picture.
    await page.goBack();
    await expect.poll(() => fragment(page)).toBe('aud=engineer&present=tour.1');
    await expect(walkthrough(page, 'tour')).toHaveAttribute('aria-current', 'true');
    await page.goBack();
    await expect.poll(() => fragment(page)).toBe(playing);
    await expect(scenario(page, 'generate-picks')).toHaveAttribute('aria-current', 'true');
    await page.goBack();
    expect(fragment(page)).toBe(services);
    await shows(page, 'services');
    await expect(node(page, 'pick-generation')).toHaveClass(/\bsel\b/);
    await expect(panel(page).locator('h1')).toHaveText('Pick generation');
    await expect(page.getByRole('tab', { name: 'Engineer' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.goBack();
    expect(new URL(page.url()).hash).toBe('');
    await shows(page, 'big-picture');
    await expect(view(page, 'big-picture')).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('tab', { name: 'Manager' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Forward returns, and the picture with it.
    await page.goForward();
    expect(fragment(page)).toBe(services);
    await shows(page, 'services');
    await expect(panel(page).locator('h1')).toHaveText('Pick generation');
    expect(await page.evaluate(() => history.length)).toBe(start + 4);
  });

  test('INT-507 Copy link copies the full address and reads "Link copied" for a moment', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    await page.keyboard.press('1');
    await expect(copy(page)).toHaveText('Copy link');
    await copy(page).click();
    await expect(copy(page)).toHaveText('Link copied');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(page.url());
    expect(new URL(copied).hash).toBe('#view=services&aud=exec');
    await expect(copy(page)).toHaveText('Copy link');
  });
});

test.describe('opening a shared link', () => {
  test('JOURNEY-006 a copied link reopens the exact picture', async ({ page, context }) => {
    await openLotto(page, 'services');
    await page.getByRole('tab', { name: 'Executive' }).click();
    await button(page, 'engine-service').focus();
    await page.keyboard.press('o');
    await clickElement(page, 'pick-generation');
    await settled(page);
    await copy(page).click();
    await expect(copy(page)).toHaveText('Link copied');
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(new URL(link).hash).toBe(
      '#view=services&aud=exec&open=engine-service&sel=pick-generation',
    );
    await expect(copy(page)).toHaveText('Copy link');

    const other = await context.newPage();
    await other.goto(link);
    await expect(other.locator('#app')).toHaveAttribute('data-ready', 'true');
    await settled(other);
    // The same address, panel, boxes and pixels.
    expect(other.url()).toBe(link);
    await expect(panel(other)).toHaveText((await panel(page).textContent()) ?? '');
    expect(await boxes(other)).toEqual(await boxes(page));
    // The same pointer place and no keyboard focus on either page, so hover and focus match.
    for (const each of [page, other]) {
      await each.mouse.move(800, 20);
      await each.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
    }
    await settled(page);
    await settled(other);
    const shot = { animations: 'disabled' as const, caret: 'hide' as const };
    const [mine, theirs] = [await page.screenshot(shot), await other.screenshot(shot)];
    expect(await differentPixels(other, mine, theirs)).toBe(0);
  });

  test('INT-505 a link opens at its picture directly, without a glide', async ({ page }) => {
    await page.goto('/?model=samples/lotto.aerie#view=services&open=engine-service');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    const first = await boxes(page);
    expect(first['node pick-generation']).toBeDefined();
    await settled(page);
    expect(await boxes(page)).toEqual(first);
    await expect(page.locator('.notice')).toBeHidden();
  });

  test('JOURNEY-006 and INT-505 a part that no longer matches is dropped, and the reader is told', async ({
    page,
  }) => {
    await page.goto(
      '/?model=samples/lotto.aerie#view=services&aud=exec&open=engine-service&sel=nothing-here',
    );
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    const notice = page.getByRole('status').filter({ hasText: STALE });
    await expect(notice).toBeVisible();
    // The rest of the picture is shown, and the address holds the picture that is shown.
    await shows(page, 'services');
    await expect(node(page, 'pick-generation')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Executive' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(panel(page).locator('.kicker')).toHaveText('View');
    expect(fragment(page)).toBe('view=services&aud=exec&open=engine-service');
    // The notice shows for six seconds.
    await expect(notice).toBeHidden({ timeout: 8000 });
  });

  test('INT-505 an address typed by hand shows its picture, and Back returns', async ({ page }) => {
    await openLotto(page);
    const url = new URL(page.url());
    url.hash = 'view=engineering&aud=engineer';
    await page.goto(url.href);
    await shows(page, 'engineering');
    await expect(page.getByRole('tab', { name: 'Engineer' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.goBack();
    await shows(page, 'big-picture');
    await expect(page.getByRole('tab', { name: 'Manager' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
