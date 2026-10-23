// A presenter walking a room through the Lotto sample's tour (docs/spec/interaction.md, INT-701 to
// INT-707; docs/spec/model.md, MODEL-501 to MODEL-506; acceptance A9 and JOURNEY-005): presenter
// mode, every step's picture, the keys and controls, scenario steps inside the walkthrough, the
// live audience switch, links to a step, ending, and reduced motion. Real clicks and keys only.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { boxOf, boxes, clickElement, node, openLotto, scale, settled } from './reader.ts';

test.use({ viewport: { width: 1600, height: 900 } });

const STEPS = 8;

const bar = (page: Page): Locator => page.locator('.narration-bar');
const controls = (page: Page): Locator => page.getByRole('group', { name: 'Present' });
const control = (page: Page, name: string): Locator =>
  controls(page).getByRole('button', { name, exact: true });
const currentBadge = (page: Page): Locator => page.locator('svg.aerie g.badges > g.badge.now');

/** The picture part of the page's address: the fragment, without its `#`. */
const fragment = (page: Page): string => new URL(page.url()).hash.replace(/^#/, '');

/** The ids of the elements drawn as selected or focused. */
const focused = (page: Page): Promise<string[]> =>
  page
    .locator('svg.aerie g.boxes > g.node.sel')
    .evaluateAll((all) => all.map((each) => each.getAttribute('data-id') ?? ''));

/** Chooses the tour in the sidebar and waits for its first step. */
async function presentTour(page: Page): Promise<void> {
  await page.locator('button[data-walkthrough="tour"]').click();
  await atStep(page, 1);
}

/** Waits until the presentation shows `step` (and, inside a scenario, its step) and is still. */
async function atStep(page: Page, step: number, scenarioStep?: number): Promise<void> {
  await expect(bar(page).locator('.narration-meta .count')).toHaveText(
    `${String(step)} / ${String(STEPS)}`,
  );
  if (scenarioStep === undefined) {
    await expect(bar(page).locator('.scenario-count')).toHaveCount(0);
  } else {
    await expect(bar(page).locator('.scenario-count')).toHaveText(`${String(scenarioStep)}/14`);
    await expect(currentBadge(page)).toHaveAttribute('data-step', String(scenarioStep));
  }
  await settled(page);
}

/** What the tour shows at each step, for the Manager (docs/spec/model.md, walkthrough `tour`). */
const TOUR: {
  view: string;
  focus: string[];
  narration: string;
  fragment: string;
  /** An element drawn only at this zoom, or one that must not be drawn (`!id`). */
  zoom?: string;
}[] = [
  {
    view: 'big-picture',
    focus: ['website'],
    narration: 'The user opens the website in a browser and picks a state and a game.',
    fragment: 'present=tour.1',
  },
  {
    view: 'big-picture',
    focus: ['screen-api'],
    narration:
      "The Screen API prepares the data for each screen, mostly by reshaping the engine's answers.",
    fragment: 'present=tour.2',
  },
  {
    view: 'big-picture',
    focus: ['engine'],
    narration:
      'The Analysis engine does the thinking: dashboards, generated picks, scoring and betslips.',
    fragment: 'present=tour.3',
  },
  {
    view: 'services',
    focus: ['pick-generation'],
    narration:
      'Inside the engine, Pick generation runs the strategy the user chose and checks each set against past draws until it finds one worth playing.',
    fragment: 'present=tour.4',
    zoom: 'pick-generation',
  },
  {
    view: 'big-picture',
    focus: ['store'],
    narration:
      "The Results store keeps each game's past draws and refreshes them from the Texas Lottery website every two hours.",
    fragment: 'present=tour.5',
  },
  {
    // The view changed, so Engine service is closed again (MODEL-502).
    view: 'services',
    focus: ['store'],
    narration:
      "Inside the store, the updater has every game refreshed, the reader downloads and saves each game's results, and the history service answers the engine.",
    fragment: 'present=tour.6',
    zoom: '!pick-generation',
  },
];

test.describe('SCOPE-007 presenter mode', () => {
  test('INT-701 presenting fills the screen with the stage, the narration bar, the audience tabs and the controls', async ({
    page,
  }) => {
    await openLotto(page, 'services');
    await presentTour(page);
    // Aerie asks for full screen, and the sidebar and side panel hide.
    expect(await page.evaluate(() => document.fullscreenElement?.tagName)).toBe('HTML');
    await expect(page.getByRole('navigation', { name: 'Diagram' })).toBeHidden();
    await expect(page.locator('aside.panel')).toBeHidden();
    await expect(page.locator('header .crumb')).toBeHidden();
    expect(await page.locator('main.aerie-stage').boundingBox()).toEqual({
      x: 0,
      y: 0,
      width: 1600,
      height: 900,
    });
    // The narration bar: "1 / 8", the walkthrough's title and the step's narration, announced.
    await expect(bar(page)).toHaveAttribute('aria-live', 'polite');
    await expect(bar(page).locator('.narration-meta')).toHaveText('1 / 8A tour of the Lotto suite');
    await expect(bar(page).locator('.narration-text')).toHaveText(TOUR[0]?.narration ?? '');
    // LOOK type scale: presenter narration is 28 px Source Serif 4.
    await expect(bar(page).locator('.narration-text')).toHaveCSS('font-size', '28px');
    await expect(bar(page).locator('.narration-text')).toHaveCSS(
      'font-family',
      /^"?Source Serif 4"?/,
    );
    // The audience tabs at the top right, always in view (INT-001).
    const tabs = await page.getByRole('tablist', { name: 'Written for' }).boundingBox();
    expect(tabs).not.toBeNull();
    expect((tabs?.x ?? 0) + (tabs?.width ?? 0)).toBeGreaterThan(1500);
    expect(tabs?.y ?? 900).toBeLessThan(40);
    // Back, Next and Exit at the bottom right; Back does nothing on the first step.
    await expect(controls(page).getByRole('button')).toHaveText(['Back', 'Next', 'Exit']);
    const exit = await control(page, 'Exit').boundingBox();
    expect((exit?.x ?? 0) + (exit?.width ?? 0)).toBeGreaterThan(1500);
    expect(exit?.y ?? 0).toBeGreaterThan(780);
    await expect(control(page, 'Back')).toHaveAttribute('aria-disabled', 'true');
    // LOOK-901: they hide after 2.5 s without pointer movement and return when it moves.
    await page.mouse.move(800, 400);
    await expect(controls(page)).toHaveCSS('opacity', '1');
    await page.waitForTimeout(1500);
    await expect(controls(page)).toHaveCSS('opacity', '1');
    await expect(controls(page)).toHaveCSS('opacity', '0', { timeout: 3000 });
    await page.mouse.move(820, 420);
    await expect(controls(page)).toHaveCSS('opacity', '1');
  });

  test('JOURNEY-005, INT-706 and MODEL-501 to MODEL-503 every step of the tour shows its picture, then the scenario plays through', async ({
    page,
  }) => {
    await openLotto(page);
    await presentTour(page);
    // The keys and the Next control all go forward (INT-703).
    const forward = [
      () => page.keyboard.press('ArrowRight'),
      () => page.keyboard.press('PageDown'),
      () => page.keyboard.press(' '),
      () => control(page, 'Next').click(),
    ];
    for (const [index, step] of TOUR.entries()) {
      if (index > 0) await forward[index % forward.length]?.();
      await atStep(page, index + 1);
      await expect(page.locator(`svg.aerie[data-view="${step.view}"]`)).toBeVisible();
      // LOOK-603: the focus is drawn like a selection.
      expect(await focused(page)).toEqual(step.focus);
      await expect(bar(page).locator('.narration-text')).toHaveText(step.narration);
      expect(fragment(page)).toBe(step.fragment);
      if (step.zoom?.startsWith('!') === true) {
        await expect(node(page, step.zoom.slice(1))).toHaveCount(0);
      } else if (step.zoom !== undefined) {
        await expect(node(page, step.zoom)).toBeVisible();
      }
    }
    // Step 7 plays Generate picks on Services, which gives every participant a lift (MODEL-503).
    await page.keyboard.press('ArrowRight');
    await atStep(page, 7, 1);
    await expect(page.locator('svg.aerie[data-view="services"]')).toBeVisible();
    expect(await focused(page)).toEqual([]);
    await expect(bar(page).locator('.narration-meta')).toHaveText(
      '7 / 8A tour of the Lotto suiteGenerate picks 1/14',
    );
    await expect(bar(page).locator('.narration-text')).toHaveText(
      'Now follow one request: what happens when the user clicks Generate Numbers.',
    );
    expect(fragment(page)).toBe('present=tour.7.1');
    // MODEL-504: forward plays the next scenario step until the end of the range.
    for (let at = 2; at <= 14; at++) {
      await page.keyboard.press('ArrowRight');
      await atStep(page, 7, at);
      expect(fragment(page)).toBe(`present=tour.7.${String(at)}`);
    }
    // Then the next walkthrough step: the Big picture, nothing focused, nothing playing.
    await page.keyboard.press('ArrowRight');
    await atStep(page, 8);
    await expect(page.locator('svg.aerie[data-view="big-picture"]')).toBeVisible();
    expect(await focused(page)).toEqual([]);
    await expect(page.locator('svg.aerie .trail')).toHaveCount(0);
    await expect(bar(page).locator('.narration-text')).toHaveText('The whole suite again.');
    // INT-706: on the last step Next does nothing, and the bar says the walkthrough has ended.
    await expect(bar(page).locator('.narration-end')).toHaveText('End of the walkthrough');
    await expect(control(page, 'Next')).toHaveAttribute('aria-disabled', 'true');
    // Playwright waits for a control marked aria-disabled to be enabled, so it is forced.
    await control(page, 'Next').click({ force: true });
    await page.keyboard.press('ArrowRight');
    await atStep(page, 8);
    expect(fragment(page)).toBe('present=tour.8');
    // Esc ends it: reading mode, same view.
    await page.keyboard.press('Escape');
    await expect(bar(page)).toBeHidden();
    await expect(page.locator('svg.aerie[data-view="big-picture"]')).toBeVisible();
    await expect(page.locator('button[data-view="big-picture"]')).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(fragment(page)).toBe('');
  });

  test('INT-703 and MODEL-504 going back, Page Up, Home and End', async ({ page }) => {
    await openLotto(page);
    await presentTour(page);
    await page.keyboard.press('End');
    await atStep(page, 8);
    // Back into a scenario step starts at the last step of its range.
    await page.keyboard.press('ArrowLeft');
    await atStep(page, 7, 14);
    await page.keyboard.press('PageUp');
    await atStep(page, 7, 13);
    await control(page, 'Back').click();
    await atStep(page, 7, 12);
    await page.keyboard.press('Home');
    await atStep(page, 1);
    expect(fragment(page)).toBe('present=tour.1');
    // On the first step, Back does nothing.
    await page.keyboard.press('ArrowLeft');
    await atStep(page, 1);
    // Going back to step 6 from step 7 shows step 6's own picture again (MODEL-501).
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');
    await atStep(page, 7, 14);
    for (let at = 13; at >= 1; at--) await page.keyboard.press('ArrowLeft');
    await atStep(page, 7, 1);
    await page.keyboard.press('ArrowLeft');
    await atStep(page, 6);
    expect(await focused(page)).toEqual(['store']);
    await expect(page.locator('svg.aerie .trail')).toHaveCount(0);
  });

  test('INT-702 a focus step frames its focus elements; a step without focus fits the whole picture', async ({
    page,
  }) => {
    await openLotto(page);
    await presentTour(page);
    const stage = { width: 1600, height: 900 };
    const room = 174;
    for (const step of [1, 4]) {
      await page.keyboard.press('Home');
      for (let at = 1; at < step; at++) await page.keyboard.press('ArrowRight');
      await atStep(page, step);
      const id = TOUR[step - 1]?.focus[0] ?? '';
      const box = await boxOf(page, id);
      // Centred above the narration bar, at most 1.15, with at least 80 px all round.
      expect(await scale(page)).toBeLessThanOrEqual(1.15);
      expect(box.x + box.width / 2).toBeCloseTo(stage.width / 2, 0);
      expect(box.y + box.height / 2).toBeCloseTo((stage.height - room) / 2, 0);
      expect(box.x).toBeGreaterThanOrEqual(80);
      expect(box.y + box.height).toBeLessThanOrEqual(stage.height - room - 80);
    }
    // The last step has no focus: the whole picture fits, clear of the narration bar.
    await page.keyboard.press('End');
    await atStep(page, 8);
    const drawn = Object.values(await boxes(page));
    const bottom = Math.max(...drawn.map((each) => each.y + each.height));
    const top = Math.min(...drawn.map((each) => each.y));
    expect(top).toBeGreaterThanOrEqual(0);
    expect(bottom).toBeLessThanOrEqual(stage.height - room);
  });

  test('INT-704 clicks do not select, open or close; the camera still moves, and the next step fits it again', async ({
    page,
  }) => {
    await openLotto(page);
    await presentTour(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await atStep(page, 3);
    const framed = await scale(page);
    // No open or close control is offered (INT-303), and clicking selects nothing.
    await expect(page.locator('svg.aerie .control').first()).toBeHidden();
    await clickElement(page, 'website');
    await page.locator('svg.aerie g.node[data-id="engine"] text').first().dblclick();
    await settled(page);
    expect(await focused(page)).toEqual(['engine']);
    await expect(node(page, 'engine-service')).toHaveCount(0);
    expect(fragment(page)).toBe('present=tour.3');
    // The camera magnifies with the keys and the wheel.
    await page.keyboard.press('+');
    await settled(page);
    expect(await scale(page)).toBeGreaterThan(framed);
    await page.mouse.move(800, 300);
    await page.mouse.wheel(0, 400);
    await settled(page);
    expect(await scale(page)).not.toBeCloseTo(framed, 2);
    // The next step fits it again, and going back frames step 3 as it was.
    await page.keyboard.press('ArrowRight');
    await atStep(page, 4);
    await page.keyboard.press('ArrowLeft');
    await atStep(page, 3);
    expect(await scale(page)).toBeCloseTo(framed, 3);
  });

  test('INT-104 and MODEL-505 the audience switches live while presenting, and nothing moves', async ({
    page,
  }) => {
    await openLotto(page);
    await presentTour(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await atStep(page, 3);
    const before = await boxes(page);
    await page.keyboard.press('3');
    // The engineer reads the narration with its added paragraph, in the code voice (LOOK-102).
    await expect(bar(page).locator('.narration-text')).toContainText(
      'One Spring Boot jar on port 8002',
    );
    await expect(bar(page).locator('.narration-text')).toHaveCSS('font-size', '24px');
    await expect(page.getByRole('tab', { name: 'Engineer' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await settled(page);
    expect(await boxes(page)).toEqual(before);
    expect(fragment(page)).toBe('aud=engineer&present=tour.3');
    // A step without `for` keeps the audience.
    await page.keyboard.press('ArrowRight');
    await atStep(page, 4);
    expect(fragment(page)).toBe('aud=engineer&present=tour.4');
    // The tabs switch it too, and the executive reads the replaced narration.
    await page.keyboard.press('ArrowLeft');
    await page.getByRole('tab', { name: 'Executive' }).click();
    await expect(bar(page).locator('.narration-text')).toHaveText(
      'The engine is where the value is: it turns past draws into suggested picks.',
    );
    expect(fragment(page)).toBe('aud=exec&present=tour.3');
  });

  test('INT-705 a step without narration shows its view title, or the scenario step caption', async ({
    page,
  }) => {
    await openLotto(page);
    await page.getByLabel('Open a .aerie file').setInputFiles({
      name: 'quiet.aerie',
      mimeType: 'text/plain',
      buffer: Buffer.from(
        [
          'model quiet: Quiet tour',
          '',
          'shop: Shop',
          'bank: Bank',
          '',
          'shop pays through bank',
          '',
          'view main: Main view',
          '  show shop, bank',
          '',
          'scenario pay: Paying',
          '  shop pays through bank',
          '    > The shop asks for the money.',
          '',
          'walkthrough tour: Quiet tour',
          '  step main: shop',
          '  step pay',
          '',
        ].join('\n'),
      ),
    });
    await page.locator('button[data-walkthrough="tour"]').click();
    await expect(bar(page).locator('.narration-meta .count')).toHaveText('1 / 2');
    await expect(bar(page).locator('.narration-text')).toHaveText('Main view');
    await page.keyboard.press('ArrowRight');
    await expect(bar(page).locator('.narration-meta .count')).toHaveText('2 / 2');
    await expect(bar(page).locator('.narration-text')).toHaveText('The shop asks for the money.');
  });

  test('INT-707 Exit returns to reading at the same view, zoom and audience, with nothing focused or playing', async ({
    page,
  }) => {
    await openLotto(page);
    await presentTour(page);
    for (let at = 1; at < 4; at++) await page.keyboard.press('ArrowRight');
    await atStep(page, 4);
    await page.keyboard.press('1');
    await control(page, 'Exit').click();
    await expect(bar(page)).toBeHidden();
    await settled(page);
    expect(fragment(page)).toBe('view=services&aud=exec&open=engine-service');
    expect(await focused(page)).toEqual([]);
    await expect(node(page, 'pick-generation')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Diagram' })).toBeVisible();
    await expect(page.locator('aside.panel h1')).toHaveText('Services');
    await expect(controls(page)).toBeHidden();
    // Full screen ends with the presentation, and clicks select again.
    await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
    await clickElement(page, 'website');
    expect(await focused(page)).toEqual(['website']);
  });

  test('INT-703 leaving full screen ends the presentation', async ({ page }) => {
    await openLotto(page);
    await presentTour(page);
    await page.keyboard.press('ArrowRight');
    await atStep(page, 2);
    // The browser's own way out of full screen, as its Esc or a system gesture does.
    await page.evaluate(() => document.exitFullscreen());
    await expect(bar(page)).toBeHidden();
    expect(fragment(page)).toBe('');
    await expect(page.locator('aside.panel h1')).toHaveText('Big picture');
  });

  test('INT-801 the split editor offers the walkthroughs in its view menu, and presenting covers it', async ({
    page,
  }) => {
    await openLotto(page);
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('.editor-pane')).toBeVisible();
    await page.locator('.crumb-title').click();
    await page.getByRole('menuitem', { name: 'A tour of the Lotto suite' }).click();
    await atStep(page, 1);
    await expect(page.locator('.editor-pane')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('.editor-pane')).toBeVisible();
  });
});

test.describe('links to a step', () => {
  test('INT-501 and INT-505 a link opens the presentation at its step, inside a scenario too', async ({
    page,
  }) => {
    await page.goto('/?model=samples/lotto.aerie#present=tour.4');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await atStep(page, 4);
    await expect(page.locator('svg.aerie[data-view="services"]')).toBeVisible();
    expect(await focused(page)).toEqual(['pick-generation']);
    await expect(page.locator('aside.panel')).toBeHidden();
    // Without a reader's gesture there is no full screen: presenting fills the window.
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    expect(await page.locator('main.aerie-stage').boundingBox()).toEqual({
      x: 0,
      y: 0,
      width: 1600,
      height: 900,
    });
    await page.goto('/?model=samples/lotto.aerie#aud=engineer&present=tour.7.9');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await atStep(page, 7, 9);
    await expect(page.getByRole('tab', { name: 'Engineer' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('ArrowRight');
    await atStep(page, 7, 10);
    expect(fragment(page)).toBe('aud=engineer&present=tour.7.10');
    // A step past the end is clamped to the last one (MODEL-603).
    await page.goto('/?model=samples/lotto.aerie#present=tour.99');
    await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
    await atStep(page, 8);
  });

  test('INT-506 starting and ending a walkthrough add history entries; its steps do not', async ({
    page,
  }) => {
    await openLotto(page);
    const start = await page.evaluate(() => history.length);
    await presentTour(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await atStep(page, 3);
    expect(await page.evaluate(() => history.length)).toBe(start + 1);
    // Back ends the presentation, and Forward presents the step again.
    await page.goBack();
    await expect(bar(page)).toBeHidden();
    expect(fragment(page)).toBe('');
    // Leaving full screen takes the browser a moment.
    await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
    await page.goForward();
    await atStep(page, 3);
    expect(await focused(page)).toEqual(['engine']);
  });
});

test.describe('reduced motion', () => {
  test('LOOK-903 and INT-905 with Reduce motion every step appears at once and the controls hide without fading', async ({
    page,
  }) => {
    await openLotto(page);
    await page.getByLabel('Reduce motion').check();
    await presentTour(page);
    for (let at = 2; at <= 7; at++) {
      await page.keyboard.press('ArrowRight');
      await expect(bar(page).locator('.narration-meta .count')).toHaveText(`${String(at)} / 8`);
      // Nothing glides, fades or draws itself: the picture and the camera jump.
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    }
    await expect(currentBadge(page)).toHaveAttribute('data-step', '1');
    const curve = page.locator('svg.aerie g.trail > g.step.now > path.curve');
    await expect(curve).toHaveCSS('stroke-dashoffset', '0px');
    // The wait before the controls hide is not motion; only their fade goes.
    await page.mouse.move(700, 300);
    await expect(controls(page)).toHaveCSS('transition-duration', '0s');
    await page.waitForTimeout(1500);
    await expect(controls(page)).toHaveCSS('opacity', '1');
    await expect(controls(page)).toHaveCSS('opacity', '0', { timeout: 3000 });
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
});

for (const theme of ['light', 'dark'] as const) {
  test(`SCORE-005 an accessibility audit finds no problems while presenting, on a focus step and a scenario step, ${theme}`, async ({
    page,
  }) => {
    test.slow();
    await page.emulateMedia({ colorScheme: theme });
    await openLotto(page);
    await presentTour(page);
    for (const [step, keys] of [
      [3, 2],
      [7, 4],
    ] as const) {
      // The arrow keys belong to the audience tabs while one has the focus, so Next is pressed.
      for (let at = 0; at < keys; at++) await control(page, 'Next').click();
      for (const audience of ['Executive', 'Manager', 'Engineer']) {
        await page.getByRole('tab', { name: audience }).click();
        await atStep(page, step, step === 7 ? 1 : undefined);
        const results = await new AxeBuilder({ page }).analyze();
        const found = results.violations.flatMap((violation) =>
          violation.nodes.map((each) => `${violation.id}: ${each.target.join(' ')}`),
        );
        expect(found, `step ${String(step)}, ${audience}`).toEqual([]);
      }
    }
  });
}
