import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
  type CLIConfig,
  CONFIG_DIR,
  CONFIG_FILE,
  CONFIG_KEYS,
  type ConfigScope,
  PROJECT_CONFIG_FILENAME,
} from '../types/config.js';

// ----------------------------------------------------------------------------
// Atomic write — write to <path>.tmp.<pid> then rename(). On POSIX, rename() is
// atomic, so concurrent readers either see the old file or the new one — never
// a torn intermediate. Critical for ~/.gsccli/oauth-tokens.json which is rewritten
// on every access-token refresh; without atomicity, two parallel agents can produce
// a corrupt file.
// ----------------------------------------------------------------------------

interface AtomicWriteOptions {
  mode?: number;
}

export function atomicWrite(path: string, content: string, opts: AtomicWriteOptions = {}): void {
  const tmp = `${path}.tmp.${process.pid}`;
  try {
    writeFileSync(tmp, content, { encoding: 'utf-8', mode: opts.mode });
    renameSync(tmp, path);
  } catch (err) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      // best-effort cleanup
    }
    throw err;
  }
}

// ----------------------------------------------------------------------------
// Project-local config discovery
// ----------------------------------------------------------------------------

// Walk up from `startDir` looking for a project config. Stops at $HOME and the
// filesystem root so we don't escape into siblings or the user's global config dir.
export function findProjectConfigFile(startDir: string = process.cwd()): string | undefined {
  const home = resolve(homedir());
  let dir = resolve(startDir);
  while (true) {
    if (dir === home) return undefined;
    const candidate = join(dir, PROJECT_CONFIG_FILENAME);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function readJsonOrEmpty(path: string): CLIConfig {
  try {
    if (existsSync(path)) {
      const raw = readFileSync(path, 'utf-8');
      return JSON.parse(raw) as CLIConfig;
    }
  } catch {
    // Silent fall-through — torn reads, malformed JSON, missing perms.
  }
  return {};
}

// ----------------------------------------------------------------------------
// Layered reads
// ----------------------------------------------------------------------------

export function getGlobalConfig(): CLIConfig {
  return readJsonOrEmpty(CONFIG_FILE);
}

export function getProjectConfig(): CLIConfig {
  const projectFile = findProjectConfigFile();
  return projectFile ? readJsonOrEmpty(projectFile) : {};
}

export function getProjectConfigFile(): string | undefined {
  return findProjectConfigFile();
}

// Merged effective config — project values override global. Per-flag overrides
// happen one level up in `resolveGlobalOptions`; env-var overrides happen there too.
export function getConfig(): CLIConfig {
  return { ...getGlobalConfig(), ...getProjectConfig() };
}

// ----------------------------------------------------------------------------
// Scope-aware writes
// ----------------------------------------------------------------------------

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function coerceConfigValue(key: string, value: string): string | boolean {
  if (key === 'noColor' || key === 'verbose') return value === 'true';
  return value;
}

function writeGlobalConfig(config: CLIConfig): void {
  ensureConfigDir();
  atomicWrite(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function writeProjectConfig(path: string, config: CLIConfig): void {
  atomicWrite(path, JSON.stringify(config, null, 2));
}

export interface SetConfigResult {
  scope: ConfigScope;
  file: string;
}

export function setConfigValue(key: string, value: string, scope: ConfigScope): SetConfigResult {
  if (!(key in CONFIG_KEYS)) {
    throw new Error(`Unknown config key: ${key}. Valid keys: ${Object.keys(CONFIG_KEYS).join(', ')}`);
  }
  const coerced = coerceConfigValue(key, value);

  if (scope === 'global') {
    const config = getGlobalConfig();
    (config as Record<string, unknown>)[key] = coerced;
    writeGlobalConfig(config);
    return { scope, file: CONFIG_FILE };
  }

  // Local: write to existing project config if found, else create one in CWD.
  // Guard: CWD === $HOME would create ~/.gsccli.json, which the walk-up explicitly stops
  // at $HOME and never finds — the file would be orphan. Refuse with a clear message.
  const cwd = resolve(process.cwd());
  const home = resolve(homedir());
  if (!findProjectConfigFile() && cwd === home) {
    throw new Error(
      'Refusing to create .gsccli.json directly in $HOME — the walk-up stops there, so the file would never be discovered.\n' +
        'Run `config set` from a project subdirectory, or pass --global to write ~/.gsccli/config.json instead.',
    );
  }
  const file = findProjectConfigFile() ?? join(cwd, PROJECT_CONFIG_FILENAME);
  const config = readJsonOrEmpty(file);
  (config as Record<string, unknown>)[key] = coerced;
  writeProjectConfig(file, config);
  return { scope, file };
}

// ----------------------------------------------------------------------------
// Reads with provenance — used by `config get` and `config list` to show users
// where each effective value came from.
// ----------------------------------------------------------------------------

export type ConfigSource = 'project' | 'global' | '(not set)';

export interface ResolvedConfigValue {
  value: string | undefined;
  source: ConfigSource;
}

export function getConfigValue(key: string): string | undefined {
  return resolveConfigValue(key).value;
}

export function resolveConfigValue(key: string): ResolvedConfigValue {
  const project = getProjectConfig();
  const projectVal = (project as Record<string, unknown>)[key];
  if (projectVal !== undefined) return { value: String(projectVal), source: 'project' };

  const global = getGlobalConfig();
  const globalVal = (global as Record<string, unknown>)[key];
  if (globalVal !== undefined) return { value: String(globalVal), source: 'global' };

  return { value: undefined, source: '(not set)' };
}

export function listConfig(): {
  effective: CLIConfig;
  global: CLIConfig;
  project: CLIConfig;
  projectFile: string | undefined;
  globalFile: string;
} {
  const global = getGlobalConfig();
  const project = getProjectConfig();
  return {
    effective: { ...global, ...project },
    global,
    project,
    projectFile: findProjectConfigFile(),
    globalFile: CONFIG_FILE,
  };
}
