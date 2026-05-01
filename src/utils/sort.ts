import type { ReportData } from '../types/common.js';

// GSC's searchanalytics.query has NO native orderBy — results are always returned sorted by
// clicks descending. Sort client-side. Numeric vs string is detected by header name (the
// four GSC metrics are well-known) with a parseFloat fallback for unknown columns.
const NUMERIC_HEADERS = new Set(['clicks', 'impressions', 'ctr', 'position']);

export interface SortSpec {
  column: string;
  direction: 'asc' | 'desc';
}

export function parseSortSpec(spec: string): SortSpec {
  const [column, direction = 'desc'] = spec.split(':');
  if (!column) {
    throw new Error(`Invalid sort spec: "${spec}". Use "column:asc" or "column:desc".`);
  }
  if (direction !== 'asc' && direction !== 'desc') {
    throw new Error(`Invalid sort direction: "${direction}". Use "asc" or "desc".`);
  }
  return { column, direction };
}

function isNumericColumn(header: string, sample: string | undefined): boolean {
  if (NUMERIC_HEADERS.has(header)) return true;
  if (!sample) return false;
  const n = Number.parseFloat(sample);
  return Number.isFinite(n);
}

export function sortReportData(data: ReportData, spec: SortSpec | string | undefined): ReportData {
  if (!spec) return data;
  if (data.rows.length === 0) return data;

  const parsed: SortSpec = typeof spec === 'string' ? parseSortSpec(spec) : spec;
  const colIndex = data.headers.indexOf(parsed.column);
  if (colIndex === -1) {
    throw new Error(`Unknown sort column: "${parsed.column}". Available: ${data.headers.join(', ')}.`);
  }

  const numeric = isNumericColumn(parsed.column, data.rows[0]?.[colIndex]);
  const dirMul = parsed.direction === 'asc' ? 1 : -1;

  const sorted = [...data.rows].sort((a, b) => {
    const av = a[colIndex] ?? '';
    const bv = b[colIndex] ?? '';
    if (numeric) {
      const an = Number.parseFloat(av);
      const bn = Number.parseFloat(bv);
      if (an < bn) return -1 * dirMul;
      if (an > bn) return 1 * dirMul;
      return 0;
    }
    return av.localeCompare(bv) * dirMul;
  });

  return { ...data, rows: sorted };
}
