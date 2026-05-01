import type { Command } from 'commander';
import { createConvenienceQueryCommand } from './_factory.js';

export function createByCountryCommand(): Command {
  return createConvenienceQueryCommand({
    name: 'by-country',
    description: 'Search performance by country (ISO-3166-1 alpha-3, lowercase: usa, gbr, fra, ...)',
    dimension: 'country',
    spinnerLabel: 'Loading country breakdown...',
  });
}
