import { describe, expect, it } from 'vitest';
import { formatJson } from '../../src/formatters/json.formatter.js';
import type { ReportData } from '../../src/types/common.js';

describe('formatJson', () => {
  it('emits {rowCount, data:[{header:value}]} shape', () => {
    const data: ReportData = {
      headers: ['query', 'clicks'],
      rows: [
        ['brand', '100'],
        ['cheap', '50'],
      ],
      rowCount: 2,
    };
    const parsed = JSON.parse(formatJson(data));
    expect(parsed.rowCount).toBe(2);
    expect(parsed.data).toEqual([
      { query: 'brand', clicks: '100' },
      { query: 'cheap', clicks: '50' },
    ]);
  });

  it('attaches metadata only when present and non-empty', () => {
    const withMeta = JSON.parse(
      formatJson({
        headers: ['x'],
        rows: [['y']],
        rowCount: 1,
        metadata: { source: 'live' },
      }),
    );
    expect(withMeta.metadata).toEqual({ source: 'live' });

    const withoutMeta = JSON.parse(formatJson({ headers: ['x'], rows: [['y']], rowCount: 1 }));
    expect(withoutMeta.metadata).toBeUndefined();
  });

  it('handles empty rows', () => {
    expect(JSON.parse(formatJson({ headers: ['x'], rows: [], rowCount: 0 }))).toEqual({
      rowCount: 0,
      data: [],
    });
  });
});
