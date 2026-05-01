<!--
Thanks for the PR. Keep this template intact — empty sections are fine, but don't delete the headers.
PR title MUST be Conventional Commits (feat: / fix: / refactor: / docs: / test: / chore: / perf:)
because squash-merge uses it as the merge commit subject.
-->

## Summary

<!-- 1–3 sentences: WHY this change exists. Not what — `git diff` shows that. -->

## Type of change

- [ ] `feat` — user-facing capability
- [ ] `fix` — user-facing bug fix
- [ ] `refactor` — internal cleanup, no behavior change
- [ ] `perf` — measurable performance improvement
- [ ] `docs` — README / help.md / MCP.md / CHANGELOG / CLAUDE.md
- [ ] `test` — test-only changes
- [ ] `chore` — deps, CI, repo hygiene
- [ ] **Breaking change** (also tick one above)

## Test plan

<!--
The exact commands a reviewer should run to convince themselves this works.
Replace the placeholders below; don't leave them.
-->

- [ ] `pnpm verify` passes locally
- [ ] New behavior covered by a test (or this is a `chore` / `docs`)
- [ ] Manual smoke: `pnpm dev <command> …` → expected output

## CLAUDE.md invariants

<!-- Tick any rules from CLAUDE.md that this PR touches, and explain why the change is still safe. -->

- [ ] Pipeline order (Commander → resolveGlobalOptions+validate → service → ReportData → format → write)
- [ ] `handleError` is terminal
- [ ] stdout = data, stderr = status
- [ ] Imports end in `.js` (ESM)
- [ ] Service results return `ReportData`
- [ ] Auth chain (OAuth > GOOGLE_APPLICATION_CREDENTIALS > config `credentials`)
- [ ] None of the above touched

## Screenshots / sample output (optional)

<!-- For new commands or output-format changes, paste a small example. -->

## Checklist

- [ ] PR title is Conventional Commits
- [ ] CHANGELOG.md updated (under `## [Unreleased]`) for user-facing changes
- [ ] Docs updated (README / help.md / MCP.md) if behavior changed
- [ ] No secrets, no real site URLs / account IDs in diffs or fixtures
