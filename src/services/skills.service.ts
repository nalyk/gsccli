import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentName, AgentSpec, InstallFileChange, InstallReport, SkillScope } from '../types/skills.js';

// ----------------------------------------------------------------------------
// Per-agent registry. Source dirs map to layout in the npm tarball:
//   agents/claude-code/gsccli/SKILL.md
//   agents/codex/gsccli/SKILL.md
//   agents/codex/gsccli/agents/openai.yaml
//   agents/gemini/gsccli/SKILL.md
//   agents/qwen/gsccli/SKILL.md
// Targets are <home-or-cwd>/<parentDir>/<skillsSubdir>/<skillName>/.
// ----------------------------------------------------------------------------

export const AGENTS: Record<AgentName, AgentSpec> = {
  claude: {
    name: 'claude',
    displayName: 'Claude Code',
    sourceDir: 'claude-code',
    parentDir: '.claude',
    skillName: 'gsccli',
    skillsSubdir: 'skills',
    postInstallNote:
      'If your global ~/.claude/settings.json contains permissions.deny matching ' +
      'Bash(gsccli *) or Bash(*), the skill cannot override it (deny > allow).',
  },
  codex: {
    name: 'codex',
    displayName: 'Codex CLI',
    sourceDir: 'codex',
    parentDir: '.codex',
    skillName: 'gsccli',
    skillsSubdir: 'skills',
    projectScopeNote:
      'Project-scoped Codex skills require `[projects."<absolute-cwd>"] trust_level = "trusted"` ' +
      'in ~/.codex/config.toml. Run `codex` from this directory once to be prompted, ' +
      'or add the entry manually.',
  },
  gemini: {
    name: 'gemini',
    displayName: 'Gemini CLI',
    sourceDir: 'gemini',
    parentDir: '.gemini',
    skillName: 'gsccli',
    skillsSubdir: 'skills',
    postInstallNote:
      '`gsccli auth login` opens a browser. Gemini sandbox modes (Docker/Podman/Seatbelt) ' +
      'block browser launch — run `gsccli auth login` ONCE outside the sandbox to cache tokens.',
  },
  qwen: {
    name: 'qwen',
    displayName: 'Qwen Code',
    sourceDir: 'qwen',
    parentDir: '.qwen',
    skillName: 'gsccli',
    skillsSubdir: 'skills',
    postInstallNote:
      "Qwen issue #2343: skills sometimes don't auto-discover. If unloaded, run `/skills` once. " +
      'Qwen OAuth free tier ended 2026-04-15 — set DASHSCOPE_API_KEY or use a Coding Plan.',
  },
};

export function isValidAgent(name: string): name is AgentName {
  return name in AGENTS;
}

export function listAgents(): AgentSpec[] {
  return Object.values(AGENTS);
}

// ----------------------------------------------------------------------------
// Source dir resolution. Walk up from this file two levels: in dev (tsx) we live at
//   src/services/skills.service.ts → ../../agents/ = repo-root/agents/
// In production (built) we live at
//   dist/services/skills.service.js  → ../../agents/ = node_modules/@nalyk/gsccli/agents/
// ----------------------------------------------------------------------------

export function getSourceRoot(): string {
  return fileURLToPath(new URL('../../agents/', import.meta.url));
}

export function getAgentSourceDir(agent: AgentName): string {
  return join(getSourceRoot(), AGENTS[agent].sourceDir, AGENTS[agent].skillName);
}

// ----------------------------------------------------------------------------
// Target dir resolution
// ----------------------------------------------------------------------------

export function getParentDir(agent: AgentName, scope: SkillScope): string {
  const spec = AGENTS[agent];
  return scope === 'user' ? join(homedir(), spec.parentDir) : join(process.cwd(), spec.parentDir);
}

export function getTargetDir(agent: AgentName, scope: SkillScope): string {
  const spec = AGENTS[agent];
  return join(getParentDir(agent, scope), spec.skillsSubdir, spec.skillName);
}

// ----------------------------------------------------------------------------
// Project-marker check for --scope project. We refuse to write into a directory that
// doesn't look like a project (no .git, no package.json, etc.) unless --force.
// ----------------------------------------------------------------------------

const PROJECT_MARKERS = [
  '.git',
  'package.json',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  '.gsccli.json',
];

export function looksLikeProjectRoot(dir: string = process.cwd()): boolean {
  return PROJECT_MARKERS.some((m) => existsSync(join(dir, m)));
}

// ----------------------------------------------------------------------------
// Recursive file enumeration
// ----------------------------------------------------------------------------

function listFilesRecursive(root: string, base: string = root): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full, base));
    } else if (entry.isFile()) {
      out.push(relative(base, full));
    }
  }
  return out.sort();
}

// ----------------------------------------------------------------------------
// Plan & install
// ----------------------------------------------------------------------------

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

interface PlanOptions {
  force: boolean;
}

export interface PlanResult {
  agent: AgentName;
  scope: SkillScope;
  targetDir: string;
  parentMissing: boolean;
  files: InstallFileChange[];
}

export function planInstall(agent: AgentName, scope: SkillScope, opts: PlanOptions): PlanResult {
  const sourceDir = getAgentSourceDir(agent);
  if (!existsSync(sourceDir)) {
    throw new Error(
      `Source skill package missing at ${sourceDir}. The npm tarball is incomplete; reinstall @nalyk/gsccli.`,
    );
  }

  const targetDir = getTargetDir(agent, scope);
  const parentDir = getParentDir(agent, scope);
  const parentMissing = !existsSync(parentDir);

  const sourceFiles = listFilesRecursive(sourceDir);
  const files: InstallFileChange[] = sourceFiles.map((rel) => {
    const sourcePath = join(sourceDir, rel);
    const targetPath = join(targetDir, rel);
    const sourceBytes = readFileSync(sourcePath);
    let status: InstallFileChange['status'];

    if (!existsSync(targetPath)) {
      status = 'new';
    } else {
      const targetBytes = readFileSync(targetPath);
      if (sha256(sourceBytes) === sha256(targetBytes)) {
        status = 'unchanged';
      } else {
        status = opts.force ? 'force-overwrite' : 'changed';
      }
    }

    return { relPath: rel, absPath: targetPath, size: sourceBytes.byteLength, status };
  });

  return { agent, scope, targetDir, parentMissing, files };
}

interface InstallOptions {
  dryRun: boolean;
  force: boolean;
}

export function installAgent(agent: AgentName, scope: SkillScope, opts: InstallOptions): InstallReport {
  const plan = planInstall(agent, scope, { force: opts.force });

  if (opts.dryRun) {
    return {
      agent,
      scope,
      targetDir: plan.targetDir,
      files: plan.files,
      dryRun: true,
      parentMissing: plan.parentMissing,
    };
  }

  if (plan.parentMissing) {
    throw new Error(
      `${AGENTS[agent].displayName} doesn't appear to be installed: ${getParentDir(agent, scope)} ` +
        `does not exist. Install ${AGENTS[agent].displayName} first, then re-run.`,
    );
  }

  const blockedChanges = plan.files.filter((f) => f.status === 'changed');
  if (!opts.force && blockedChanges.length > 0) {
    const list = blockedChanges.map((f) => `  - ${f.relPath}`).join('\n');
    throw new Error(
      `Refusing to overwrite ${blockedChanges.length} file(s) at ${plan.targetDir}:\n${list}\n\n` +
        'Pass --force to overwrite.',
    );
  }

  for (const file of plan.files) {
    if (file.status === 'unchanged') continue;
    const sourcePath = join(getAgentSourceDir(agent), file.relPath);
    mkdirSync(dirname(file.absPath), { recursive: true });
    writeFileSync(file.absPath, readFileSync(sourcePath));
  }

  return {
    agent,
    scope,
    targetDir: plan.targetDir,
    files: plan.files,
    dryRun: false,
    parentMissing: false,
  };
}

// ----------------------------------------------------------------------------
// Uninstall
// ----------------------------------------------------------------------------

export interface UninstallResult {
  agent: AgentName;
  scope: SkillScope;
  targetDir: string;
  removed: boolean;
}

export function uninstallAgent(agent: AgentName, scope: SkillScope): UninstallResult {
  const targetDir = getTargetDir(agent, scope);
  if (!existsSync(targetDir)) {
    return { agent, scope, targetDir, removed: false };
  }
  rmSync(targetDir, { recursive: true, force: true });
  return { agent, scope, targetDir, removed: true };
}

// ----------------------------------------------------------------------------
// Status — probe each (agent, scope) combination
// ----------------------------------------------------------------------------

export interface StatusEntry {
  agent: AgentName;
  scope: SkillScope;
  targetDir: string;
  installed: boolean;
  fileCount: number;
  inSync: boolean;
}

export function statusAgent(agent: AgentName, scope: SkillScope): StatusEntry {
  const targetDir = getTargetDir(agent, scope);
  if (!existsSync(targetDir)) {
    return { agent, scope, targetDir, installed: false, fileCount: 0, inSync: false };
  }
  try {
    const stat = statSync(targetDir);
    if (!stat.isDirectory()) {
      return { agent, scope, targetDir, installed: false, fileCount: 0, inSync: false };
    }
    const plan = planInstall(agent, scope, { force: false });
    const inSync = plan.files.every((f) => f.status === 'unchanged');
    return {
      agent,
      scope,
      targetDir,
      installed: true,
      fileCount: plan.files.length,
      inSync,
    };
  } catch {
    return { agent, scope, targetDir, installed: true, fileCount: 0, inSync: false };
  }
}

// ----------------------------------------------------------------------------
// Detect installed agents — used by --agent all
// ----------------------------------------------------------------------------

export function detectInstalledAgents(): AgentName[] {
  return (Object.keys(AGENTS) as AgentName[]).filter((name) => {
    const parent = join(homedir(), AGENTS[name].parentDir);
    return existsSync(parent);
  });
}

// Re-export for tests that want a defensive resolved-source path
export function resolvePackageRoot(): string {
  return resolve(getSourceRoot(), '..');
}
