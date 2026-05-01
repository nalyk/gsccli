import { Command } from 'commander';
import { formatOutput } from '../../formatters/index.js';
import { getSite } from '../../services/searchconsole.service.js';
import { type ReportData, resolveGlobalOptions, writeOutput } from '../../types/common.js';
import { handleError } from '../../utils/error-handler.js';
import { ensureValidSiteUrl } from '../../utils/url-helpers.js';

export function createGetCommand(): Command {
  return new Command('get')
    .description('Get site details (permission level)')
    .argument('[siteUrl]', 'Site URL — defaults to -s/--site')
    .action(async (siteUrlArg: string | undefined, _opts, command) => {
      try {
        const globalOpts = resolveGlobalOptions(command);
        const siteUrl = ensureValidSiteUrl(siteUrlArg ?? globalOpts.site);
        const site = await getSite(siteUrl);

        const data: ReportData = {
          headers: ['siteUrl', 'permissionLevel'],
          rows: [[site.siteUrl, site.permissionLevel]],
          rowCount: 1,
        };

        const output = formatOutput(data, globalOpts.format);
        writeOutput(output, globalOpts);
      } catch (error) {
        handleError(error);
      }
    });
}
