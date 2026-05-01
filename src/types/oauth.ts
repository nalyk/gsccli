import { join } from 'node:path';
import { CONFIG_DIR } from './config.js';

export const OAUTH_TOKENS_FILE = join(CONFIG_DIR, 'oauth-tokens.json');

export interface StoredOAuthTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type: string;
  scope: string;
  client_id: string;
  client_secret: string;
}

export interface OAuthClientSecrets {
  installed: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
    auth_uri: string;
    token_uri: string;
  };
}
