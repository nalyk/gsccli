import { describe, expect, it } from 'vitest';
import {
  buildDimensionFilterGroup,
  buildDimensionFilterGroups,
  parseFilterString,
  parseJsonFilterGroups,
} from '../../src/utils/filter-builder.js';

describe('parseFilterString', () => {
  it('parses == as equals', () => {
    expect(parseFilterString('query==brand')).toEqual({
      dimension: 'query',
      operator: 'equals',
      expression: 'brand',
    });
  });

  it('parses != as notEquals', () => {
    expect(parseFilterString('country!=usa')).toEqual({
      dimension: 'country',
      operator: 'notEquals',
      expression: 'usa',
    });
  });

  it('parses ~= as contains', () => {
    expect(parseFilterString('page~=/blog')).toEqual({
      dimension: 'page',
      operator: 'contains',
      expression: '/blog',
    });
  });

  it('parses !~= as notContains (regression: longest-first alternation)', () => {
    // Bug: with `!~` ordered before `!~=`, "page!~=/admin" parses as `!~` (excludingRegex)
    // plus expression "=/admin", silently changing the filter semantics.
    expect(parseFilterString('page!~=/admin')).toEqual({
      dimension: 'page',
      operator: 'notContains',
      expression: '/admin',
    });
  });

  it('parses =~ as includingRegex', () => {
    expect(parseFilterString('page=~/blog/.*')).toEqual({
      dimension: 'page',
      operator: 'includingRegex',
      expression: '/blog/.*',
    });
  });

  it('parses !~ as excludingRegex', () => {
    expect(parseFilterString('page!~/admin')).toEqual({
      dimension: 'page',
      operator: 'excludingRegex',
      expression: '/admin',
    });
  });

  it('throws on missing operator', () => {
    expect(() => parseFilterString('justaword')).toThrow(/Invalid filter format/);
  });

  it('throws on empty string', () => {
    expect(() => parseFilterString('')).toThrow(/Invalid filter format/);
  });

  it('throws on unknown dimension', () => {
    expect(() => parseFilterString('bogus==x')).toThrow(/Unknown filter dimension/);
  });

  it('preserves regex special characters in expression verbatim', () => {
    const parsed = parseFilterString('page=~/foo\\.bar(.*)');
    expect(parsed.expression).toBe('/foo\\.bar(.*)');
  });

  it('handles values containing operator-like characters', () => {
    // `query==a==b` — value contains `==` after the operator; greedy `.+` captures it.
    expect(parseFilterString('query==a==b').expression).toBe('a==b');
  });
});

describe('buildDimensionFilterGroup', () => {
  it('returns undefined for empty input', () => {
    expect(buildDimensionFilterGroup([])).toBeUndefined();
  });

  it('combines multiple filters with AND', () => {
    const built = buildDimensionFilterGroup(['query==brand', 'country==usa']);
    expect(built).toEqual({
      groupType: 'and',
      filters: [
        { dimension: 'query', operator: 'equals', expression: 'brand' },
        { dimension: 'country', operator: 'equals', expression: 'usa' },
      ],
    });
  });

  it('propagates parse errors from invalid components', () => {
    expect(() => buildDimensionFilterGroup(['query==brand', 'broken'])).toThrow(/Invalid filter format/);
  });
});

describe('buildDimensionFilterGroups', () => {
  it('wraps a single group in an array (matches GSC schema)', () => {
    expect(buildDimensionFilterGroups(['query==brand'])).toEqual([
      {
        groupType: 'and',
        filters: [{ dimension: 'query', operator: 'equals', expression: 'brand' }],
      },
    ]);
  });

  it('returns undefined for empty input', () => {
    expect(buildDimensionFilterGroups([])).toBeUndefined();
  });
});

describe('parseJsonFilterGroups', () => {
  it('round-trips a JSON filter-groups payload', () => {
    const payload = [
      {
        groupType: 'and',
        filters: [{ dimension: 'query', operator: 'equals', expression: 'x' }],
      },
    ];
    expect(parseJsonFilterGroups(JSON.stringify(payload))).toEqual(payload);
  });

  it('throws on non-array JSON', () => {
    expect(() => parseJsonFilterGroups('{"not": "array"}')).toThrow();
  });

  it('throws on invalid JSON', () => {
    expect(() => parseJsonFilterGroups('{not json')).toThrow();
  });
});
