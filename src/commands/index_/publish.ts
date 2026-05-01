import { Command } from 'commander';
import { publishIndexingNotification } from '../../services/indexing.service.js';
import { resolveGlobalOptions } from '../../types/common.js';
import type { IndexingNotificationType } from '../../types/indexing.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';

export function createPublishCommand(): Command {
  return new Command('publish')
    .description('Notify Google about a URL update or deletion')
    .argument('<url>', 'URL to notify Google about')
    .option('--type <type>', 'Notification type: URL_UPDATED (default) or URL_DELETED', 'URL_UPDATED')
    .action(async (url: string, opts: { type: string }, command: Command) => {
      try {
        resolveGlobalOptions(command);
        const type = opts.type as IndexingNotificationType;
        if (type !== 'URL_UPDATED' && type !== 'URL_DELETED') {
          logger.error(`Invalid --type: "${opts.type}". Use URL_UPDATED or URL_DELETED.`);
          process.exit(1);
        }
        const meta = await publishIndexingNotification({ url, type });
        logger.success(`Notification accepted: ${url} (${type})`);
        if (meta.latestUpdate?.notifyTime) {
          logger.info(`Notify time: ${meta.latestUpdate.notifyTime}`);
        }
      } catch (error) {
        handleError(error);
      }
    });
}
