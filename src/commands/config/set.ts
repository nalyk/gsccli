import { Command } from 'commander';
import { setConfigValue } from '../../services/config.service.js';
import { CONFIG_KEYS, type ConfigScope, defaultScopeFor } from '../../types/config.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';

export function createSetCommand(): Command {
  return new Command('set')
    .description('Set a configuration value (per-project by default for site/format/noColor/verbose)')
    .argument('<key>', `Config key (${Object.keys(CONFIG_KEYS).join(', ')})`)
    .argument('<value>', 'Value to set')
    .option('--global', 'Force write to ~/.gsccli/config.json')
    .option('--local', 'Force write to ./.gsccli.json (project file)')
    .action((key: string, value: string, opts: { global?: boolean; local?: boolean }) => {
      try {
        if (!(key in CONFIG_KEYS)) {
          logger.error(`Unknown config key: ${key}\nValid keys: ${Object.keys(CONFIG_KEYS).join(', ')}`);
          process.exit(1);
        }
        if (opts.global && opts.local) {
          logger.error('Cannot pass both --global and --local.');
          process.exit(1);
        }

        const scope: ConfigScope = opts.global ? 'global' : opts.local ? 'local' : defaultScopeFor(key);
        const result = setConfigValue(key, value, scope);
        logger.success(`Set ${key} = ${value} (${result.scope}: ${result.file})`);
      } catch (error) {
        handleError(error);
      }
    });
}
