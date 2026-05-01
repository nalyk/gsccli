# Security Policy

## Supported versions

`gsccli` follows [SemVer](https://semver.org). Only the latest minor of the current
major receives security fixes.

| Version  | Supported          |
|----------|--------------------|
| 1.x      | :white_check_mark: |
| < 1.0    | :x:                |

## Reporting a vulnerability

**Do not open a public GitHub issue.**

Use one of the following private channels:

1. **Preferred — GitHub Security Advisories**:
   <https://github.com/nalyk/gsccli/security/advisories/new>
2. **Email**: **dev.ungheni@gmail.com** with subject prefix `[gsccli security]`.

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (a minimal `gsccli …` invocation, config layout, or code path).
- The `gsccli --version` and `node --version` you tested against.
- Any suggested mitigation if you have one.

## Response expectations

- **Acknowledgement**: within 7 days.
- **Triage decision** (accepted / not-a-vuln / duplicate): within 14 days.
- **Fix or mitigation**: target 30 days for high-severity, 90 days otherwise.

If you don't hear back, ping the email address again — mail can fail silently.

## What counts as a vulnerability

- Auth bypass — anything that uses a credential the user didn't intend to use.
- Token exfiltration — `gsccli` writing OAuth tokens or service-account JSON to a
  location an attacker can read, or printing them to stdout/stderr.
- Cache poisoning — anything that lets one site's cache entry be served for another.
- Arbitrary file write outside `~/.gsccli/` (or `$GSCCLI_CONFIG_DIR`) and the user's
  explicit `-o` argument.
- Command injection through user-supplied input that `gsccli` shells out with.
- MCP server escalation — anything that lets an MCP client invoke a write operation
  (the MCP surface is read-only by design).

## What is **not** a vulnerability

- Google-side rate limits or quota exhaustion.
- API errors surfaced verbatim from `googleapis`.
- Output containing site URLs, GA property IDs, or other data that the authenticated
  user already has access to via the GSC web UI.
- Accidentally pasting a credential into a public issue (rotate it; that's not a
  product flaw).

## Disclosure

Once a fix is released, the advisory is published with credit to the reporter
(unless you prefer to remain anonymous). CVE assignment via GitHub when warranted.
