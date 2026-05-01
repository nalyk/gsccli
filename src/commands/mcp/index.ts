import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Command } from 'commander';
import { z } from 'zod';
import {
  inspectUrl,
  listSitemaps,
  listSites,
  querySearchAnalytics,
} from '../../services/searchconsole.service.js';
import type { ReportData } from '../../types/common.js';
import { resolveGlobalOptions } from '../../types/common.js';
import type {
  AggregationType,
  DataState,
  SearchAnalyticsDimension,
  SearchAnalyticsQueryParams,
  SearchType,
} from '../../types/searchconsole.js';
import { resolveDate } from '../../utils/date-helpers.js';
import { handleError } from '../../utils/error-handler.js';
import { buildDimensionFilterGroups } from '../../utils/filter-builder.js';
import { logger } from '../../utils/logger.js';
import { ensureValidSiteUrl } from '../../utils/url-helpers.js';

const VERSION = '1.0.0';

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function reportToObjects(d: ReportData): Array<Record<string, string>> {
  return d.rows.map((row) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < d.headers.length; i++) {
      obj[d.headers[i]] = row[i] ?? '';
    }
    return obj;
  });
}

function resolveSite(argSite: string | undefined, defaultSite: string): string {
  const candidate = argSite ?? defaultSite;
  if (!candidate) {
    throw new Error(
      'siteUrl is required. Either pass it in the tool args or set a default with `gsccli config set site <url>`.',
    );
  }
  return ensureValidSiteUrl(candidate);
}

function registerTools(server: McpServer, defaultSite: string): void {
  // ---------------------------------------------------------------------------
  // gsccli_query — Search Analytics. The workhorse.
  // ---------------------------------------------------------------------------
  server.registerTool(
    'gsccli_query',
    {
      title: 'Run a Search Console search analytics query',
      description:
        'Returns clicks/impressions/CTR/position broken down by the requested dimensions. ' +
        'Use this for "top queries", "top pages", "performance by country/device", or any ' +
        '"how is the site doing in search" question. Date format: YYYY-MM-DD or relative ' +
        'like "today", "yesterday", "28daysAgo". Default range is the last 28 days.',
      inputSchema: {
        siteUrl: z
          .string()
          .optional()
          .describe(
            'Site URL (https://example.com/ or sc-domain:example.com). Defaults to the configured site.',
          ),
        dimensions: z
          .array(z.enum(['query', 'page', 'country', 'device', 'date', 'searchAppearance']))
          .optional()
          .describe('Dimensions to group by. Omit for site-wide totals.'),
        startDate: z.string().default('28daysAgo'),
        endDate: z.string().default('today'),
        type: z
          .enum(['web', 'image', 'video', 'news', 'discover', 'googleNews'])
          .optional()
          .describe('Search type. Defaults to "web".'),
        dataState: z
          .enum(['final', 'all'])
          .default('final')
          .describe('"final" excludes data from the last ~3 days; "all" includes fresh-but-incomplete data.'),
        aggregationType: z.enum(['auto', 'byPage', 'byProperty']).optional(),
        rowLimit: z.number().int().positive().max(25000).optional(),
        startRow: z.number().int().nonnegative().optional(),
        filter: z
          .array(z.string())
          .optional()
          .describe(
            'Dimension filters in shorthand: "query==brand", "page=~/blog/.*", "country!=usa", "device==MOBILE". Combined with AND.',
          ),
      },
    },
    async (args) => {
      const siteUrl = resolveSite(args.siteUrl, defaultSite);
      const params: SearchAnalyticsQueryParams = {
        siteUrl,
        startDate: resolveDate(args.startDate),
        endDate: resolveDate(args.endDate),
        dimensions: args.dimensions as SearchAnalyticsDimension[] | undefined,
        type: args.type as SearchType | undefined,
        dataState: args.dataState as DataState,
        aggregationType: args.aggregationType as AggregationType | undefined,
        dimensionFilterGroups: args.filter ? buildDimensionFilterGroups(args.filter) : undefined,
        rowLimit: args.rowLimit,
        startRow: args.startRow,
      };
      const data = await querySearchAnalytics(params);
      return ok({ rowCount: data.rowCount, rows: reportToObjects(data) });
    },
  );

  // ---------------------------------------------------------------------------
  // gsccli_sites_list — list sites the authenticated user can access.
  // ---------------------------------------------------------------------------
  server.registerTool(
    'gsccli_sites_list',
    {
      title: 'List Search Console sites',
      description:
        'Returns all verified Search Console properties the authenticated user has access to. ' +
        'Use this to discover what sites are available before calling other tools.',
      inputSchema: {},
    },
    async () => {
      const sites = await listSites();
      return ok({
        siteCount: sites.length,
        sites: sites.map((s) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel })),
      });
    },
  );

  // ---------------------------------------------------------------------------
  // gsccli_sitemaps_list — sitemaps registered for a site.
  // ---------------------------------------------------------------------------
  server.registerTool(
    'gsccli_sitemaps_list',
    {
      title: 'List sitemaps for a site',
      description:
        'Returns all sitemaps registered for a Search Console site, with status, last submit/download timestamps, error/warning counts, and submitted/indexed URL counts per content type.',
      inputSchema: {
        siteUrl: z.string().optional().describe('Site URL. Defaults to the configured site.'),
        sitemapIndex: z
          .string()
          .optional()
          .describe('Optional: filter to children of a specific sitemap index.'),
      },
    },
    async (args) => {
      const siteUrl = resolveSite(args.siteUrl, defaultSite);
      const sitemaps = await listSitemaps(siteUrl, args.sitemapIndex);
      return ok({
        sitemapCount: sitemaps.length,
        sitemaps: sitemaps.map((s) => ({
          path: s.path ?? '',
          type: s.type ?? '',
          lastSubmitted: s.lastSubmitted ?? '',
          lastDownloaded: s.lastDownloaded ?? '',
          isPending: s.isPending ?? false,
          isSitemapsIndex: s.isSitemapsIndex ?? false,
          errors: s.errors ?? '0',
          warnings: s.warnings ?? '0',
          contents: s.contents ?? [],
        })),
      });
    },
  );

  // ---------------------------------------------------------------------------
  // gsccli_inspect_url — index status for a single URL.
  // ---------------------------------------------------------------------------
  server.registerTool(
    'gsccli_inspect_url',
    {
      title: 'Inspect a URL — index status, mobile usability, AMP, rich results',
      description:
        'Returns the current Search Console URL Inspection result: whether the URL is indexed, ' +
        'last crawl time, googleCanonical vs userCanonical, mobile-usability verdict, AMP status, ' +
        'and any rich-result detections. Use this to debug "why isn\'t my page indexed" questions.',
      inputSchema: {
        siteUrl: z.string().optional().describe('Site URL. Defaults to the configured site.'),
        inspectionUrl: z.string().describe('URL to inspect — must belong to the site.'),
        languageCode: z
          .string()
          .optional()
          .describe('BCP-47 code (e.g. "en-US") for translated description fields.'),
      },
    },
    async (args) => {
      const siteUrl = resolveSite(args.siteUrl, defaultSite);
      const result = await inspectUrl({
        siteUrl,
        inspectionUrl: args.inspectionUrl,
        languageCode: args.languageCode,
      });
      return ok(result);
    },
  );
}

export function createMcpCommand(): Command {
  const cmd = new Command('mcp').description('Model Context Protocol server (stdio)');

  cmd
    .command('serve')
    .description(
      'Start an MCP server over stdio. Connect from Claude Desktop, Cursor, Cline, etc. ' +
        'Tools: gsccli_query, gsccli_sites_list, gsccli_sitemaps_list, gsccli_inspect_url.',
    )
    .action(async (_opts, command) => {
      try {
        const globalOpts = resolveGlobalOptions(command);
        // The MCP transport speaks JSON-RPC on stdout; gsccli's normal logging goes to stderr,
        // but suppress spinners/info to keep stdout strictly to JSON-RPC frames.
        logger.setVerbose(false);

        const server = new McpServer({ name: 'gsccli', version: VERSION });
        registerTools(server, globalOpts.site ?? '');

        const transport = new StdioServerTransport();
        await server.connect(transport);
      } catch (error) {
        handleError(error);
      }
    });

  return cmd;
}
