import { Command } from 'commander';
import { OAuth2Client } from 'google-auth-library';
import { resetAuth } from '../../services/auth.service.js';
import { deleteOAuthTokens, loadOAuthTokens } from '../../services/oauth.service.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';

export function createLogoutCommand(): Command {
  return new Command('logout')
    .description('Remove saved OAuth tokens')
    .option('--revoke', 'Revoke the token at Google before deleting')
    .action(async (opts) => {
      try {
        await runLogout(opts.revoke);
      } catch (error) {
        handleError(error);
      }
    });
}

async function runLogout(revoke?: boolean): Promise<void> {
  const tokens = loadOAuthTokens();
  if (!tokens) {
    logger.info('No OAuth tokens found. Nothing to do.');
    return;
  }

  if (revoke) {
    try {
      const oauth2Client = new OAuth2Client({
        clientId: tokens.client_id,
        clientSecret: tokens.client_secret,
      });
      await oauth2Client.revokeToken(tokens.access_token);
      logger.success('Token revoked at Google.');
    } catch {
      logger.warn('Failed to revoke token at Google (it may already be expired).');
    }
  }

  deleteOAuthTokens();
  resetAuth();
  logger.success('OAuth tokens removed.');
}
