import { describe, expect, it } from 'vitest';
import { cacheKey, parseTtl } from '../../src/services/cache.service.js';

describe('cacheKey', () => {
  it('is stable for identical input', () => {
    const a = cacheKey({ siteUrl: 'https://example.com/', startDate: '2025-01-01' });
    const b = cacheKey({ siteUrl: 'https://example.com/', startDate: '2025-01-01' });
    expect(a).toBe(b);
  });

  it('differs for different input', () => {
    const a = cacheKey({ siteUrl: 'https://example.com/' });
    const b = cacheKey({ siteUrl: 'https://other.com/' });
    expect(a).not.toBe(b);
  });

  it('produces a hex sha256 digest', () => {
    const k = cacheKey({ x: 1 });
    expect(k).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('parseTtl', () => {
  it('parses seconds', () => {
    expect(parseTtl('30s')).toBe(30_000);
  });

  it('parses minutes', () => {
    expect(parseTtl('10m')).toBe(600_000);
  });

  it('parses hours', () => {
    expect(parseTtl('2h')).toBe(7_200_000);
  });

  it('parses days', () => {
    expect(parseTtl('3d')).toBe(259_200_000);
  });

  it('treats bare numbers as milliseconds', () => {
    expect(parseTtl('5000')).toBe(5000);
  });

  it('returns undefined for empty input', () => {
    expect(parseTtl(undefined)).toBeUndefined();
    expect(parseTtl('')).toBeUndefined();
  });

  it('throws on garbage', () => {
    expect(() => parseTtl('what')).toThrow(/Invalid TTL/);
  });
});
