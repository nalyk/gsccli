# gsccli

[![Listed on Yoda Digital Open Source](https://img.shields.io/badge/listed%20on-opensource.yoda.digital-af9568?style=flat-square)](https://opensource.yoda.digital/en/projects/gsccli/)
[![npm version](https://img.shields.io/npm/v/%40nalyk%2Fgsccli?logo=npm&label=npm)](https://www.npmjs.com/package/@nalyk/gsccli)
[![npm downloads](https://img.shields.io/npm/dm/%40nalyk%2Fgsccli?logo=npm&label=downloads)](https://www.npmjs.com/package/@nalyk/gsccli)
[![CI](https://github.com/nalyk/gsccli/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/nalyk/gsccli/actions/workflows/ci.yml)
[![CodeQL](https://github.com/nalyk/gsccli/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/nalyk/gsccli/actions/workflows/codeql.yml)
[![Provenance](https://img.shields.io/badge/npm-provenance-7c3aed?logo=npm)](https://docs.npmjs.com/generating-provenance-statements)
![Node](https://img.shields.io/badge/node-%E2%89%A522-brightgreen?logo=nodedotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)
![ESM](https://img.shields.io/badge/ESM-only-blue)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Senior-grade CLI for Google Search Console + Indexing API — built for daily SEO production
use, not demos. Wraps the entire GSC API surface (Search Analytics, Sites, Sitemaps, URL
Inspection) plus the Indexing API, with the workflow tooling a real user actually needs:
auto-pagination, client-side sort, period-over-period comparison, parallel batch URL
inspection, query-result cache, multi-format output (table/json/ndjson/csv/chart),
OAuth + service-account auth, and an [MCP server](#model-context-protocol) that exposes
read-only tools to any LLM client (Claude Desktop, Cursor, Cline, Zed).

## What's actually different from a "wraps the API" CLI

- **Auto-pagination beyond GSC's 25,000-row cap.** `--all` walks `startRow` until exhausted.
  NDJSON output streams page-by-page so a 1M-row site doesn't OOM your shell.
- **Client-side sort the API doesn't give you.** `--sort-by ctr:desc`,
  `--sort-by impressions:desc` for low-CTR / high-impression "optimization gold" queries.
  GSC always returns by-clicks-desc; this fixes it.
- **Period comparison.** `gsccli query compare` runs both periods, joins on dimension keys,
  and emits a delta table — sortable by `delta_clicks`, `delta_position`, etc.
- **Batch URL Inspection** with concurrency and quota-aware rate pacing. 600 QPM and
  2,000/day per-property limits respected by default.
- **Indexing API** built in (`gsccli index publish` / `index status` / `index batch`),
  reusing the same OAuth flow.
- **Query result cache** — `--cache 1h` and stop hitting the API for the same query while
  you iterate on a deck.
- **Validation guards** that match what the API actually rejects: `searchAppearance`
  cannot be combined with other dimensions; `--type discover` cannot use the `query`
  dimension. Caught before round-trip.

## Setup

Install globally from npm:

```bash
npm i -g @nalyk/gsccli
# or
pnpm add -g @nalyk/gsccli
```

Or run from source:

```bash
git clone git@github.com:nalyk/gsccli.git
cd gsccli
pnpm install && pnpm build && pnpm link --global
```

The binary is `gsccli` either way (the `@nalyk/` scope is only on the npm package
identifier, not on the CLI you invoke). Requires Node.js >= 22.

## Authentication

gsccli supports two authentication methods: **OAuth 2.0** (interactive) and **service
account** (JSON key file).

### OAuth 2.0 (recommended for personal use)

1. Create a **Desktop** OAuth client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Enable the **Search Console API** AND the **Web Search Indexing API** in that project
3. Download the `client_secret_*.json`
4. Run:

```bash
gsccli auth login --client-secret-file ./client_secret.json
```

Browser-based consent flow. Tokens saved to `~/.gsccli/oauth-tokens.json` (mode `0600`).

> **Upgrading from 1.0?** Indexing API support added a third scope. Re-run `gsccli auth login`
> so the new refresh token covers `index publish/status/batch`.

To save the client secret path for future use:

```bash
gsccli config set oauthClientSecretFile /path/to/client_secret.json
gsccli auth login
```

### Service account

Set credentials via one of:

1. `GOOGLE_APPLICATION_CREDENTIALS` environment variable
2. `gsccli config set credentials /path/to/service-account.json`

The service account email must be added as a user on the Search Console property (in the
classic Search Console settings → Users and permissions).

### Auth priority

OAuth tokens (if present) > service account file (env or config).

### Managing auth

```bash
gsccli auth status              # Show active auth method
gsccli auth logout              # Remove saved OAuth tokens
gsccli auth logout --revoke     # Revoke at Google, then remove
```

Scopes: `webmasters.readonly`, `webmasters`, `indexing`.

## Global options

| Flag | Description |
|------|-------------|
| `-s, --site <url>` | Site URL — `https://example.com/` (URL-prefix) or `sc-domain:example.com` (domain property) |
| `-f, --format <fmt>` | `table` (default), `json`, `ndjson`, `csv`, `chart` |
| `-o, --output <file>` | Write output to file |
| `--no-color` | Disable colors |
| `-v, --verbose` | Verbose logging |

Site resolution: `--site` > `config.site` > `GSC_SITE_URL` env var. URL-prefix properties
must end in a trailing slash; gsccli normalises automatically.

## Quick start — daily SEO workflows

```bash
gsccli config set site https://example.com/
gsccli auth login

# Top 25 queries by clicks, last 28 days
gsccli query top-queries

# "Optimization gold" — high impressions, low CTR
gsccli query top-queries --sort-by impressions:desc --row-limit 100 \
  | gsccli query top-queries --sort-by ctr:asc --row-limit 100

# Or in one go: fetch all rows for last 28d, then sort client-side
gsccli query run -d query --all --sort-by impressions:desc --max-rows 5000

# "Almost there" — high impressions, position just past page 1 (10-20)
gsccli query run -d query --all --max-rows 5000 \
  --sort-by impressions:desc -f ndjson \
  | jq -c 'select((.position|tonumber) >= 10 and (.position|tonumber) <= 20)'

# Period comparison — last 28d vs the prior 28d
gsccli query compare -d query --row-limit 25000 --sort-by delta_clicks:desc | head -20

# YoY comparison
gsccli query compare -d page \
  --start-date 28daysAgo --end-date today \
  --vs-start-date 393daysAgo --vs-end-date 365daysAgo \
  --sort-by delta_position:asc

# Stream a million rows to NDJSON without OOM
gsccli query run -d page --all -f ndjson > all-pages.ndjson

# Cache an expensive query for one hour while you iterate on the slide deck
gsccli query top-pages --row-limit 1000 --cache 1h

# Search appearance — the dimension that requires its own query
gsccli query run -d searchAppearance

# Image search performance broken down by country
gsccli query by-country --type image --row-limit 50

# Batch URL inspection with rate pacing
gsccli inspect batch --urls-file ./pages.txt --concurrency 5 --rps 8 -f ndjson

# Single URL inspection
gsccli inspect url https://example.com/some/page

# Sites you have access to
gsccli sites list

# Sitemap status
gsccli sitemaps list
gsccli sitemaps submit https://example.com/sitemap.xml

# Indexing API (jobs / livestream content only per Google policy)
gsccli index publish https://example.com/job/123
gsccli index publish https://example.com/job/old --type URL_DELETED
gsccli index batch --urls-file ./jobs.txt --concurrency 3 --rps 3

# Run as MCP server for Claude Desktop / Cursor / Cline / Zed
gsccli mcp serve

# Browse the dimension/operator catalog interactively
gsccli explore
```

## Command structure

```
gsccli
  auth login|logout|status
  query run|top-queries|top-pages|by-country|by-device|compare|batch
  sites list|get|add|delete
  sitemaps list|get|submit|delete
  inspect url|batch
  index publish|status|batch
  config set|get|list
  explore
  mcp serve
```

## Output formats

| Format | Usage |
|--------|-------|
| `table` | Colored ASCII table (default) |
| `json` | `{rowCount, data:[{...}]}` shape — pipe to `jq` |
| `ndjson` | One JSON object per line — clean piping into `jq -c`, ClickHouse, BigQuery loads. With `query run --all` this is the streaming output mode (memory-bounded). |
| `csv` | RFC 4180 CSV |
| `chart` | ASCII bar chart. Defaults to `clicks` for GSC reports (avoids the GSC pitfall where `position` is the last column and lower=better). Override with `--chart-metric <name>`. |

## Filters

Shorthand passed to `--filter` (combined with AND):

| Operator | GSC API operator | Meaning |
|----------|------------------|---------|
| `==` | `equals` | Exact match |
| `!=` | `notEquals` | Not equal |
| `~=` | `contains` | Substring |
| `!~=` | `notContains` | Substring not present |
| `=~` | `includingRegex` | RE2 regex match |
| `!~` | `excludingRegex` | RE2 regex not match |

Valid dimensions: `query`, `page`, `country`, `device`, `date`, `searchAppearance`.

For OR groups or nested expressions, pass the raw GSC `dimensionFilterGroups` JSON via
`--filter-json`.

## Sort (client-side)

The GSC API has **no native `orderBy`** — results always come back by clicks descending.
Use `--sort-by <column>:<asc|desc>` to re-sort client-side after fetching:

- `--sort-by clicks:desc` — default for top-queries / top-pages
- `--sort-by impressions:desc` — biggest opportunities
- `--sort-by ctr:asc` — pages losing clicks despite impressions
- `--sort-by position:asc` — best rankings first (lower=better in GSC)
- `--sort-by delta_clicks:desc` — biggest movers (in `query compare`)
- `--sort-by delta_position:asc` — biggest ranking improvements

## Pagination

GSC caps every request at 25,000 rows. To get more:

- `--all` — auto-paginate until the API returns a short page. Use `--max-rows <n>` to cap.
- For very large sites, combine with `-f ndjson` to stream output page-by-page (constant
  memory). Without `--all`, only the first 25,000 rows are retrieved; pass `--start-row`
  to manually page.

GSC also caps the *daily total* at **50,000 page+keyword pairs per property** — `--all` on
a fresh-each-day basis is the realistic ceiling. Plan accordingly.

## Caching

```bash
gsccli query top-queries --cache 1h
```

Hashes the request and stores the response in `~/.gsccli/cache/<sha256>.json`. TTL units:
`s`, `m`, `h`, `d` (e.g. `30s`, `10m`, `2h`, `1d`). Bare numbers = milliseconds. Wipe the
cache with `rm -rf ~/.gsccli/cache`.

## Configuration

gsccli has **two config layers**: global (machine-wide, auth) and project-local
(per-project, site).

| Layer | File | Default home for | Discovered how |
|-------|------|------------------|----------------|
| Global | `~/.gsccli/config.json` | `credentials`, `oauthClientSecretFile` | Always loaded |
| Project | `.gsccli.json` at the project root | `site`, `format`, `noColor`, `verbose` | Walked up from CWD; stops at `$HOME` |

`gsccli config set <key> <val>` picks the file based on the key by default:

```bash
# from /repos/site-a/
gsccli config set site https://site-a.example.com/
# → writes /repos/site-a/.gsccli.json     (site is local-by-default)

gsccli config set credentials /opt/sa.json
# → writes ~/.gsccli/config.json          (credentials is global-by-default)
```

Override with `--global` or `--local`:

```bash
gsccli config set --global site https://default-everywhere.com/
gsccli config set --local credentials ./project-sa.json
```

**Effective value resolution per command, per key:**

```
CLI flag (-s/--site, -f/--format, ...)
   ↓ if not set
Environment variable (GSC_SITE_URL)
   ↓ if not set
Project .gsccli.json (walked up from CWD)
   ↓ if not set
Global ~/.gsccli/config.json
   ↓ if not set
Built-in default ('table' for format, '' for site → validation error)
```

`gsccli config get <key> --show-source` prints which file the value came from.
`gsccli config list` shows every key, its effective value, and its source side-by-side.

| Key | Description | Default scope |
|-----|-------------|---------------|
| `credentials` | Path to service account JSON file | global |
| `site` | Default site URL | local |
| `format` | Default output format | local |
| `noColor` | Disable colors (`true`/`false`) | local |
| `verbose` | Verbose logging (`true`/`false`) | local |
| `oauthClientSecretFile` | Path to OAuth client secret JSON file | global |

### `.gsccli.json` and version control

The project file holds site URLs and format preferences — no secrets. Whether to commit
it is a team call:

- **Commit it** if your repo corresponds 1:1 to a Search Console property and you want
  every checkout to hit the right site automatically.
- **Add it to `.gitignore`** if developers might point at different sites (staging vs
  prod) or if the repo represents multiple sites.

### Multi-agent isolation

Two parallel agents from different folders share `~/.gsccli/`. For per-project site
isolation, use `.gsccli.json` (no setup beyond `cd` into the project). For full isolation
including separate OAuth identities, use `GSCCLI_CONFIG_DIR`:

```bash
GSCCLI_CONFIG_DIR=~/.gsccli-agent-a gsccli auth login --client-secret-file ./client.json
GSCCLI_CONFIG_DIR=~/.gsccli-agent-a gsccli query top-queries

GSCCLI_CONFIG_DIR=~/.gsccli-agent-b gsccli auth login --client-secret-file ./client.json
GSCCLI_CONFIG_DIR=~/.gsccli-agent-b gsccli query top-queries
```

OAuth-token writes are atomic (write-temp + rename) so even agents sharing `~/.gsccli/`
can't corrupt the tokens file when both refresh at the same moment.

## Environment variables

| Variable | Default | Effect |
|---|---|---|
| `GSC_SITE_URL` | — | Site URL — overrides project + global config files |
| `GSCCLI_CONFIG_DIR` | `~/.gsccli` | Override the global config dir (auth, global config) |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | Path to service-account JSON |
| `GSCCLI_VERBOSE` | `0` | When `1`, error stack traces accompany the human-readable error |
| `GSCCLI_MAX_RETRIES` | `3` | Max retries on retriable HTTP errors (429, 5xx). 4xx never retries |
| `GSCCLI_RETRY_BASE_MS` | `500` | Base for exponential-backoff-with-jitter |

## Quotas (live as of 2026)

| Surface | Per site | Per project |
|---------|----------|-------------|
| Search Analytics queries | 1,200 QPM, 50,000 page+keyword pairs/day | 40,000 QPM, 30M QPD |
| URL Inspection | 600 QPM, 2,000/day | 15,000 QPM, 10M/day |
| Sitemaps | 30 QPM | — |
| Indexing API | — | 200/day default (request raise) |

Hit a 429 → `withRetry` backs off automatically. Hit a daily cap → split across days.

## Model Context Protocol

```bash
gsccli mcp serve
```

Stdio MCP server exposing four read-only tools — `gsccli_query`, `gsccli_sites_list`,
`gsccli_sitemaps_list`, `gsccli_inspect_url` — to any MCP client. Reuses gsccli's auth
chain, retry policy, validation guards, and site resolution. Write operations
(`sites add/delete`, `sitemaps submit/delete`, `index publish/batch`) are deliberately
**not** exposed via MCP — running them via prompt injection would silently change a
production site or burn a hard-capped quota. Use the CLI for those.

Wire-up examples for Claude Desktop, Cursor, Cline, and Zed are in [MCP.md](./MCP.md).

## Interactive explore

```bash
gsccli explore
```

Reference card REPL for the GSC dimension catalog (six dimensions), search types (six),
and filter operators (six). Tab-completion on `show <dimension>`. Useful when you
don't remember whether device codes are uppercase or how the regex operator is spelled.

## Development

```bash
pnpm install
pnpm verify        # lint + type-check + test + build
pnpm test:watch    # vitest watch mode
pnpm dev <args>    # run from source (no build step)
```

Lint/format is [Biome](https://biomejs.dev), tests are [Vitest](https://vitest.dev).
**106 tests** covering filters, sort, pagination, concurrency, retry, cache TTL parsing,
auth resolution chain, formatters, validation guards, and the MCP JSON-RPC handshake.

## Documentation

| File | Purpose |
|---|---|
| [`README.md`](./README.md) | This file — user setup and quick reference |
| [`help.md`](./help.md) | Verbose human-readable command reference (every flag) |
| [`MCP.md`](./MCP.md) | MCP server setup for Claude Desktop, Cursor, Cline, Zed |
| [`CLAUDE.md`](./CLAUDE.md) | Conventions Claude follows when working in this repo |

## Tech stack

Node 22+, ESM-only TypeScript 6, Commander 14, `googleapis` v144 (webmasters v3 +
searchconsole v1 + indexing v3), `google-auth-library` v9, `@modelcontextprotocol/sdk`
1.x, zod, ora, chalk, cli-table3, boxen. Dev: Vitest, Biome, tsx.

## Architecture

Strict layered pipeline:

```
Commander → resolveGlobalOptions + validate → service → ReportData
          → sort? → cache? → formatOutput → writeOutput
```

- **Services** (`src/services/`) wrap googleapis clients with auth, retry, validation
  guards, response normalisation, pagination iterators, and a content-addressable cache.
- **Formatters** (`src/formatters/`) take `ReportData` + optional metric column → string.
- **Validation** (`src/validation/`) is Zod-based; failures call `process.exit(1)`.
- **Concurrency** (`src/utils/concurrency.ts`) is a bounded worker-pool with rate pacing,
  used by `inspect batch` and `index batch`.
- **Auth** is OAuth-first, env-var, then config-file service-account. Cached per process;
  invalidated by `auth login` / `auth logout`.

The MCP server (`src/commands/mcp/`) reuses the same service layer.

## Limitations & gotchas (still real, just better-documented now)

- Search Analytics has a freshness lag — `--data-state final` excludes the most recent
  ~3 days; `--data-state all` includes fresh-but-incomplete data.
- `https://example.com/` and `sc-domain:example.com` are different properties even for
  the same domain.
- `searchAppearance` cannot be combined with other dimensions — gsccli rejects this
  before round-trip with an actionable error.
- `--type discover` does not support the `query` dimension — also pre-validated.
- GSC keeps **only 16 months** of history. Earlier dates return truncated data silently.
- The Indexing API is **policy-restricted** by Google to job-posting and livestream
  pages. Other content types may receive notifications but won't see crawl boost.
- `query batch` runs requests sequentially (the API has no native batch endpoint).
  For parallelism, use `inspect batch` or `index batch` (which DO use the worker pool).

## Contributing

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the dev loop, the
architectural invariants you can't break (also captured in [CLAUDE.md](./CLAUDE.md)),
and the Conventional Commits PR-title rule.

The `main` branch is protected: required CI on Node 22 + 24, linear history, no
force pushes, no deletions, conversation resolution required before merge. Squash
is the only merge method enabled — so the PR title becomes the commit subject on
`main` (which is why it must be Conventional).

## Security

Vulnerabilities? **Don't open a public issue.** Use one of the private channels in
[SECURITY.md](./SECURITY.md) — preferably [GitHub Security Advisories](https://github.com/nalyk/gsccli/security/advisories/new).

Releases are published to npm via **OIDC trusted publishing** with
[provenance attestations](https://docs.npmjs.com/generating-provenance-statements) —
each artifact is signed by GitHub's OIDC issuer and traceable to the exact
workflow run that built it. No long-lived `NPM_TOKEN` is involved.

CodeQL runs on every PR (security-extended + security-and-quality query packs)
and on a weekly schedule.

## Code of conduct

Participation is governed by the [Contributor Covenant 2.1](./CODE_OF_CONDUCT.md).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) — Keep-a-Changelog format, SemVer-disciplined.

## License

MIT — see [LICENSE](./LICENSE). Authored by [Ion (Nalyk) Calmîș](https://github.com/nalyk).

## Acknowledgements

Built on top of:

- [`googleapis`](https://www.npmjs.com/package/googleapis) — Google's official Node SDK for the GSC and Indexing APIs.
- [`google-auth-library`](https://www.npmjs.com/package/google-auth-library) — OAuth + service-account flows.
- [`commander`](https://www.npmjs.com/package/commander) — CLI parsing.
- [`zod`](https://www.npmjs.com/package/zod) — runtime validation.
- [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk) — the MCP server surface.
- [`vitest`](https://vitest.dev) and [`biome`](https://biomejs.dev) — test runner and linter/formatter.
