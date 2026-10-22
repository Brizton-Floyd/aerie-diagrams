// The renderer's SVG tree and its serialiser.
import { expect, it } from 'vitest';
import { el, escape, num, path, toMarkup, translate } from '../../../src/render/index.ts';

it('writes numbers with at most two decimal places and never -0 (LAYOUT-003)', () => {
  expect(num(1.005)).toBe('1');
  expect(num(2.3456)).toBe('2.35');
  expect(num(-0.001)).toBe('0');
  expect(() => num(Number.NaN)).toThrow('Cannot draw');
  expect(path('M', 1, -2, 'L', 3.333, 4)).toBe('M1-2L3.33 4');
  expect(translate(-0.004, 2.5)).toBe('translate(0 2.5)');
});

it('escapes text and attributes, and leaves out empty attributes', () => {
  expect(escape('a < b & "c" > d')).toBe('a &lt; b &amp; &quot;c&quot; &gt; d');
  expect(toMarkup(el('text', { x: 1.234, hidden: true, gone: null, off: false }, ['<b>']))).toBe(
    '<text x="1.23" hidden=""><b></text>'.replace('<b></text>', '&lt;b&gt;</text>'),
  );
});

it('indents nested elements for goldens and keeps text on its line', () => {
  const tree = el('g', { class: 'a' }, [el('rect', { width: 2 }), el('text', {}, ['hi'])]);
  expect(toMarkup(tree, '  ')).toBe('<g class="a">\n  <rect width="2"/>\n  <text>hi</text>\n</g>');
  expect(toMarkup(tree)).toBe('<g class="a"><rect width="2"/><text>hi</text></g>');
});
