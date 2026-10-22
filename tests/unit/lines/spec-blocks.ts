// The ```aerie examples written in the spec's own pages.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SPEC = join(import.meta.dirname, '../../../docs/spec');

/** Every ```aerie block in the spec, with where it is. */
export function specBlocks(): { name: string; source: string }[] {
  const blocks: { name: string; source: string }[] = [];
  for (const file of readdirSync(SPEC).filter((name) => name.endsWith('.md'))) {
    const text = readFileSync(join(SPEC, file), 'utf8');
    let index = 0;
    for (const match of text.matchAll(/^```aerie\n([\s\S]*?)^```$/gm)) {
      index++;
      blocks.push({
        name: `${file.replace(/\.md$/, '')}-${String(index)}`,
        source: match[1] ?? '',
      });
    }
  }
  return blocks;
}
