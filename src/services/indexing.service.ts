import type { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { google, type indexing_v3 } from 'googleapis';
import type { IndexingPublishParams, IndexingUrlNotificationMetadata } from '../types/indexing.js';
import { withRetry } from '../utils/retry.js';
import { getAuthClientOptions } from './auth.service.js';

function pickAuthArg(opts: { authClient: OAuth2Client } | { auth: GoogleAuth }): OAuth2Client | GoogleAuth {
  return 'authClient' in opts ? opts.authClient : opts.auth;
}

let indexingClient: indexing_v3.Indexing | null = null;

function getIndexing(): indexing_v3.Indexing {
  if (!indexingClient) {
    indexingClient = google.indexing({ version: 'v3', auth: pickAuthArg(getAuthClientOptions()) });
  }
  return indexingClient;
}

export async function publishIndexingNotification(
  params: IndexingPublishParams,
): Promise<IndexingUrlNotificationMetadata> {
  const response = await withRetry(
    () =>
      getIndexing().urlNotifications.publish({
        requestBody: { url: params.url, type: params.type },
      }),
    { label: 'indexing.urlNotifications.publish' },
  );
  return (response.data.urlNotificationMetadata ?? {}) as IndexingUrlNotificationMetadata;
}

export async function getIndexingNotificationMetadata(url: string): Promise<IndexingUrlNotificationMetadata> {
  const response = await withRetry(() => getIndexing().urlNotifications.getMetadata({ url }), {
    label: 'indexing.urlNotifications.getMetadata',
  });
  return response.data as IndexingUrlNotificationMetadata;
}
