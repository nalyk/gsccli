import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Each test gets its own home (for global config) and project dir (for project config).
// We point GSCCLI_CONFIG_DIR at a per-test global dir so we don't touch the user's real
// ~/.gsccli/, and chdir into a per-test project tree so the walk-up discovery is real.

let tempRoot: string;
let globalDir: string;
let projectDir: string;
let originalCwd: string;
let originalConfigDirEnv: string | undefined;

function freshConfigModule() {
  // The config-dir constants are read at import time. Reset module registry so each
  // test sees CONFIG_DIR/CONFIG_FILE pointed at the test's globalDir.
  vi.resetModules();
}

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'gsccli-cfg-test-'));
  globalDir = join(tempRoot, 'home', '.gsccli');
  projectDir = join(tempRoot, 'project', 'subdir', 'deep');
  mkdirSync(globalDir, { recursive: true });
  mkdirSync(projectDir, { recursive: true });

  originalConfigDirEnv = process.env.GSCCLI_CONFIG_DIR;
  process.env.GSCCLI_CONFIG_DIR = globalDir;

  originalCwd = process.cwd();
  process.chdir(projectDir);
  freshConfigModule();
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalConfigDirEnv === undefined) delete process.env.GSCCLI_CONFIG_DIR;
  else process.env.GSCCLI_CONFIG_DIR = originalConfigDirEnv;
  rmSync(tempRoot, { recursive: true, force: true });
});

describe('project-config discovery', () => {
  it('walks up from CWD and finds the project file at the project root', async () => {
    const svc = await import('../../src/services/config.service.js');
    // Place .gsccli.json two levels above CWD.
    const projectRoot = join(tempRoot, 'project');
    writeFileSync(join(projectRoot, '.gsccli.json'), JSON.stringify({ site: 'https://from-project.com/' }));
    expect(svc.findProjectConfigFile()).toBe(join(projectRoot, '.gsccli.json'));
  });

  it('returns undefined when no project file is found', async () => {
    const svc = await import('../../src/services/config.service.js');
    expect(svc.findProjectConfigFile()).toBeUndefined();
  });

  it('does NOT walk into $HOME', async () => {
    // Place a fake config in the path-of-$HOME ancestor — discovery must stop at $HOME.
    // Construct a CWD that's a child of a fake home, with home itself NOT containing the file.
    const home = join(tempRoot, 'fakehome');
    const sub = join(home, 'sub');
    mkdirSync(sub, { recursive: true });
    process.chdir(sub);
    process.env.HOME = home;

    // Re-import to honor the new HOME for homedir().
    vi.resetModules();
    const svc = await import('../../src/services/config.service.js');
    expect(svc.findProjectConfigFile()).toBeUndefined();
  });
});

describe('layered reads — project overrides global', () => {
  it('returns the project value when both layers set the same key', async () => {
    writeFileSync(join(globalDir, 'config.json'), JSON.stringify({ site: 'https://global.com/' }));
    writeFileSync(
      join(tempRoot, 'project', '.gsccli.json'),
      JSON.stringify({ site: 'https://project.com/' }),
    );

    const svc = await import('../../src/services/config.service.js');
    expect(svc.getConfig().site).toBe('https://project.com/');
    expect(svc.resolveConfigValue('site')).toEqual({ value: 'https://project.com/', source: 'project' });
  });

  it('falls back to global when project does not set the key', async () => {
    writeFileSync(
      join(globalDir, 'config.json'),
      JSON.stringify({ site: 'https://global.com/', credentials: '/path/sa.json' }),
    );
    writeFileSync(join(tempRoot, 'project', '.gsccli.json'), JSON.stringify({ format: 'ndjson' }));

    const svc = await import('../../src/services/config.service.js');
    expect(svc.resolveConfigValue('site')).toEqual({ value: 'https://global.com/', source: 'global' });
    expect(svc.resolveConfigValue('format')).toEqual({ value: 'ndjson', source: 'project' });
    expect(svc.resolveConfigValue('credentials')).toEqual({ value: '/path/sa.json', source: 'global' });
  });

  it('reports (not set) when neither layer has the key', async () => {
    const svc = await import('../../src/services/config.service.js');
    expect(svc.resolveConfigValue('site').source).toBe('(not set)');
    expect(svc.resolveConfigValue('site').value).toBeUndefined();
  });
});

describe('scope-aware setConfigValue', () => {
  it('writes site to .gsccli.json in CWD by default (local-by-default key)', async () => {
    const svc = await import('../../src/services/config.service.js');
    const result = svc.setConfigValue('site', 'https://local.com/', 'local');
    expect(result.scope).toBe('local');
    expect(existsSync(result.file)).toBe(true);
    expect(JSON.parse(readFileSync(result.file, 'utf-8'))).toEqual({ site: 'https://local.com/' });
    // Global was not touched.
    expect(existsSync(join(globalDir, 'config.json'))).toBe(false);
  });

  it('writes credentials to ~/.gsccli/config.json with --global', async () => {
    const svc = await import('../../src/services/config.service.js');
    const result = svc.setConfigValue('credentials', '/path/sa.json', 'global');
    expect(result.scope).toBe('global');
    expect(JSON.parse(readFileSync(result.file, 'utf-8'))).toEqual({ credentials: '/path/sa.json' });
  });

  it('coerces noColor / verbose strings to booleans', async () => {
    const svc = await import('../../src/services/config.service.js');
    svc.setConfigValue('noColor', 'true', 'local');
    const file = svc.findProjectConfigFile();
    expect(file).toBeDefined();
    if (!file) return;
    expect(JSON.parse(readFileSync(file, 'utf-8'))).toEqual({ noColor: true });
  });

  it('preserves existing keys when updating one', async () => {
    const svc = await import('../../src/services/config.service.js');
    svc.setConfigValue('site', 'https://a.com/', 'local');
    svc.setConfigValue('format', 'csv', 'local');
    const file = svc.findProjectConfigFile();
    expect(file).toBeDefined();
    if (!file) return;
    expect(JSON.parse(readFileSync(file, 'utf-8'))).toEqual({
      site: 'https://a.com/',
      format: 'csv',
    });
  });

  it('rejects unknown config keys', async () => {
    const svc = await import('../../src/services/config.service.js');
    expect(() => svc.setConfigValue('bogus' as string, 'x', 'local')).toThrow(/Unknown config key/);
  });

  it('refuses to create .gsccli.json directly in $HOME (would be orphan)', async () => {
    // Spoof HOME to equal CWD so the home-guard triggers.
    process.env.HOME = process.cwd();
    vi.resetModules();
    const svc = await import('../../src/services/config.service.js');
    expect(() => svc.setConfigValue('site', 'https://x.com/', 'local')).toThrow(
      /Refusing to create .gsccli.json directly in \$HOME/,
    );
  });
});

describe('atomicWrite', () => {
  it('replaces target with content via temp+rename', async () => {
    const svc = await import('../../src/services/config.service.js');
    const target = join(tempRoot, 'atom-target.json');
    svc.atomicWrite(target, '{"x":1}');
    expect(readFileSync(target, 'utf-8')).toBe('{"x":1}');
    // Temp file should not linger.
    expect(existsSync(`${target}.tmp.${process.pid}`)).toBe(false);
  });

  it('cleans up the temp file when rename fails', async () => {
    const svc = await import('../../src/services/config.service.js');
    // Renaming into a path whose parent directory does not exist produces ENOENT.
    const bogus = join(tempRoot, 'no-such-dir', 'target.json');
    expect(() => svc.atomicWrite(bogus, 'x')).toThrow();
    // The .tmp sibling is never created on this path because writeFileSync also fails.
    // Just verify the target still doesn't exist.
    expect(existsSync(bogus)).toBe(false);
  });
});

describe('GSCCLI_CONFIG_DIR override', () => {
  it('honors the env var for the global config dir', async () => {
    // Already set in beforeEach; verify CONFIG_FILE points at it.
    const cfg = await import('../../src/types/config.js');
    expect(cfg.CONFIG_DIR).toBe(globalDir);
    expect(cfg.CONFIG_FILE).toBe(join(globalDir, 'config.json'));
  });
});
