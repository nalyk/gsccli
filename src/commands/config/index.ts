import { Command } from 'commander';
import { createGetCommand } from './get.js';
import { createListCommand } from './list.js';
import { createSetCommand } from './set.js';

export function createConfigCommand(): Command {
  const cmd = new Command('config').description('Manage CLI configuration');

  cmd.addCommand(createSetCommand());
  cmd.addCommand(createGetCommand());
  cmd.addCommand(createListCommand());

  return cmd;
}
