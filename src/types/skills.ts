// gsccli skills install — types
//
// One skill per CLI agent (Claude Code, Codex, Gemini, Qwen Code), copied from
// `agents/<source>/gsccli/` to `~/.<parent>/skills/gsccli/` (user scope) or
// `./.<parent>/skills/gsccli/` (project scope). Idempotent recursive copy with
// content-hash diffing.

export type AgentName = 'claude' | 'codex' | 'gemini' | 'qwen';
export type SkillScope = 'user' | 'project';

export interface AgentSpec {
  /** CLI flag value: `--agent claude` */
  name: AgentName;
  /** Human-friendly name for messages */
  displayName: string;
  /** Source dir under `agents/` (e.g. `claude-code`, `codex`, `gemini`, `qwen`) */
  sourceDir: string;
  /** CLI's home directory name under $HOME (e.g. `.claude`, `.codex`) */
  parentDir: string;
  /** Skill name as discovered by the CLI (always `gsccli` here) */
  skillName: string;
  /** Subdirectory inside `parentDir` where skills live (always `skills` for these four) */
  skillsSubdir: string;
  /** Optional one-line caveat printed after install */
  postInstallNote?: string;
  /** Extra reminder printed only for `--scope project` */
  projectScopeNote?: string;
}

export interface InstallFileChange {
  relPath: string;
  /** Absolute path on disk */
  absPath: string;
  /** Source bytes */
  size: number;
  status: 'new' | 'unchanged' | 'changed' | 'force-overwrite';
}

export interface InstallReport {
  agent: AgentName;
  scope: SkillScope;
  targetDir: string;
  files: InstallFileChange[];
  /** True when --dry-run; nothing was written */
  dryRun: boolean;
  /** True when target parent (e.g. ~/.claude/) didn't exist */
  parentMissing: boolean;
}
