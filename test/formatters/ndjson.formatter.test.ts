import { describe, expect, it } from 'vitest';
import { formatNdjson } from '../../src/formatters/ndjson.formatter.js';
import type { ReportData } from '../../src/types/common.js';

describe('formatNdjson', () => {
  it('emits one JSON object per line, newline-separated', () => {
    const data: ReportData = {
      headers: ['query', 'clicks'],
      rows: [
        ['brand', '100'],
        ['cheap', '50'],
      ],
      rowCount: 2,
    };
    const out = formatNdjson(data);
    const lines = out.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual({ query: 'brand', clicks: '100' });
    expect(JSON.parse(lines[1])).toEqual({ query: 'cheap', clicks: '50' });
  });

  it('appends a trailing newline so streams concat safely', () => {
    const out = formatNdjson({ headers: ['x'], rows: [['y']], rowCount: 1 });
    expect(out.endsWith('\n')).toBe(true);
  });

  it('returns empty string for empty rows', () => {
    expect(formatNdjson({ headers: ['x'], rows: [], rowCount: 0 })).toBe('');
  });
});
