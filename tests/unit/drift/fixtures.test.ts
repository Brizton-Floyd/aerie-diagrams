// Fixture projects with planted drifts (docs/spec/drift.md, section 10; DRIFT-432): each folder in
// fixtures/ is a workspace with a model that matches its code, which must give no finding, and a
// model with planted differences, listed in its opening comment, which must give exactly those.
// `<model>.findings.txt` beside each model holds the whole finding model; update it deliberately
// with `npx vitest run --project unit -u` and review the difference.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIR, driftFixture, keys, patched, report } from './drift.ts';

async function expectReport(
  fixture: string,
  model: string,
): Promise<ReturnType<typeof driftFixture>> {
  const found = driftFixture(fixture, model);
  await expect(report(found.drift)).toMatchFileSnapshot(
    join(DIR, fixture, `${model}.findings.txt`),
  );
  return found;
}

/** Applying every suggested edit gives a model that parses, and drift on it finds nothing. */
function expectCleanPatch({ source, drift, extraction }: ReturnType<typeof driftFixture>): void {
  const after = patched(source, drift, extraction);
  expect(keys(after.drift)).toEqual([]);
}

describe('fixture projects with planted drifts', () => {
  it('DRIFT-432 Compose: the matching model gives no finding', async () => {
    const found = await expectReport('compose', 'shop');
    expect(keys(found.drift)).toEqual([]);
  });

  it('DRIFT-432 DRIFT-431 Compose: every planted difference is found, nothing else, and the patch leaves none', async () => {
    const found = await expectReport('compose', 'shop-drift');
    expect(keys(found.drift)).toEqual([
      'drift renamed-code:payments:compose:payment>compose:payments',
      'drift missing-code:search:compose:search',
      'drift undrawn-code:compose:cache',
      'drift undrawn-connection:worker>api',
      'likely missing-connection:web>payments:calls',
      'likely unused-ignore:web to db',
      'likely undrawn-connection:api>db',
    ]);
    expect(
      found.drift.ignored.map((each) => [each.subject, each.findings.map((f) => f.key)]),
    ).toEqual([['compose:queue', ['undrawn-code:compose:queue']]]);
    expectCleanPatch(found);
  });

  it('DRIFT-432 Spring and Maven: the matching model gives no finding', async () => {
    const found = await expectReport('spring', 'shop');
    expect(keys(found.drift)).toEqual([]);
  });

  it('DRIFT-432 DRIFT-431 Spring and Maven: every planted difference is found, nothing else, and the patch leaves none', async () => {
    const found = await expectReport('spring', 'shop-drift');
    expect(keys(found.drift)).toEqual([
      'drift renamed-code:ledger:class:com.shop.billing.Ledger>class:com.shop.billing.ledger.Ledger',
      'drift missing-dependency:billing>catalog',
      'drift undrawn-code:maven:shop-common',
      'drift undrawn-connection:billing-client>invoices',
      'drift undrawn-dependency:orders>catalog',
      'likely undrawn-connection:web>service',
    ]);
    expect(
      found.drift.ignored.map((each) => [each.subject, each.findings.map((f) => f.key)]),
    ).toEqual([['maven:shop-legacy', ['undrawn-code:maven:shop-legacy']]]);
    expectCleanPatch(found);
  });

  it('DRIFT-432 Node and Angular: the matching model gives no finding', async () => {
    const found = await expectReport('angular', 'shop');
    expect(keys(found.drift)).toEqual([]);
  });

  it('DRIFT-432 DRIFT-431 Node and Angular: every planted difference is found, nothing else, and the patch leaves none', async () => {
    const found = await expectReport('angular', 'shop-drift');
    expect(keys(found.drift)).toEqual([
      'drift renamed-code:storefront:npm:shop-site>npm:shop-web',
      'drift undrawn-connection:storefront>api',
      'likely missing-connection:api>storefront:notifies',
      'likely undrawn-connection:storefront>pay',
    ]);
    expectCleanPatch(found);
  });
});
