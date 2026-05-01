import { Command } from 'commander';
import { createAddCommand } from './add.js';
import { createDeleteCommand } from './delete.js';
import { createGetCommand } from './get.js';
import { createListCommand } from './list.js';

export function createSitesCommand(): Command {
  const cmd = new Command('sites').description('Manage verified Search Console properties (sites)');

  cmd.addCommand(createListCommand());
  cmd.addCommand(createGetCommand());
  cmd.addCommand(createAddCommand());
  cmd.addCommand(createDeleteCommand());

  return cmd;
}
