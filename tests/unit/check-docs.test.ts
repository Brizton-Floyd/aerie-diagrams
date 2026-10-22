import { describe, expect, it } from 'vitest';
import { checkDocs, headingAnchors, maskCode, slugify } from '../../scripts/check-docs.ts';

// Ids are assembled at run time so this file does not itself cite them.
const id = (prefix: string, number: string): string => `${prefix}-${number}`;

function check(markdown: Record<string, string>, code: Record<string, string> = {}) {
  const files = new Map(Object.entries(markdown));
  return checkDocs({
    markdown: files,
    code: new Map(Object.entries(code)),
    exists: (path) => files.has(path) || path === 'docs',
  }).map(
    ({ file, line, column, message }) => `${file}:${String(line)}:${String(column)} ${message}`,
  );
}

describe('slugify', () => {
  it('makes the anchor GitHub gives a heading', () => {
    expect(slugify('1. A first look')).toBe('1-a-first-look');
    expect(slugify('Clean-room rules (mandatory)')).toBe('clean-room-rules-mandatory');
    expect(slugify('The `aerie` command')).toBe('the-aerie-command');
    expect(slugify('Worked example: Lotto')).toBe('worked-example-lotto');
  });

  it('numbers repeated headings and skips code blocks', () => {
    const anchors = headingAnchors('# Notes\n## Notes\n```\n# not a heading\n```\n');
    expect([...anchors]).toEqual(['notes', 'notes-1']);
  });
});

describe('maskCode', () => {
  it('blanks code spans and fenced blocks but keeps positions', () => {
    const text = 'a `b` c\n```ts\nx\n```\nd';
    const masked = maskCode(text);
    expect(masked).toHaveLength(text.length);
    expect(masked.split('\n')).toEqual(['a     c', '     ', ' ', '   ', 'd']);
  });
});

describe('checkDocs', () => {
  it('accepts links that resolve, with their anchors', () => {
    expect(
      check({
        'docs/a.md':
          'See [b](b.md#part-two), [top](#a), [dir](../docs) and [web](https://x.y).\n# A',
        'docs/b.md': '## Part two',
      }),
    ).toEqual([]);
  });

  it('reports a missing file and a missing anchor', () => {
    expect(check({ 'docs/a.md': 'x [c](c.md)\n[b](b.md#nope)', 'docs/b.md': '# B' })).toEqual([
      'docs/a.md:1:3 link to c.md: there is no docs/c.md',
      'docs/a.md:2:1 link to b.md#nope: docs/b.md has no heading with the anchor #nope',
    ]);
  });

  it('ignores links inside code', () => {
    expect(check({ 'docs/a.md': '`[c](c.md)`\n```\n[d](d.md)\n```' })).toEqual([]);
  });

  it('accepts ids defined once in the spec and cited anywhere', () => {
    const lang = id('LANG', '001');
    expect(
      check(
        {
          'docs/spec/language.md': `- **${lang}** A rule.\n\n| E001 | error | A message. |`,
          'docs/spec/acceptance.md': `Proves ${lang} and E001.`,
        },
        { 'tests/unit/x.test.ts': `it('${lang} works')` },
      ),
    ).toEqual([]);
  });

  it('reports an id defined twice', () => {
    const lang = id('LANG', '002');
    expect(check({ 'docs/spec/a.md': `**${lang}** one\n**${lang}** two` })).toEqual([
      `docs/spec/a.md:2:3 ${lang} is defined twice; it is first defined at docs/spec/a.md:1`,
    ]);
  });

  it('reports ids cited but not defined, in documents and in code', () => {
    const missing = id('MODEL', '999');
    expect(
      check({ 'docs/spec/a.md': `See ${missing} and W999.` }, { 'src/x.ts': `// ${missing}` }),
    ).toEqual([
      `docs/spec/a.md:1:5 ${missing} is cited but not defined in docs/spec/`,
      'docs/spec/a.md:1:19 W999 is cited but not defined in docs/spec/',
      `src/x.ts:1:4 ${missing} is cited but not defined in docs/spec/`,
    ]);
  });

  it('reports words the glossary asks the spec to avoid', () => {
    expect(check({ 'docs/spec/a.md': 'Each Perspective lists resources.' })).toEqual([
      'docs/spec/a.md:1:6 "Perspective" is on the glossary\'s list of words to avoid (GLOSSARY.md)',
      'docs/spec/a.md:1:24 "resources" is on the glossary\'s list of words to avoid (GLOSSARY.md)',
    ]);
  });
});
