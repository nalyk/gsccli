import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Spawn the dev binary via tsx against a sandboxed HOME so we never touch the
// real ~/.claude, ~/.codex, etc. The CLI surface (Commander wiring, --dry-run
// output formatting, --force semantics) is what we're validating here; the
// underlying logic is tested at the service level.
//
// Each spawn of `npx tsx` cold-starts the TypeScript loader (≈2-3 seconds), so
// these tests need a generous timeout. Service-level unit tests cover the same
// logic in milliseconds.

const SPAWN_TIMEOUT = 30_000;

const REPO_ROOT = resolve(process.cwd());
const ENTRY = resolve(REPO_ROOT, 'src/index.ts');

let sandboxHome: string;

beforeEach(() => {
  sandboxHome = mkdtempSync(join(tmpdir(), 'gsccli-cli-test-'));
});

afterEach(() => {
  rmSync(sandboxHome, { recursive: true, force: true });
});

function runGsccli(args: string[], cwd: string = REPO_ROOT) {
  return spawnSync('npx', ['tsx', ENTRY, ...args], {
    cwd,
    env: { ...process.env, HOME: sandboxHome },
    encoding: 'utf-8',
  });
}

describe('skills install --dry-run', () => {
  it('claude dry-run prints "Would install" and the target path', SPAWN_TIMEOUT, () => {
    const result = runGsccli(['skills', 'install', '--agent', 'claude', '--dry-run']);
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/Would install for agent=claude scope=user/);
    expect(result.stderr).toMatch(/\.claude\/skills\/gsccli\/SKILL\.md/);
    expect(result.stderr).toMatch(/permissions\.deny/);
  });

  it('codex dry-run includes both SKILL.md and agents/openai.yaml', SPAWN_TIMEOUT, () => {
    const result = runGsccli(['skills', 'install', '--agent', 'codex', '--dry-run']);
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/\.codex\/skills\/gsccli\/SKILL\.md/);
    expect(result.stderr).toMatch(/\.codex\/skills\/gsccli\/agents\/openai\.yaml/);
  });

  it('rejects unknown agent', SPAWN_TIMEOUT, () => {
    const result = runGsccli(['skills', 'install', '--agent', 'cursor', '--dry-run']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Invalid --agent cursor/);
  });

  it('rejects unknown scope', SPAWN_TIMEOUT, () => {
    const result = runGsccli([
      'skills',
      'install',
      '--agent',
      'claude',
      '--scope',
      'enterprise',
      '--dry-run',
    ]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Invalid --scope enterprise/);
  });

  it('all dry-run prints "no detected" message when sandbox HOME has no CLI dirs', SPAWN_TIMEOUT, () => {
    const result = runGsccli(['skills', 'install', '--agent', 'all', '--dry-run']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/No supported agent CLI detected/);
  });

  it('all dry-run finds detected CLIs', SPAWN_TIMEOUT, () => {
    mkdirSync(join(sandboxHome, '.claude'));
    mkdirSync(join(sandboxHome, '.gemini'));
    const result = runGsccli(['skills', 'install', '--agent', 'all', '--dry-run']);
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/Detected agents: Claude Code, Gemini CLI/);
  });
});

describe('skills install --scope project', () => {
  it('refuses when CWD has no project marker', SPAWN_TIMEOUT, () => {
    const empty = mkdtempSync(join(tmpdir(), 'gsccli-no-marker-'));
    try {
      const result = runGsccli(
        ['skills', 'install', '--agent', 'claude', '--scope', 'project', '--dry-run'],
        empty,
      );
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/does not look like a project root/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe('skills install (real write)', () => {
  it('writes SKILL.md when not dry-run', SPAWN_TIMEOUT, () => {
    mkdirSync(join(sandboxHome, '.claude'));
    const result = runGsccli(['skills', 'install', '--agent', 'claude']);
    expect(result.status).toBe(0);
    expect(existsSync(join(sandboxHome, '.claude/skills/gsccli/SKILL.md'))).toBe(true);
  });
});

describe('skills status / list', () => {
  it('list prints all four agents with source + user + project paths', SPAWN_TIMEOUT, () => {
    const result = runGsccli(['skills', 'list']);
    expect(result.status).toBe(0);
    for (const display of ['Claude Code', 'Codex CLI', 'Gemini CLI', 'Qwen Code']) {
      expect(result.stderr).toContain(display);
    }
  });

  it('status prints "not installed" for a fresh sandbox', SPAWN_TIMEOUT, () => {
    const result = runGsccli(['skills', 'status', '--agent', 'claude']);
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/not installed/);
  });
});
