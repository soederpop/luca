---
title: Subagent Provider Tool Parity
status: exploring
tags:
  - assistants
  - mcp
  - claude-code
  - codex
  - providers
goal: Give codex-backed assistants the same automatic Luca tool access claude-code-backed ones get, and make permission/approval posture explicit instead of inherited from the user's local config.
needs: []
---

# Subagent Provider Tool Parity

When an assistant uses `provider: claude-code` or `provider: codex`, it stops being a
tool-calling loop that Luca drives and becomes a delegation to another agent that runs its
own loop. Today those two paths behave very differently, and neither one is explicit about
permissions.

## How it works today

On the OpenAI-compatible path, `Assistant.conversation` passes `tools: this.tools` into the
`conversation` feature and Luca runs the agentic loop in-process — it sees every tool call
and every result.

The subagent transports don't do that. Both `ClaudeSessionTransport` and
`OpenAICodexTransport` hardcode `toolCalls: []` in the response they yield. The subagent
runs its own loop and Luca only observes the final text plus a resume handle
(`claudeSessionId` / `codexThreadId`).

### claude-code

Tools reach the subagent over MCP, automatically:

- `ClaudeSessionTransport.resolveMcpServers()` registers a stdio server
  `luca mcp --assistant <name> --transport stdio`.
- `Assistant.conversation` defaults `providerOptions.assistant` to the assistant's own
  name, so this needs no configuration.
- `src/commands/mcp.ts` walks `asst.tools` and re-registers each one as an MCP tool, plus a
  `README` tool that returns the effective system prompt.
- The spawned Claude therefore sees the assistant's tools as
  `mcp__luca-<name>__<ToolName>`. With `askOnly: true` the surface collapses to
  `README` + `Ask_<name>` for stateless one-shot delegation.

### codex

No equivalent wiring exists. `OpenAICodexTransport` sends the prompt plus
`developer_instructions` and nothing else. A codex-backed assistant gets codex's built-in
shell/edit tools and **none** of its own Luca tools. Same frontmatter, silently different
capability set.

## Problem

1. **Provider choice silently changes what the assistant can do.** Swapping
   `provider: claude-code` for `provider: codex` in frontmatter looks like a model swap but
   actually strips every custom tool. Nothing warns about it.
2. **Permission posture is inherited, not declared.** Neither transport sets a default
   permission or approval mode, so behavior depends on the operator's local
   `~/.claude/settings.json` or codex config. The same assistant behaves differently on two
   machines.
3. **Denials are invisible.** Both subagents run headless (`claude -p`,
   `codex exec --json`), so a permission gate never blocks for a human — the tool call is
   simply refused and the subagent works around it. The run "succeeds" with a quietly
   degraded result, and because `toolCalls: []`, Luca has no signal that it happened.

## Core Idea

Treat "which tools does the subagent have" and "what is it allowed to do without asking"
as declared properties of the assistant, uniform across subagent providers.

### 1. Codex MCP wiring

`OpenAICodexTransport` should build the same `luca mcp --assistant <name>` server that the
claude path does. The plumbing already exists: `CodexRunOptions.config` is forwarded as
`-c key=value` TOML overrides in `buildArgs`, so this becomes something like:

```
mcp_servers.luca-<name>.command = "luca"
mcp_servers.luca-<name>.args = ["mcp", "--assistant", "<name>", "--transport", "stdio"]
```

Worth factoring `resolveMcpServers` out of `ClaudeSessionTransport` into shared code so
both transports honor `providerOptions.mcpServers`, `lucaBin`, `askOnly`, and
`mcpServerName` identically. Note the codex stdio framing quirk — `luca mcp` already has a
`--stdio-compat codex` profile, which the codex-spawned server probably needs.

### 2. Declared autonomy level

One frontmatter concept that maps onto both CLIs, rather than making authors learn two
vocabularies:

| Luca level  | claude-code                                | codex                                    |
|-------------|--------------------------------------------|------------------------------------------|
| `readonly`  | `permissionMode: plan`                     | `sandbox: read-only`                     |
| `workspace` | `permissionMode: acceptEdits`              | `sandbox: workspace-write`, `fullAuto`   |
| `full`      | `permissionMode: bypassPermissions`        | `sandbox: danger-full-access`, `fullAuto`|

Default to `workspace` so a subagent-backed assistant is deterministic out of the box
instead of picking up whatever the host machine allows. Escaping to `full` stays explicit.
Per-provider escape hatches (`providerOptions.runOptions`, `providerOptions.config`) keep
working and continue to win, since they're spread last.

### 3. Tool scoping

For assistants whose whole point is their own tools, allow narrowing the subagent to just
those:

- claude-code: `allowedTools: ['mcp__luca-<name>']` plus `strictMcpConfig: true` so the
  operator's personal MCP servers don't leak in.
- codex: the analogous config-level restriction.

A frontmatter flag like `subagentTools: own | own+builtin | all` would express this without
authors writing CLI flags. `own` is the honest default for a delegation assistant.

### 4. Surface the denials

Even without full tool-call streaming, the transports could parse the subagent's event
stream for permission-denied / sandbox-blocked tool results and either warn or attach them
to `providerData`. Turning a silent degradation into a visible one is most of the value.

## Open Questions

- Should tool calls made *inside* the subagent be echoed into Luca's conversation history
  as real tool-call records? It would make traces and history/replay far more useful, but
  it means parsing each CLI's stream format into a common shape and reconciling that with
  `historyMode`.
- Does the MCP callback create a recursion hazard? `luca mcp --assistant <name>` spins up a
  *new* instance of the same assistant to serve tools. If that assistant's provider is
  itself claude-code, a tool call could fan out into another subagent. Probably wants a
  depth guard, similar to `forkDepth`.
- `luca mcp --assistant` starts the assistant just to enumerate `asst.tools`. For an
  assistant with expensive startup, that's paid on every subagent spawn. Worth a
  tools-only lightweight init path?
- Is `askOnly` actually the better default for codex, given codex's built-in tools already
  cover shell and edits? Maybe the codex answer is "delegate a question," not "hand over
  the whole toolbox."

## Related

- [[local-mcp-bridge]] — the inverse direction: MCP servers as tools for the in-process
  loop, rather than Luca tools as MCP for a subagent.
