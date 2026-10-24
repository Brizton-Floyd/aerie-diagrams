// Font metrics for text measuring (docs/spec/layout.md, LAYOUT-101): reads the glyph advance widths
// of every face the diagram draws from Aerie's bundled font files (the Fontsource packages pinned in
// package.json) and writes them to src/layout/text/advances.json, which the layout measures with in
// Node, in every browser and in a Web Worker alike.
//
//   node scripts/font-metrics.ts           writes the table
//   node scripts/font-metrics.ts --check   fails when the committed table differs from the fonts
//
// The unit suite runs the same comparison, so the table can never drift from the font files.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

const ROOT = join(import.meta.dirname, '..');
export const ADVANCES_FILE = 'src/layout/text/advances.json';

/** The faces the diagram draws (docs/spec/look.md, type scale), each from all its subset files. */
export const FACES = {
  'sans-600': { family: 'Inter', package: 'inter', weight: 600, style: 'normal' },
  'sans-500': { family: 'Inter', package: 'inter', weight: 500, style: 'normal' },
  'sans-400': { family: 'Inter', package: 'inter', weight: 400, style: 'normal' },
  'mono-400': {
    family: 'JetBrains Mono',
    package: 'jetbrains-mono',
    weight: 400,
    style: 'normal',
  },
} as const;

/** The subsets Fontsource cuts each family into; a family may lack some of them. */
const SUBSETS = [
  'latin',
  'latin-ext',
  'greek',
  'greek-ext',
  'cyrillic',
  'cyrillic-ext',
  'vietnamese',
];

export interface FaceAdvances {
  family: string;
  weight: number;
  style: string;
  /** The font files read, relative to node_modules. */
  files: string[];
  unitsPerEm: number;
  /** Runs of consecutive code points: the first number is the code point, then one advance each. */
  runs: number[][];
}

export interface AdvanceTable {
  format: 'aerie-advances/1';
  faces: Record<keyof typeof FACES, FaceAdvances>;
}

/** The tables of a WOFF 1.0 file, decompressed, by tag. */
export function woffTables(file: Buffer): Map<string, Buffer> {
  if (file.toString('latin1', 0, 4) !== 'wOFF') throw new Error('not a WOFF 1.0 file');
  const count = file.readUInt16BE(12);
  const tables = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    const at = 44 + i * 20;
    const tag = file.toString('latin1', at, at + 4);
    const offset = file.readUInt32BE(at + 4);
    const compressed = file.readUInt32BE(at + 8);
    const length = file.readUInt32BE(at + 12);
    const data = file.subarray(offset, offset + compressed);
    tables.set(tag, compressed < length ? inflateSync(data) : Buffer.from(data));
  }
  return tables;
}

function table(tables: Map<string, Buffer>, tag: string): Buffer {
  const found = tables.get(tag);
  if (found === undefined) throw new Error(`the font has no ${tag} table`);
  return found;
}

/** The Unicode character map: code point to glyph id, from a format 12 or format 4 subtable. */
export function characterMap(cmap: Buffer): Map<number, number> {
  const count = cmap.readUInt16BE(2);
  const subtables: { platform: number; encoding: number; offset: number }[] = [];
  for (let i = 0; i < count; i++) {
    const at = 4 + i * 8;
    subtables.push({
      platform: cmap.readUInt16BE(at),
      encoding: cmap.readUInt16BE(at + 2),
      offset: cmap.readUInt32BE(at + 4),
    });
  }
  const pick = (platform: number, encoding: number): number | undefined =>
    subtables.find((each) => each.platform === platform && each.encoding === encoding)?.offset;
  const full = pick(3, 10) ?? pick(0, 4);
  const basic = pick(3, 1) ?? pick(0, 3);
  const out = new Map<number, number>();
  if (full !== undefined && cmap.readUInt16BE(full) === 12) {
    const groups = cmap.readUInt32BE(full + 12);
    for (let i = 0; i < groups; i++) {
      const at = full + 16 + i * 12;
      const start = cmap.readUInt32BE(at);
      const end = cmap.readUInt32BE(at + 4);
      const glyph = cmap.readUInt32BE(at + 8);
      for (let code = start; code <= end; code++) out.set(code, glyph + code - start);
    }
    return out;
  }
  if (basic === undefined || cmap.readUInt16BE(basic) !== 4) {
    throw new Error('the font has no Unicode cmap subtable of format 4 or 12');
  }
  const segments = cmap.readUInt16BE(basic + 6) / 2;
  const ends = basic + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const ranges = deltas + segments * 2;
  for (let i = 0; i < segments; i++) {
    const end = cmap.readUInt16BE(ends + i * 2);
    const start = cmap.readUInt16BE(starts + i * 2);
    const delta = cmap.readInt16BE(deltas + i * 2);
    const rangeAt = ranges + i * 2;
    const range = cmap.readUInt16BE(rangeAt);
    for (let code = start; code <= end && code !== 0xffff; code++) {
      let glyph: number;
      if (range === 0) {
        glyph = (code + delta) & 0xffff;
      } else {
        glyph = cmap.readUInt16BE(rangeAt + range + (code - start) * 2);
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph !== 0) out.set(code, glyph);
    }
  }
  return out;
}

/** Code point to advance width in font units, and the font's units per em, from one font file. */
export function fontAdvances(file: Buffer): { unitsPerEm: number; advances: Map<number, number> } {
  const tables = woffTables(file);
  const unitsPerEm = table(tables, 'head').readUInt16BE(18);
  const metrics = table(tables, 'hhea').readUInt16BE(34);
  const hmtx = table(tables, 'hmtx');
  // Glyphs past the last full metric share its advance (OpenType hmtx).
  const advance = (glyph: number): number => hmtx.readUInt16BE(Math.min(glyph, metrics - 1) * 4);
  const advances = new Map<number, number>();
  for (const [code, glyph] of characterMap(table(tables, 'cmap'))) {
    advances.set(code, advance(glyph));
  }
  return { unitsPerEm, advances };
}

/** Packs a code point map into runs of consecutive code points. */
export function toRuns(advances: ReadonlyMap<number, number>): number[][] {
  const runs: number[][] = [];
  let run: number[] | undefined;
  let next = -1;
  for (const code of [...advances.keys()].sort((a, b) => a - b)) {
    const width = advances.get(code) ?? 0;
    if (run !== undefined && code === next) {
      run.push(width);
    } else {
      run = [code, width];
      runs.push(run);
    }
    next = code + 1;
  }
  return runs;
}

/** Reads every face from the bundled font files. A code point two files disagree on is an error. */
export function buildAdvances(): AdvanceTable {
  const faces = {} as Record<keyof typeof FACES, FaceAdvances>;
  for (const [key, face] of Object.entries(FACES) as [
    keyof typeof FACES,
    (typeof FACES)[keyof typeof FACES],
  ][]) {
    const files: string[] = [];
    const merged = new Map<number, number>();
    let unitsPerEm = 0;
    for (const subset of SUBSETS) {
      const name = `@fontsource/${face.package}/files/${face.package}-${subset}-${String(face.weight)}-${face.style}.woff`;
      let data: Buffer;
      try {
        data = readFileSync(join(ROOT, 'node_modules', name));
      } catch {
        continue; // the family has no such subset
      }
      const read = fontAdvances(data);
      if (unitsPerEm !== 0 && read.unitsPerEm !== unitsPerEm) {
        throw new Error(
          `${name} has ${String(read.unitsPerEm)} units per em, not ${String(unitsPerEm)}`,
        );
      }
      unitsPerEm = read.unitsPerEm;
      for (const [code, width] of read.advances) {
        const known = merged.get(code);
        if (known !== undefined && known !== width) {
          throw new Error(
            `${name} gives U+${code.toString(16)} the advance ${String(width)}, not ${String(known)}`,
          );
        }
        merged.set(code, width);
      }
      files.push(name);
    }
    if (files.length === 0) throw new Error(`no font files for ${key}`);
    faces[key] = {
      family: face.family,
      weight: face.weight,
      style: face.style,
      files,
      unitsPerEm,
      runs: toRuns(merged),
    };
  }
  return { format: 'aerie-advances/1', faces };
}

/** The table as committed: one face per block and one run per line, so diffs stay readable. */
export function serializeAdvances(table: AdvanceTable): string {
  const faces = Object.entries(table.faces).map(([key, face]) => {
    const head = JSON.stringify({ ...face, runs: undefined }).slice(1, -1);
    const runs = face.runs.map((run) => `        ${JSON.stringify(run)}`).join(',\n');
    return `    ${JSON.stringify(key)}: {${head},\n      "runs": [\n${runs}\n      ]\n    }`;
  });
  return `{\n  "format": ${JSON.stringify(table.format)},\n  "faces": {\n${faces.join(',\n')}\n  }\n}\n`;
}

function main(): void {
  const text = serializeAdvances(buildAdvances());
  const path = join(ROOT, ADVANCES_FILE);
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== text) {
      console.error(
        `${ADVANCES_FILE} differs from the font files; run node scripts/font-metrics.ts`,
      );
      process.exitCode = 1;
    }
    return;
  }
  writeFileSync(path, text);
}

if (import.meta.main) {
  main();
}
