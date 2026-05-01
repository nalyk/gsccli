import { Command } from 'commander';
import { createBatchCommand } from './batch.js';
import { createUrlCommand } from './url.js';

export function createInspectCommand(): Command {
  const cmd = new Command('inspect').description(
    'URL Inspection — index status, mobile usability, AMP, rich results',
  );

  cmd.addCommand(createUrlCommand());
  cmd.addCommand(createBatchCommand());

  return cmd;
}
