// Every ```aerie example in the spec parses to its known model or diagnostics, stored beside this
// file in spec-examples/ (update deliberately with `npx vitest run --project unit -u`).
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '../../../src/lines/index.ts';
import { specBlocks } from './spec-blocks.ts';

const DIR = join(import.meta.dirname, 'spec-examples');

describe('the examples in the spec', () => {
  it.each(specBlocks().map((block) => [block.name, block.source]))(
    'ACC-013 the example %s parses to its known result',
    async (name, source) => {
      const result = parse(source);
      const { model, diagnostics } = result;
      const text = JSON.stringify({ model, diagnostics }, null, 2) + '\n';
      await expect(text).toMatchFileSnapshot(join(DIR, `${name}.json`));
    },
  );
});
