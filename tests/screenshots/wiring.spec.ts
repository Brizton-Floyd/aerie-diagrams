import { expect, test } from '@playwright/test';

// Stub proving screenshot comparison runs against a committed baseline. The swatch has no text,
// so it renders identically on every platform. A5 replaces it with screenshots of Aerie's own samples.
test('screenshot suite is wired', async ({ page }) => {
  await page.setContent(
    '<div id="swatch" style="width:120px;height:80px;background:#3d6b4f;border:8px solid #f4efe4"></div>',
  );
  await expect(page.locator('#swatch')).toHaveScreenshot('swatch.png');
});
