import { logger } from './logger.js';

// Search Console errors come from googleapis (HTTP-based, not gRPC). Retry only on
// transient failures — 429 (rate limit) and 5xx server errors. Never retry on 4xx
// client errors, which always re-fail with the same input.
const RETRYABLE_HTTP_CODES = new Set([429, 500, 502, 503, 504]);

const DEFAULT_MAX_RETRIES = Number(process.env.GSCCLI_MAX_RETRIES ?? 3);
const DEFAULT_BASE_MS = Number(process.env.GSCCLI_RETRY_BASE_MS ?? 500);

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  label?: string;
}

interface MaybeHttpError {
  code?: number | string;
  status?: number;
  response?: { status?: number };
}

function extractHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as MaybeHttpError;
  if (typeof e.code === 'number') return e.code;
  if (typeof e.code === 'string' && /^\d+$/.test(e.code)) return Number.parseInt(e.code, 10);
  if (typeof e.status === 'number') return e.status;
  if (typeof e.response?.status === 'number') return e.response.status;
  return undefined;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = opts.baseDelayMs ?? DEFAULT_BASE_MS;
  const label = opts.label ?? 'request';

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = extractHttpStatus(err);
      const retriable = status !== undefined && RETRYABLE_HTTP_CODES.has(status);
      if (!retriable || attempt === maxRetries) {
        throw err;
      }
      // Exponential backoff with full jitter: random in [0, base * 2^attempt]
      const cap = baseDelayMs * 2 ** attempt;
      const delay = Math.floor(Math.random() * cap);
      logger.debug(
        `${label} failed with HTTP ${status} (attempt ${attempt + 1}/${maxRetries + 1}); retrying in ${delay}ms`,
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}
