import type { ReportData } from '../types/common.js';

// RFC 4180: quote fields containing comma, quote, newline, or leading/trailing whitespace;
// double embedded quotes.
function escapeField(value: string): string {
  const needsQuoting =
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r') ||
    value.startsWith(' ') ||
    value.endsWith(' ');

  if (needsQuoting) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function rowToCsv(fields: string[]): string {
  return fields.map(escapeField).join(',');
}

export function formatCsv(data: ReportData): string {
  const lines: string[] = [];
  lines.push(rowToCsv(data.headers));
  for (const row of data.rows) {
    lines.push(rowToCsv(row));
  }
  return lines.join('\n');
}
