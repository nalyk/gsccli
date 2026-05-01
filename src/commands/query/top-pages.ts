import type { Command } from 'commander';
import { createConvenienceQueryCommand } from './_factory.js';

export function createTopPagesCommand(): Command {
  return createConvenienceQueryCommand({
    name: 'top-pages',
    description: 'Top landing pages (defaults: last 28 days, sorted by clicks desc)',
    dimension: 'page',
    spinnerLabel: 'Loading top pages...',
  });
}
