// Screenshots of Aerie's own drawings in the Signal look (docs/spec/look.md), compared only with
// Aerie's earlier screenshots (ACC-003, ACC-006): every Lotto view in every audience in both themes
// at 1600 x 900, the shapes sample, and in the browser, drawn text that fits its reserved space.
// Update deliberately: `npx playwright test --project screenshots --update-snapshots`.
import { expect, test } from '@playwright/test';
import { choices, HIDE_TEXT, openModel, show, useTheme } from './page.ts';

const THEMES = ['dark', 'light'] as const;

test.use({ viewport: { width: 1600, height: 900 } });

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await useTheme(page, theme);
    });

    test(`LOOK-301 to LOOK-502, LOOK-801 to LOOK-807 and SCOPE-004 every Lotto view in every audience, ${theme}`, async ({
      page,
    }) => {
      // Nine pictures, each waited on until it is still, and a screenshot of each.
      test.slow();
      await openModel(page, 'samples/lotto.aerie');
      const { views, audiences } = await choices(page);
      expect(views).toEqual(['big-picture', 'services', 'engineering']);
      expect(audiences).toEqual(['exec', 'manager', 'engineer']);
      await page.addStyleTag({ content: HIDE_TEXT });
      for (const view of views) {
        for (const audience of audiences) {
          await show(page, view, audience);
          await expect(page).toHaveScreenshot(`lotto-${view}-${audience}-${theme}.png`);
        }
      }
    });

    test(`LOOK-301 to LOOK-307 and LOOK-401 one of each shape and icon, and a trail, ${theme}`, async ({
      page,
    }) => {
      await openModel(page, 'samples/shapes.aerie');
      await page.addStyleTag({ content: HIDE_TEXT });
      for (const view of ['shapes', 'icon-set']) {
        await show(page, view, 'manager');
        await expect(page).toHaveScreenshot(`shapes-${view}-${theme}.png`);
      }
      await show(page, 'shapes', 'manager');
      await page.locator('button[data-scenario="visit"]').click();
      // The side panel's content is hidden (HIDE_TEXT), so its controls are pressed without a pointer.
      await page.locator('aside.panel button.step-choice[data-step="5"]').dispatchEvent('click');
      await expect(page.locator('svg.aerie .badge.now')).toHaveAttribute('data-step', '5');
      await expect(page).toHaveScreenshot(`shapes-visit-trail-${theme}.png`);
      await page.locator('aside.panel button[data-control="lanes"]').dispatchEvent('click');
      await expect(page.locator('svg.aerie[data-scenario="visit"]')).toBeVisible();
      await expect(page).toHaveScreenshot(`shapes-visit-lanes-${theme}.png`);
    });
  });
}

test('ACC-006 screenshot runs hide drawn text, form controls and the side panel content', async ({
  page,
}) => {
  await openModel(page, 'samples/lotto.aerie');
  const text = page.locator('svg.aerie g.node text').first();
  await expect(text).not.toHaveCSS('fill', 'rgba(0, 0, 0, 0)');
  await page.addStyleTag({ content: HIDE_TEXT });
  await expect(text).toHaveCSS('fill', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('header .crumb')).toHaveCSS('color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('.panel-content').first()).toHaveCSS('visibility', 'hidden');
});

/** What the browser drew for every text element of the current drawing. */
interface DrawnText {
  role: string;
  text: string;
  drawn: number;
  measured: number;
  size: number;
  /** For box text: the room the box leaves for text, from the text's left; else null. */
  room: number | null;
}

for (const model of ['samples/lotto.aerie', 'samples/shapes.aerie']) {
  test(`RULE-003 and RULE-008 in the browser, drawn text fits its box and labels their space, at 13.5 px or more: ${model}`, async ({
    page,
  }) => {
    await openModel(page, model);
    // The bundled faces are the ones drawing (LOOK-101), so drawn widths are the measured ones.
    const loaded = await page.evaluate(() =>
      ['600 14px "Inter"', '13.5px "Inter"', '500 13.5px "Inter"', '13.5px "JetBrains Mono"'].map(
        (face) => document.fonts.check(face),
      ),
    );
    expect(loaded).toEqual([true, true, true, true]);
    const { views, audiences } = await choices(page);
    for (const view of views) {
      for (const audience of audiences) {
        await show(page, view, audience);
        const texts = await page.evaluate(() => {
          const out: DrawnText[] = [];
          const pad = 12;
          const control = 28;
          for (const text of document.querySelectorAll<SVGTextElement>('svg.aerie text')) {
            const group = text.closest('g.node, g.head, g.label, g.badge, g.band');
            let room: number | null = null;
            if (group?.matches('g.node, g.head') === true) {
              const id = (group as SVGGElement).dataset['id'] ?? '';
              const node = document.querySelector(`svg.aerie g.node[data-id="${CSS.escape(id)}"]`);
              const width = Number(node?.querySelector('.shape')?.getAttribute('width'));
              const container = node?.matches('.open, .closed') === true;
              room = width - pad - (container ? control : 0) - Number(text.getAttribute('x'));
            }
            out.push({
              role: text.getAttribute('class') ?? '',
              text: text.textContent,
              drawn: text.getComputedTextLength(),
              measured: Number(text.dataset['width'] ?? Number.NaN),
              size: parseFloat(getComputedStyle(text).fontSize),
              room,
            });
          }
          return out;
        });
        expect(texts.length).toBeGreaterThan(0);
        for (const text of texts) {
          const where = `${view}, ${audience}: ${text.role} "${text.text}"`;
          if (text.role === 't-badge') continue;
          expect(text.size, where).toBeGreaterThanOrEqual(13.5);
          // Drawn no wider than measured (LAYOUT-101, LAYOUT-102), so it fits the space the
          // layout reserved for it (RULE-003 in the rules suite).
          expect(text.drawn, where).toBeLessThanOrEqual(text.measured + 0.5);
          if (text.room !== null) expect(text.drawn, where).toBeLessThanOrEqual(text.room + 0.5);
        }
      }
    }
  });
}
