import { Command } from 'commander';
import { formatOutput } from '../../formatters/index.js';
import { getIndexingNotificationMetadata } from '../../services/indexing.service.js';
import { type ReportData, resolveGlobalOptions, writeOutput } from '../../types/common.js';
import { handleError } from '../../utils/error-handler.js';

export function createStatusCommand(): Command {
  return new Command('status')
    .description('Get the latest Indexing API notification metadata for a URL')
    .argument('<url>', 'URL to query')
    .action(async (url: string, _opts, command: Command) => {
      try {
        const globalOpts = resolveGlobalOptions(command);
        const meta = await getIndexingNotificationMetadata(url);

        const rows: string[][] = [
          ['url', String(meta.url ?? url)],
          ['latestUpdate.url', String(meta.latestUpdate?.url ?? '')],
          ['latestUpdate.type', String(meta.latestUpdate?.type ?? '')],
          ['latestUpdate.notifyTime', String(meta.latestUpdate?.notifyTime ?? '')],
          ['latestRemove.url', String(meta.latestRemove?.url ?? '')],
          ['latestRemove.type', String(meta.latestRemove?.type ?? '')],
          ['latestRemove.notifyTime', String(meta.latestRemove?.notifyTime ?? '')],
        ];

        const data: ReportData = {
          headers: ['field', 'value'],
          rows,
          rowCount: rows.length,
          metadata: meta as Record<string, unknown>,
        };

        const output = formatOutput(data, globalOpts.format);
        writeOutput(output, globalOpts);
      } catch (error) {
        handleError(error);
      }
    });
}
