import { Command } from 'commander';
import {
  AGENTS,
  detectInstalledAgents,
  getParentDir,
  installAgent,
  isValidAgent,
  looksLikeProjectRoot,
} from '../../services/skills.service.js';
import type { AgentName, InstallReport, SkillScope } from '../../types/skills.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';

interface RawInstallOpts {
  agent: string;
  scope?: string;
  dryRun?: boolean;
  force?: boolean;
}

const VALID_SCOPES: ReadonlySet<string> = new Set(['user', 'project']);

export function createInstallCommand(): Command {
  return new Command('install')
    .description('Install the gsccli SKILL.md package into one or more AI coding-agent CLIs.')
    .requiredOption(
      '--agent <name>',
      `Target agent: ${Object.keys(AGENTS).join(', ')}, or "all" to install into every detected CLI`,
    )
    .option(
      '--scope <scope>',
      'Install scope: user (default, ~/.<cli>/skills/) or project (./.<cli>/skills/)',
      'user',
    )
    .option('--dry-run', 'Print the action tree without writing anything')
    .option('--force', 'Overwrite existing files when content differs')
    .action((opts: RawInstallOpts) => {
      try {
        const scope = parseScope(opts.scope);
        const agents = parseAgents(opts.agent);

        if (scope === 'project' && !looksLikeProjectRoot()) {
          logger.error(
            `--scope project refused: current directory does not look like a project root ` +
              '(no .git, package.json, pyproject.toml, etc.).\n' +
              'Run from a project root, or use --scope user.',
          );
          process.exit(1);
        }

        const reports: InstallReport[] = [];
        const failures: { agent: AgentName; error: Error }[] = [];

        for (const agent of agents) {
          try {
            const report = installAgent(agent, scope, {
              dryRun: opts.dryRun ?? false,
              force: opts.force ?? false,
            });
            reports.push(report);
          } catch (err) {
            failures.push({ agent, error: err instanceof Error ? err : new Error(String(err)) });
          }
        }

        printReports(reports, scope, opts.dryRun ?? false);

        if (failures.length > 0) {
          for (const f of failures) {
            logger.error(`${AGENTS[f.agent].displayName}: ${f.error.message}`);
          }
          process.exit(1);
        }
      } catch (error) {
        handleError(error);
      }
    });
}

function parseScope(value: string | undefined): SkillScope {
  const scope = value ?? 'user';
  if (!VALID_SCOPES.has(scope)) {
    logger.error(`Invalid --scope ${scope}. Valid: user, project.`);
    process.exit(1);
  }
  return scope as SkillScope;
}

function parseAgents(value: string): AgentName[] {
  if (value === 'all') {
    const detected = detectInstalledAgents();
    if (detected.length === 0) {
      logger.error(
        'No supported agent CLI detected (looked for ~/.claude, ~/.codex, ~/.gemini, ~/.qwen). ' +
          'Install one of them, or pass --agent <name> explicitly to override.',
      );
      process.exit(1);
    }
    logger.info(`Detected agents: ${detected.map((a) => AGENTS[a].displayName).join(', ')}`);
    return detected;
  }
  if (!isValidAgent(value)) {
    logger.error(`Invalid --agent ${value}. Valid: ${Object.keys(AGENTS).join(', ')}, all.`);
    process.exit(1);
  }
  return [value];
}

function printReports(reports: InstallReport[], scope: SkillScope, dryRun: boolean): void {
  for (const report of reports) {
    const spec = AGENTS[report.agent];
    const header = dryRun
      ? `Would install for agent=${report.agent} scope=${scope}:`
      : `Installed for agent=${report.agent} scope=${scope}:`;
    logger.info(header);

    for (const file of report.files) {
      const sigil = sigilFor(file.status);
      const note =
        file.status === 'unchanged'
          ? '(unchanged)'
          : file.status === 'changed'
            ? '(WILL CONFLICT — pass --force to overwrite)'
            : file.status === 'force-overwrite'
              ? '(forced overwrite)'
              : 'NEW';
      console.error(`  ${sigil} ${file.absPath}  (${file.size} bytes, ${note})`);
    }

    if (spec.postInstallNote) {
      logger.warn(`${spec.displayName}: ${spec.postInstallNote}`);
    }
    if (scope === 'project' && spec.projectScopeNote) {
      logger.warn(`${spec.displayName} (project scope): ${spec.projectScopeNote}`);
    }
    if (scope === 'user' && report.parentMissing && dryRun) {
      logger.warn(
        `${spec.displayName} parent dir ${getParentDir(report.agent, scope)} is missing — ` +
          'install will fail without it. Install the CLI first.',
      );
    }
  }

  if (dryRun) {
    logger.info('Run without --dry-run to apply.');
  }
}

function sigilFor(status: 'new' | 'unchanged' | 'changed' | 'force-overwrite'): string {
  switch (status) {
    case 'new':
      return '+';
    case 'unchanged':
      return '=';
    case 'changed':
      return '!';
    case 'force-overwrite':
      return '~';
  }
}
