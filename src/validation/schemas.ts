import { z } from 'zod';

export const dimensionEnum = z.enum(['query', 'page', 'country', 'device', 'date', 'searchAppearance']);
export const searchTypeEnum = z.enum(['web', 'image', 'video', 'news', 'discover', 'googleNews']);
export const dataStateEnum = z.enum(['final', 'all']);
export const aggregationTypeEnum = z.enum(['auto', 'byPage', 'byProperty']);

export const outputFormatSchema = z.enum(['table', 'json', 'ndjson', 'csv', 'chart']);

// Defaults for date/dataState are applied at the Commander layer (.option(default)) so that
// Zod inference yields plain `string` rather than `string | undefined`. Commander always
// supplies a value before validation, so requiring them here is safe.
export const queryRunOptsSchema = z.object({
  dimensions: z.array(z.string()).optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  searchType: searchTypeEnum.optional(),
  type: searchTypeEnum.optional(),
  dataState: dataStateEnum,
  aggregationType: aggregationTypeEnum.optional(),
  rowLimit: z.number().int().min(1).max(25000).optional(),
  startRow: z.number().int().min(0).optional(),
  filter: z.array(z.string()).optional(),
  filterJson: z.string().optional(),
});

export const queryConvenienceOptsSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  searchType: searchTypeEnum.optional(),
  type: searchTypeEnum.optional(),
  dataState: dataStateEnum,
  rowLimit: z.number().int().min(1).max(25000).optional(),
  filter: z.array(z.string()).optional(),
});

export const queryBatchOptsSchema = z.object({
  requests: z.string().min(1, 'Path to JSON requests file is required'),
});

export const sitemapsSubmitOptsSchema = z.object({
  // siteUrl comes from -s; sitemap URL is positional
});

export const inspectUrlOptsSchema = z.object({
  languageCode: z.string().optional(),
});
