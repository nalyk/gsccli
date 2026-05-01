import { Command } from 'commander';
import { createBatchCommand } from './batch.js';
import { createPublishCommand } from './publish.js';
import { createStatusCommand } from './status.js';

export function createIndexingCommand(): Command {
  const cmd = new Command('index').description(
    'Google Indexing API — notify Google of URL_UPDATED / URL_DELETED. ' +
      'Restricted by Google policy to job-posting and livestream-broadcast pages.',
  );

  cmd.addCommand(createPublishCommand());
  cmd.addCommand(createStatusCommand());
  cmd.addCommand(createBatchCommand());

  return cmd;
}
