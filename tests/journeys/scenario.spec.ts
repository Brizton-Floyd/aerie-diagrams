// A reader playing the Lotto sample's Generate picks scenario on the architecture (docs/spec/
// interaction.md, INT-601 to INT-606; acceptance A8 and JOURNEY-004): the scenario panel and its
// step list, stepping forward and back, Play and Pause, the caption bar, the lanes, switching the
// audience mid-scenario, ending it, and reduced motion. Real clicks and keys only.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { boxes, button, clickElement, node, openLotto, settled, useTheme } from './reader.ts';

test.use({ viewport: { width: 1600, height: 900 } });

const STEPS = 14;

const panel = (page: Page): Locator => page.locator('aside.panel');
const caption = (page: Page): Locator => page.locator('.caption-bar');
const steps = (page: Page): Locator => panel(page).getByRole('list', { name: 'Steps' });
const stepItem = (page: Page, step: number): Locator =>
  steps(page).locator(`li[data-step="${String(step)}"]`);
const control = (page: Page, name: string): Locator =>
  panel(page).getByRole('button', { name, exact: true });
const currentBadge = (page: Page): Locator => page.locator('svg.aerie g.badges > g.badge.now');

/** Chooses Generate picks in the sidebar and waits for step 1. */
async function playGeneratePicks(page: Page): Promise<void> {
  await page.locator('button[data-scenario="generate-picks"]').click();
  await expect(caption(page).locator('.count')).toHaveText(`Step 1 of ${String(STEPS)}`);
  await settled(page);
}

/** Waits until the scenario shows `step`, on the map or as lanes, and nothing moves. */
async function atStep(page: Page, step: number): Promise<void> {
  await expect(caption(page).locator('.count')).toHaveText(
    `Step ${String(step)} of ${String(STEPS)}`,
  );
  await expect(stepItem(page, step)).toHaveClass(/\bnow\b/);
  const lanes = await page.locator('svg.aerie g.rows').count();
  if (lanes > 0) {
    await expect(page.locator('svg.aerie rect.row.now')).toHaveAttribute('data-step', String(step));
  } else {
    await expect(currentBadge(page)).toHaveAttribute('data-step', String(step));
  }
  await settled(page);
}

/** The camera's transform of the drawing. */
const cameraOf = (page: Page): Promise<string> =>
  page.locator('svg.aerie').evaluate((svg) => getComputedStyle(svg).transform);

/** Every badge's place on screen, by step number. */
async function badges(page: Page): Promise<Record<string, { x: number; y: number }>> {
  return page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('svg.aerie g.badges > g.badge')].map((badge) => {
        const r = badge.getBoundingClientRect();
        return [
          badge.getAttribute('data-step') ?? '',
          { x: Math.round(r.x * 100) / 100, y: Math.round(r.y * 100) / 100 },
        ];
      }),
    ),
  );
}

test.describe('SCOPE-006 playing a scenario', () => {
  test('INT-601, INT-603 and INT-904 starting a scenario clears the selection, shows step 1 with its announced caption, and fits around the caption bar', async ({
    page,
  }) => {
    await openLotto(page);
    await clickElement(page, 'website');
    await expect(button(page, 'website')).toHaveAttribute('aria-pressed', 'true');
    // INT-205: the element's own "In scenarios" list plays it too.
    await panel(page).locator('button[data-play="generate-picks"]').click();
    await atStep(page, 1);
    await expect(button(page, 'website')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('header .crumb')).toContainText('Generate picks');
    await expect(caption(page)).toHaveText(
      'Step 1 of 14The user has chosen a game, a strategy, a target prize and how many tickets.',
    );
    // LAYOUT-451: the fitted picture keeps clear of the caption bar.
    const drawing = await page.locator('svg.aerie').boundingBox();
    const bar = await caption(page).boundingBox();
    expect(drawing).not.toBeNull();
    expect(bar).not.toBeNull();
    if (drawing !== null && bar !== null) {
      expect(drawing.y + drawing.height).toBeLessThanOrEqual(bar.y);
    }
    // MODEL-406 and LOOK-705: the current step's two elements are outlined.
    await expect(node(page, 'user')).toHaveClass(/\bnow\b/);
    await expect(node(page, 'website')).toHaveClass(/\bnow\b/);
    // INT-904: captions are announced as they change.
    await expect(caption(page)).toHaveAttribute('aria-live', 'polite');
  });

  test('INT-602 the side panel shows the scenario, its controls and the numbered steps', async ({
    page,
  }) => {
    await openLotto(page);
    await playGeneratePicks(page);
    await expect(panel(page).locator('.kicker')).toHaveText('Scenario');
    await expect(panel(page).getByRole('heading', { level: 1 })).toHaveText('Generate picks');
    await expect(panel(page).locator('.lead')).toContainText('What happens when the user clicks');
    for (const name of ['Back', 'Play', 'Next', 'End', 'On the diagram', 'As lanes']) {
      await expect(control(page, name)).toBeVisible();
    }
    await expect(control(page, 'On the diagram')).toHaveAttribute('aria-pressed', 'true');
    await expect(steps(page).getByRole('listitem')).toHaveCount(STEPS);
    // Each step shows "{subject} to {object}" in capitals, and its caption.
    const first = stepItem(page, 1);
    await expect(first.locator('.ends')).toHaveText('User to Website');
    await expect(first.locator('.ends')).toHaveCSS('text-transform', 'uppercase');
    await expect(first.locator('.caption')).toHaveText(
      'The user has chosen a game, a strategy, a target prize and how many tickets.',
    );
    await expect(first.getByRole('button')).toHaveAttribute('aria-current', 'step');
    // MODEL-401: the Results store answering the lookup is a reply, in italic.
    await expect(stepItem(page, 7)).toHaveClass(/\breply\b/);
    await expect(stepItem(page, 7).locator('.caption')).toHaveCSS('font-style', 'italic');
    await expect(stepItem(page, 6).locator('.caption')).toHaveCSS('font-style', 'normal');
    // Choosing a step jumps to it; earlier steps are marked done.
    await stepItem(page, 5).getByRole('button').click();
    await atStep(page, 5);
    for (const step of [1, 2, 3, 4]) await expect(stepItem(page, step)).toHaveClass(/\bdone\b/);
    await expect(stepItem(page, 6)).not.toHaveClass(/\bdone\b/);
    await expect(page.locator('svg.aerie g.trail > g.step')).toHaveCount(5);
  });

  test('INT-602 the controls stay in view while the list scrolls', async ({ page }) => {
    await openLotto(page);
    await playGeneratePicks(page);
    await stepItem(page, STEPS).getByRole('button').click();
    await atStep(page, STEPS);
    await expect(stepItem(page, STEPS)).toBeInViewport();
    await expect(control(page, 'Play')).toBeInViewport();
    await panel(page).hover();
    await page.mouse.wheel(0, -4000);
    await page.mouse.wheel(0, 4000);
    await expect(control(page, 'Back')).toBeInViewport();
    await expect(control(page, 'As lanes')).toBeInViewport();
  });

  test('JOURNEY-004 and INT-604 step through Generate picks, see it as lanes, switch audience and end it', async ({
    page,
  }) => {
    await openLotto(page);
    const fitted = await cameraOf(page);
    await playGeneratePicks(page);
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
    await atStep(page, 9);
    await expect(page.locator('svg.aerie g.badges > g.badge')).toHaveCount(9);
    // INT-604: as lanes, the step stays the same.
    await control(page, 'As lanes').click();
    await expect(page.locator('svg.aerie[data-scenario="generate-picks"]')).toBeVisible();
    await atStep(page, 9);
    await expect(control(page, 'As lanes')).toHaveAttribute('aria-pressed', 'true');
    const before = await boxes(page);
    await page.keyboard.press('3');
    await expect(caption(page)).toContainText('The generator chosen by numberGenerator');
    await settled(page);
    // INT-103: nothing moves.
    expect(await boxes(page)).toEqual(before);
    await atStep(page, 9);
    // INT-605: Esc ends the scenario and returns to the view, fitted.
    await page.keyboard.press('Escape');
    await expect(caption(page)).toBeHidden();
    await expect(panel(page).locator('.kicker')).toHaveText('Architecture');
    await expect(page.locator('header .crumb')).not.toContainText('Generate picks');
    await settled(page);
    expect(await cameraOf(page)).toBe(fitted);
  });

  test('INT-605 Next and Back, the arrow keys, and the ends of the scenario', async ({ page }) => {
    await openLotto(page);
    await playGeneratePicks(page);
    await expect(control(page, 'Back')).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('ArrowLeft');
    await atStep(page, 1);
    await control(page, 'Next').click();
    await atStep(page, 2);
    await control(page, 'Next').click();
    await atStep(page, 3);
    await control(page, 'Back').click();
    await atStep(page, 2);
    // The keyboard focus stays on the control the reader pressed.
    await expect(control(page, 'Back')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await atStep(page, 3);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await atStep(page, 1);
    // Every step of the scenario plays, each drawn on the trail (RULE-011).
    for (let step = 2; step <= STEPS; step++) {
      await page.keyboard.press('ArrowRight');
      await expect(caption(page).locator('.count')).toHaveText(`Step ${String(step)} of 14`);
    }
    await atStep(page, STEPS);
    await expect(page.locator('svg.aerie g.trail > g.step')).toHaveCount(STEPS);
    await expect(control(page, 'Next')).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('ArrowRight');
    await atStep(page, STEPS);
  });

  test('INT-605 Play advances a step every 2.4 s until the last, then stops; Play on the last starts again', async ({
    page,
  }) => {
    await openLotto(page);
    await playGeneratePicks(page);
    await stepItem(page, 12).getByRole('button').click();
    await atStep(page, 12);
    await control(page, 'Play').click();
    await expect(control(page, 'Pause')).toHaveAttribute('aria-pressed', 'true');
    await expect(caption(page).locator('.count')).toHaveText('Step 12 of 14');
    await expect(caption(page).locator('.count')).toHaveText('Step 13 of 14', { timeout: 4000 });
    await expect(caption(page).locator('.count')).toHaveText('Step 14 of 14', { timeout: 4000 });
    await expect(control(page, 'Play')).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(2600);
    await atStep(page, STEPS);
    // Play on the last step starts again from step 1; Pause stops it there.
    await control(page, 'Play').click();
    await atStep(page, 1);
    await expect(control(page, 'Pause')).toBeVisible();
    await control(page, 'Pause').click();
    await page.waitForTimeout(2600);
    await atStep(page, 1);
    // Space plays and pauses too.
    await page.locator('aside.panel h1').click();
    await page.keyboard.press('Space');
    await expect(control(page, 'Pause')).toBeVisible();
    await expect(caption(page).locator('.count')).toHaveText('Step 2 of 14', { timeout: 4000 });
    await page.keyboard.press('Space');
    await expect(control(page, 'Play')).toBeVisible();
    // Stepping by hand stops Play.
    await control(page, 'Play').click();
    await page.keyboard.press('ArrowRight');
    await expect(control(page, 'Play')).toBeVisible();
  });

  test('INT-901 a caption too long for its bar is reached with Tab and scrolled with the keys', async ({
    page,
  }) => {
    await openLotto(page);
    await playGeneratePicks(page);
    await stepItem(page, 9).getByRole('button').click();
    await atStep(page, 9);
    await page.keyboard.press('3');
    await expect(caption(page)).toContainText('The generator chosen by numberGenerator');
    const bar = caption(page);
    expect(await bar.evaluate((each) => each.scrollHeight > each.clientHeight)).toBe(true);
    // After the last drawn element, Tab moves to the caption bar, which shows its focus.
    await page.locator('svg.aerie g.boxes > g.node > .shape').last().focus();
    await page.keyboard.press('Tab');
    await expect(bar).toBeFocused();
    await expect(bar).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => bar.evaluate((each) => each.scrollTop)).toBeGreaterThan(0);
    await atStep(page, 9);
  });

  test('INT-605 End ends the scenario', async ({ page }) => {
    await openLotto(page);
    await playGeneratePicks(page);
    await control(page, 'End').click();
    await expect(caption(page)).toBeHidden();
    await expect(page.locator('svg.aerie g.trail')).toHaveCount(0);
    await expect(panel(page).getByRole('heading', { name: 'Watch it work' })).toBeVisible();
  });

  test('INT-606 switching view or starting another scenario stops the one playing', async ({
    page,
  }) => {
    await openLotto(page);
    await playGeneratePicks(page);
    await control(page, 'Play').click();
    await page.locator('button[data-scenario="results-poll"]').click();
    await expect(panel(page).getByRole('heading', { level: 1 })).toHaveText('Results poll');
    await expect(caption(page).locator('.count')).toHaveText(/^Step 1 of /);
    await expect(control(page, 'Play')).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(2600);
    await expect(caption(page).locator('.count')).toHaveText(/^Step 1 of /);
    await page.locator('button[data-view="services"]').click();
    await expect(page.locator('svg.aerie[data-view="services"]')).toBeVisible();
    await expect(caption(page)).toBeHidden();
    await expect(page.locator('svg.aerie g.trail')).toHaveCount(0);
  });

  test('INT-201 while a scenario plays, clicking does not select', async ({ page }) => {
    await openLotto(page);
    await playGeneratePicks(page);
    await clickElement(page, 'website');
    await settled(page);
    await expect(button(page, 'website')).toHaveAttribute('aria-pressed', 'false');
    await expect(panel(page).locator('.kicker')).toHaveText('Scenario');
  });

  test('INT-303 and LAYOUT-505 opening a container during playback redraws the trail at the new zoom', async ({
    page,
  }) => {
    await openLotto(page);
    await playGeneratePicks(page);
    await stepItem(page, 9).getByRole('button').click();
    await atStep(page, 9);
    // MODEL-405: with the Analysis engine closed, the steps inside it fold into loops on it.
    const step = (n: number): Locator =>
      page.locator(`svg.aerie g.trail > g.step[data-step="${String(n)}"] > path.curve`);
    await expect(step(4)).toHaveAttribute('d', /C/);
    await expect(step(9)).toHaveAttribute('d', /C/);
    await node(page, 'engine').locator('.control').click();
    await expect(node(page, 'engine-service')).toBeAttached();
    await settled(page);
    // Opened, pick generation's call to the strategies runs from the Engine service to them.
    await expect(step(9)).toHaveAttribute('d', /Q/);
    await expect(step(4)).toHaveAttribute('d', /C/);
    await node(page, 'engine-service').locator('.control').click();
    await expect(node(page, 'pick-generation')).toBeAttached();
    await settled(page);
    // Request handling hands the request to pick generation on a curve between them.
    await expect(step(4)).toHaveAttribute('d', /Q/);
    await atStep(page, 9);
    await expect(page.locator('svg.aerie g.trail > g.step')).toHaveCount(9);
  });

  test('INT-106 a change of wording keeps the step and moves no box, badge or trail', async ({
    page,
  }) => {
    await openLotto(page);
    await playGeneratePicks(page);
    await stepItem(page, 9).getByRole('button').click();
    await atStep(page, 9);
    const before = await boxes(page);
    const placed = await badges(page);
    const trail = await page.locator('svg.aerie g.trail').innerHTML();
    await page.keyboard.press('3');
    // The step list and caption are reworded for the engineer.
    await expect(stepItem(page, 2).locator('.ends')).toHaveText('Website to BFF');
    await expect(stepItem(page, 2).locator('.caption')).toContainText('BFF_URL');
    await settled(page);
    expect(await boxes(page)).toEqual(before);
    expect(await badges(page)).toEqual(placed);
    // The current step does not draw itself again: the trail is the same drawing.
    expect(await page.locator('svg.aerie g.trail').innerHTML()).toBe(trail);
    await atStep(page, 9);
  });
});

test.describe('reduced motion', () => {
  test('LOOK-903 and INT-905 with Reduce motion the trail is drawn whole and every change is instant', async ({
    page,
  }) => {
    await openLotto(page);
    await page.getByLabel('Reduce motion').check();
    await playGeneratePicks(page);
    await page.keyboard.press('ArrowRight');
    await expect(caption(page).locator('.count')).toHaveText('Step 2 of 14');
    await expect(currentBadge(page)).toHaveAttribute('data-step', '2');
    // Nothing draws itself, glides, fades or waits.
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    const curve = page.locator('svg.aerie g.trail > g.step.now > path.curve');
    await expect(curve).toHaveCSS('stroke-dashoffset', '0px');
    // The map and the lanes swap at once, with no cross-fade.
    await control(page, 'As lanes').click();
    await expect(page.locator('svg.aerie g.rows')).toBeAttached();
    expect(await page.locator('svg.aerie').count()).toBe(1);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await control(page, 'On the diagram').click();
    await expect(currentBadge(page)).toHaveAttribute('data-step', '2');
    expect(await page.locator('svg.aerie').count()).toBe(1);
    // The autoplay pace is not motion: Play still waits 2.4 s between steps.
    await control(page, 'Play').click();
    await page.waitForTimeout(1200);
    await expect(caption(page).locator('.count')).toHaveText('Step 2 of 14');
    await expect(caption(page).locator('.count')).toHaveText('Step 3 of 14', { timeout: 3000 });
    await control(page, 'Pause').click();
    await page.keyboard.press('Escape');
    await expect(caption(page)).toBeHidden();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
});

for (const theme of ['light', 'dark'] as const) {
  test(`SCORE-005 an accessibility audit finds no problems while Generate picks plays, on the map and as lanes, ${theme}`, async ({
    page,
  }) => {
    test.slow();
    await useTheme(page, theme);
    await openLotto(page);
    await playGeneratePicks(page);
    await stepItem(page, 9).getByRole('button').click();
    for (const lanes of [false, true]) {
      if (lanes) await control(page, 'As lanes').click();
      for (const [key, audience] of [
        ['1', 'Executive'],
        ['2', 'Manager'],
        ['3', 'Engineer'],
      ] as const) {
        await page.keyboard.press(key);
        await atStep(page, 9);
        const results = await new AxeBuilder({ page }).analyze();
        const found = results.violations.flatMap((violation) =>
          violation.nodes.map((each) => `${violation.id}: ${each.target.join(' ')}`),
        );
        expect(found, `${lanes ? 'lanes' : 'map'}, ${audience}`).toEqual([]);
      }
    }
  });
}
