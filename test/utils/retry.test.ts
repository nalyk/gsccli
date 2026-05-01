import { describe, expect, it, vi } from 'vitest';
import { withRetry } from '../../src/utils/retry.js';

function httpError(status: number, message = 'API error'): Error {
  const err = new Error(message) as Error & { code: number };
  err.code = status;
  return err;
}

describe('withRetry', () => {
  it('returns the result on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    expect(await withRetry(fn, { maxRetries: 3, baseDelayMs: 1 })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on HTTP 429 (rate limit)', async () => {
    const fn = vi.fn().mockRejectedValueOnce(httpError(429)).mockResolvedValueOnce('ok');
    expect(await withRetry(fn, { maxRetries: 3, baseDelayMs: 1 })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on HTTP 503 (service unavailable)', async () => {
    const fn = vi.fn().mockRejectedValueOnce(httpError(503)).mockResolvedValueOnce('ok');
    expect(await withRetry(fn, { maxRetries: 3, baseDelayMs: 1 })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on HTTP 400 (client error)', async () => {
    const fn = vi.fn().mockRejectedValue(httpError(400, 'bad request'));
    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 1 })).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on HTTP 403 (permission denied)', async () => {
    const fn = vi.fn().mockRejectedValue(httpError(403));
    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 1 })).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxRetries on persistent retryable failure', async () => {
    const fn = vi.fn().mockRejectedValue(httpError(429));
    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('extracts status from response.status on Gaxios-style errors', async () => {
    const err = new Error('boom') as Error & { response: { status: number } };
    err.response = { status: 502 };
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce('ok');
    expect(await withRetry(fn, { maxRetries: 3, baseDelayMs: 1 })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry when no status is extractable', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('plain error'));
    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 1 })).rejects.toThrow('plain error');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
