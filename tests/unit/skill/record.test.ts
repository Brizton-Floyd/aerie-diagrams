// The record of drafting the Lotto sample with the Aerie skill (docs/spec/claude-skill.md, SKILL-301):
// it says what the skill read, how the checks went, the warnings left and what changed after the
// draft, and it stays true to the sample: every `// Unsure:` point is quoted, the counts are the
// model's, and the skill edited the existing file, keeping its ids, rather than rewriting it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse, type Element, type Model } from '../../../src/lines/index.ts';
import { check } from '../../../src/model/index.ts';

const ROOT = join(import.meta.dirname, '../../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const RECORD = read('samples/lotto.md');
const SAMPLE = read('samples/lotto.aerie');

function modelOf(source: string): Model {
  const { model } = parse(source);
  if (model === null) throw new Error('no model');
  return model;
}

const ids = (elements: readonly Element[]): string[] => elements.map((element) => element.id);

/** The text of a `## heading` section of the record, up to the next one. */
function section(heading: string): string {
  const start = RECORD.indexOf(`\n## ${heading}\n`);
  if (start === -1) throw new Error(`The record has no section "${heading}".`);
  const end = RECORD.indexOf('\n## ', start + 1);
  return RECORD.slice(start, end === -1 ? undefined : end);
}

/** Text with Markdown line breaks and comment markers folded into single spaces. */
const flat = (text: string): string =>
  text
    .replace(/\n\s*\/\/\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('the record of the Lotto sample', () => {
  it('SKILL-301 says what the skill read, how the checks went, the warnings left and what changed after the draft', () => {
    for (const heading of [
      'What the skill read',
      'Check rounds',
      'Warnings left',
      'What changed after the draft',
    ]) {
      expect(section(heading).trim().length, heading).toBeGreaterThan(heading.length + 20);
    }
    expect(section('Check rounds')).toContain('No problems found.');
    expect(check(SAMPLE).diagnostics).toEqual([]);
    expect(section('Warnings left')).toMatch(/^\s*## Warnings left\s+None\./);
  });

  it('SKILL-201 and SKILL-202 agrees the scope, then reads the project in the order the skill gives', () => {
    expect(section('Scope')).toMatch(/\*\*System\*\*.*\*\*Audiences\*\*.*\*\*File\*\*/s);
    const steps = [...section('What the skill read').matchAll(/^\| (\d)\. /gm)].map(
      (match) => match[1],
    );
    expect(steps).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('SKILL-209 the report gives the counts of the model, the checker summary and every unsure point', () => {
    const report = flat(section('Report'));
    const model = modelOf(SAMPLE);
    expect(report).toContain(`${String(model.elements.length)} elements`);
    expect(report).toContain(`${String(model.relationships.length)} relationships`);
    expect(report).toContain(`${String(model.views.length)} views`);
    expect(report).toContain(`${String(model.scenarios.length)} scenarios`);
    expect(report).toContain('No problems found.');
    const unsure = [...SAMPLE.matchAll(/^ *\/\/ Unsure: (.*(?:\n *\/\/ (?!Unsure:).*)*)/gm)].map(
      (match) => flat(match[1] ?? ''),
    );
    expect(unsure).toHaveLength(3);
    for (const point of unsure) expect(report).toContain(`"${point}"`);
  });

  it('SKILL-210 the skill edited the existing file: every id of the earlier version is kept', () => {
    const before = modelOf(read('docs/spec/examples/lotto.aerie'));
    const after = modelOf(SAMPLE);
    expect(ids(after.elements)).toEqual(expect.arrayContaining(ids(before.elements)));
    expect(after.views.map((view) => view.id)).toEqual(before.views.map((view) => view.id));
    expect(after.scenarios.map((each) => each.id)).toEqual(before.scenarios.map((each) => each.id));
    expect(after.walkthroughs.map((each) => each.id)).toEqual(
      before.walkthroughs.map((each) => each.id),
    );
    expect(after.id).toBe(before.id);
  });
});
