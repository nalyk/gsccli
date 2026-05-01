import { Command } from 'commander';
import { deleteSite } from '../../services/searchconsole.service.js';
import { resolveGlobalOptions } from '../../types/common.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';
import { ensureValidSiteUrl } from '../../utils/url-helpers.js';

export function createDeleteCommand(): Command {
  return new Command('delete')
    .description("Remove a site from the user's Search Console (does not affect site verification)")
    .argument('<siteUrl>', 'Site URL')
    .action(async (siteUrlArg: string, _opts, command) => {
      try {
        resolveGlobalOptions(command);
        const siteUrl = ensureValidSiteUrl(siteUrlArg);
        await deleteSite(siteUrl);
        logger.success(`Removed site: ${siteUrl}`);
      } catch (error) {
        handleError(error);
      }
    });
}
