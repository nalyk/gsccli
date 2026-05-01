import { Command } from 'commander';
import { formatOutput } from '../../formatters/index.js';
import { listConfig } from '../../services/config.service.js';
import { type ReportData, resolveGlobalOptions, writeOutput } from '../../types/common.js';
import { CONFIG_KEYS } from '../../types/config.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';

export function createListCommand(): Command {
  return new Command('list')
    .description('List effective config (project overrides global) with provenance per key')
    .action((_opts: Record<string, unknown>, command: Command) => {
      try {
        const globalOpts = resolveGlobalOptions(command);
        const layered = listConfig();

        // Layer banner — to stderr so it doesn't pollute `-f json | jq` pipes.
        logger.info(`global: ${layered.globalFile}`);
        logger.info(
          `project: ${layered.projectFile ?? '(none — no .gsccli.json found walking up from CWD)'}`,
        );

        const rows: string[][] = Object.entries(CONFIG_KEYS).map(([key, description]) => {
          const proj = (layered.project as Record<string, unknown>)[key];
          const glob = (layered.global as Record<string, unknown>)[key];
          const eff = (layered.effective as Record<string, unknown>)[key];
          const source = proj !== undefined ? 'project' : glob !== undefined ? 'global' : '(not set)';
          return [key, eff !== undefined ? String(eff) : '(not set)', source, description];
        });

        const data: ReportData = {
          headers: ['Key', 'Value', 'Source', 'Description'],
          rows,
          rowCount: rows.length,
        };

        const output = formatOutput(data, globalOpts.format);
        writeOutput(output, globalOpts);
      } catch (error) {
        handleError(error);
      }
    });
}
