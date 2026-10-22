import { describe, expect, it } from 'vitest';
import { findEmDashes } from '../../scripts/check-text.ts';

describe('findEmDashes', () => {
  it('accepts text with plain hyphens', () => {
    expect(findEmDashes('One model - every audience.\nA - B')).toEqual([]);
  });

  it('reports every em dash by line and column', () => {
    expect(findEmDashes('ok\na\u2014b\u2014c')).toEqual([
      { line: 2, column: 2 },
      { line: 2, column: 4 },
    ]);
  });
});
