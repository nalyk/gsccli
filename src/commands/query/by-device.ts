import type { Command } from 'commander';
import { createConvenienceQueryCommand } from './_factory.js';

export function createByDeviceCommand(): Command {
  return createConvenienceQueryCommand({
    name: 'by-device',
    description: 'Search performance by device (DESKTOP, MOBILE, TABLET)',
    dimension: 'device',
    spinnerLabel: 'Loading device breakdown...',
  });
}
