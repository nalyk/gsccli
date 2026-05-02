import { Command } from 'commander';
import { AGENTS, isValidAgent, uninstallAgent } from '../../services/skills.service.js';
import type { SkillScope } from '../../types/skills.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';

interface RawOpts {
  agent: string;
  scope?: string;
}

export function createUninstallCommand(): Command {
  return new Command('uninstall')
    .description('Remove the gsccli skill package from one or all detected agent CLIs.')
    .requiredOption('--agent <name>', `Target agent: ${Object.keys(AGENTS).join(', ')}, or "all"`)
    .option('--scope <scope>', 'Scope to remove: user (default) or project', 'user')
    .action((opts: RawOpts) => {
      try {
        const scope = (opts.scope ?? 'user') as SkillScope;
        if (scope !== 'user' && scope !== 'project') {
          logger.error(`Invalid --scope ${opts.scope}. Valid: user, project.`);
          process.exit(1);
        }

        const targets =
          opts.agent === 'all'
            ? (Object.keys(AGENTS) as Array<keyof typeof AGENTS>)
            : isValidAgent(opts.agent)
              ? [opts.agent]
              : null;

        if (targets === null) {
          logger.error(`Invalid --agent ${opts.agent}. Valid: ${Object.keys(AGENTS).join(', ')}, all.`);
          process.exit(1);
        }

        let anyRemoved = false;
        for (const agent of targets) {
          const result = uninstallAgent(agent, scope);
          if (result.removed) {
            logger.success(`${AGENTS[agent].displayName}: removed ${result.targetDir}`);
            anyRemoved = true;
          } else {
            logger.info(`${AGENTS[agent].displayName}: nothing to remove (${result.targetDir} not present)`);
          }
        }

        if (!anyRemoved) {
          logger.warn('No skill installations were found to remove.');
        }
      } catch (error) {
        handleError(error);
      }
    });
}
