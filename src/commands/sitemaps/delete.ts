import { Command } from 'commander';
import { deleteSitemap } from '../../services/searchconsole.service.js';
import { resolveGlobalOptions } from '../../types/common.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';
import { validateSiteUrl } from '../../validation/validators.js';

export function createDeleteCommand(): Command {
  return new Command('delete')
    .description('Remove a sitemap from Search Console')
    .argument('<feedpath>', 'Sitemap feed URL')
    .action(async (feedpath: string, _opts, command) => {
      try {
        const globalOpts = resolveGlobalOptions(command);
        const siteUrl = validateSiteUrl(globalOpts.site);
        await deleteSitemap(siteUrl, feedpath);
        logger.success(`Deleted sitemap: ${feedpath}`);
      } catch (error) {
        handleError(error);
      }
    });
}
