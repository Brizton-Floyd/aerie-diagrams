import { expect, it } from 'vitest';

// Stub proving the golden suite runs and compares against a committed snapshot.
// A5 replaces it with goldens of Aerie's own samples; golden changes are deliberate and reviewed.
it('golden suite is wired', () => {
  expect({ suite: 'golden', compares: 'committed snapshot' }).toMatchSnapshot();
});
