import { Command } from 'commander';
import { submitSitemap } from '../../services/searchconsole.service.js';
import { resolveGlobalOptions } from '../../types/common.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';
import { validateSiteUrl } from '../../validation/validators.js';

export function createSubmitCommand(): Command {
  return new Command('submit')
    .description('Submit (or resubmit) a sitemap')
    .argument('<feedpath>', 'Sitemap feed URL')
    .action(async (feedpath: string, _opts, command) => {
      try {
        const globalOpts = resolveGlobalOptions(command);
        const siteUrl = validateSiteUrl(globalOpts.site);
        await submitSitemap(siteUrl, feedpath);
        logger.success(`Submitted sitemap: ${feedpath}`);
      } catch (error) {
        handleError(error);
      }
    });
}
