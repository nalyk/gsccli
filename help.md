# gsccli — Command Reference for AI

Senior-grade CLI for Google Search Console + Indexing API. Built for daily SEO production
use: auto-pagination, client-side sort, period comparison, parallel batch URL inspection,
result caching, validation guards.

## Global options (apply to ALL commands)

```
-s, --site <url>          Site URL — https://example.com/ or sc-domain:example.com
-f, --format <format>     Output: table|json|ndjson|csv|chart (default: table)
-o, --output <file>       Write to file instead of stdout
--no-color                Disable colors
-v, --verbose             Debug logging
```

Site resolution: `--site` flag > `config.site` > `GSC_SITE_URL` env var.

URL-prefix properties must end in a trailing slash. gsccli normalises automatically.

---

## auth login / logout / status

```
gsccli auth login [--client-secret-file <path>]
gsccli auth logout [--revoke]
gsccli auth status
```

Scopes requested at login: `webmasters.readonly`, `webmasters`, `indexing`. Tokens stored
at `~/.gsccli/oauth-tokens.json` (mode 0600).

---

## query run

The workhorse. Most flags shared with the convenience commands.

```
gsccli query run [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `-d, --dimensions <d...>` | (none) | `query`, `page`, `country`, `device`, `date`, `searchAppearance` |
| `--start-date <date>` | `28daysAgo` | YYYY-MM-DD or relative (`today`, `yesterday`, `NdaysAgo`) |
| `--end-date <date>` | `today` | YYYY-MM-DD or relative |
| `--type <type>` | `web` | `web`, `image`, `video`, `news`, `discover`, `googleNews` |
| `--data-state <state>` | `final` | `final` (excludes ~3-day lag) or `all` (includes fresh) |
| `--aggregation-type <type>` | `auto` | `auto`, `byPage`, `byProperty` |
| `--row-limit <n>` | (API max 25000) | Max rows per API request |
| `--start-row <n>` | 0 | Row offset (ignored with `--all`) |
| `--all` | off | Auto-paginate through ALL rows (loops `startRow` until exhausted) |
| `--max-rows <n>` | ∞ | Hard cap when `--all` is set |
| `--sort-by <spec>` | (API order) | Client-side sort: `column:asc` or `column:desc` |
| `--filter <f...>` | (none) | Dimension filters in shorthand (combined AND) |
| `--filter-json <json>` | (none) | Raw `dimensionFilterGroups` JSON (overrides `--filter`) |
| `--cache <ttl>` | (no cache) | Cache TTL: `30s`, `10m`, `1h`, `2d`, or raw ms |
| `--chart-metric <name>` | `clicks` | For `-f chart`: which metric column to bar |

**`--all` + `-f ndjson` streams page-by-page** (memory-bounded), suitable for million-row
sites. With other formats, all rows are accumulated then formatted.

Always returns four metric columns: `clicks`, `impressions`, `ctr`, `position`.

Examples:

```bash
gsccli query run -d query -d page --all --max-rows 50000 -f ndjson > out.ndjson
gsccli query run -d query --sort-by impressions:desc --row-limit 100
gsccli query run -d page --filter "page=~/blog/" --filter "country==usa" --cache 1h
```

## query top-queries / top-pages / by-country / by-device

Convenience wrappers around `query run` with the dimension preset. Same flag block as
`query run` (minus `-d`/`--dimensions`).

```
gsccli query top-queries [options]
gsccli query top-pages   [options]
gsccli query by-country  [options]
gsccli query by-device   [options]
```

## query compare

Period-over-period delta table. Runs both periods, joins on dimension keys, computes
deltas (A − B). Sortable by any delta column.

```
gsccli query compare [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `-d, --dimensions <d...>` | `["query"]` | Dimensions to group by |
| `--start-date <date>` | `28daysAgo` | Period A start |
| `--end-date <date>` | `today` | Period A end |
| `--vs-start-date <date>` | `56daysAgo` | Period B start (older period) |
| `--vs-end-date <date>` | `29daysAgo` | Period B end |
| `--type <type>` | `web` | Search type |
| `--data-state <state>` | `final` | |
| `--aggregation-type <type>` | `auto` | |
| `--row-limit <n>` | `25000` | Per-request cap (passed to both periods) |
| `--max-rows <n>` | `25000` | Hard cap per period |
| `--sort-by <spec>` | `delta_clicks:desc` | Any of: `clicks_a/b`, `delta_clicks`, `clicks_b`, `impressions_a/b`, `delta_impressions`, `ctr_a/b`, `delta_ctr`, `position_a/b`, `delta_position` |
| `--filter <f...>` | (none) | Applied to both periods |
| `--filter-json <json>` | (none) | Raw GSC filter JSON |
| `--chart-metric <name>` | `delta_clicks` | For `-f chart` |

Output columns: `<dimensions>, clicks_a, clicks_b, delta_clicks, impressions_a, impressions_b, delta_impressions, ctr_a, ctr_b, delta_ctr, position_a, position_b, delta_position`.

Note: positive `delta_position` = ranking got *worse* (higher number); negative = improved.

Examples:

```bash
# Last 28d vs prior 28d, biggest movers
gsccli query compare -d query --sort-by delta_clicks:desc | head -20

# YoY by page
gsccli query compare -d page \
  --start-date 28daysAgo --end-date today \
  --vs-start-date 393daysAgo --vs-end-date 365daysAgo

# Biggest ranking improvements
gsccli query compare -d query --sort-by delta_position:asc
```

## query batch

Sequential batch from a JSON file (no API-native batch exists for searchanalytics).

```
gsccli query batch --requests <path>
```

JSON file format: array of `SearchAnalyticsQueryParams`; each entry can omit `siteUrl`
(filled from `-s`).

---

## sites list / get / add / delete

```
gsccli sites list                           # list all sites you can access
gsccli sites get [siteUrl]                  # defaults to -s
gsccli sites add <siteUrl>                  # registers site; verify in UI separately
gsccli sites delete <siteUrl>               # remove from your account
```

---

## sitemaps list / get / submit / delete

```
gsccli sitemaps list [--sitemap-index <url>]      # uses -s
gsccli sitemaps get <feedpath>                    # uses -s
gsccli sitemaps submit <feedpath>                 # uses -s
gsccli sitemaps delete <feedpath>                 # uses -s
```

---

## inspect url

Single-URL inspection. Index status, last crawl, mobile usability, AMP, rich results.

```
gsccli inspect url <inspectionUrl> [--language-code <code>]
```

With `-f json`/`-f ndjson` returns the full inspection payload. With table/csv/chart
returns a flattened summary.

## inspect batch

Parallel batch URL inspection with quota-aware rate pacing. Respects GSC's 600 QPM and
2,000/day-per-property limits.

```
gsccli inspect batch [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--urls-file <path>` | — | File with one URL per line (#-prefixed lines ignored) |
| `--urls-stdin` | — | Read URLs from stdin |
| `--concurrency <n>` | `5` | Parallel inspections |
| `--rps <n>` | `8` | Pool-wide rate limit (8/s ≈ 480 QPM, conservative under 600 QPM cap) |
| `--language-code <code>` | (none) | BCP-47 code for translated descriptions |

Output is a flat ReportData with one row per URL, columns:
`url, verdict, coverageState, indexingState, lastCrawlTime, googleCanonical, userCanonical, crawledAs, mobileVerdict, richResultsVerdict, ampVerdict, error`.

Per-URL failures (e.g. 403 on a non-owned URL) are isolated — they appear as a non-empty
`error` column rather than failing the whole batch.

Examples:

```bash
# Inspect all URLs in sitemap.txt
gsccli inspect batch --urls-file ./pages.txt -f ndjson > inspections.ndjson

# Pipe from another command
gsccli query top-pages --row-limit 100 -f ndjson | jq -r .page | \
  gsccli inspect batch --urls-stdin --concurrency 3 -f csv -o audit.csv
```

---

## index publish / status / batch

Google Indexing API. Restricted by Google policy to job-posting and
livestream-broadcast pages.

```
gsccli index publish <url> [--type URL_UPDATED|URL_DELETED]
gsccli index status <url>
gsccli index batch [options]
```

`index publish` defaults to `--type URL_UPDATED`. Use `URL_DELETED` to notify Google a
page is gone.

`index status` returns `latestUpdate` and `latestRemove` notification metadata for a URL.

`index batch` options:

| Option | Default | Description |
|--------|---------|-------------|
| `--urls-file <path>` | — | File with one URL per line |
| `--urls-stdin` | — | Read URLs from stdin |
| `--type <type>` | `URL_UPDATED` | `URL_UPDATED` or `URL_DELETED` |
| `--concurrency <n>` | `3` | Parallel publishes |
| `--rps <n>` | `3` | Pool-wide rate limit |

Default Indexing API quota is 200/day per project (raisable on request). gsccli warns if
your batch exceeds that.

---

## config set / get / list

Two layers: **global** (`~/.gsccli/config.json`) for auth, **project** (`./.gsccli.json`,
walked up from CWD) for site + per-project preferences.

```
gsccli config set <key> <value> [--global|--local]
gsccli config get <key> [--show-source]
gsccli config list
```

`config set` default scope:
- **local** for `site`, `format`, `noColor`, `verbose`
- **global** for `credentials`, `oauthClientSecretFile`

`--global` forces `~/.gsccli/config.json`. `--local` forces `./.gsccli.json` (creates it
in CWD if no parent project file exists). Refuses to write a `.gsccli.json` directly into
`$HOME` because the walk-up stops at $HOME and the file would be orphan.

`config get` returns the effective value (project overrides global). `--show-source`
prints which file the value came from.

`config list` shows every key with effective value, source, and description. The two file
paths are printed to stderr first.

**Resolution chain** (per command, per key): flag > env (`GSC_SITE_URL`) > project
`.gsccli.json` > global `~/.gsccli/config.json` > built-in default.

**Isolation:** set `GSCCLI_CONFIG_DIR=/path` to redirect the global dir entirely (useful
for parallel agents with different OAuth identities). Project `.gsccli.json` is
unaffected by this env var.

---

## explore

```
gsccli explore
```

REPL commands: `dimensions`, `types`, `operators`, `sites`, `show <dimension>`, `help`,
`exit`. Tab-completion on `show <dimension>`.

---

## mcp serve

```
gsccli mcp serve
```

Stdio MCP server. Read-only tools: `gsccli_query`, `gsccli_sites_list`,
`gsccli_sitemaps_list`, `gsccli_inspect_url`. Write operations and Indexing API
deliberately not exposed.

---

## Filter syntax (shorthand)

| Operator | GSC API | Example |
|----------|---------|---------|
| `==` | `equals` | `query==brand` |
| `!=` | `notEquals` | `country!=usa` |
| `~=` | `contains` | `page~=/blog` |
| `!~=` | `notContains` | `page!~=/admin` |
| `=~` | `includingRegex` | `page=~/blog/.*` |
| `!~` | `excludingRegex` | `query!~spam` |

Valid dimensions: `query`, `page`, `country`, `device`, `date`, `searchAppearance`.

For OR groups or nested expressions, use `--filter-json` with raw GSC
`dimensionFilterGroups` payload.

## Sort syntax (client-side)

`--sort-by <column>:<asc|desc>`. Direction defaults to `desc` if omitted.

The four GSC metric columns (`clicks`, `impressions`, `ctr`, `position`) are sorted
numerically; everything else lexicographically. In GSC, **lower position is better** — use
`--sort-by position:asc` to get best rankings first.

## Validation guards (caught before the API round-trip)

| Combo | Error |
|-------|-------|
| `-d searchAppearance -d query` | searchAppearance cannot be combined with other dimensions |
| `--type discover -d query` | Discover does not record search queries |
| `--row-limit 50000` | rowLimit exceeds GSC max of 25,000 (use `--all` instead) |

## Notes for AI usage

- Auth priority: OAuth tokens > service account (`credentials` config / `GOOGLE_APPLICATION_CREDENTIALS` env). Use `gsccli auth status`.
- Site URL has TWO shapes: `https://example.com/` (URL-prefix, must end in `/`) or `sc-domain:example.com` (domain property). Distinct properties.
- Search Analytics returns fixed metrics: `clicks`, `impressions`, `ctr`, `position`. No custom metrics.
- Country codes are ISO-3166-1 alpha-3 lowercase: `usa`, `gbr`, `fra`, `mda`.
- Device values are uppercase: `DESKTOP`, `MOBILE`, `TABLET`.
- Date format: `YYYY-MM-DD`, `today`, `yesterday`, `NdaysAgo`. Max history: 16 months.
- GSC API has NO native `orderBy` — always returns by clicks descending. Use `--sort-by`.
- Single-request cap: 25,000 rows. Daily cap: 50,000 page+keyword pairs/property. Use `--all` (with optional `--max-rows`) to paginate.
- `inspect batch` and `index batch` use a worker pool with rate pacing — set `--concurrency` and `--rps` to match your project's quotas.
- The Indexing API only effectively works for job-postings and livestream pages per Google's policy.
- `query batch` is sequential (no API-native batch); for parallelism, use `inspect batch` or `index batch`.
