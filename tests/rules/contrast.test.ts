// SCORE-004 (docs/spec/layout.md, readability scores): the lowest contrast ratio of any text colour
// on any surface it is drawn on, per theme (look.md, contrast). It is kept in contrast.json with the
// other baselines: worse fails, better asks for the baseline to be updated in the same change
// (ACC-004), and it never falls below 4.5.
//
//   AERIE_UPDATE_SCORES=1 npx vitest run --project rules tests/rules/contrast.test.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { THEMES, lowestTextContrast, type Theme } from '../../src/render/index.ts';

const BASELINE = join(import.meta.dirname, 'contrast.json');
const UPDATE = process.env['AERIE_UPDATE_SCORES'] === '1';

it('SCORE-004 and ACC-004 the lowest text contrast of each theme is at least 4.5 and no worse than the baseline', () => {
  const now = Object.fromEntries(
    THEMES.map((theme) => [theme, lowestTextContrast(theme)]),
  ) as Record<Theme, number>;
  if (UPDATE) {
    writeFileSync(BASELINE, `${JSON.stringify(now, null, 2)}\n`);
    return;
  }
  const before = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<Theme, number>;
  for (const theme of THEMES) {
    expect(now[theme], theme).toBeGreaterThanOrEqual(4.5);
    expect(now[theme], `${theme} got worse`).toBeGreaterThanOrEqual(before[theme]);
    if (now[theme] > before[theme]) {
      process.stdout.write(
        `SCORE-004 ${theme} improved to ${String(now[theme])}; update contrast.json in this change (AERIE_UPDATE_SCORES=1)\n`,
      );
    }
  }
});
