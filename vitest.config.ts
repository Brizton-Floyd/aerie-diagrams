import { defineConfig } from 'vitest/config';

// Each suite is its own project so `npm run check` can run and report them separately.
// Playwright owns tests/screenshots and tests/journeys (*.spec.ts).
export default defineConfig({
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] } },
      { extends: true, test: { name: 'rules', include: ['tests/rules/**/*.test.ts'] } },
      { extends: true, test: { name: 'golden', include: ['tests/golden/**/*.test.ts'] } },
    ],
  },
});
