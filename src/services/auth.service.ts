import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { getConfig } from './config.service.js';
import { loadOAuthTokens, saveOAuthTokens } from './oauth.service.js';

// Search Console + Indexing API scopes:
//  - webmasters.readonly  → search analytics, sites list, sitemaps list/get, urlInspection
//  - webmasters           → adds sites add/delete, sitemaps submit/delete
//  - indexing             → adds Indexing API (URL_UPDATED / URL_DELETED notifications)
// We request all three at login so the same refresh token covers every gsccli command.
// Existing users from earlier versions need to re-run `gsccli auth login` to upgrade.
export const GSC_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/indexing',
];

export function resolveCredentialsPath(): string | undefined {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
  const config = getConfig();
  if (config.credentials) {
    return config.credentials;
  }
  return undefined;
}

type AuthOptions = { authClient: OAuth2Client } | { auth: GoogleAuth };

let cachedAuthOptions: AuthOptions | null = null;

export function getAuthClientOptions(): AuthOptions {
  if (cachedAuthOptions) return cachedAuthOptions;

  const tokens = loadOAuthTokens();
  if (tokens) {
    const oauth2Client = new OAuth2Client({
      clientId: tokens.client_id,
      clientSecret: tokens.client_secret,
    });
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      token_type: tokens.token_type,
    });
    oauth2Client.on('tokens', (newTokens) => {
      saveOAuthTokens({
        access_token: newTokens.access_token ?? tokens.access_token,
        refresh_token: newTokens.refresh_token ?? tokens.refresh_token,
        expiry_date: newTokens.expiry_date ?? tokens.expiry_date,
        token_type: newTokens.token_type ?? tokens.token_type,
        scope: newTokens.scope ?? tokens.scope,
        client_id: tokens.client_id,
        client_secret: tokens.client_secret,
      });
    });
    cachedAuthOptions = { authClient: oauth2Client };
    return cachedAuthOptions;
  }

  const keyFile = resolveCredentialsPath();
  if (!keyFile) {
    throw new Error(
      'No credentials configured. Run `gsccli auth login` for OAuth or set a service account via:\n' +
        '  gsccli config set credentials /path/to/service-account.json',
    );
  }
  const auth = new GoogleAuth({ keyFile, scopes: GSC_SCOPES });
  cachedAuthOptions = { auth };
  return cachedAuthOptions;
}

export function getActiveAuthMode(): 'oauth' | 'service-account' {
  const tokens = loadOAuthTokens();
  return tokens ? 'oauth' : 'service-account';
}

export function resetAuth(): void {
  cachedAuthOptions = null;
}
