# Changelog

All notable changes to `gsccli` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1](https://github.com/nalyk/gsccli/compare/v1.2.0...v1.2.1) (2026-05-02)


### Fixed

* **cli:** read version from package.json + add release-please for automated releases ([#7](https://github.com/nalyk/gsccli/issues/7)) ([1d6d91c](https://github.com/nalyk/gsccli/commit/1d6d91c9474cc603b8ff5d71af8d61433cdf6e7d))

## [1.2.0] - 2026-05-02

### Added — AI agent integration

- **Bundled Agent Skills (`SKILL.md`)** for the four major AI coding-agent CLIs:
  Claude Code, Codex (with companion `agents/openai.yaml` UI metadata), Gemini
  CLI (with `when_to_use` and `allowed_tools: [run_shell_command]`), and Qwen
  Code. Identical 600-word body across all four; only the per-CLI frontmatter
  differs. Ships under `agents/` in the npm tarball.
- **`gsccli skills install|uninstall|list|status`** subcommand. Copies the
  bundled `SKILL.md` package to the right location for the chosen agent and
  scope (`--scope user|project`, default `user`). Idempotent (SHA-256 content
  diff), supports `--dry-run` and `--force`. `--agent all` auto-detects which
  CLIs are installed by probing `~/.claude/`, `~/.codex/`, `~/.gemini/`,
  `~/.qwen/`. Refuses `--scope project` unless the CWD has a project marker
  (`.git`, `package.json`, `pyproject.toml`, etc.). Surfaces per-CLI caveats
  in the install output (Claude `permissions.deny` precedence, Codex
  project-trust requirement, Gemini sandbox + browser auth, Qwen issue #2343
  + OAuth deprecation).

### Notes

- No MCP wiring, plugins, extensions, custom slash commands, profile snippets,
  or settings-file mutations. Just the right `SKILL.md` in the right place per
  CLI. Each CLI auto-discovers its skills directory.

## [1.1.0] - 2026-05-02

First public release on npm. Published as **`@nalyk/gsccli`** (npm rejected the
unscoped `gsccli` for being too similar to the older `gsc-cli`). The binary you
invoke is still `gsccli`.

### Added — CLI features

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

### Added — repository governance & supply chain

- `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CONTRIBUTING.md`, issue templates, PR
  template, `CODEOWNERS`.
- Dependabot (`npm` + `github-actions`, weekly, grouped).
- CodeQL scheduled scans (`security-extended`, `security-and-quality`) on
  JS/TS.
- Release workflow with **npm provenance** (OIDC-attested), tag-vs-package.json
  guard, auto-extracted release notes, and a tarball install smoke-test before
  publish.
- CI hardening: least-privilege `permissions:`, concurrency cancel-superseded
  on PRs, `timeout-minutes`, `publint` on the build artifact.
- Branch protection on `main`: required CI status checks, linear history, no
  force-push, no deletions, conversation resolution required.

### Added — tooling

- `package.json`: `funding`, `publishConfig.{access,provenance}`,
  `packageManager`, `engines.pnpm`.
- `.nvmrc` and `.editorconfig` for reproducible local setup.

[Unreleased]: https://github.com/nalyk/gsccli/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/nalyk/gsccli/releases/tag/v1.1.0
