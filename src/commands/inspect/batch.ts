import { Command } from 'commander';
import { formatOutput } from '../../formatters/index.js';
import { inspectUrl } from '../../services/searchconsole.service.js';
import { type ReportData, resolveGlobalOptions, writeOutput } from '../../types/common.js';
import { parallelMapSettled } from '../../utils/concurrency.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';
import { readUrlList } from '../../utils/url-list.js';
import { validateSiteUrl } from '../../validation/validators.js';

// GSC URL Inspection quotas: 600 QPM, 2000/day per property. We default to 8 RPS
// (≈480 QPM, conservative) and cap concurrency at 5. Both are tunable.
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_RPS = 8;
const DAILY_QUOTA = 2000;

interface InspectionRow {
  url: string;
  verdict: string;
  coverageState: string;
  indexingState: string;
  lastCrawlTime: string;
  googleCanonical: string;
  userCanonical: string;
  crawledAs: string;
  mobileVerdict: string;
  richResultsVerdict: string;
  ampVerdict: string;
  error: string;
}

export function createBatchCommand(): Command {
  return new Command('batch')
    .description('Inspect many URLs in parallel with rate-pacing and resume-friendly output')
    .option('--urls-file <path>', 'File with one URL per line (#-prefixed lines ignored)')
    .option('--urls-stdin', 'Read URLs from stdin (one per line)')
    .option(
      '--concurrency <n>',
      `Parallel inspections (default ${DEFAULT_CONCURRENCY})`,
      String(DEFAULT_CONCURRENCY),
    )
    .option(
      '--rps <n>',
      `Pool-wide rate limit in requests/second (default ${DEFAULT_RPS})`,
      String(DEFAULT_RPS),
    )
    .option('--language-code <code>', 'BCP-47 code (e.g. en-US) for translated descriptions')
    .action(async (rawOpts, command) => {
      try {
        const globalOpts = resolveGlobalOptions(command);
        const siteUrl = validateSiteUrl(globalOpts.site);

        const urls = await readUrlList(rawOpts);

        if (urls.length === 0) {
          logger.warn('No URLs to inspect.');
          return;
        }

        if (urls.length > DAILY_QUOTA) {
          logger.warn(
            `${urls.length} URLs exceeds the GSC daily URL Inspection quota of ${DAILY_QUOTA}/site. ` +
              'The run will likely hit 429 partway through; consider splitting across days.',
          );
        }

        const concurrency = Math.max(1, Number.parseInt(rawOpts.concurrency, 10) || DEFAULT_CONCURRENCY);
        const rps = Math.max(0.1, Number.parseFloat(rawOpts.rps) || DEFAULT_RPS);
        const minIntervalMs = Math.ceil(1000 / rps);

        logger.info(`Inspecting ${urls.length} URLs at concurrency=${concurrency}, rps=${rps}`);

        const results = await parallelMapSettled(
          urls,
          async (url) => inspectUrl({ siteUrl, inspectionUrl: url, languageCode: rawOpts.languageCode }),
          {
            concurrency,
            minIntervalMs,
            onProgress: (done, total) => {
              if (done === total || done % 10 === 0) {
                logger.debug(`progress: ${done}/${total}`);
              }
            },
          },
        );

        const rows: string[][] = urls.map((url, i) => {
          const result = results[i];
          if (!result.ok) {
            const empty: InspectionRow = {
              url,
              verdict: '',
              coverageState: '',
              indexingState: '',
              lastCrawlTime: '',
              googleCanonical: '',
              userCanonical: '',
              crawledAs: '',
              mobileVerdict: '',
              richResultsVerdict: '',
              ampVerdict: '',
              error: result.error.message,
            };
            return Object.values(empty).map(String);
          }

          const inspection = result.value.inspectionResult ?? {};
          const idx = inspection.indexStatusResult ?? {};
          const mobile = inspection.mobileUsabilityResult ?? {};
          const rich = inspection.richResultsResult ?? {};
          const amp = inspection.ampResult ?? {};

          const filled: InspectionRow = {
            url,
            verdict: String(idx.verdict ?? ''),
            coverageState: String(idx.coverageState ?? ''),
            indexingState: String(idx.indexingState ?? ''),
            lastCrawlTime: String(idx.lastCrawlTime ?? ''),
            googleCanonical: String(idx.googleCanonical ?? ''),
            userCanonical: String(idx.userCanonical ?? ''),
            crawledAs: String(idx.crawledAs ?? ''),
            mobileVerdict: String(mobile.verdict ?? ''),
            richResultsVerdict: String(rich.verdict ?? ''),
            ampVerdict: String(amp.verdict ?? ''),
            error: '',
          };
          return Object.values(filled);
        });

        const headers = [
          'url',
          'verdict',
          'coverageState',
          'indexingState',
          'lastCrawlTime',
          'googleCanonical',
          'userCanonical',
          'crawledAs',
          'mobileVerdict',
          'richResultsVerdict',
          'ampVerdict',
          'error',
        ];

        const data: ReportData = { headers, rows, rowCount: rows.length };

        const output = formatOutput(data, globalOpts.format);
        writeOutput(output, globalOpts);

        const errorCount = results.filter((r) => !r.ok).length;
        if (errorCount > 0) {
          logger.warn(`${errorCount} of ${urls.length} URLs failed inspection (see "error" column).`);
        } else {
          logger.success(`Inspected ${urls.length} URLs successfully.`);
        }
      } catch (error) {
        handleError(error);
      }
    });
}
