import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { formatOutput } from '../../formatters/index.js';
import { batchSearchAnalytics } from '../../services/searchconsole.service.js';
import { type ReportData, resolveGlobalOptions, writeOutput } from '../../types/common.js';
import type { BatchSearchAnalyticsRequest, SearchAnalyticsQueryParams } from '../../types/searchconsole.js';
import { handleError } from '../../utils/error-handler.js';
import { createSpinner } from '../../utils/spinner.js';
import { queryBatchOptsSchema } from '../../validation/schemas.js';
import { validate, validateSiteUrl } from '../../validation/validators.js';

export function createBatchCommand(): Command {
  return new Command('batch')
    .description('Run multiple Search Analytics queries from a JSON file')
    .requiredOption('--requests <path>', 'Path to JSON file: array of SearchAnalyticsQueryParams')
    .action(async (rawOpts, command) => {
      try {
        const globalOpts = resolveGlobalOptions(command);
        const siteUrl = validateSiteUrl(globalOpts.site);
        const opts = validate(queryBatchOptsSchema, rawOpts);

        const json = readFileSync(opts.requests, 'utf-8');
        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed)) {
          throw new Error('Requests file must contain a JSON array of SearchAnalyticsQueryParams.');
        }

        // Inject siteUrl from -s if not present in each request — convenience for batch files
        // that target the same site.
        const requests: SearchAnalyticsQueryParams[] = parsed.map((r: SearchAnalyticsQueryParams) => ({
          ...r,
          siteUrl: r.siteUrl ?? siteUrl,
        }));

        const spinner = createSpinner(`Running ${requests.length} queries...`);
        spinner.start();
        const results = await batchSearchAnalytics({ requests } as BatchSearchAnalyticsRequest);
        spinner.stop();

        // Concatenate outputs separated by an empty line per report. Each carries its own header.
        const sections = results.map((data: ReportData, i: number) => {
          const sep = `\n--- report ${i + 1} of ${results.length} ---\n`;
          return sep + formatOutput(data, globalOpts.format);
        });
        writeOutput(sections.join('\n'), globalOpts);
      } catch (error) {
        handleError(error);
      }
    });
}
