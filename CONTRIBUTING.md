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

Fully automated. We follow [Semantic Versioning](https://semver.org) and keep
a [CHANGELOG.md](./CHANGELOG.md) the bot owns end-to-end.

### How a release happens (zero manual editing)

1. **Contributor opens a PR** with a Conventional-Commits title (the PR-title-lint
   workflow blocks anything else; squash-merge means the title becomes the commit).
2. **PR merges to `main`.** `ci.yml` already verified lint + type-check + tests + build.
3. **`release-please.yml` runs.** It walks every commit since the last `v<X.Y.Z>` tag
   and either:
   - opens a "release PR" (`chore(main): release X.Y.Z`) that bumps `package.json` +
     `.release-please-manifest.json` + prepends a CHANGELOG entry, OR
   - updates the existing release PR with the new commit, OR
   - does nothing (commit was `chore:`/`ci:`/`docs:` — not version-bumping).
4. **Maintainer reviews + admin-merges the release PR.** This is the only human step.
5. **`release-please.yml` runs again on the merge.** It creates the `vX.Y.Z` git tag.
6. **`release.yml` fires from the tag push.** It matrix-verifies on Node 22 + 24,
   asserts tag↔package.json agree, builds + smoke-tests the freshly-packed tarball,
   creates a GitHub Release with the tarball as a downloadable asset (release-please
   is configured with `skip-github-release: true` so this side owns it), and publishes
   to npm via **OIDC trusted publishing** (no token, provenance attestation
   auto-attached).

The whole loop is: **commit → review → merge → release-please opens version PR →
merge that → published.**

### Bump rules (Conventional Commits → version)

- `feat:` → minor bump (1.2.x → 1.3.0)
- `fix:` / `perf:` / `revert:` / `refactor:` → patch bump (1.2.0 → 1.2.1)
- `feat!:` / `BREAKING CHANGE:` in body → major bump (1.x → 2.0.0)
- `docs:` / `ci:` / `chore:` / `style:` / `test:` / `build:` → no bump (rolled into next release)

### Recovering from a release-please defensive abort

If two PRs merge in rapid succession, release-please can sometimes log
`There are untagged, merged release PRs outstanding - aborting` and skip tag
creation. Recovery: tag the squash-merge commit of the release PR by hand.

```bash
git pull --rebase
node -p "require('./package.json').version"     # confirm = X.Y.Z
git tag -a vX.Y.Z -m "vX.Y.Z" $(git log --grep "release X.Y.Z" --format=%H -1)
git push origin vX.Y.Z
```

`release.yml` fires from the tag push. release-please reconciles itself on the
next push to `main`.

### First-publish bootstrap (one-time, human-only)

OIDC trusted publishing requires the package to already exist on npm before the
trusted-publisher relationship can be configured. The first publish is therefore
manual:

```bash
# 1. Pull latest, confirm logged-in identity
git pull
npm whoami        # if missing: npm login

# 2. Build
pnpm install --frozen-lockfile
pnpm build

# 3. Get a fresh OTP from your authenticator app and publish within 30 seconds.
#    Always pass --otp explicitly; npm 11.x sometimes 403s instead of prompting.
npm publish --otp=XXXXXX --access public

# 4. Confirm
npm view @nalyk/gsccli@$(node -p "require('./package.json').version") dist.tarball
```

Then configure the trusted publisher at <https://www.npmjs.com/package/@nalyk/gsccli/access>
→ **Trusted Publishers** tab → **Add trusted publisher**:

| Field                | Value             |
|----------------------|-------------------|
| Provider             | GitHub Actions    |
| Organization or user | `nalyk`           |
| Repository           | `gsccli`          |
| Workflow filename    | `release.yml`     |
| Environment name     | `npm`             |

Save. From this point on, every `vX.Y.Z` tag pushed to `main` ships via OIDC with
zero secrets.

### Verify OIDC works (after bootstrap + trusted-publisher config)

```bash
gh workflow run release.yml --ref main
```

A green run on `main` is proof the OIDC handshake works end-to-end. The publish step
will emit `::notice::@nalyk/gsccli@X.Y.Z already on npm — skipping publish.` because
the idempotency guard sees the bootstrap publish.

## Code of Conduct

Participation in this project is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).
TL;DR: be respectful, assume good faith, focus on the work.

## Security

Vulnerabilities? Don't open a public issue. See [SECURITY.md](./SECURITY.md) for the
private disclosure path.
