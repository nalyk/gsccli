import { Command } from 'commander';
import { formatOutput } from '../../formatters/index.js';
import { querySearchAnalyticsAll } from '../../services/searchconsole.service.js';
import { type ReportData, resolveGlobalOptions, writeOutput } from '../../types/common.js';
import type {
  AggregationType,
  DataState,
  SearchAnalyticsDimension,
  SearchAnalyticsQueryParams,
  SearchType,
} from '../../types/searchconsole.js';
import { resolveDate } from '../../utils/date-helpers.js';
import { handleError } from '../../utils/error-handler.js';
import { buildDimensionFilterGroups, parseJsonFilterGroups } from '../../utils/filter-builder.js';
import { sortReportData } from '../../utils/sort.js';
import { createSpinner } from '../../utils/spinner.js';
import { validateSiteUrl } from '../../validation/validators.js';

// Period-over-period comparison. The GSC API has no native compare; we run two queries,
// outer-join on dimension keys, and compute deltas client-side. The output schema is:
//
//   <dimensions...>, clicks_a, clicks_b, delta_clicks, impressions_a, impressions_b,
//   delta_impressions, ctr_a, ctr_b, delta_ctr, position_a, position_b, delta_position
//
// Period A is the "current" period; Period B is the "comparison" period (older). Deltas
// are computed as A - B so positive numbers mean improvement (except for `delta_position`
// where negative is improvement — lower position is better).

interface MetricRow {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

function parseRowMetrics(row: string[], dimCount: number): MetricRow {
  return {
    clicks: Number.parseFloat(row[dimCount] ?? '0'),
    impressions: Number.parseFloat(row[dimCount + 1] ?? '0'),
    ctr: Number.parseFloat(row[dimCount + 2] ?? '0'),
    position: Number.parseFloat(row[dimCount + 3] ?? '0'),
  };
}

function buildKey(row: string[], dimCount: number): string {
  return row.slice(0, dimCount).join('');
}

function joinPeriods(
  dimensions: SearchAnalyticsDimension[],
  periodA: ReportData,
  periodB: ReportData,
): ReportData {
  const dimCount = dimensions.length;
  const headers = [
    ...dimensions,
    'clicks_a',
    'clicks_b',
    'delta_clicks',
    'impressions_a',
    'impressions_b',
    'delta_impressions',
    'ctr_a',
    'ctr_b',
    'delta_ctr',
    'position_a',
    'position_b',
    'delta_position',
  ];

  const aIndex = new Map<string, MetricRow>();
  const bIndex = new Map<string, MetricRow>();
  const dimsByKey = new Map<string, string[]>();

  for (const r of periodA.rows) {
    const key = buildKey(r, dimCount);
    aIndex.set(key, parseRowMetrics(r, dimCount));
    dimsByKey.set(key, r.slice(0, dimCount));
  }
  for (const r of periodB.rows) {
    const key = buildKey(r, dimCount);
    bIndex.set(key, parseRowMetrics(r, dimCount));
    if (!dimsByKey.has(key)) dimsByKey.set(key, r.slice(0, dimCount));
  }

  const allKeys = new Set([...aIndex.keys(), ...bIndex.keys()]);
  const rows: string[][] = [];

  for (const key of allKeys) {
    const a = aIndex.get(key);
    const b = bIndex.get(key);
    const dims = dimsByKey.get(key) ?? [];
    const av: MetricRow = a ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    const bv: MetricRow = b ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };

    rows.push([
      ...dims,
      String(av.clicks),
      String(bv.clicks),
      String(av.clicks - bv.clicks),
      String(av.impressions),
      String(bv.impressions),
      String(av.impressions - bv.impressions),
      String(av.ctr),
      String(bv.ctr),
      String(av.ctr - bv.ctr),
      String(av.position),
      String(bv.position),
      String(av.position - bv.position),
    ]);
  }

  return { headers, rows, rowCount: rows.length };
}

export function createCompareCommand(): Command {
  return new Command('compare')
    .description('Compare two date ranges (period A vs period B) — produces a delta table')
    .option('-d, --dimensions <dimensions...>', 'Dimensions to group by', ['query'])
    .option('--start-date <date>', 'Period A start date', '28daysAgo')
    .option('--end-date <date>', 'Period A end date', 'today')
    .option('--vs-start-date <date>', 'Period B start date', '56daysAgo')
    .option('--vs-end-date <date>', 'Period B end date', '29daysAgo')
    .option('--type <type>', 'Search type: web (default), image, video, news, discover, googleNews')
    .option('--data-state <state>', 'Data state: final (default) or all', 'final')
    .option('--aggregation-type <type>', 'Aggregation: auto (default), byPage, byProperty')
    .option('--row-limit <n>', 'Max rows per request (1-25000)', '25000')
    .option('--max-rows <n>', 'Hard cap on rows per period (default: 25000)', '25000')
    .option(
      '--sort-by <spec>',
      'Sort: column:direction. E.g. "delta_clicks:desc" (default), "delta_position:asc"',
    )
    .option('--filter <filters...>', 'Dimension filters (applied to both periods)')
    .option('--filter-json <json>', 'Raw dimensionFilterGroups JSON (overrides --filter)')
    .option('--chart-metric <name>', 'For -f chart: which column to bar (default: delta_clicks)')
    .action(async (rawOpts, command) => {
      try {
        const globalOpts = resolveGlobalOptions(command);
        const siteUrl = validateSiteUrl(globalOpts.site);
        const dimensions = (rawOpts.dimensions ?? ['query']) as SearchAnalyticsDimension[];

        const dimensionFilterGroups = rawOpts.filterJson
          ? parseJsonFilterGroups(rawOpts.filterJson)
          : rawOpts.filter
            ? buildDimensionFilterGroups(rawOpts.filter)
            : undefined;

        const baseParams = {
          siteUrl,
          dimensions,
          type: rawOpts.type as SearchType | undefined,
          dataState: rawOpts.dataState as DataState,
          aggregationType: rawOpts.aggregationType as AggregationType | undefined,
          dimensionFilterGroups,
        } satisfies Partial<SearchAnalyticsQueryParams>;

        const maxRows = rawOpts.maxRows ? Number.parseInt(rawOpts.maxRows, 10) : 25000;

        const periodA: SearchAnalyticsQueryParams = {
          ...baseParams,
          startDate: resolveDate(rawOpts.startDate),
          endDate: resolveDate(rawOpts.endDate),
        };
        const periodB: SearchAnalyticsQueryParams = {
          ...baseParams,
          startDate: resolveDate(rawOpts.vsStartDate),
          endDate: resolveDate(rawOpts.vsEndDate),
        };

        const spinner = createSpinner(
          `Comparing ${periodA.startDate}..${periodA.endDate} vs ${periodB.startDate}..${periodB.endDate}...`,
        );
        spinner.start();

        const [aData, bData] = await Promise.all([
          querySearchAnalyticsAll(periodA, { maxRows }),
          querySearchAnalyticsAll(periodB, { maxRows }),
        ]);

        spinner.stop();

        const joined = joinPeriods(dimensions, aData, bData);
        const sortBy = rawOpts.sortBy ?? 'delta_clicks:desc';
        const sorted = sortReportData(joined, sortBy);

        const chartMetric = rawOpts.chartMetric ?? 'delta_clicks';
        const output = formatOutput(sorted, globalOpts.format, { chartMetric });
        writeOutput(output, globalOpts);
      } catch (error) {
        handleError(error);
      }
    });
}
