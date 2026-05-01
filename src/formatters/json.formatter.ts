import type { ReportData } from '../types/common.js';

export function formatJson(data: ReportData): string {
  const objects = data.rows.map((row) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < data.headers.length; i++) {
      obj[data.headers[i]] = row[i] ?? '';
    }
    return obj;
  });

  const output: Record<string, unknown> = {
    rowCount: data.rowCount,
    data: objects,
  };

  if (data.metadata && Object.keys(data.metadata).length > 0) {
    output.metadata = data.metadata;
  }

  return JSON.stringify(output, null, 2);
}
