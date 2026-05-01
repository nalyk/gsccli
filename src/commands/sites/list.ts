import { Command } from 'commander';
import { formatOutput } from '../../formatters/index.js';
import { listSites } from '../../services/searchconsole.service.js';
import { type ReportData, resolveGlobalOptions, writeOutput } from '../../types/common.js';
import { handleError } from '../../utils/error-handler.js';
import { createSpinner } from '../../utils/spinner.js';

export function createListCommand(): Command {
  return new Command('list')
    .description('List all sites the user has access to')
    .action(async (_opts, command) => {
      try {
        const globalOpts = resolveGlobalOptions(command);

        const spinner = createSpinner('Loading sites...');
        spinner.start();
        const sites = await listSites();
        spinner.stop();

        const data: ReportData = {
          headers: ['siteUrl', 'permissionLevel'],
          rows: sites.map((s) => [s.siteUrl, s.permissionLevel]),
          rowCount: sites.length,
        };

        const output = formatOutput(data, globalOpts.format);
        writeOutput(output, globalOpts);
      } catch (error) {
        handleError(error);
      }
    });
}
