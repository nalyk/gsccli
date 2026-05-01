import { existsSync } from 'node:fs';
import { Command } from 'commander';
import { getActiveAuthMode, resolveCredentialsPath } from '../../services/auth.service.js';
import { loadOAuthTokens } from '../../services/oauth.service.js';
import { OAUTH_TOKENS_FILE } from '../../types/oauth.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';

export function createStatusCommand(): Command {
  return new Command('status').description('Show active authentication method').action(() => {
    try {
      runStatus();
    } catch (error) {
      handleError(error);
    }
  });
}

function runStatus(): void {
  const mode = getActiveAuthMode();

  if (mode === 'oauth') {
    const tokens = loadOAuthTokens();
    logger.info('Auth method: OAuth 2.0');
    logger.info(`Token file:  ${OAUTH_TOKENS_FILE}`);
    if (tokens?.expiry_date) {
      const expiry = new Date(tokens.expiry_date);
      const isExpired = expiry.getTime() < Date.now();
      logger.info(
        `Expiry:      ${expiry.toISOString()}${isExpired ? ' (expired — will refresh on next use)' : ''}`,
      );
    }
    if (tokens?.scope) {
      logger.info(`Scopes:      ${tokens.scope}`);
    }
  } else {
    const credPath = resolveCredentialsPath();
    logger.info('Auth method:      Service account');
    if (!credPath) {
      logger.warn(
        'No credentials configured. Run `gsccli auth login` or set a service account via:\n  gsccli config set credentials /path/to/service-account.json',
      );
    } else {
      logger.info(`Credentials file: ${credPath}`);
      if (!existsSync(credPath)) {
        logger.warn('Credentials file does not exist.');
      }
    }
  }
}
