import { Command } from 'commander';
import { formatOutput } from '../../formatters/index.js';
import { inspectUrl } from '../../services/searchconsole.service.js';
import { type ReportData, resolveGlobalOptions, writeOutput } from '../../types/common.js';
import { handleError } from '../../utils/error-handler.js';
import { createSpinner } from '../../utils/spinner.js';
import { validateSiteUrl } from '../../validation/validators.js';

export function createUrlCommand(): Command {
  return new Command('url')
    .description('Inspect a URL — index status, last crawl, mobile usability, AMP, rich-result eligibility')
    .argument('<inspectionUrl>', 'URL to inspect (must belong to the site)')
    .option('--language-code <code>', 'BCP-47 language code (e.g. en-US) for translated descriptions')
    .action(async (inspectionUrl: string, opts, command) => {
      try {
        const globalOpts = resolveGlobalOptions(command);
        const siteUrl = validateSiteUrl(globalOpts.site);

        const spinner = createSpinner(`Inspecting ${inspectionUrl}...`);
        spinner.start();
        const result = await inspectUrl({ siteUrl, inspectionUrl, languageCode: opts.languageCode });
        spinner.stop();

        // For JSON/NDJSON, emit the full inspection payload directly — readers want every
        // field. For table/csv/chart we surface a flattened summary of the most useful
        // fields; the full payload still rides along as `metadata`.
        if (globalOpts.format === 'json' || globalOpts.format === 'ndjson') {
          writeOutput(JSON.stringify(result, null, 2), globalOpts);
          return;
        }

        const inspection = result.inspectionResult ?? {};
        const indexStatus = inspection.indexStatusResult ?? {};
        const mobileUsability = inspection.mobileUsabilityResult ?? {};
        const richResults = inspection.richResultsResult ?? {};
        const amp = inspection.ampResult ?? {};

        const summaryRows: string[][] = [
          ['inspectionResultLink', String(inspection.inspectionResultLink ?? '')],
          ['indexStatus.verdict', String(indexStatus.verdict ?? '')],
          ['indexStatus.coverageState', String(indexStatus.coverageState ?? '')],
          ['indexStatus.indexingState', String(indexStatus.indexingState ?? '')],
          ['indexStatus.lastCrawlTime', String(indexStatus.lastCrawlTime ?? '')],
          ['indexStatus.googleCanonical', String(indexStatus.googleCanonical ?? '')],
          ['indexStatus.userCanonical', String(indexStatus.userCanonical ?? '')],
          ['indexStatus.crawledAs', String(indexStatus.crawledAs ?? '')],
          ['mobileUsability.verdict', String(mobileUsability.verdict ?? '')],
          ['richResults.verdict', String(richResults.verdict ?? '')],
          ['amp.verdict', String(amp.verdict ?? '')],
        ];

        const data: ReportData = {
          headers: ['field', 'value'],
          rows: summaryRows,
          rowCount: summaryRows.length,
          metadata: result as Record<string, unknown>,
        };

        const output = formatOutput(data, globalOpts.format);
        writeOutput(output, globalOpts);
      } catch (error) {
        handleError(error);
      }
    });
}
