# Changelog

All notable changes to `gsccli` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Repository governance: `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CONTRIBUTING.md`,
  issue templates, PR template, `CODEOWNERS`.
- Supply-chain hardening: Dependabot (`npm` + `github-actions`, weekly, grouped),
  CodeQL scheduled scans on JS/TS, release workflow with npm provenance.
- CI hardening: least-privilege `permissions:`, concurrency cancel-superseded,
  `timeout-minutes`, `publint` step on the build artifact.
- `.nvmrc`, `.editorconfig`, and `packageManager` field for reproducible local
  setup across editors and Node managers.

### Changed
- `package.json`: added `funding` and `publishConfig.provenance` so npm publishes
  carry an OIDC-attested provenance statement.

## [1.1.0] - 2026-05-01

### Added
- **Indexing API** (`gsccli index`): submit, status, batch (parallel + rate-limited).
  Single OAuth login covers both `webmasters` and `indexing` scopes.
- **MCP server** (`gsccli mcp`): read-only Model Context Protocol surface exposing
  `query`, `inspect`, `sites list`, `sitemaps list`. Stdout speaks JSON-RPC; status
  goes to stderr.
- **Period comparison** (`query compare`): two date ranges side-by-side with
  absolute and percentage deltas.
- **Batch URL inspection** (`inspect batch`): parallel calls with per-item failure
  isolation via `parallelMapSettled`.
- **Auto-pagination** (`--all`): `querySearchAnalyticsAll` (accumulating) and
  `iterateSearchAnalytics` (generator → NDJSON streaming).
- **Client-side sort** (`--sort-by`): GSC has no native `orderBy`; we sort after
  the fact via `sortReportData`.
- **File-backed query cache** (`--cache-ttl`): SHA-256 over request payload →
  `~/.gsccli/cache/<hash>.json`. Never used for write operations.
- **Filter DSL** with `eq`, `~`, `~=`, `!~`, `!~=` operators on `query`, `page`,
  `country`, `device`, `searchAppearance`.
- **Layered config**: global (`~/.gsccli/config.json`) ← project (`.gsccli.json`)
  ← env (`GSCCLI_*`, `GOOGLE_APPLICATION_CREDENTIALS`) ← CLI flag.
- **Atomic writes** for all config/token persistence (write-temp-then-rename) so
  parallel agents and OAuth auto-refresh can't corrupt the file.
- **`GSCCLI_CONFIG_DIR`** for full multi-agent isolation; project files unaffected.
- **Validation** via Zod schemas (`src/validation/schemas.ts`); `validate()` is
  terminal and `process.exit(1)`s on `ZodError`.
- **Output formats**: table (default), JSON, NDJSON, CSV, ASCII chart.
- **Retry**: HTTP-status-based with full-jitter exponential backoff. Override via
  `GSCCLI_MAX_RETRIES` and `GSCCLI_RETRY_BASE_MS`.

[Unreleased]: https://github.com/nalyk/gsccli/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/nalyk/gsccli/releases/tag/v1.1.0
