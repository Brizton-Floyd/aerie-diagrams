import { expect, it } from 'vitest';

// Stub proving the rule-check suite runs. A4 replaces it with layout rule checks
// (no overlaps, labels fit, children inside parents, audience switch moves nothing,
// every relationship drawn) over every view and audience.
it('rule suite is wired', () => {
  expect(import.meta.url).toContain('/tests/rules/');
});
