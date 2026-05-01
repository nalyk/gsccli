import { Command } from 'commander';
import { addSite } from '../../services/searchconsole.service.js';
import { resolveGlobalOptions } from '../../types/common.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';
import { ensureValidSiteUrl } from '../../utils/url-helpers.js';

export function createAddCommand(): Command {
  return new Command('add')
    .description("Add a site to the user's Search Console — verification still required afterwards")
    .argument('<siteUrl>', 'Site URL (https://example.com/ or sc-domain:example.com)')
    .action(async (siteUrlArg: string, _opts, command) => {
      try {
        // resolveGlobalOptions runs for parity with other commands — keeps -v/--no-color flags wired.
        resolveGlobalOptions(command);
        const siteUrl = ensureValidSiteUrl(siteUrlArg);
        await addSite(siteUrl);
        logger.success(`Added site: ${siteUrl}`);
        logger.info(
          'Reminder: the site still needs to be verified in Search Console before you can query it.',
        );
      } catch (error) {
        handleError(error);
      }
    });
}
