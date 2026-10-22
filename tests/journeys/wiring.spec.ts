import { expect, test } from '@playwright/test';

// Stub proving journeys run against the production build. A11 replaces it with the Lotto
// journeys: audience switch, open in place, scenario playback, presenter walkthrough, shared link.
test('journey suite is wired', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Aerie');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
});
