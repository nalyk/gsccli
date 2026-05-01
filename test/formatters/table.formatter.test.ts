import { describe, expect, it } from 'vitest';
import { formatTable } from '../../src/formatters/table.formatter.js';
import type { ReportData } from '../../src/types/common.js';

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes literally are control chars
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

describe('formatTable', () => {
  const mockData: ReportData = {
    headers: ['query', 'clicks', 'impressions', 'ctr', 'position'],
    rows: [
      ['brand name', '1000', '5000', '0.2', '3.4'],
      ['shop online', '850', '4200', '0.2', '4.1'],
      ['cheap thing', '120', '2000', '0.06', '8.7'],
    ],
    rowCount: 3,
  };

  it('returns "No data returned." for empty rows', () => {
    expect(stripAnsi(formatTable({ headers: ['x'], rows: [], rowCount: 0 }))).toContain('No data returned.');
  });

  it('renders headers and all row cells', () => {
    const out = stripAnsi(formatTable(mockData));
    expect(out).toContain('query');
    expect(out).toContain('clicks');
    expect(out).toContain('brand name');
    expect(out).toContain('1000');
    expect(out).toContain('cheap thing');
  });

  it('appends row count footer', () => {
    expect(stripAnsi(formatTable(mockData))).toContain('3 row(s)');
  });

  it('uses rowCount field, not rows.length, for footer', () => {
    const out = stripAnsi(formatTable({ headers: ['x'], rows: [['1']], rowCount: 9999 }));
    expect(out).toContain('9999 row(s)');
  });

  it('handles unicode', () => {
    const out = stripAnsi(
      formatTable({
        headers: ['query', 'country'],
        rows: [['ürün', '🇩🇪']],
        rowCount: 1,
      }),
    );
    expect(out).toContain('🇩🇪');
  });

  it('handles 100-row datasets without crashing', () => {
    const rows: string[][] = Array.from({ length: 100 }, (_, i) => [`q${i}`, `${i * 10}`]);
    const out = stripAnsi(formatTable({ headers: ['query', 'clicks'], rows, rowCount: 100 }));
    expect(out).toContain('100 row(s)');
    expect(out.split('\n').length).toBeGreaterThan(50);
  });
});
