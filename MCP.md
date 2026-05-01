# MCP — Model Context Protocol

gsccli ships an MCP server that lets any compatible LLM client (Claude Desktop, Cursor,
Cline, Zed) call Search Console as a set of typed tools.

```bash
gsccli mcp serve
```

Speaks JSON-RPC 2.0 over stdio. Auth is reused from gsccli's normal chain
(OAuth tokens or service account).

## Tools exposed

| Tool | Purpose |
|------|---------|
| `gsccli_query` | Run a Search Analytics query — clicks, impressions, CTR, position by dimension |
| `gsccli_sites_list` | List Search Console sites the authenticated user can access |
| `gsccli_sitemaps_list` | List sitemaps registered for a site |
| `gsccli_inspect_url` | URL Inspection — index status, mobile usability, AMP, rich results |

All tools are **read-only**. Write operations (`sites add`/`delete`, `sitemaps submit`/`delete`),
the Indexing API (`index publish`/`batch`), and `inspect batch` (which can burn the daily
2,000/property quota) are NOT exposed to MCP — running them via prompt injection would
silently change a production property or burn a hard-capped quota. Run those manually via
the CLI, where you can see exactly what's about to happen and abort with Ctrl-C.

## Configure once

```bash
gsccli config set site https://example.com/        # default site
gsccli auth login --client-secret-file ./client_secret.json
```

## Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%AppData%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "gsccli": {
      "command": "gsccli",
      "args": ["mcp", "serve"]
    }
  }
}
```

Pin a specific site per client via env:

```json
{
  "mcpServers": {
    "gsccli-marketing": {
      "command": "gsccli",
      "args": ["mcp", "serve"],
      "env": { "GSC_SITE_URL": "https://marketing.example.com/" }
    },
    "gsccli-blog": {
      "command": "gsccli",
      "args": ["mcp", "serve"],
      "env": { "GSC_SITE_URL": "sc-domain:blog.example.com" }
    }
  }
}
```

## Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "gsccli": {
      "command": "gsccli",
      "args": ["mcp", "serve"]
    }
  }
}
```

## Cline (VS Code extension)

In Cline settings → MCP Servers → Add:

- Name: `gsccli`
- Command: `gsccli`
- Args: `mcp serve`

## Zed

`~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "gsccli": {
      "command": {
        "path": "gsccli",
        "args": ["mcp", "serve"]
      }
    }
  }
}
```

## Architecture notes

- The same service layer is shared with the CLI — no duplicate business logic.
- Logger is suppressed in MCP mode to keep stdout strictly to JSON-RPC frames.
- Auth resolution runs per process (OAuth tokens are loaded from
  `~/.gsccli/oauth-tokens.json` at server start; refreshed transparently on use).
- Each tool call validates its inputs with Zod before reaching the API.
- Errors propagate as JSON-RPC errors, not as crashes.

## Why only four tools?

The Search Console API has a small surface (Search Analytics, Sites, Sitemaps, URL
Inspection). Four well-named tools beat 30 overlapping ones for LLM ergonomics: smaller
discovery surface, less ambiguity, less prompt injection blast radius. If you need
write operations or batch queries, run them from the shell.
