import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { URL } from 'node:url';
import { Command } from 'commander';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { GSC_SCOPES, resetAuth } from '../../services/auth.service.js';
import { getConfig } from '../../services/config.service.js';
import { loadClientSecrets, saveOAuthTokens } from '../../services/oauth.service.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';

export function createLoginCommand(): Command {
  return new Command('login')
    .description('Authenticate with Google via OAuth 2.0')
    .option('--client-secret-file <path>', 'Path to OAuth client secret JSON file')
    .action(async (opts) => {
      try {
        await runLogin(opts.clientSecretFile);
      } catch (error) {
        handleError(error);
      }
    });
}

async function runLogin(clientSecretFilePath?: string): Promise<void> {
  const secretPath = clientSecretFilePath ?? getConfig().oauthClientSecretFile;
  if (!secretPath) {
    logger.error(
      'No client secret file provided. Use --client-secret-file <path> or set it via:\n' +
        '  gsccli config set oauthClientSecretFile /path/to/client_secret.json',
    );
    process.exit(1);
  }

  const secrets = loadClientSecrets(secretPath);
  const { client_id, client_secret } = secrets.installed;

  const state = randomBytes(16).toString('hex');

  const { redirectUri, closeServer } = await startLoopbackServer(state);

  const oauth2Client = new OAuth2Client({ clientId: client_id, clientSecret: client_secret, redirectUri });
  const { codeVerifier, codeChallenge } = await oauth2Client.generateCodeVerifierAsync();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GSC_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
  });

  logger.info('Open this URL in your browser to authenticate:\n');
  console.log(authUrl);
  console.log();
  logger.info('Waiting for authentication callback (timeout: 120s)...');

  try {
    const code = await waitForCallback(closeServer, 120_000);

    const { tokens } = await oauth2Client.getToken({ code, codeVerifier });

    saveOAuthTokens({
      // biome-ignore lint/style/noNonNullAssertion: tokens.access_token must be present after a successful exchange
      access_token: tokens.access_token!,
      // biome-ignore lint/style/noNonNullAssertion: refresh_token granted by access_type=offline + prompt=consent
      refresh_token: tokens.refresh_token!,
      // biome-ignore lint/style/noNonNullAssertion: expiry_date is always set on a fresh exchange
      expiry_date: tokens.expiry_date!,
      token_type: tokens.token_type ?? 'Bearer',
      scope: tokens.scope ?? GSC_SCOPES.join(' '),
      client_id,
      client_secret,
    });

    resetAuth();
    logger.success('Authentication successful! OAuth tokens saved.');
  } catch (error) {
    if (error instanceof Error && error.message === 'TIMEOUT') {
      logger.error('Authentication timed out. Please try again.');
      process.exit(1);
    }
    throw error;
  }
}

interface LoopbackServer {
  redirectUri: string;
  closeServer: {
    promise: Promise<string>;
    resolve: (code: string) => void;
    reject: (err: Error) => void;
    server: ReturnType<typeof createServer>;
  };
}

function startLoopbackServer(expectedState: string): Promise<LoopbackServer> {
  return new Promise((resolveStart, rejectStart) => {
    let resolveCode: (code: string) => void;
    let rejectCode: (err: Error) => void;
    const promise = new Promise<string>((res, rej) => {
      resolveCode = res;
      rejectCode = rej;
    });

    const server = createServer((req, res) => {
      // biome-ignore lint/style/noNonNullAssertion: req.url is always defined for HTTP requests
      const url = new URL(req.url!, `http://${req.headers.host}`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Authentication failed</h1><p>You can close this tab.</p></body></html>');
        rejectCode?.(new Error(`OAuth error: ${error}`));
        server.close();
        return;
      }

      if (state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(
          '<html><body><h1>Invalid state</h1><p>Authentication failed. Please try again.</p></body></html>',
        );
        rejectCode?.(new Error('State mismatch — possible CSRF attack'));
        server.close();
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>No code received</h1><p>Authentication failed.</p></body></html>');
        rejectCode?.(new Error('No authorization code received'));
        server.close();
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        '<html><body><h1>Authentication successful!</h1><p>You can close this tab and return to the terminal.</p></body></html>',
      );
      resolveCode?.(code);
      server.close();
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        rejectStart(new Error('Failed to start loopback server'));
        return;
      }
      const port = addr.port;
      resolveStart({
        redirectUri: `http://127.0.0.1:${port}/callback`,
        // biome-ignore lint/style/noNonNullAssertion: resolveCode/rejectCode are assigned synchronously above
        closeServer: { promise, resolve: resolveCode!, reject: rejectCode!, server },
      });
    });

    server.on('error', (err) => {
      rejectStart(err);
    });
  });
}

function waitForCallback(closeServer: LoopbackServer['closeServer'], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      closeServer.server.close();
      reject(new Error('TIMEOUT'));
    }, timeoutMs);

    closeServer.promise
      .then((code) => {
        clearTimeout(timer);
        resolve(code);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
