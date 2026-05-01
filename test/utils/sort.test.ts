import { describe, expect, it } from 'vitest';
import type { ReportData } from '../../src/types/common.js';
import { parseSortSpec, sortReportData } from '../../src/utils/sort.js';

const sample: ReportData = {
  headers: ['query', 'clicks', 'impressions', 'ctr', 'position'],
  rows: [
    ['brand', '100', '1000', '0.10', '3.5'],
    ['cheap', '50', '5000', '0.01', '8.2'],
    ['fast', '200', '500', '0.40', '1.5'],
  ],
  rowCount: 3,
};

describe('parseSortSpec', () => {
  it('defaults to desc when direction is omitted', () => {
    expect(parseSortSpec('clicks')).toEqual({ column: 'clicks', direction: 'desc' });
  });

  it('parses asc and desc explicitly', () => {
    expect(parseSortSpec('ctr:asc')).toEqual({ column: 'ctr', direction: 'asc' });
    expect(parseSortSpec('position:desc')).toEqual({ column: 'position', direction: 'desc' });
  });

  it('rejects bogus directions', () => {
    expect(() => parseSortSpec('clicks:descending')).toThrow(/Invalid sort direction/);
  });
});

describe('sortReportData — numeric columns', () => {
  it('sorts numerically descending by clicks', () => {
    const sorted = sortReportData(sample, 'clicks:desc');
    expect(sorted.rows.map((r) => r[0])).toEqual(['fast', 'brand', 'cheap']);
  });

  it('sorts numerically ascending by position (lower=better in GSC)', () => {
    const sorted = sortReportData(sample, 'position:asc');
    expect(sorted.rows.map((r) => r[0])).toEqual(['fast', 'brand', 'cheap']);
  });

  it('sorts by ctr — the SEO optimization-finder', () => {
    const sorted = sortReportData(sample, 'ctr:desc');
    expect(sorted.rows.map((r) => r[0])).toEqual(['fast', 'brand', 'cheap']);
  });

  it('sorts by impressions:desc — the "missed opportunity" sort', () => {
    const sorted = sortReportData(sample, 'impressions:desc');
    expect(sorted.rows.map((r) => r[0])).toEqual(['cheap', 'brand', 'fast']);
  });
});

describe('sortReportData — string columns', () => {
  it('sorts alphabetically by dimension', () => {
    const sorted = sortReportData(sample, 'query:asc');
    expect(sorted.rows.map((r) => r[0])).toEqual(['brand', 'cheap', 'fast']);
  });

  it('reverses with desc', () => {
    const sorted = sortReportData(sample, 'query:desc');
    expect(sorted.rows.map((r) => r[0])).toEqual(['fast', 'cheap', 'brand']);
  });
});

describe('sortReportData — edge cases', () => {
  it('returns unchanged when spec is undefined', () => {
    const result = sortReportData(sample, undefined);
    expect(result.rows).toBe(sample.rows);
  });

  it('returns unchanged for empty rows', () => {
    const empty: ReportData = { headers: ['x'], rows: [], rowCount: 0 };
    expect(sortReportData(empty, 'x:asc').rows).toEqual([]);
  });

  it('throws on unknown column', () => {
    expect(() => sortReportData(sample, 'unknownColumn:desc')).toThrow(/Unknown sort column/);
  });

  it('does not mutate input', () => {
    const before = [...sample.rows];
    sortReportData(sample, 'clicks:desc');
    expect(sample.rows).toEqual(before);
  });
});
