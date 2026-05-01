import { Command } from 'commander';
import { formatOutput } from '../../formatters/index.js';
import { publishIndexingNotification } from '../../services/indexing.service.js';
import { type ReportData, resolveGlobalOptions, writeOutput } from '../../types/common.js';
import type { IndexingNotificationType } from '../../types/indexing.js';
import { parallelMapSettled } from '../../utils/concurrency.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';
import { readUrlList } from '../../utils/url-list.js';

// Default Indexing API quota: 200 requests/day per project (raisable on request).
// Conservative defaults so we don't hammer the quota: concurrency 3, ~3 RPS.
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_RPS = 3;
const DEFAULT_DAILY_BUDGET = 200;

export function createBatchCommand(): Command {
  return new Command('batch')
    .description('Publish many URL notifications in parallel with rate-pacing')
    .option('--urls-file <path>', 'File with one URL per line (#-prefixed lines ignored)')
    .option('--urls-stdin', 'Read URLs from stdin (one per line)')
    .option('--type <type>', 'URL_UPDATED (default) or URL_DELETED', 'URL_UPDATED')
    .option(
      '--concurrency <n>',
      `Parallel publishes (default ${DEFAULT_CONCURRENCY})`,
      String(DEFAULT_CONCURRENCY),
    )
    .option('--rps <n>', `Pool-wide rate limit (default ${DEFAULT_RPS})`, String(DEFAULT_RPS))
    .action(async (rawOpts, command) => {
      try {
        const globalOpts = resolveGlobalOptions(command);
        const type = rawOpts.type as IndexingNotificationType;
        if (type !== 'URL_UPDATED' && type !== 'URL_DELETED') {
          logger.error(`Invalid --type: "${rawOpts.type}". Use URL_UPDATED or URL_DELETED.`);
          process.exit(1);
        }

        const urls = await readUrlList(rawOpts);

        if (urls.length === 0) {
          logger.warn('No URLs to publish.');
          return;
        }

        if (urls.length > DEFAULT_DAILY_BUDGET) {
          logger.warn(
            `${urls.length} URLs exceeds the default Indexing API quota of ${DEFAULT_DAILY_BUDGET}/day per project. ` +
              'Either request a quota increase or split across days.',
          );
        }

        const concurrency = Math.max(1, Number.parseInt(rawOpts.concurrency, 10) || DEFAULT_CONCURRENCY);
        const rps = Math.max(0.1, Number.parseFloat(rawOpts.rps) || DEFAULT_RPS);
        const minIntervalMs = Math.ceil(1000 / rps);

        logger.info(
          `Publishing ${urls.length} ${type} notifications at concurrency=${concurrency}, rps=${rps}`,
        );

        const results = await parallelMapSettled(
          urls,
          async (url) => publishIndexingNotification({ url, type }),
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
          const r = results[i];
          if (!r.ok) {
            return [url, type, 'error', '', r.error.message];
          }
          const t = r.value.latestUpdate?.notifyTime ?? r.value.latestRemove?.notifyTime ?? '';
          return [url, type, 'ok', String(t), ''];
        });

        const data: ReportData = {
          headers: ['url', 'type', 'status', 'notifyTime', 'error'],
          rows,
          rowCount: rows.length,
        };

        const output = formatOutput(data, globalOpts.format);
        writeOutput(output, globalOpts);

        const errorCount = results.filter((r) => !r.ok).length;
        if (errorCount > 0) {
          logger.warn(`${errorCount} of ${urls.length} notifications failed (see "error" column).`);
        } else {
          logger.success(`Published ${urls.length} notifications successfully.`);
        }
      } catch (error) {
        handleError(error);
      }
    });
}
