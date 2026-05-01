import { homedir } from 'node:os';
import { join } from 'node:path';

// Global config dir. Honors `GSCCLI_CONFIG_DIR` for per-agent isolation when running
// multiple gsccli processes against different OAuth identities or test fixtures.
export const CONFIG_DIR = process.env.GSCCLI_CONFIG_DIR
  ? process.env.GSCCLI_CONFIG_DIR
  : join(homedir(), '.gsccli');

export const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

// Project-local config. Discovered by walking up from CWD until a `.gsccli.json` is
// found, stopping at $HOME and the filesystem root. JSON shape matches CLIConfig.
// Site-related and per-project preferences live here; auth keys live in the global file.
export const PROJECT_CONFIG_FILENAME = '.gsccli.json';

export interface CLIConfig {
  credentials?: string;
  site?: string;
  format?: 'table' | 'json' | 'ndjson' | 'csv' | 'chart';
  noColor?: boolean;
  verbose?: boolean;
  oauthClientSecretFile?: string;
}

export type ConfigScope = 'global' | 'local';

export const CONFIG_KEYS: Record<string, string> = {
  credentials: 'Path to Google service account credentials JSON file',
  site: 'Default Search Console site URL (e.g. https://example.com/ or sc-domain:example.com)',
  format: 'Default output format (table|json|ndjson|csv|chart)',
  noColor: 'Disable colored output (true|false)',
  verbose: 'Enable verbose logging (true|false)',
  oauthClientSecretFile: 'Path to OAuth client secret JSON file',
};

// Site-specific or per-project preferences default to the local file when set without
// an explicit scope. Auth-related keys default to the global file (machine-wide).
const LOCAL_BY_DEFAULT_KEYS: ReadonlySet<string> = new Set(['site', 'format', 'noColor', 'verbose']);

export function defaultScopeFor(key: string): ConfigScope {
  return LOCAL_BY_DEFAULT_KEYS.has(key) ? 'local' : 'global';
}
