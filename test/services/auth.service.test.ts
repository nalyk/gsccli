import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/oauth.service.js', () => ({
  loadOAuthTokens: vi.fn(),
  saveOAuthTokens: vi.fn(),
}));
vi.mock('../../src/services/config.service.js', () => ({
  getConfig: vi.fn(),
}));

const { loadOAuthTokens } = await import('../../src/services/oauth.service.js');
const { getConfig } = await import('../../src/services/config.service.js');
const auth = await import('../../src/services/auth.service.js');

const mockedLoadTokens = vi.mocked(loadOAuthTokens);
const mockedGetConfig = vi.mocked(getConfig);

describe('auth.service resolution chain', () => {
  beforeEach(() => {
    auth.resetAuth();
    mockedLoadTokens.mockReset();
    mockedGetConfig.mockReset();
    mockedGetConfig.mockReturnValue({});
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  });

  afterEach(() => {
    auth.resetAuth();
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  });

  it('priority 1: OAuth tokens win even when service-account env+config are present', () => {
    mockedLoadTokens.mockReturnValue({
      access_token: 'a',
      refresh_token: 'r',
      client_id: 'cid',
      client_secret: 'csec',
      expiry_date: 9999999999999,
      token_type: 'Bearer',
      scope: '',
    });
    mockedGetConfig.mockReturnValue({ credentials: '/path/to/sa.json' });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/env/sa.json';

    const opts = auth.getAuthClientOptions();
    expect(opts).toHaveProperty('authClient');
    expect(opts).not.toHaveProperty('auth');
    expect(auth.getActiveAuthMode()).toBe('oauth');
  });

  it('priority 2: env var GOOGLE_APPLICATION_CREDENTIALS used when no OAuth tokens and no config', () => {
    mockedLoadTokens.mockReturnValue(null);
    mockedGetConfig.mockReturnValue({});
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/env/sa.json';

    const opts = auth.getAuthClientOptions();
    expect(opts).toHaveProperty('auth');
    expect(opts).not.toHaveProperty('authClient');
    expect(auth.getActiveAuthMode()).toBe('service-account');
  });

  it('priority 3: env var beats config when both are set', () => {
    mockedLoadTokens.mockReturnValue(null);
    mockedGetConfig.mockReturnValue({ credentials: '/config/sa.json' });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/env/sa.json';

    expect(auth.resolveCredentialsPath()).toBe('/env/sa.json');
  });

  it('priority 4: config.credentials used when env missing', () => {
    mockedLoadTokens.mockReturnValue(null);
    mockedGetConfig.mockReturnValue({ credentials: '/config/sa.json' });

    expect(auth.resolveCredentialsPath()).toBe('/config/sa.json');
  });

  it('throws with actionable message when no credentials configured at all', () => {
    mockedLoadTokens.mockReturnValue(null);
    mockedGetConfig.mockReturnValue({});

    expect(() => auth.getAuthClientOptions()).toThrow(/No credentials configured/);
    expect(() => auth.getAuthClientOptions()).toThrow(/gsccli auth login/);
  });

  it('caches resolved options across calls (singleton)', () => {
    mockedLoadTokens.mockReturnValue({
      access_token: 'a',
      refresh_token: 'r',
      client_id: 'cid',
      client_secret: 'csec',
      expiry_date: 9999999999999,
      token_type: 'Bearer',
      scope: '',
    });

    const a = auth.getAuthClientOptions();
    const b = auth.getAuthClientOptions();
    expect(a).toBe(b);
    expect(mockedLoadTokens).toHaveBeenCalledTimes(1);
  });

  it('resetAuth() clears the cache so a new call re-resolves', () => {
    mockedLoadTokens.mockReturnValue({
      access_token: 'a',
      refresh_token: 'r',
      client_id: 'cid',
      client_secret: 'csec',
      expiry_date: 9999999999999,
      token_type: 'Bearer',
      scope: '',
    });

    auth.getAuthClientOptions();
    auth.resetAuth();
    auth.getAuthClientOptions();
    expect(mockedLoadTokens).toHaveBeenCalledTimes(2);
  });

  it('exports the expected GSC + Indexing OAuth scopes', () => {
    expect(auth.GSC_SCOPES).toEqual([
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/webmasters',
      'https://www.googleapis.com/auth/indexing',
    ]);
  });
});
