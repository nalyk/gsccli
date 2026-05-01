import { Command } from 'commander';
import { formatOutput } from '../../formatters/index.js';
import { listSitemaps } from '../../services/searchconsole.service.js';
import { type ReportData, resolveGlobalOptions, writeOutput } from '../../types/common.js';
import { handleError } from '../../utils/error-handler.js';
import { createSpinner } from '../../utils/spinner.js';
import { validateSiteUrl } from '../../validation/validators.js';

export function createListCommand(): Command {
  return new Command('list')
    .description('List all sitemaps for a site')
    .option('--sitemap-index <url>', 'Filter to children of a specific sitemap index')
    .action(async (opts, command) => {
      try {
        const globalOpts = resolveGlobalOptions(command);
        const siteUrl = validateSiteUrl(globalOpts.site);

        const spinner = createSpinner('Loading sitemaps...');
        spinner.start();
        const sitemaps = await listSitemaps(siteUrl, opts.sitemapIndex);
        spinner.stop();

        const data: ReportData = {
          headers: [
            'path',
            'type',
            'lastSubmitted',
            'lastDownloaded',
            'isPending',
            'isSitemapsIndex',
            'errors',
            'warnings',
          ],
          rows: sitemaps.map((s) => [
            s.path ?? '',
            s.type ?? '',
            s.lastSubmitted ?? '',
            s.lastDownloaded ?? '',
            String(s.isPending ?? false),
            String(s.isSitemapsIndex ?? false),
            String(s.errors ?? '0'),
            String(s.warnings ?? '0'),
          ]),
          rowCount: sitemaps.length,
        };

        const output = formatOutput(data, globalOpts.format);
        writeOutput(output, globalOpts);
      } catch (error) {
        handleError(error);
      }
    });
}
