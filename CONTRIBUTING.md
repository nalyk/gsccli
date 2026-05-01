# Contributing to gsccli

Thanks for your interest. This is a senior-grade SEO tool that we keep tight: the bar is
production-grade code, real test coverage, and changes that pull their weight.

## Reporting bugs

Open a [bug report](https://github.com/nalyk/gsccli/issues/new?template=bug_report.yml).
The form asks for the command you ran, the actual vs. expected output, and the gsccli /
Node version. **Never paste OAuth tokens, service-account JSON, or `gsccli auth status`
output containing real account details.**

## Suggesting features

Open a [feature request](https://github.com/nalyk/gsccli/issues/new?template=feature_request.yml)
or start a [Discussion](https://github.com/nalyk/gsccli/discussions) for open-ended ideas.

## Development setup

Requires Node.js >= 22 and pnpm.

```bash
git clone git@github.com:nalyk/gsccli.git
cd gsccli
pnpm install
cp .env.example .env   # optional — set GOOGLE_APPLICATION_CREDENTIALS / GSC_SITE_URL
pnpm verify            # lint + type-check + test + build
pnpm dev <command>     # run from source via tsx
```

## Workflow

```bash
pnpm dev query top-queries     # run from source (no build)
pnpm test:watch                # vitest watch
pnpm lint:fix                  # auto-fix Biome issues
pnpm type-check                # tsc --noEmit
```

Before opening a PR, make sure `pnpm verify` is green. The CI matrix (Node 22 + Node 24)
will rerun it on push.

## Architecture invariants — DO NOT break

These are documented in [CLAUDE.md](./CLAUDE.md). The 10 critical rules govern the
pipeline shape, the auth chain, the formatter contract, and the validation flow. If your
change requires bending one, raise it in the PR description first.

Highlights:

1. **All TS imports MUST end in `.js`** (ESM + `moduleResolution: bundler`).
2. **Pipeline order**: Commander → `resolveGlobalOptions` + `validate` → service →
   `ReportData` → `formatOutput` → `writeOutput`. No layer-skipping.
3. **`handleError(err)` is terminal** — never wrap, never rethrow.
4. **stdout = data, stderr = status.** Mixing breaks `--format json | jq` AND breaks the
   MCP server (which speaks JSON-RPC on stdout).
5. **MCP exposes only read-only tools.** Write operations and the Indexing API are
   deliberately CLI-only.

## Testing

We run [Vitest](https://vitest.dev) with a 50% coverage floor. New behavior gets new
tests. Bug fixes ship with a regression test that fails before the fix and passes after.

| Where to add a test |
|---|
| New formatter logic → `test/formatters/` |
| New utility (`utils/`) → `test/utils/` |
| New service method or auth path → `test/services/` |
| New MCP tool → extend `test/commands/mcp-smoke.test.ts` |
| Config/env-var resolution → `test/services/config-layers.test.ts` |

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org). Common prefixes:

- `feat:` user-facing capability
- `fix:` user-facing bug fix
- `refactor:` internal cleanup, no behavior change
- `docs:` README, help.md, MCP.md, CHANGELOG, CLAUDE.md
- `test:` test-only changes
- `chore:` deps, CI, repo hygiene
- `perf:` measurable performance improvement

Squash-merging is the only merge strategy enabled, so individual commit style is less
critical than the final PR title — keep that one Conventional.

## Releases

We follow [Semantic Versioning](https://semver.org) and keep a [CHANGELOG.md](./CHANGELOG.md)
in the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Maintainers tag
releases as `vX.Y.Z`; the release workflow verifies, builds, and (when `NPM_TOKEN` is
configured) publishes to npm.

## Code of Conduct

Participation in this project is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).
TL;DR: be respectful, assume good faith, focus on the work.

## Security

Vulnerabilities? Don't open a public issue. See [SECURITY.md](./SECURITY.md) for the
private disclosure path.
