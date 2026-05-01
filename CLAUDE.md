# gsccli — Operating Contract

TypeScript ESM CLI for Google Search Console + Indexing API. Senior-grade workflow tooling
on top of every GSC API endpoint: auto-pagination, client-side sort, period comparison,
parallel batch URL inspection, file-backed query cache, validation guards. Claude operates
this repo mostly autonomously.

## <CRITICAL> The 10 rules that break things silently

1. **Imports end in `.js`, never `.ts`** — `import { foo } from './bar.service.js'`. ESM + `moduleResolution: bundler` requires it. Hard build break if violated.
2. **Every command `.action()` starts with `resolveGlobalOptions(command)`** — single place where flags + env + project `.gsccli.json` + global `~/.gsccli/config.json` are reconciled (in that priority order).
3. **Service results return `ReportData` (`{headers, rows, rowCount}`)** — even single-value or `"Deleted X"` responses get coerced into a 1×N row. Formatters depend on it.
4. **`handleError(err)` is terminal (`: never`)** — never wrap, never rethrow, never `try`-around it. It is the leaf of every action.
5. **Pipeline order is inviolable**: Commander → `resolveGlobalOptions` + `validate` → service → `ReportData` → `formatOutput` → `writeOutput`. No layer-skipping.
6. **API clients only via the singletons in `searchconsole.service.ts` / `indexing.service.ts`** — direct `google.webmasters({...})` / `google.indexing({...})` bypasses the auth chain and cache.
7. **`validate(schema, opts)` is terminal** — `process.exit(1)` on `ZodError`. Don't catch `ZodError` outside `validate`. New options need a schema in `src/validation/schemas.ts`.
8. **New CLI config key = update `CLIConfig` interface, `CONFIG_KEYS` map, AND `LOCAL_BY_DEFAULT_KEYS` (when site-related/per-project)** in `src/types/config.ts`. Otherwise `setConfigValue` rejects them and `defaultScopeFor` mis-routes them.
9. **stderr = status (`logger`/ora). stdout = data (`writeOutput`)**. Mixing breaks `--format json | jq` piping AND breaks the MCP server (which speaks JSON-RPC on stdout).
10. **New top-level command = `program.addCommand(createXxxCommand())` in `src/index.ts`** or it's invisible at the CLI surface.

## Site URL gotchas (the GSC-specific ones)

- URL-prefix property MUST end in trailing slash: `https://example.com/`. `normalizeSiteUrl()` adds it.
- Domain property uses `sc-domain:example.com` — no scheme, no path, no slash.
- Bare hostnames (`example.com`) are NOT silently coerced to https — they'd mismatch a domain property. `ensureValidSiteUrl()` rejects them with an actionable error.
- `https://example.com/` and `sc-domain:example.com` are DIFFERENT properties even for the same domain.

## Search Analytics gotchas

- The four metric columns are FIXED: `clicks`, `impressions`, `ctr`, `position`. No custom metrics. The `searchAnalyticsToReportData()` mapper hardcodes them.
- Default `dataState=final` excludes the last ~3 days. Pass `--data-state all` for fresh-but-incomplete data.
- Country dimension values are ISO-3166-1 alpha-3 lowercase (`usa`), device values are uppercase (`MOBILE`).
- Filter alternation order in `filter-builder.ts` must keep `!~=` BEFORE `!~`. Otherwise `page!~=/admin` parses as `!~` (excludingRegex) plus expression `=/admin` — silently changing semantics. Tests cover this regression.
- The GSC API has **no native `orderBy`** — every Search Analytics response comes back sorted by clicks descending. Re-sort client-side via `sortReportData()` from `utils/sort.ts` whenever the user passes `--sort-by`.
- Single-request hard cap is 25,000 rows (`SEARCH_ANALYTICS_MAX_ROW_LIMIT`). For larger pulls, use `iterateSearchAnalytics()` (generator) or `querySearchAnalyticsAll()` (accumulating).
- Validation guards live in `validateSearchAnalyticsParams()` and run inside both `querySearchAnalytics` and `iterateSearchAnalytics`. Adding a new constraint = add it there once.

## Pagination & streaming

- `--all` triggers `querySearchAnalyticsAll` (accumulates in memory) for table/json/csv/chart, or `iterateSearchAnalytics` + per-page NDJSON streaming for `-f ndjson` without `-o`.
- Daily property cap of 50,000 page+keyword pairs makes very-large pulls self-limiting in practice. Surface this in `--all` documentation; don't try to "fix" it in code.

## Cache layer (`services/cache.service.ts`)

- Content-addressable. SHA-256 over the request payload → `~/.gsccli/cache/<hash>.json`. Wipe with `rm -rf ~/.gsccli/cache`.
- `withCache(key, ttlMs, loader)`: passes through when `ttlMs` is undefined. NEVER cache write operations.
- TTL parsing: `30s`, `10m`, `1h`, `2d`, or bare ms numbers. `parseTtl('5000')` = 5000ms, `parseTtl('5000s')` = 5,000,000ms.

## Concurrency (`utils/concurrency.ts`)

- `parallelMap` returns ordered results, throws on first failure.
- `parallelMapSettled` wraps each result in `{ok,value}` or `{ok:false,error}` — use this for batch endpoints where per-item failures shouldn't kill the run.
- `minIntervalMs` is the pool-wide gap between request *starts*. With `concurrency=N`, the first N items pass instantly; only items beyond that get gated. Set RPS to match your project's QPM cap (rps = QPM / 60).

## Indexing API (`services/indexing.service.ts`)

- Separate API host (`indexing.googleapis.com`), separate scope (`indexing`). Bundled into the same OAuth login. Existing 1.0 users must re-run `gsccli auth login` after upgrading.
- Policy-restricted by Google to job-postings and livestream pages. Other content types may receive notifications but won't see crawl boost.
- Default project quota: 200 requests/day. `index batch` warns if the URL count exceeds that.

## Auth & retry

- Auth priority: OAuth tokens (`~/.gsccli/oauth-tokens.json`) > env `GOOGLE_APPLICATION_CREDENTIALS` > config `credentials` key.
- Resolved auth options are cached at module level in `auth.service.ts`. `resetAuth()` after `login`/`logout`.
- Retry is HTTP-status based (NOT gRPC like gacli). Retryable: 429, 500, 502, 503, 504. Never retry 4xx (always re-fails).
- Exponential backoff with full jitter: `delay ∈ [0, baseDelayMs * 2^attempt]`.
- Override via `GSCCLI_MAX_RETRIES` and `GSCCLI_RETRY_BASE_MS`.

## Config layers

- **Global** (`~/.gsccli/config.json` or `$GSCCLI_CONFIG_DIR/config.json`): auth keys (`credentials`, `oauthClientSecretFile`).
- **Project** (`.gsccli.json` walked up from CWD, stops at `$HOME`): site keys (`site`, `format`, `noColor`, `verbose`).
- `getConfig()` returns `{...global, ...project}` — project overrides global. `resolveGlobalOptions` then applies env then flag on top of that.
- `config set` defaults the scope from `defaultScopeFor(key)` in `types/config.ts`. `--global`/`--local` override.
- All writes go through `atomicWrite()` (write-temp-then-rename) — critical because google-auth-library auto-refreshes the access token and triggers `saveOAuthTokens()` ~hourly; non-atomic writes from two parallel agents would corrupt the file.
- `GSCCLI_CONFIG_DIR` env var redirects the global dir for full multi-agent isolation. Project files are unaffected.
- `findProjectConfigFile()` deliberately stops at `$HOME` so the user's home directory can never be treated as a project root, and `setConfigValue` refuses `--local` writes when CWD is exactly `$HOME` (the resulting `.gsccli.json` would be orphan — the walk-up never sees it).

## Build & test commands

- `pnpm dev <args>` — run from source via tsx (no build needed).
- `pnpm type-check` — `tsc --noEmit`, the build gate.
- `pnpm test` / `pnpm test:watch` / `pnpm test:coverage`.
- `pnpm build` then `pnpm start` — production-artifact verification.
- `pnpm verify` — the full pre-merge gate: lint + type-check + test + build.

## Verification gate — the "done" contract

Before saying "done", "fixed", "works", or opening a PR, you MUST in this order:

1. Run `pnpm type-check` — paste exit code.
2. Run `pnpm test` — paste pass/fail summary.
3. For new/changed commands: run `pnpm dev <command> --help` and a happy-path invocation; paste output.
4. Re-read the original requirement; state point-by-point whether each item is met.

If 1–3 didn't run, the work is **implemented**, not **done** — say so explicitly. Never claim
success on the basis that "the code looks right".

## What this file is NOT

Not a memory dump. Not a skill catalogue. Not a linter (`tsc --strict` is). Not commit conventions. Not onboarding (`README.md`).
