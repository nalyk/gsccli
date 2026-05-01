import { Command } from 'commander';
import { formatOutput } from '../../formatters/index.js';
import { formatNdjson } from '../../formatters/ndjson.formatter.js';
import { cacheKey, parseTtl, withCache } from '../../services/cache.service.js';
import {
  iterateSearchAnalytics,
  querySearchAnalytics,
  querySearchAnalyticsAll,
} from '../../services/searchconsole.service.js';
import { resolveGlobalOptions, writeOutput } from '../../types/common.js';
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
import { logger } from '../../utils/logger.js';
import { sortReportData } from '../../utils/sort.js';
import { createSpinner } from '../../utils/spinner.js';
import { validateSiteUrl } from '../../validation/validators.js';

export interface ConvenienceCommandSpec {
  name: string;
  description: string;
  // The dimension that this convenience command implies. Pass `undefined` to mean
  // "use whatever the user passes via -d" (currently unused but reserved for `query run`-lite).
  dimension: SearchAnalyticsDimension | SearchAnalyticsDimension[];
  spinnerLabel?: string;
}

// Common option block — every query command exposes the same flags so muscle memory
// transfers between `query run` and `query top-queries`.
function attachCommonOptions(cmd: Command, withDimensions: boolean): Command {
  if (withDimensions) {
    cmd.option(
      '-d, --dimensions <dimensions...>',
      'Dimensions: query, page, country, device, date, searchAppearance',
    );
  }
  return cmd
    .option('--start-date <date>', 'Start date (YYYY-MM-DD or NdaysAgo)', '28daysAgo')
    .option('--end-date <date>', 'End date', 'today')
    .option('--type <type>', 'Search type: web (default), image, video, news, discover, googleNews')
    .option(
      '--data-state <state>',
      'Data state: final (default, ~3-day lag) or all (includes fresh-but-incomplete)',
      'final',
    )
    .option('--aggregation-type <type>', 'Aggregation: auto (default), byPage, byProperty')
    .option('--row-limit <n>', 'Max rows per request (1-25000)')
    .option('--start-row <n>', 'Row offset for pagination (ignored with --all)')
    .option('--all', 'Auto-paginate through ALL rows (loops until exhausted)')
    .option('--max-rows <n>', 'Hard cap on rows when using --all')
    .option(
      '--sort-by <spec>',
      'Client-side sort: column:direction. E.g. "ctr:desc", "position:asc", "impressions:desc"',
    )
    .option('--filter <filters...>', 'Dimension filters in shorthand: query==brand, page=~/blog/.*')
    .option('--filter-json <json>', 'Raw dimensionFilterGroups JSON (overrides --filter)')
    .option('--cache <ttl>', 'Cache results for <ttl> ("30s", "10m", "1h", "2d"). Default: no cache.')
    .option('--chart-metric <name>', 'For -f chart: which metric column to bar (default: clicks)');
}

export interface CommonQueryOpts {
  startDate: string;
  endDate: string;
  type?: string;
  dataState: string;
  aggregationType?: string;
  rowLimit?: string;
  startRow?: string;
  all?: boolean;
  maxRows?: string;
  sortBy?: string;
  filter?: string[];
  filterJson?: string;
  cache?: string;
  chartMetric?: string;
  dimensions?: string[];
}

function buildParams(
  siteUrl: string,
  opts: CommonQueryOpts,
  dimensions: SearchAnalyticsDimension[],
): SearchAnalyticsQueryParams {
  const dimensionFilterGroups = opts.filterJson
    ? parseJsonFilterGroups(opts.filterJson)
    : opts.filter
      ? buildDimensionFilterGroups(opts.filter)
      : undefined;

  return {
    siteUrl,
    startDate: resolveDate(opts.startDate),
    endDate: resolveDate(opts.endDate),
    dimensions,
    type: opts.type as SearchType | undefined,
    dataState: opts.dataState as DataState,
    aggregationType: opts.aggregationType as AggregationType | undefined,
    dimensionFilterGroups,
    rowLimit: opts.rowLimit ? Number.parseInt(opts.rowLimit, 10) : undefined,
    startRow: opts.startRow ? Number.parseInt(opts.startRow, 10) : undefined,
  };
}

// The shared action body for `query run` and every convenience command. Both forks of
// the streaming-vs-accumulating decision live here so we don't drift them across files.
export async function executeQueryAction(
  command: Command,
  rawOpts: CommonQueryOpts,
  dimensions: SearchAnalyticsDimension[],
  spinnerLabel: string,
): Promise<void> {
  try {
    const globalOpts = resolveGlobalOptions(command);
    const siteUrl = validateSiteUrl(globalOpts.site);

    const params = buildParams(siteUrl, rawOpts, dimensions);
    const ttlMs = parseTtl(rawOpts.cache);

    const spinner = createSpinner(spinnerLabel);
    spinner.start();

    // NDJSON streaming when --all is set: pipe each page directly to stdout, never
    // accumulate. For other formats, accumulate then format.
    if (rawOpts.all && globalOpts.format === 'ndjson' && !globalOpts.output) {
      spinner.stop();
      let total = 0;
      for await (const page of iterateSearchAnalytics(params)) {
        process.stdout.write(formatNdjson(page));
        total += page.rowCount;
        logger.debug(`streamed ${total} rows so far`);
      }
      logger.success(`streamed ${total} rows`);
      return;
    }

    const data = await withCache(
      cacheKey({ ...params, all: !!rawOpts.all, maxRows: rawOpts.maxRows ?? null }),
      ttlMs,
      async () => {
        if (rawOpts.all) {
          return querySearchAnalyticsAll(params, {
            maxRows: rawOpts.maxRows ? Number.parseInt(rawOpts.maxRows, 10) : undefined,
            onPage: (n) => spinner.start(`Paginated ${n} rows...`),
          });
        }
        return querySearchAnalytics(params);
      },
    );

    spinner.stop();
    const sorted = sortReportData(data, rawOpts.sortBy);
    const output = formatOutput(sorted, globalOpts.format, { chartMetric: rawOpts.chartMetric });
    writeOutput(output, globalOpts);
  } catch (error) {
    handleError(error);
  }
}

export function createConvenienceQueryCommand(spec: ConvenienceCommandSpec): Command {
  const cmd = new Command(spec.name).description(spec.description);
  attachCommonOptions(cmd, false);

  const dimensions: SearchAnalyticsDimension[] = Array.isArray(spec.dimension)
    ? spec.dimension
    : [spec.dimension];

  cmd.action((rawOpts: CommonQueryOpts, command: Command) =>
    executeQueryAction(command, rawOpts, dimensions, spec.spinnerLabel ?? 'Running query...'),
  );

  return cmd;
}

// Exposed for `query run` (which adds -d/--dimensions on top of the common block).
export { attachCommonOptions, buildParams };
