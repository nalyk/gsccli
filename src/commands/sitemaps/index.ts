import { Command } from 'commander';
import { createDeleteCommand } from './delete.js';
import { createGetCommand } from './get.js';
import { createListCommand } from './list.js';
import { createSubmitCommand } from './submit.js';

export function createSitemapsCommand(): Command {
  const cmd = new Command('sitemaps').description('Manage XML sitemaps');

  cmd.addCommand(createListCommand());
  cmd.addCommand(createGetCommand());
  cmd.addCommand(createSubmitCommand());
  cmd.addCommand(createDeleteCommand());

  return cmd;
}
