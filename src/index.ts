#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { createAuthCommand } from './commands/auth/index.js';
import { createConfigCommand } from './commands/config/index.js';
import { createExploreCommand } from './commands/explore/index.js';
import { createIndexingCommand } from './commands/index_/index.js';
import { createInspectCommand } from './commands/inspect/index.js';
import { createMcpCommand } from './commands/mcp/index.js';
import { createQueryCommand } from './commands/query/index.js';
import { createSitemapsCommand } from './commands/sitemaps/index.js';
import { createSitesCommand } from './commands/sites/index.js';
import { createSkillsCommand } from './commands/skills/index.js';

// Read version from package.json at runtime so it can never drift from npm metadata.
// In dev (`tsx src/index.ts`): src/ → ../package.json = repo root.
// In prod (`node dist/index.js`): dist/ → ../package.json = package install root.
// Both resolve to the same package.json that `npm` published.
const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf-8'),
) as { version: string };

const program = new Command();

program
  .name('gsccli')
  .description('Google Search Console CLI tool')
  .version(pkg.version)
  .option('-s, --site <url>', 'Search Console site URL (https://example.com/ or sc-domain:example.com)')
  .option('-f, --format <format>', 'Output format: table, json, ndjson, csv, chart', 'table')
  .option('-o, --output <file>', 'Write output to file')
  .option('--no-color', 'Disable colored output')
  .option('-v, --verbose', 'Enable verbose logging');

program.addCommand(createQueryCommand());
program.addCommand(createSitesCommand());
program.addCommand(createSitemapsCommand());
program.addCommand(createInspectCommand());
program.addCommand(createIndexingCommand());
program.addCommand(createConfigCommand());
program.addCommand(createAuthCommand());
program.addCommand(createExploreCommand());
program.addCommand(createMcpCommand());
program.addCommand(createSkillsCommand());

program.parse();
