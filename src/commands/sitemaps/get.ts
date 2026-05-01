import { Command } from 'commander';
import { formatOutput } from '../../formatters/index.js';
import { getSitemap } from '../../services/searchconsole.service.js';
import { type ReportData, resolveGlobalOptions, writeOutput } from '../../types/common.js';
import { handleError } from '../../utils/error-handler.js';
import { validateSiteUrl } from '../../validation/validators.js';

export function createGetCommand(): Command {
  return new Command('get')
    .description('Get a single sitemap status')
    .argument('<feedpath>', 'Sitemap feed URL (e.g. https://example.com/sitemap.xml)')
    .action(async (feedpath: string, _opts, command) => {
      try {
        const globalOpts = resolveGlobalOptions(command);
        const siteUrl = validateSiteUrl(globalOpts.site);
        const sitemap = await getSitemap(siteUrl, feedpath);

        const headers = [
          'path',
          'type',
          'lastSubmitted',
          'lastDownloaded',
          'isPending',
          'isSitemapsIndex',
          'errors',
          'warnings',
        ];
        const row: string[] = [
          sitemap.path ?? feedpath,
          sitemap.type ?? '',
          sitemap.lastSubmitted ?? '',
          sitemap.lastDownloaded ?? '',
          String(sitemap.isPending ?? false),
          String(sitemap.isSitemapsIndex ?? false),
          String(sitemap.errors ?? '0'),
          String(sitemap.warnings ?? '0'),
        ];

        const data: ReportData = {
          headers,
          rows: [row],
          rowCount: 1,
          metadata: sitemap.contents ? { contents: sitemap.contents } : undefined,
        };

        const output = formatOutput(data, globalOpts.format);
        writeOutput(output, globalOpts);
      } catch (error) {
        handleError(error);
      }
    });
}
