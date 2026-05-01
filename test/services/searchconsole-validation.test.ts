import { describe, expect, it } from 'vitest';
import { validateSearchAnalyticsParams } from '../../src/services/searchconsole.service.js';

describe('validateSearchAnalyticsParams', () => {
  it('accepts a normal query', () => {
    expect(() =>
      validateSearchAnalyticsParams({
        siteUrl: 'https://example.com/',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        dimensions: ['query', 'page'],
      }),
    ).not.toThrow();
  });

  it('rejects searchAppearance combined with another dimension', () => {
    expect(() =>
      validateSearchAnalyticsParams({
        siteUrl: 'https://example.com/',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        dimensions: ['searchAppearance', 'query'],
      }),
    ).toThrow(/searchAppearance.*cannot be combined/);
  });

  it('accepts searchAppearance alone', () => {
    expect(() =>
      validateSearchAnalyticsParams({
        siteUrl: 'https://example.com/',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        dimensions: ['searchAppearance'],
      }),
    ).not.toThrow();
  });

  it('rejects type=discover with the query dimension', () => {
    expect(() =>
      validateSearchAnalyticsParams({
        siteUrl: 'https://example.com/',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        type: 'discover',
        dimensions: ['query'],
      }),
    ).toThrow(/`query` dimension is not available.*discover/);
  });

  it('accepts type=discover with page dimension', () => {
    expect(() =>
      validateSearchAnalyticsParams({
        siteUrl: 'https://example.com/',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        type: 'discover',
        dimensions: ['page'],
      }),
    ).not.toThrow();
  });

  it('rejects rowLimit beyond the GSC ceiling of 25000', () => {
    expect(() =>
      validateSearchAnalyticsParams({
        siteUrl: 'https://example.com/',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        rowLimit: 50000,
      }),
    ).toThrow(/exceeds the GSC API maximum.*--all/);
  });

  it('accepts rowLimit at the ceiling', () => {
    expect(() =>
      validateSearchAnalyticsParams({
        siteUrl: 'https://example.com/',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        rowLimit: 25000,
      }),
    ).not.toThrow();
  });
});
