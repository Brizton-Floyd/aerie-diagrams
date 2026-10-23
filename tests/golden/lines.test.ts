// Goldens of the canonical model (LANG-806) of every committed sample and every example file of
// the spec. A change to them is deliberate and reviewed (ACC-003): update with
// `npx vitest run --project golden -u`.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse, serializeModel } from '../../src/lines/index.ts';

const ROOT = join(import.meta.dirname, '../..');
const SOURCES = ['samples', 'docs/spec/examples'].flatMap((dir) =>
  readdirSync(join(ROOT, dir))
    .filter((file) => file.endsWith('.aerie'))
    .map((file) => ({ dir, file })),
);

describe('canonical models', () => {
  it.each(SOURCES)('LANG-806 the canonical model of $dir/$file', async ({ dir, file }) => {
    const result = parse(readFileSync(join(ROOT, dir, file), 'utf8'));
    expect(result.diagnostics.filter((found) => found.severity === 'error')).toEqual([]);
    if (result.model === null) {
      throw new Error(`${dir}/${file} has no model`);
    }
    const golden = join(
      import.meta.dirname,
      '__snapshots__/lines',
      dir.replace(/\//g, '-'),
      `${file}.json`,
    );
    await expect(serializeModel(result.model)).toMatchFileSnapshot(golden);
  });
});
