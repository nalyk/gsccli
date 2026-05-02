import { Command } from 'commander';
import { AGENTS, getAgentSourceDir, getTargetDir } from '../../services/skills.service.js';
import type { AgentName } from '../../types/skills.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';

export function createListCommand(): Command {
  return new Command('list')
    .description('List the available gsccli skill packages and where they would be installed.')
    .action(() => {
      try {
        for (const agent of Object.keys(AGENTS) as AgentName[]) {
          const spec = AGENTS[agent];
          logger.info(`${spec.displayName} (--agent ${agent})`);
          console.error(`    source : ${getAgentSourceDir(agent)}`);
          console.error(`    user   : ${getTargetDir(agent, 'user')}`);
          console.error(`    project: ${getTargetDir(agent, 'project')}`);
        }
      } catch (error) {
        handleError(error);
      }
    });
}
