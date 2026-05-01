import { Command } from 'commander';
import type { SearchAnalyticsDimension } from '../../types/searchconsole.js';
import { attachCommonOptions, type CommonQueryOpts, executeQueryAction } from './_factory.js';

export function createRunCommand(): Command {
  const cmd = new Command('run').description('Run a Search Analytics query — the workhorse');
  attachCommonOptions(cmd, true);

  cmd.action((rawOpts: CommonQueryOpts, command: Command) => {
    const dimensions = (rawOpts.dimensions ?? []) as SearchAnalyticsDimension[];
    return executeQueryAction(command, rawOpts, dimensions, 'Running search analytics query...');
  });

  return cmd;
}
