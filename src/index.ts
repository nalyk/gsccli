#!/usr/bin/env node

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

const program = new Command();

program
  .name('gsccli')
  .description('Google Search Console CLI tool')
  .version('1.1.0')
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

program.parse();
