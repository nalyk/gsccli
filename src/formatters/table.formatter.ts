import chalk from 'chalk';
import Table from 'cli-table3';
import type { ReportData } from '../types/common.js';

export function formatTable(data: ReportData): string {
  if (data.rows.length === 0) {
    return chalk.yellow('No data returned.');
  }

  const table = new Table({
    head: data.headers.map((h) => chalk.cyan.bold(h)),
    style: { head: [], border: [] },
  });

  for (const row of data.rows) {
    table.push(row);
  }

  return `${table.toString()}\n${chalk.gray(`${data.rowCount} row(s)`)}`;
}
