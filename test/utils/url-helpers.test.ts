import { describe, expect, it } from 'vitest';
import { ensureValidSiteUrl, isDomainProperty, normalizeSiteUrl } from '../../src/utils/url-helpers.js';

describe('normalizeSiteUrl', () => {
  it('passes through a domain property as-is', () => {
    expect(normalizeSiteUrl('sc-domain:example.com')).toBe('sc-domain:example.com');
  });

  it('appends a trailing slash to URL-prefix without one', () => {
    expect(normalizeSiteUrl('https://example.com')).toBe('https://example.com/');
  });

  it('preserves trailing slash on URL-prefix', () => {
    expect(normalizeSiteUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('handles http:// (not just https://)', () => {
    expect(normalizeSiteUrl('http://example.com')).toBe('http://example.com/');
  });

  it('trims whitespace', () => {
    expect(normalizeSiteUrl('  https://example.com  ')).toBe('https://example.com/');
  });

  it('returns input as-is when no scheme is present (does NOT silently coerce)', () => {
    // Coercing "example.com" to "https://example.com/" would silently mismatch a
    // sc-domain:example.com property. Surface the issue at the call site.
    expect(normalizeSiteUrl('example.com')).toBe('example.com');
  });

  it('preserves empty input', () => {
    expect(normalizeSiteUrl('')).toBe('');
  });
});

describe('isDomainProperty', () => {
  it('detects sc-domain: prefix', () => {
    expect(isDomainProperty('sc-domain:example.com')).toBe(true);
  });

  it('returns false for URL-prefix property', () => {
    expect(isDomainProperty('https://example.com/')).toBe(false);
  });
});

describe('ensureValidSiteUrl', () => {
  it('returns the normalised URL for valid URL-prefix input', () => {
    expect(ensureValidSiteUrl('https://example.com')).toBe('https://example.com/');
  });

  it('returns the input unchanged for valid domain property', () => {
    expect(ensureValidSiteUrl('sc-domain:example.com')).toBe('sc-domain:example.com');
  });

  it('throws on bare hostname (no scheme, no sc-domain: prefix)', () => {
    expect(() => ensureValidSiteUrl('example.com')).toThrow(/Invalid site URL/);
  });

  it('throws on empty input', () => {
    expect(() => ensureValidSiteUrl('')).toThrow(/Site URL is required/);
  });
});
