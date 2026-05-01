import boxen from 'boxen';
import chalk from 'chalk';
import type { ReportData } from '../types/common.js';

const MAX_BAR_WIDTH = 40;
const BAR_CHAR = '█';

const BAR_COLORS = [chalk.green, chalk.blue, chalk.magenta, chalk.cyan, chalk.yellow, chalk.red];

// Format ReportData as a horizontal ASCII bar chart. By default we prefer the `clicks`
// column for the bar metric (GSC reports always end in `position` where lower=better,
// which would invert the chart's meaning). Fall back to the last column for non-GSC data.
// Caller can override via `metricColumn`.
const PREFERRED_METRIC_HEADERS = ['clicks', 'impressions'];

function pickMetricIndex(headers: string[], preferred?: string): number {
  if (preferred) {
    const idx = headers.indexOf(preferred);
    if (idx !== -1) return idx;
  }
  for (const h of PREFERRED_METRIC_HEADERS) {
    const idx = headers.indexOf(h);
    if (idx !== -1) return idx;
  }
  return headers.length - 1;
}

export function formatChart(data: ReportData, metricColumn?: string): string {
  if (data.rows.length === 0) {
    return chalk.yellow('No data to chart.');
  }

  if (data.headers.length < 2) {
    return chalk.red('Chart requires at least two columns (dimension + metric).');
  }

  const metricIndex = pickMetricIndex(data.headers, metricColumn);
  const metricHeader = data.headers[metricIndex];
  // Dimension labels = every column EXCEPT the chosen metric (not just the prefix).
  const dimensionHeaders = data.headers.filter((_, i) => i !== metricIndex);
  const dimensionIndices = data.headers.map((_, i) => i).filter((i) => i !== metricIndex);

  const entries: { label: string; value: number }[] = [];

  for (const row of data.rows) {
    const label = dimensionIndices.map((i) => row[i] ?? '').join(' | ');
    const raw = row[metricIndex] ?? '0';
    const value = Number.parseFloat(raw.replace(/,/g, ''));
    entries.push({ label, value: Number.isFinite(value) ? value : 0 });
  }

  const maxValue = Math.max(...entries.map((e) => e.value), 1);
  const maxLabelWidth = Math.max(...entries.map((e) => e.label.length), 1);

  const lines: string[] = [];
  const title = chalk.bold.white(`${metricHeader} by ${dimensionHeaders.join(', ')}`);
  lines.push(title);
  lines.push('');

  for (let i = 0; i < entries.length; i++) {
    const { label, value } = entries[i];
    const barWidth = Math.round((value / maxValue) * MAX_BAR_WIDTH);
    const colorFn = BAR_COLORS[i % BAR_COLORS.length];

    const paddedLabel = label.padEnd(maxLabelWidth);
    const bar = colorFn(BAR_CHAR.repeat(Math.max(barWidth, 1)));
    const formattedValue = chalk.white.bold(formatNumber(value));

    lines.push(`  ${chalk.gray(paddedLabel)}  ${bar} ${formattedValue}`);
  }

  lines.push('');
  lines.push(chalk.gray(`${data.rowCount} row(s)`));

  return boxen(lines.join('\n'), {
    padding: 1,
    borderColor: 'gray',
    borderStyle: 'round',
    title: 'Chart',
    titleAlignment: 'left',
  });
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) {
    return n.toLocaleString('en-US');
  }
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}
