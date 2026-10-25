import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { parse } from '../../../src/lines/index.ts';
import { Semantics } from '../../../src/model/index.ts';
import { Layouter } from '../../../src/layout/index.ts';
import { inProcessEngine } from '../../../src/layout/elk/in-process.ts';
import {
  compatibleFlow,
  exportDocument,
  exportFilename,
  exportPages,
  imageSize,
  rasterSize,
  EXPORT_LIMITS,
  type ExportOptions,
} from '../../../src/export/index.ts';

const source = readFileSync(join(import.meta.dirname, '../../../samples/aerie.aerie'), 'utf8');
function model(text = source): Semantics {
  const parsed = parse(text);
  if (parsed.model === null) throw new Error('Invalid export fixture');
  return new Semantics(parsed.model);
}
const options: ExportOptions = {
  view: 'big-picture',
  audience: 'exec',
  scenario: 'full-flow',
  reference: false,
};
const prose = (document: ReturnType<typeof exportDocument>) =>
  document.blocks.map((b) => b.text).join('\n');
const simple = `audiences plain "Everyone", specialist "Specialist" (code)
root: Sample system
  child: Worker
    > Full responsibility. Decision rationale is authored here.
    @specialist >> Additional implementation detail.
  store: Storage
root-child-placeholder: External caller [external]
child writes to store
  > Connection explanation.
view one: View one
  show root
view other: Other
  show root-child-placeholder
scenario writes: Write data
  child writes to store
    > Scenario detail.
`;

describe('export document', () => {
  it('EXPORT-001 EXPORT-002 expands the current roots and retains every stage and detailed explanation', () => {
    const semantics = model();
    const document = exportDocument(semantics, options);
    expect(document.elementIds).toEqual(semantics.tree.elements.map((e) => e.id));
    expect(prose(document)).toContain('Scenario: Create a diagram');
    for (const step of semantics.steps('full-flow', 'exec')) {
      expect(prose(document)).toContain(`Step ${String(step.number)}: ${step.sentence}`);
      expect(prose(document)).toContain(step.about);
    }
    for (const stage of semantics.overviewSteps('full-flow', 'exec'))
      expect(prose(document)).toContain(`Stage ${String(stage.number)}: ${stage.sentence}`);
    expect(semantics.scope('big-picture').everythingOpen().size).toBeGreaterThan(0);
  });
  it('EXPORT-002 EXPORT-004 supports an unstaged scenario and no-flow exports with actual custom audiences', () => {
    const semantics = model(simple);
    const selected = { view: 'one', audience: 'specialist', scenario: 'writes', reference: true };
    const document = exportDocument(semantics, selected);
    expect(document.audience).toBe('Specialist');
    expect(document.code).toBe(true);
    expect(document.elementIds).not.toContain('root-child-placeholder');
    expect(prose(document)).toContain('Step 1: Worker writes to Storage.');
    expect(prose(document)).not.toContain('Stage 1');
    expect(prose(document)).toContain(
      'Full responsibility. Decision rationale is authored here.\n\nAdditional implementation detail.',
    );
    expect(prose(document)).toContain('Connection explanation.');
    const without = exportDocument(semantics, { ...selected, scenario: null });
    expect(without.scenario).toBeNull();
    expect(prose(without)).not.toContain('Scenario detail.');
    expect(prose(without)).toContain('Connection explanation.');
  });
  it('EXPORT-002 refuses flows outside the selected view rather than dropping their participants', () => {
    const semantics = model(simple);
    expect(compatibleFlow(semantics, 'other', 'writes')).toBe(false);
    expect(() =>
      exportDocument(semantics, {
        view: 'other',
        audience: 'plain',
        scenario: 'writes',
        reference: false,
      }),
    ).toThrow('outside this view');
  });
  it('EXPORT-003 includes only authored component reference content and can omit it without losing steps', () => {
    const semantics = model(simple);
    const selected = { view: 'one', audience: 'plain', scenario: 'writes', reference: true };
    const document = exportDocument(semantics, selected);
    expect(prose(document)).toContain('Component reference');
    expect(prose(document)).toContain('Inside Sample system');
    expect(prose(document)).toContain('Full description not documented.');
    expect(prose(document)).not.toContain('Additional implementation detail.');
    const without = exportDocument(semantics, { ...selected, reference: false });
    expect(prose(without)).not.toContain('Component reference');
    expect(prose(without)).toContain('Scenario detail.');
    expect(prose(without)).not.toContain('Decision rationale');
  });
  it('EXPORT-001 EXPORT-004 preserves user names and creates safe filenames without added branding', () => {
    const document = exportDocument(model(simple), {
      view: 'one',
      audience: 'plain',
      scenario: 'writes',
      reference: false,
    });
    expect(exportFilename(document, 'png')).toBe('View-one-Write-data-Everyone.png');
    expect(
      exportFilename(
        { ...document, title: '../unsafe/name:*?', audience: 'X', scenario: null },
        'pdf',
      ),
    ).not.toMatch(/[/:*?]/);
    expect(prose(document)).not.toContain('Aerie');
  });
  it('EXPORT-001 EXPORT-005 an empty model still produces a complete document', async () => {
    const semantics = model('model empty: Empty\n');
    const selected = {
      view: 'overview',
      audience: semantics.model.audiences[0]?.id ?? '',
      scenario: null,
      reference: false,
    };
    const document = exportDocument(semantics, selected);
    const layouter = new Layouter(semantics, inProcessEngine());
    const picture = await layouter.picture(selected.view, document.zoom, selected.audience);
    const output = exportPages(semantics, document, selected, picture);
    expect(output.pages.length).toBeGreaterThan(0);
    expect(output.pages[0]?.width).toBeGreaterThan(0);
  });
  it('EXPORT-005 paginates long text completely with readable sizes and keeps the diagram within its page', async () => {
    const semantics = model();
    const document = exportDocument(semantics, options);
    const paragraphs = Array.from(
      { length: 150 },
      (_, i) => `Unique explanation ${String(i)} ${'architecture words '.repeat(18)}`,
    );
    const long = {
      ...document,
      blocks: paragraphs.map((text) => ({ kind: 'paragraph' as const, text })),
    };
    const layouter = new Layouter(semantics, inProcessEngine());
    const picture = await layouter.picture(options.view, document.zoom, options.audience);
    const output = exportPages(semantics, long, options, picture);
    expect(output.pages.length).toBeGreaterThan(3);
    const parser = new DOMParser();
    const words: string[] = [];
    for (const page of output.pages) {
      const parsed = parser.parseFromString(page.svg, 'image/svg+xml');
      expect(parsed.getElementsByTagName('parsererror').length).toBe(0);
      const texts = parsed.getElementsByTagName('text');
      for (let i = 0; i < texts.length; i++) {
        const text = texts.item(i);
        if (text?.parentNode?.nodeName === 'svg') {
          expect(Number(text.getAttribute('y'))).toBeLessThan(page.height);
          words.push(text.textContent ?? '');
        }
      }
    }
    for (let i = 0; i < paragraphs.length; i++)
      expect(words.join(' ')).toContain(`Unique explanation ${String(i)} `);
    expect(output.pages[0]?.height).toBeGreaterThan(picture.result.height);
    expect(() => imageSize(output.pages)).toThrow('too large');
    expect(output.pages.every((page) => rasterSize(page.width, page.height).width > 0)).toBe(true);
  });
  it('EXPORT-005 keeps long runs of fully described step labels on readable pages without wasting one page per step', async () => {
    const semantics = model();
    const document = exportDocument(semantics, options);
    const layouter = new Layouter(semantics, inProcessEngine());
    const picture = await layouter.picture(options.view, document.zoom, options.audience);
    const labels = {
      ...document,
      blocks: Array.from({ length: 100 }, (_, i) => ({
        kind: 'label' as const,
        text: `Step ${String(i + 1)}: complete sentence without an additional caption.`,
      })),
    };
    const output = exportPages(semantics, labels, options, picture);
    expect(output.pages.length).toBeLessThan(10);
    const parsed = output.pages
      .map(
        (page) =>
          new DOMParser().parseFromString(page.svg, 'image/svg+xml').documentElement?.textContent,
      )
      .join(' ');
    expect(parsed).toContain('Step 100: complete sentence');
  });
  it('EXPORT-005 rejects oversized images and huge documents before allocating a canvas', async () => {
    expect(() => rasterSize(9000, 100)).toThrow('too large');
    expect(() => rasterSize(Number.NaN, 100)).toThrow('too large');
    expect(() => rasterSize(3000, 3000)).toThrow('too large');
    expect(rasterSize(1000, 1000)).toEqual({ width: 2000, height: 2000 });
    const semantics = model();
    const document = exportDocument(semantics, options);
    const layouter = new Layouter(semantics, inProcessEngine());
    const picture = await layouter.picture(options.view, document.zoom, options.audience);
    const huge = {
      ...document,
      blocks: Array.from({ length: EXPORT_LIMITS.pages + 1 }, (_, i) => ({
        kind: 'section' as const,
        text: `Section ${String(i)}`,
      })),
    };
    expect(() => exportPages(semantics, huge, options, picture)).toThrow('80-page');
  });
});
