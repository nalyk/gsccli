import { Command } from 'commander';
import { createInstallCommand } from './install.js';
import { createListCommand } from './list.js';
import { createStatusCommand } from './status.js';
import { createUninstallCommand } from './uninstall.js';

export function createSkillsCommand(): Command {
  const cmd = new Command('skills').description(
    'Install gsccli Agent Skills (SKILL.md) for Claude Code, Codex, Gemini, and Qwen Code.',
  );

  cmd.addCommand(createInstallCommand());
  cmd.addCommand(createUninstallCommand());
  cmd.addCommand(createListCommand());
  cmd.addCommand(createStatusCommand());

  return cmd;
}
