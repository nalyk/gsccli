---
name: gsccli
description: |
  Use when the user wants to query Google Search Console search analytics
  (clicks/impressions/CTR/position by query/page/country/device), inspect URL
  indexing status, manage sitemaps, or send Indexing API notifications via the
  `gsccli` shell command. Triggers on GSC, Search Console, sitemap, indexing API,
  mobile usability, AMP, rich results, search analytics period comparison,
  queries losing clicks, top pages, top queries, optimization gold,
  robots.txt rendering.
license: MIT
compatibility:
  min_version: "0.125.0"
---

# gsccli — Google Search Console + Indexing API CLI

You are a senior-grade user of the `gsccli` shell command (npm: `@nalyk/gsccli`). The
human installed it; you wield it. This skill is the playbook.

## Pre-flight (do these once, then never again)

- `gsccli --version` to confirm install. If missing, tell the user `npm i -g @nalyk/gsccli`.
- `gsccli auth login` once in a real shell (browser OAuth; tokens saved to
  `~/.gsccli/oauth-tokens.json` mode 0600). Auth priority: OAuth >
  `GOOGLE_APPLICATION_CREDENTIALS` env > config `credentials` key.
- `gsccli config set site <url> --local` to pin the default site for the project.
  URL-prefix property needs trailing slash (`https://example.com/`); Domain property
  uses `sc-domain:example.com` (no scheme, no path, no slash). They are DIFFERENT
  properties even for the same domain.

## The 9 commands at a glance

`auth` (OAuth), `query` (Search Analytics), `sites` (properties), `sitemaps`,
`inspect` (URL Inspection), `index` (Indexing API for job postings + livestream),
`config` (CLI config layers), `explore` (interactive reference), `mcp` (MCP server
mode — out of scope for this skill).

## The 10 killer workflows

```bash
# Top movers, period over period — the optimization-finding workhorse.
gsccli query compare -d query --row-limit 25000 --sort-by delta_clicks:desc | head -20

# Optimization gold — high impressions, low CTR (compose, don't mega-call).
gsccli query run -d query --all --sort-by impressions:desc --max-rows 5000 -f ndjson > a.ndjson
# then re-sort by CTR ascending in the next step.

# Stream all rows OOM-free — only when --all + -f ndjson + no -o (uses generator).
gsccli query run -d page --all -f ndjson > pages.ndjson

# Client-side sort on any of the 4 metrics (GSC API only sorts by clicks desc).
gsccli query top-queries --sort-by ctr:asc

# Cache repeated queries while iterating — never on writes.
gsccli query top-pages --row-limit 1000 --cache 1h

# Parallel batch URL inspection with quota-aware rate pacing.
gsccli inspect batch --urls-file urls.txt --concurrency 5 --rps 8 -f ndjson

# Year-over-year comparison.
gsccli query compare -d page --vs-start-date 393daysAgo --vs-end-date 365daysAgo \
  --sort-by delta_position:asc

# Multi-account / multi-agent isolation (separate OAuth tokens, no contention).
GSCCLI_CONFIG_DIR=~/.gsccli-account-x gsccli query top-queries

# Filter chain (AND). Operators: == != ~= !~= =~ !~. Don't hand-edit filter strings.
gsccli query top-pages --filter 'page=~/blog/.*' 'country!=usa' 'device==MOBILE'

# Index publish (job postings + livestream ONLY per Google policy; 200/day default).
gsccli index publish https://example.com/jobs/123 --type URL_UPDATED
gsccli index batch --urls-file jobs.txt --concurrency 3 --rps 3
```

## The 7 silent gotchas (the things that look right and break silently)

1. URL-prefix vs Domain are DIFFERENT properties for the same domain.
2. 4 fixed metrics only: `clicks`, `impressions`, `ctr`, `position`. No custom metrics.
3. Default `--data-state final` excludes the last ~3 days. Use `--data-state all` for fresh.
4. Country = ISO-3166-1 alpha-3 LOWERCASE (`usa`, `gbr`, `fra`). Device = UPPERCASE (`MOBILE`, `DESKTOP`, `TABLET`).
5. 25,000-row hard cap per request. Use `--all` for more; the daily 50,000 page+keyword pair cap self-limits.
6. `searchAppearance` cannot combine with other dimensions.
7. `discover` search type cannot use the `query` dimension.

## Output discipline

stdout = data only; stderr = status. Pipes:
- `-f json | jq '...'` for structured queries
- `-f ndjson > file` for streaming large pulls
- `-f csv` for spreadsheets
- `-f chart` for terminal viz
- `-f table` (default) for human reading

Never pipe `-f table` to `jq` — use `-f json`.

## Validation gates (run BEFORE the operation, not after a failure)

- If site URL is unknown: `gsccli sites list -f json` then pick from `rows[].keys[0]`.
- If freshness matters: pass `--data-state all` explicitly (default `final` excludes ~3 days).
- If row count >25,000 expected: `--all -f ndjson` and stream.
- If batch >2000 URLs: chunk across days; the inspect-batch quota is 2,000/day per property.

## Common errors → recovery (self-heal, don't blind-retry)

- `unauthorized` / `invalid_grant` → tell the user to run `gsccli auth login` once in a shell, then re-run.
- `quotaExceeded` (429) on `query` → built-in retry handles transient; if persistent, propose `--cache 1h` to reduce calls.
- `quotaExceeded` on `inspect batch` → reduce `--rps` to 4, or split URLs across days (2,000/day per property).
- `notFound` on a property → run `gsccli sites list -f json` to surface exact strings; trailing slash and `sc-domain:` mismatches are 90% of these.
- `searchAppearance` + another dimension → split into two queries.
- `discover` + `query` dimension → use `-d page` or `-d country` instead.

## Anti-patterns (don't do these)

- Don't hand-loop `--row-limit`. Use `--all`.
- Don't try to add custom metrics. There are only 4.
- Don't bake credentials into scripts. Use `gsccli auth login` once.
- Don't pipe `-f table` to `jq`. Use `-f json`.
- Don't `index batch` non-job-posting/livestream content (Google policy ignores the notification).
- Don't compose a single mega-invocation when 2 small steps (query → re-sort, or query → filter) is clearer and faster to debug.

## Verification

Check `rowCount` in JSON envelopes; check exit code (0 = success, 16 = auth, 8 = rate limit, 7 = permission). For writes (`sites add`, `sitemaps submit`, `index publish`), read the response message before claiming success.
