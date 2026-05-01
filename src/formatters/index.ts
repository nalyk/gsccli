import type { OutputFormat, ReportData } from '../types/common.js';
import { formatChart } from './chart.formatter.js';
import { formatCsv } from './csv.formatter.js';
import { formatJson } from './json.formatter.js';
import { formatNdjson } from './ndjson.formatter.js';
import { formatTable } from './table.formatter.js';

export interface FormatOptions {
  // For `chart` format: which column to use for the bar value. Defaults to `clicks`
  // (or `impressions`, then last column) — picked by chart.formatter itself.
  chartMetric?: string;
}

export function formatOutput(data: ReportData, format: OutputFormat, opts: FormatOptions = {}): string {
  switch (format) {
    case 'table':
      return formatTable(data);
    case 'json':
      return formatJson(data);
    case 'ndjson':
      return formatNdjson(data);
    case 'csv':
      return formatCsv(data);
    case 'chart':
      return formatChart(data, opts.chartMetric);
    default:
      return formatTable(data);
  }
}

export { formatChart } from './chart.formatter.js';
export { formatCsv } from './csv.formatter.js';
export { formatJson } from './json.formatter.js';
export { formatNdjson } from './ndjson.formatter.js';
export { formatTable } from './table.formatter.js';
