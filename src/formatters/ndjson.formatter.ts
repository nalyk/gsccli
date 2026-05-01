import type { ReportData } from '../types/common.js';

export function formatNdjson(data: ReportData): string {
  // One JSON object per row, separated by newline. Trailing newline included so appending
  // additional NDJSON streams concatenates safely.
  if (data.rows.length === 0) return '';
  const lines: string[] = [];
  for (const row of data.rows) {
    const obj: Record<string, string> = {};
    for (let i = 0; i < data.headers.length; i++) {
      obj[data.headers[i]] = row[i] ?? '';
    }
    lines.push(JSON.stringify(obj));
  }
  return `${lines.join('\n')}\n`;
}
