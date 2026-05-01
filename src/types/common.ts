import { writeFileSync } from 'node:fs';
import type { Command } from 'commander';
import { getConfig } from '../services/config.service.js';
import { logger } from '../utils/logger.js';

export type OutputFormat = 'table' | 'json' | 'ndjson' | 'csv' | 'chart';

export interface GlobalOptions {
  site: string;
  format: OutputFormat;
  output?: string;
  noColor: boolean;
  verbose: boolean;
}

export interface ReportData {
  headers: string[];
  rows: string[][];
  rowCount: number;
  metadata?: Record<string, unknown>;
}

// Resolution chain for every effective option:
//   1. CLI flag (always wins)
//   2. Environment variable (per-shell override; GSC_SITE_URL is the only one today)
//   3. Project-local `.gsccli.json` (discovered by walking up from CWD)
//   4. Global `~/.gsccli/config.json`
//
// `getConfig()` returns the project-overrides-global merged shape; env wins over both.
export function resolveGlobalOptions(cmd: Command): GlobalOptions {
  const opts = cmd.optsWithGlobals();
  const config = getConfig();

  const site = opts.site || process.env.GSC_SITE_URL || config.site || '';
  const format = opts.format || config.format || 'table';
  const noColor = opts.noColor ?? config.noColor ?? false;
  const verbose = opts.verbose ?? config.verbose ?? false;
  const output = opts.output;

  if (verbose) {
    logger.setVerbose(true);
  }
  if (noColor) {
    logger.setNoColor(true);
  }

  return { site, format: format as OutputFormat, output, noColor, verbose };
}

export function writeOutput(content: string, options: GlobalOptions): void {
  if (options.output) {
    writeFileSync(options.output, content, 'utf-8');
    logger.success(`Output written to ${options.output}`);
  } else {
    console.log(content);
  }
}
