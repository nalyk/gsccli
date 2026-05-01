import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_DIR } from '../types/config.js';
import { logger } from '../utils/logger.js';

// File-backed query cache. Senior SEOs iterate on the same queries dozens of times while
// drafting reports — caching saves quota AND turns a 1-2s API call into a millisecond
// disk read. Disabled by default; opted-in per command via --cache <ttl>.
//
// Layout: ~/.gsccli/cache/<sha256>.json — each file is { cachedAt, ttlMs, payload }.
// We don't shard or LRU; cache is small, content-addressable, and easily wiped with
// `rm -rf ~/.gsccli/cache`.

const CACHE_DIR = join(CONFIG_DIR, 'cache');

interface CacheEntry<T> {
  cachedAt: number;
  ttlMs: number;
  payload: T;
}

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

export function cacheKey(parts: unknown): string {
  const json = JSON.stringify(parts, Object.keys(parts as object).sort());
  return createHash('sha256').update(json).digest('hex');
}

export function cacheGet<T>(key: string): T | undefined {
  try {
    const file = join(CACHE_DIR, `${key}.json`);
    if (!existsSync(file)) return undefined;
    const raw = readFileSync(file, 'utf-8');
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.cachedAt > entry.ttlMs) {
      return undefined;
    }
    return entry.payload;
  } catch {
    return undefined;
  }
}

export function cacheSet<T>(key: string, payload: T, ttlMs: number): void {
  try {
    ensureCacheDir();
    const entry: CacheEntry<T> = { cachedAt: Date.now(), ttlMs, payload };
    writeFileSync(join(CACHE_DIR, `${key}.json`), JSON.stringify(entry), 'utf-8');
  } catch (err) {
    // A failed cache write is non-fatal — log and continue.
    logger.debug(`cache write failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function withCache<T>(
  key: string,
  ttlMs: number | undefined,
  loader: () => Promise<T>,
): Promise<T> {
  if (!ttlMs || ttlMs <= 0) return loader();
  const hit = cacheGet<T>(key);
  if (hit !== undefined) {
    logger.debug(`cache hit: ${key.slice(0, 8)}…`);
    return hit;
  }
  const value = await loader();
  cacheSet(key, value, ttlMs);
  return value;
}

// "1h", "30m", "10s", "2d" → ms; a bare number (no unit) is interpreted as raw ms.
export function parseTtl(input: string | undefined): number | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  const m = trimmed.match(/^(\d+)\s*([smhd])$/);
  if (!m) {
    throw new Error(`Invalid TTL: "${input}". Use "30s", "10m", "1h", "2d", or a number of milliseconds.`);
  }
  const n = Number.parseInt(m[1], 10);
  const unit = m[2];
  const mult: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * mult[unit];
}
