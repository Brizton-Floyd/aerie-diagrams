import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env['CI']);
// Override when several checkouts run checks side by side on one machine.
const port = Number(process.env['AERIE_PREVIEW_PORT'] ?? 4173);
const baseURL = `http://localhost:${String(port)}`;

export default defineConfig({
  forbidOnly: isCI,
  retries: 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // One baseline per screenshot, shared by every platform; baselines must not depend on fonts.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'screenshots', testDir: 'tests/screenshots', use: { ...devices['Desktop Chrome'] } },
    { name: 'journeys', testDir: 'tests/journeys', use: { ...devices['Desktop Chrome'] } },
  ],
  // Journeys run against the production build, as a reader would see it.
  webServer: {
    command: `npm run build && npm run preview -- --port ${String(port)}`,
    url: baseURL,
    // Never reuse: a server left on this port may belong to another checkout.
    reuseExistingServer: false,
  },
});
