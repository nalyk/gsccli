import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AGENTS,
  detectInstalledAgents,
  getAgentSourceDir,
  getParentDir,
  getSourceRoot,
  getTargetDir,
  installAgent,
  isValidAgent,
  looksLikeProjectRoot,
  planInstall,
  statusAgent,
  uninstallAgent,
} from '../../src/services/skills.service.js';
import type { AgentName, SkillScope } from '../../src/types/skills.js';

// Sandbox HOME and CWD per test so we never touch the real ~/.<cli>/ directories.
let sandboxHome: string;
let originalHome: string | undefined;
let originalCwd: string;

beforeEach(() => {
  sandboxHome = mkdtempSync(join(tmpdir(), 'gsccli-skills-test-'));
  originalHome = process.env.HOME;
  originalCwd = process.cwd();
  process.env.HOME = sandboxHome;
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  rmSync(sandboxHome, { recursive: true, force: true });
});

describe('AGENTS registry', () => {
  it('has the four expected agents', () => {
    expect(Object.keys(AGENTS).sort()).toEqual(['claude', 'codex', 'gemini', 'qwen']);
  });

  it('every agent points at a real source dir under agents/', () => {
    for (const name of Object.keys(AGENTS) as AgentName[]) {
      const src = getAgentSourceDir(name);
      expect(existsSync(join(src, 'SKILL.md'))).toBe(true);
    }
  });
});

describe('isValidAgent', () => {
  it('accepts the four canonical names', () => {
    for (const n of ['claude', 'codex', 'gemini', 'qwen']) {
      expect(isValidAgent(n)).toBe(true);
    }
  });

  it('rejects everything else', () => {
    for (const n of ['', 'all', 'cursor', 'cline', 'CLAUDE', 'claude-code']) {
      expect(isValidAgent(n)).toBe(false);
    }
  });
});

describe('getTargetDir', () => {
  it('user scope lands under HOME/.<cli>/skills/gsccli', () => {
    expect(getTargetDir('claude', 'user')).toBe(join(sandboxHome, '.claude/skills/gsccli'));
    expect(getTargetDir('codex', 'user')).toBe(join(sandboxHome, '.codex/skills/gsccli'));
    expect(getTargetDir('gemini', 'user')).toBe(join(sandboxHome, '.gemini/skills/gsccli'));
    expect(getTargetDir('qwen', 'user')).toBe(join(sandboxHome, '.qwen/skills/gsccli'));
  });

  it('project scope lands under CWD/.<cli>/skills/gsccli', () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'gsccli-skills-project-'));
    process.chdir(projectDir);
    try {
      for (const agent of Object.keys(AGENTS) as AgentName[]) {
        expect(getTargetDir(agent, 'project')).toBe(
          join(projectDir, AGENTS[agent].parentDir, 'skills', 'gsccli'),
        );
      }
    } finally {
      process.chdir(originalCwd);
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});

describe('getSourceRoot', () => {
  it('points at a directory containing all four agent dirs', () => {
    const root = getSourceRoot();
    for (const agent of Object.keys(AGENTS) as AgentName[]) {
      expect(existsSync(join(root, AGENTS[agent].sourceDir, 'gsccli'))).toBe(true);
    }
  });
});

describe('looksLikeProjectRoot', () => {
  it('false for an empty tmp dir', () => {
    const empty = mkdtempSync(join(tmpdir(), 'gsccli-empty-'));
    try {
      expect(looksLikeProjectRoot(empty)).toBe(false);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('true when a marker file exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gsccli-project-'));
    try {
      writeFileSync(join(dir, 'package.json'), '{}');
      expect(looksLikeProjectRoot(dir)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('detectInstalledAgents', () => {
  it('returns only agents whose ~/.<cli> dir exists', () => {
    expect(detectInstalledAgents()).toEqual([]);
    mkdirSync(join(sandboxHome, '.claude'));
    mkdirSync(join(sandboxHome, '.gemini'));
    expect(detectInstalledAgents().sort()).toEqual(['claude', 'gemini']);
  });
});

describe('planInstall', () => {
  beforeEach(() => {
    // Pretend Claude Code is installed
    mkdirSync(join(sandboxHome, '.claude'));
  });

  it('marks all files NEW on a clean install', () => {
    const plan = planInstall('claude', 'user', { force: false });
    expect(plan.parentMissing).toBe(false);
    expect(plan.files.length).toBeGreaterThan(0);
    for (const f of plan.files) {
      expect(f.status).toBe('new');
    }
  });

  it('reports parentMissing when ~/.<cli> is absent', () => {
    rmSync(join(sandboxHome, '.claude'), { recursive: true });
    const plan = planInstall('claude', 'user', { force: false });
    expect(plan.parentMissing).toBe(true);
  });
});

describe('installAgent', () => {
  beforeEach(() => {
    for (const agent of Object.keys(AGENTS) as AgentName[]) {
      mkdirSync(join(sandboxHome, AGENTS[agent].parentDir));
    }
  });

  it('writes SKILL.md to the target dir', () => {
    const report = installAgent('claude', 'user', { dryRun: false, force: false });
    expect(report.dryRun).toBe(false);
    const skillPath = join(getTargetDir('claude', 'user'), 'SKILL.md');
    expect(existsSync(skillPath)).toBe(true);
    expect(readFileSync(skillPath, 'utf-8')).toMatch(/^---\nname: gsccli\n/);
  });

  it('writes Codex agents/openai.yaml as well', () => {
    installAgent('codex', 'user', { dryRun: false, force: false });
    expect(existsSync(join(getTargetDir('codex', 'user'), 'agents', 'openai.yaml'))).toBe(true);
  });

  it('dry-run does not write', () => {
    const report = installAgent('claude', 'user', { dryRun: true, force: false });
    expect(report.dryRun).toBe(true);
    expect(existsSync(getTargetDir('claude', 'user'))).toBe(false);
  });

  it('is idempotent: re-install with no changes is a no-op', () => {
    installAgent('claude', 'user', { dryRun: false, force: false });
    const second = installAgent('claude', 'user', { dryRun: false, force: false });
    for (const f of second.files) {
      expect(f.status).toBe('unchanged');
    }
  });

  it('refuses to overwrite changed files without --force', () => {
    installAgent('claude', 'user', { dryRun: false, force: false });
    const skillPath = join(getTargetDir('claude', 'user'), 'SKILL.md');
    writeFileSync(skillPath, '---\nname: tampered\n---\n');
    expect(() => installAgent('claude', 'user', { dryRun: false, force: false })).toThrow(
      /Refusing to overwrite/,
    );
  });

  it('--force overwrites changed files', () => {
    installAgent('claude', 'user', { dryRun: false, force: false });
    const skillPath = join(getTargetDir('claude', 'user'), 'SKILL.md');
    writeFileSync(skillPath, '---\nname: tampered\n---\n');
    const report = installAgent('claude', 'user', { dryRun: false, force: true });
    const overwritten = report.files.find((f) => f.relPath === 'SKILL.md');
    expect(overwritten?.status).toBe('force-overwrite');
    expect(readFileSync(skillPath, 'utf-8')).toMatch(/^---\nname: gsccli\n/);
  });

  it('throws when parent CLI dir is missing (not dry-run)', () => {
    rmSync(join(sandboxHome, '.gemini'), { recursive: true });
    expect(() => installAgent('gemini', 'user', { dryRun: false, force: false })).toThrow(
      /Gemini CLI doesn't appear to be installed/,
    );
  });
});

describe('uninstallAgent', () => {
  it('removes the target dir if present', () => {
    mkdirSync(join(sandboxHome, '.claude'));
    installAgent('claude', 'user', { dryRun: false, force: false });
    const result = uninstallAgent('claude', 'user');
    expect(result.removed).toBe(true);
    expect(existsSync(getTargetDir('claude', 'user'))).toBe(false);
  });

  it('returns removed=false when nothing to remove', () => {
    const result = uninstallAgent('claude', 'user');
    expect(result.removed).toBe(false);
  });
});

describe('statusAgent', () => {
  beforeEach(() => {
    mkdirSync(join(sandboxHome, '.claude'));
  });

  it('reports not installed when nothing is there', () => {
    const status = statusAgent('claude', 'user');
    expect(status.installed).toBe(false);
    expect(status.fileCount).toBe(0);
    expect(status.inSync).toBe(false);
  });

  it('reports inSync after a fresh install', () => {
    installAgent('claude', 'user', { dryRun: false, force: false });
    const status = statusAgent('claude', 'user');
    expect(status.installed).toBe(true);
    expect(status.fileCount).toBeGreaterThan(0);
    expect(status.inSync).toBe(true);
  });

  it('reports out-of-sync after tampering', () => {
    installAgent('claude', 'user', { dryRun: false, force: false });
    writeFileSync(join(getTargetDir('claude', 'user'), 'SKILL.md'), 'tampered');
    const status = statusAgent('claude', 'user');
    expect(status.installed).toBe(true);
    expect(status.inSync).toBe(false);
  });
});

describe('getParentDir', () => {
  it('user scope respects HOME', () => {
    for (const agent of Object.keys(AGENTS) as AgentName[]) {
      expect(getParentDir(agent, 'user' as SkillScope)).toBe(join(sandboxHome, AGENTS[agent].parentDir));
    }
  });
});
