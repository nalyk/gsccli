# gsccli agent skills

This directory ships with the `@nalyk/gsccli` npm package. It contains a single
**Agent Skills** (`SKILL.md`) per supported AI coding-agent CLI. Each skill teaches
the agent to use `gsccli` like a senior power user — knowing the `--all` streaming
trick, the `--cache 1h` cache, the `country=usa` lowercase / `device=MOBILE`
uppercase rule, the `!~=` filter parser order, the period-comparison delta sort,
the 25,000-row hard cap and 50,000 daily property pair cap, the `searchAppearance`
solo constraint, and the rest.

There is no MCP, no plugin, no extension manifest, no custom slash command, no
profile snippet. Just one `SKILL.md` per CLI, optionally with that CLI's idiomatic
companion (Codex's `agents/openai.yaml` UI metadata).

## Install

The recommended path is the bundled subcommand:

```bash
gsccli skills install --agent <claude|codex|gemini|qwen|all>
                      [--scope <user|project>]   # default: user
                      [--dry-run]
                      [--force]
```

Manual install also works — copy the per-CLI directory yourself:

| Agent       | `--scope user` (default)                                | `--scope project`                            |
| ----------- | ------------------------------------------------------- | -------------------------------------------- |
| Claude Code | `cp -r agents/claude-code/gsccli ~/.claude/skills/`     | `cp -r agents/claude-code/gsccli .claude/skills/`     |
| Codex       | `cp -r agents/codex/gsccli ~/.codex/skills/`            | `cp -r agents/codex/gsccli .codex/skills/`            |
| Gemini      | `cp -r agents/gemini/gsccli ~/.gemini/skills/`          | `cp -r agents/gemini/gsccli .gemini/skills/`          |
| Qwen Code   | `cp -r agents/qwen/gsccli ~/.qwen/skills/`              | `cp -r agents/qwen/gsccli .qwen/skills/`              |

After install, restart the agent or run its skill-reload command.

## Per-CLI caveats

### Claude Code
- The skill uses `allowed-tools: Bash(gsccli *), Read` to pre-approve all `gsccli`
  invocations. **Note:** if your global `~/.claude/settings.json` (or
  `.claude/settings.json`) contains a `permissions.deny` entry that matches
  `Bash(gsccli *)` or `Bash(*)`, deny wins; the skill cannot override it. Permission
  precedence: deny > ask > allow.

### Codex
- The skill ships with an `agents/openai.yaml` UI metadata file (display name,
  short description, brand color, `default_prompt` for implicit invocation,
  dependency declarations).
- For `--scope project`, the project must be marked
  `[projects."<absolute-path>"] trust_level = "trusted"` in `~/.codex/config.toml`
  for Codex to load `.codex/skills/`. Run `codex` from the project once and it will
  prompt you, or add the entry by hand.
- Codex profiles are stable in CLI/IDE 0.125+ but remain experimental in the Codex
  app. Codex deprecated custom commands in 0.126 in favor of skills — this skill
  package is the right approach.

### Gemini CLI
- The skill uses Gemini's `when_to_use`, `user_invocable`, and
  `allowed_tools: [run_shell_command]` frontmatter fields.
- **`gsccli auth login` opens a browser for OAuth.** Gemini's sandbox modes
  (Docker / Podman / Seatbelt restrictive) block browser launch. Run
  `gsccli auth login` ONCE outside the sandbox to cache tokens at
  `~/.gsccli/oauth-tokens.json`; subsequent `gsccli` calls inside Gemini will
  use the cached tokens.

### Qwen Code
- Qwen has open issue **#2343** where skills sometimes don't auto-discover. If
  the skill isn't picked up, run `/skills` once to load it manually.
- **Qwen OAuth free tier was discontinued 2026-04-15.** You must have a
  `DASHSCOPE_API_KEY`, an Alibaba Cloud Coding Plan, or an OpenAI-compatible
  endpoint configured. Cached free-tier tokens no longer work.
- Recommended model for tool-use reliability: `qwen3-coder-plus` (production)
  or `qwen3-coder-next` (local inference). `qwen3-coder-flash` works but
  becomes unreliable with many tools loaded.

## Verification

After install, ask the agent these in order:

1. **"List my Search Console properties."** Expect `gsccli sites list -f json`
   (or table) with results.
2. **"Find pages losing clicks compared to last month."** Expect a `gsccli query
   compare -d page --vs-start-date ... --sort-by delta_clicks:asc` invocation.
3. **"Show top queries from USA on mobile."** Expect `country=usa` (lowercase)
   and `device=MOBILE` (uppercase). Either case wrong → the skill needs sharpening.
4. **"Inspect 5,000 URLs."** Expect `gsccli inspect batch --concurrency 5 --rps 8`
   AND a warning about the 2,000/day per-property quota.

Skill content is identical across all four CLIs; only the frontmatter and (for
Codex) the UI metadata file differ.

## Updating

When you upgrade gsccli (`npm i -g @nalyk/gsccli@latest`), re-run the install
command with `--force` to refresh the deployed skills:

```bash
gsccli skills install --agent all --force
```

## Authoring vs deployment

The files under `agents/<cli>/gsccli/` are the **canonical, version-controlled**
skill packages. The install subcommand simply copies them to the target locations.
If you want to customize a skill for your own use, edit the deployed copy at
`~/.<cli>/skills/gsccli/SKILL.md` rather than this directory — your changes here
will be overwritten on the next `gsccli skills install --force`.
