import { Command } from 'commander';
import { resolveConfigValue } from '../../services/config.service.js';
import { CONFIG_KEYS } from '../../types/config.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';

export function createGetCommand(): Command {
  return new Command('get')
    .description('Get the effective configuration value (project overrides global)')
    .argument('<key>', `Config key (${Object.keys(CONFIG_KEYS).join(', ')})`)
    .option('--show-source', 'Also print which file the value came from')
    .action((key: string, opts: { showSource?: boolean }) => {
      try {
        if (!(key in CONFIG_KEYS)) {
          logger.error(`Unknown config key: ${key}\nValid keys: ${Object.keys(CONFIG_KEYS).join(', ')}`);
          process.exit(1);
        }

        const resolved = resolveConfigValue(key);
        if (resolved.value === undefined) {
          logger.info(`${key} is not set`);
          return;
        }
        console.log(resolved.value);
        if (opts.showSource) {
          logger.info(`source: ${resolved.source}`);
        }
      } catch (error) {
        handleError(error);
      }
    });
}
