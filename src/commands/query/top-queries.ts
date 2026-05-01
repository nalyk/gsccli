import type { Command } from 'commander';
import { createConvenienceQueryCommand } from './_factory.js';

export function createTopQueriesCommand(): Command {
  return createConvenienceQueryCommand({
    name: 'top-queries',
    description: 'Top search queries (defaults: last 28 days, sorted by clicks desc)',
    dimension: 'query',
    spinnerLabel: 'Loading top queries...',
  });
}
