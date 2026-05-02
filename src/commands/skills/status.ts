import { Command } from 'commander';
import { AGENTS, isValidAgent, statusAgent } from '../../services/skills.service.js';
import type { AgentName, SkillScope } from '../../types/skills.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';

interface RawOpts {
  agent?: string;
}

export function createStatusCommand(): Command {
  return new Command('status')
    .description('Show whether the gsccli skill is installed at each known target path.')
    .option('--agent <name>', `Limit to one agent: ${Object.keys(AGENTS).join(', ')}`)
    .action((opts: RawOpts) => {
      try {
        const targets: AgentName[] =
          opts.agent === undefined
            ? (Object.keys(AGENTS) as AgentName[])
            : isValidAgent(opts.agent)
              ? [opts.agent]
              : (() => {
                  logger.error(`Invalid --agent ${opts.agent}. Valid: ${Object.keys(AGENTS).join(', ')}.`);
                  process.exit(1);
                })();

        for (const agent of targets) {
          const spec = AGENTS[agent];
          logger.info(`${spec.displayName}`);
          for (const scope of ['user', 'project'] as SkillScope[]) {
            const entry = statusAgent(agent, scope);
            const tag = !entry.installed
              ? 'not installed'
              : entry.inSync
                ? `installed (${entry.fileCount} files, in sync)`
                : `installed (${entry.fileCount} files, OUT OF SYNC — re-run with --force to update)`;
            console.error(`    ${scope.padEnd(7)}: ${entry.targetDir}  ${tag}`);
          }
        }
      } catch (error) {
        handleError(error);
      }
    });
}
