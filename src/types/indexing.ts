// Google Indexing API surface — separate API from Search Console, but bundled with every
// serious GSC tool. Restricted by Google policy to job-posting and livestream-broadcast
// pages, but senior SEOs running those sites depend on it.
//
// API host: https://indexing.googleapis.com
// Scope:    https://www.googleapis.com/auth/indexing
// Quota:    200 requests/day default; can be raised.

export type IndexingNotificationType = 'URL_UPDATED' | 'URL_DELETED';

export interface IndexingPublishParams {
  url: string;
  type: IndexingNotificationType;
}

export interface IndexingUrlNotificationMetadata {
  url?: string;
  latestUpdate?: { url?: string; type?: string; notifyTime?: string };
  latestRemove?: { url?: string; type?: string; notifyTime?: string };
}

export interface IndexingPublishResponse {
  urlNotificationMetadata?: IndexingUrlNotificationMetadata;
}
