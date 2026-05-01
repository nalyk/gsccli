// Domain-level type definitions for the Search Console API surface that gsccli exposes.
// These are intentionally a thin, friendly wrapper around the raw REST shapes — when
// the SDK boundary needs the full proto-like type, we cast there, not here.

export type SearchAnalyticsDimension = 'query' | 'page' | 'country' | 'device' | 'date' | 'searchAppearance';

export type SearchType = 'web' | 'image' | 'video' | 'news' | 'discover' | 'googleNews';

export type DataState = 'final' | 'all';

export type AggregationType = 'auto' | 'byPage' | 'byProperty';

export type DimensionFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'includingRegex'
  | 'excludingRegex';

export interface DimensionFilter {
  dimension: SearchAnalyticsDimension;
  operator: DimensionFilterOperator;
  expression: string;
}

export interface DimensionFilterGroup {
  groupType: 'and';
  filters: DimensionFilter[];
}

export interface SearchAnalyticsQueryParams {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: SearchAnalyticsDimension[];
  searchType?: SearchType;
  type?: SearchType;
  dataState?: DataState;
  aggregationType?: AggregationType;
  dimensionFilterGroups?: DimensionFilterGroup[];
  rowLimit?: number;
  startRow?: number;
}

export interface BatchSearchAnalyticsRequest {
  requests: SearchAnalyticsQueryParams[];
}

// Sites
export interface SiteEntry {
  siteUrl: string;
  permissionLevel: string;
}

// Sitemaps
export interface SitemapContent {
  type?: string;
  submitted?: string;
  indexed?: string;
}

export interface Sitemap {
  path?: string;
  lastSubmitted?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  type?: string;
  lastDownloaded?: string;
  warnings?: string;
  errors?: string;
  contents?: SitemapContent[];
}

// URL Inspection (subset of fields we expose)
export interface UrlInspectionParams {
  siteUrl: string;
  inspectionUrl: string;
  languageCode?: string;
}
