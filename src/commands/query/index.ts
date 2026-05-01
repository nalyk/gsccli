import { Command } from 'commander';
import { createBatchCommand } from './batch.js';
import { createByCountryCommand } from './by-country.js';
import { createByDeviceCommand } from './by-device.js';
import { createCompareCommand } from './compare.js';
import { createRunCommand } from './run.js';
import { createTopPagesCommand } from './top-pages.js';
import { createTopQueriesCommand } from './top-queries.js';

export function createQueryCommand(): Command {
  const cmd = new Command('query').description('Search Analytics — clicks, impressions, CTR, position');

  cmd.addCommand(createRunCommand());
  cmd.addCommand(createTopQueriesCommand());
  cmd.addCommand(createTopPagesCommand());
  cmd.addCommand(createByCountryCommand());
  cmd.addCommand(createByDeviceCommand());
  cmd.addCommand(createCompareCommand());
  cmd.addCommand(createBatchCommand());

  return cmd;
}
