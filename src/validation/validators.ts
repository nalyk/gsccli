import { ZodError, type ZodSchema } from 'zod';
import { logger } from '../utils/logger.js';
import { ensureValidSiteUrl } from '../utils/url-helpers.js';

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      const messages = err.errors.map((e) => `  ${e.path.join('.')}: ${e.message}`);
      logger.error('Validation failed:');
      for (const m of messages) {
        console.error(m);
      }
      process.exit(1);
    }
    throw err;
  }
}

export function validateSiteUrl(site: string): string {
  if (!site) {
    logger.error(
      'Site URL is required. Use -s <url> or set via:\n  gsccli config set site https://example.com/',
    );
    process.exit(1);
  }
  try {
    return ensureValidSiteUrl(site);
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
