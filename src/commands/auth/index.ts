import { Command } from 'commander';
import { createLoginCommand } from './login.js';
import { createLogoutCommand } from './logout.js';
import { createStatusCommand } from './status.js';

export function createAuthCommand(): Command {
  const cmd = new Command('auth').description('Manage authentication');

  cmd.addCommand(createLoginCommand());
  cmd.addCommand(createLogoutCommand());
  cmd.addCommand(createStatusCommand());

  return cmd;
}
