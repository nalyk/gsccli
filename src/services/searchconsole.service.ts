import type { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { google, type searchconsole_v1, type webmasters_v3 } from 'googleapis';
import type { ReportData } from '../types/common.js';
import type {
  BatchSearchAnalyticsRequest,
  SearchAnalyticsQueryParams,
  SiteEntry,
  Sitemap,
  UrlInspectionParams,
} from '../types/searchconsole.js';
import { withRetry } from '../utils/retry.js';
import { getAuthClientOptions } from './auth.service.js';

// `google.webmasters` and `google.searchconsole` accept a polymorphic `auth` option:
// either an OAuth2Client or a GoogleAuth instance. Our auth.service caches whichever was
// resolved (OAuth tokens vs. service-account key). Project the union to a single value
// suitable to pass into the googleapis factory.
function pickAuthArg(opts: { authClient: OAuth2Client } | { auth: GoogleAuth }): OAuth2Client | GoogleAuth {
  return 'authClient' in opts ? opts.authClient : opts.auth;
}

let webmastersClient: webmasters_v3.Webmasters | null = null;
let searchConsoleClient: searchconsole_v1.Searchconsole | null = null;

function getWebmasters(): webmasters_v3.Webmasters {
  if (!webmastersClient) {
    webmastersClient = google.webmasters({ version: 'v3', auth: pickAuthArg(getAuthClientOptions()) });
  }
  return webmastersClient;
}

function getSearchConsole(): searchconsole_v1.Searchconsole {
  if (!searchConsoleClient) {
    searchConsoleClient = google.searchconsole({
      version: 'v1',
      auth: pickAuthArg(getAuthClientOptions()),
    });
  }
  return searchConsoleClient;
}

// ---------------------------------------------------------------------------
// Search Analytics — the workhorse: clicks/impressions/ctr/position by dimension
// ---------------------------------------------------------------------------

const FIXED_METRIC_HEADERS = ['clicks', 'impressions', 'ctr', 'position'];

function searchAnalyticsToReportData(
  dimensions: string[] | undefined,
  rows: webmasters_v3.Schema$ApiDataRow[] | undefined,
): ReportData {
  const dims = dimensions ?? [];
  const headers = [...dims, ...FIXED_METRIC_HEADERS];

  const dataRows: string[][] = (rows ?? []).map((r) => {
    const keys = r.keys ?? [];
    const dimVals = dims.map((_, i) => keys[i] ?? '');
    const metricVals = [
      String(r.clicks ?? 0),
      String(r.impressions ?? 0),
      String(r.ctr ?? 0),
      String(r.position ?? 0),
    ];
    return [...dimVals, ...metricVals];
  });

  return { headers, rows: dataRows, rowCount: dataRows.length };
}

// API constraints, surfaced as constants so commands can validate before round-trip.
export const SEARCH_ANALYTICS_MAX_ROW_LIMIT = 25_000;

// `searchAppearance` cannot be combined with any other dimension — the API rejects it.
// `type=discover` does not support the `query` dimension. Validate at the service edge so
// every code path (CLI, MCP, future REST) gets the same guard with the same error text.
export function validateSearchAnalyticsParams(params: SearchAnalyticsQueryParams): void {
  const dims = params.dimensions ?? [];
  if (dims.includes('searchAppearance') && dims.length > 1) {
    throw new Error(
      'The `searchAppearance` dimension cannot be combined with other dimensions. ' +
        'Run a separate query with only `-d searchAppearance` to retrieve it.',
    );
  }
  if (params.type === 'discover' && dims.includes('query')) {
    throw new Error(
      'The `query` dimension is not available for `--type discover`. ' +
        'Discover does not record search queries; use `page`, `country`, or `device`.',
    );
  }
  if (params.rowLimit !== undefined && params.rowLimit > SEARCH_ANALYTICS_MAX_ROW_LIMIT) {
    throw new Error(
      `rowLimit ${params.rowLimit} exceeds the GSC API maximum of ${SEARCH_ANALYTICS_MAX_ROW_LIMIT}. ` +
        'Use --all to auto-paginate beyond this cap.',
    );
  }
}

export async function querySearchAnalytics(params: SearchAnalyticsQueryParams): Promise<ReportData> {
  validateSearchAnalyticsParams(params);
  const { siteUrl, ...body } = params;
  const response = await withRetry(
    () =>
      getWebmasters().searchanalytics.query({
        siteUrl,
        requestBody: body as webmasters_v3.Schema$SearchAnalyticsQueryRequest,
      }),
    { label: 'searchanalytics.query' },
  );
  return searchAnalyticsToReportData(params.dimensions, response.data.rows ?? undefined);
}

// Generator yielding pages until the API returns a short page (< pageSize rows).
// Use this when memory matters — pipe each page straight to NDJSON output.
export async function* iterateSearchAnalytics(
  params: SearchAnalyticsQueryParams,
  pageSize: number = SEARCH_ANALYTICS_MAX_ROW_LIMIT,
): AsyncGenerator<ReportData, void, unknown> {
  validateSearchAnalyticsParams(params);
  let startRow = params.startRow ?? 0;
  while (true) {
    const page = await querySearchAnalytics({ ...params, startRow, rowLimit: pageSize });
    if (page.rowCount === 0) return;
    yield page;
    if (page.rowCount < pageSize) return;
    startRow += pageSize;
  }
}

// Accumulating variant — useful for table/csv/chart formats. Caller's responsibility to
// keep the row total bounded; the GSC quota of 50K page+keyword pairs/day per property
// makes this self-limiting in practice.
export async function querySearchAnalyticsAll(
  params: SearchAnalyticsQueryParams,
  opts: { pageSize?: number; maxRows?: number; onPage?: (rowsSoFar: number) => void } = {},
): Promise<ReportData> {
  const pageSize = opts.pageSize ?? SEARCH_ANALYTICS_MAX_ROW_LIMIT;
  const maxRows = opts.maxRows ?? Number.POSITIVE_INFINITY;
  const dims = params.dimensions ?? [];
  const headers = [...dims, ...FIXED_METRIC_HEADERS];
  const rows: string[][] = [];

  for await (const page of iterateSearchAnalytics(params, pageSize)) {
    for (const r of page.rows) {
      if (rows.length >= maxRows) break;
      rows.push(r);
    }
    opts.onPage?.(rows.length);
    if (rows.length >= maxRows) break;
  }

  return { headers, rows, rowCount: rows.length };
}

export async function batchSearchAnalytics(req: BatchSearchAnalyticsRequest): Promise<ReportData[]> {
  // The Search Console API has no native batch endpoint for searchanalytics — issue requests
  // sequentially under the same auth. (Concurrent fan-out is possible, but trades retry
  // observability for throughput; keep it sequential by default.)
  const results: ReportData[] = [];
  for (const r of req.requests) {
    results.push(await querySearchAnalytics(r));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Sites — list / get / add / delete
// ---------------------------------------------------------------------------

export async function listSites(): Promise<SiteEntry[]> {
  const response = await withRetry(() => getWebmasters().sites.list(), { label: 'sites.list' });
  const entries = (response.data.siteEntry ?? []) as webmasters_v3.Schema$WmxSite[];
  return entries.map((s) => ({
    siteUrl: s.siteUrl ?? '',
    permissionLevel: s.permissionLevel ?? '',
  }));
}

export async function getSite(siteUrl: string): Promise<SiteEntry> {
  const response = await withRetry(() => getWebmasters().sites.get({ siteUrl }), { label: 'sites.get' });
  return {
    siteUrl: response.data.siteUrl ?? siteUrl,
    permissionLevel: response.data.permissionLevel ?? '',
  };
}

export async function addSite(siteUrl: string): Promise<void> {
  await withRetry(() => getWebmasters().sites.add({ siteUrl }), { label: 'sites.add' });
}

export async function deleteSite(siteUrl: string): Promise<void> {
  await withRetry(() => getWebmasters().sites.delete({ siteUrl }), { label: 'sites.delete' });
}

// ---------------------------------------------------------------------------
// Sitemaps — list / get / submit / delete
// ---------------------------------------------------------------------------

export async function listSitemaps(siteUrl: string, sitemapIndex?: string): Promise<Sitemap[]> {
  const response = await withRetry(() => getWebmasters().sitemaps.list({ siteUrl, sitemapIndex }), {
    label: 'sitemaps.list',
  });
  return (response.data.sitemap ?? []) as Sitemap[];
}

export async function getSitemap(siteUrl: string, feedpath: string): Promise<Sitemap> {
  const response = await withRetry(() => getWebmasters().sitemaps.get({ siteUrl, feedpath }), {
    label: 'sitemaps.get',
  });
  return response.data as Sitemap;
}

export async function submitSitemap(siteUrl: string, feedpath: string): Promise<void> {
  await withRetry(() => getWebmasters().sitemaps.submit({ siteUrl, feedpath }), {
    label: 'sitemaps.submit',
  });
}

export async function deleteSitemap(siteUrl: string, feedpath: string): Promise<void> {
  await withRetry(() => getWebmasters().sitemaps.delete({ siteUrl, feedpath }), {
    label: 'sitemaps.delete',
  });
}

// ---------------------------------------------------------------------------
// URL Inspection — index status, mobile usability, AMP, rich results
// ---------------------------------------------------------------------------

export async function inspectUrl(
  params: UrlInspectionParams,
): Promise<searchconsole_v1.Schema$InspectUrlIndexResponse> {
  const response = await withRetry(
    () =>
      getSearchConsole().urlInspection.index.inspect({
        requestBody: {
          siteUrl: params.siteUrl,
          inspectionUrl: params.inspectionUrl,
          languageCode: params.languageCode,
        },
      }),
    { label: 'urlInspection.index.inspect' },
  );
  return response.data;
}
