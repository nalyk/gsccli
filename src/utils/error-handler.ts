import { logger } from './logger.js';

// googleapis surfaces errors as GaxiosError-like objects with a numeric .code (HTTP status)
// and an .errors array of { message, domain, reason }. Some plain Error paths (auth-library,
// JSON parsing) surface only .message — we fall through to that case below.
interface GoogleApiLikeError extends Error {
  code?: number | string;
  status?: number;
  errors?: Array<{ message?: string; reason?: string; domain?: string }>;
  response?: { data?: unknown; status?: number };
}

function extractHttpStatus(err: GoogleApiLikeError): number | undefined {
  if (typeof err.code === 'number') return err.code;
  if (typeof err.code === 'string' && /^\d+$/.test(err.code)) return Number.parseInt(err.code, 10);
  if (typeof err.status === 'number') return err.status;
  if (typeof err.response?.status === 'number') return err.response.status;
  return undefined;
}

function extractApiMessage(err: GoogleApiLikeError): string {
  if (err.errors && err.errors.length > 0) {
    return (
      err.errors
        .map((e) => e.message)
        .filter(Boolean)
        .join('; ') || err.message
    );
  }
  return err.message;
}

export function handleError(error: unknown): never {
  if (error instanceof Error) {
    const apiError = error as GoogleApiLikeError;
    const status = extractHttpStatus(apiError);
    const message = extractApiMessage(apiError);

    if (status !== undefined) {
      switch (status) {
        case 400:
          logger.error(`Invalid argument: ${message}`);
          process.exit(3);
          break;
        case 401:
          logger.error(
            `Unauthenticated: ${message}. Check credentials or run \`gsccli auth login\` to re-authenticate.`,
          );
          process.exit(16);
          break;
        case 403:
          logger.error(
            `Permission denied: ${message}. Verify the service account / OAuth user has access to the site.`,
          );
          process.exit(7);
          break;
        case 404:
          logger.error(`Not found: ${message}`);
          process.exit(5);
          break;
        case 409:
          logger.error(`Conflict: ${message}`);
          process.exit(9);
          break;
        case 429:
          logger.error(`Rate limit exceeded: ${message}. Try again later or set GSCCLI_MAX_RETRIES higher.`);
          process.exit(8);
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          logger.error(`Search Console API server error (${status}): ${message}`);
          process.exit(14);
          break;
        default:
          logger.error(`API error (${status}): ${message}`);
          process.exit(1);
      }
    }

    logger.error(message);
    if (error.stack && process.env.GSCCLI_VERBOSE === '1') {
      console.error(error.stack);
    }
  } else {
    logger.error(String(error));
  }
  process.exit(1);
}
