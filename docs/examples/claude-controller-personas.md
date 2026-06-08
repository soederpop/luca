---
title: "Claude Controller Personas"
tags: [claude, claude-code, tmux, personas, agents]
lastTested: null
lastTestPassed: null
---

# Claude Controller Personas

Use `claudeController` personas when you want repeatable interactive Claude Code workers with different instructions, allowed directories, tools, MCP servers, and permission behavior.

`claudeController` does not use `claude -p`. It starts real interactive Claude Code sessions inside tmux and returns `ClaudeSessionController` workers. The top-level `ClaudeController` only defines personas and spawns/list/stops session workers; each worker owns `ask()`, `respond()`, `chooseOption()`, screen state, and JSONL session lookup.

## Quick Start

```ts
const controller = container.feature('claudeController')

controller.definePersona('reviewer', {
  description: 'Strict Luca-aware code reviewer',
  systemPrompt: `You are a strict code reviewer for Luca projects.`,
  appendSystemPrompt: `Check Luca conventions, tests, API shape, and edge cases.`,
  addDirs: ['/Users/jonathansoeder/@soederpop/projects/luca'],
  skillsFolders: ['/Users/jonathansoeder/@agentic-loop/.claude/skills'],
  tools: ['Read', 'Grep', 'Glob', 'Bash'],
  allowedTools: ['Bash(git *)', 'Bash(bun test *)'],
  permissionMode: 'acceptEdits',
})

const reviewer = controller.create({
  id: 'reviewer',
  cwd: '/Users/jonathansoeder/@soederpop/projects/luca',
  persona: 'reviewer',
})

await reviewer.start()
await reviewer.ask('Review the current diff and tell me what is risky.')
```

The persona compiles to normal interactive Claude Code CLI flags before the session starts. For example, the persona above passes flags like `--system-prompt`, `--append-system-prompt`, `--add-dir`, `--tools`, `--allowed-tools`, and `--permission-mode` to `claude`.

## Defining Personas

Call `definePersona(name, persona)` on the controller. Names are arbitrary strings; use short stable names because they are how later `create()`, `start()`, or `startMany()` calls select a persona.

```ts
controller.definePersona('docs', {
  description: 'Documentation writer',
  systemPrompt: `You write concise docs with runnable TypeScript examples.`,
  appendSystemPrompt: `Prefer Luca container APIs over direct node imports.`,
  addDirs: ['/repo'],
  skillsFolders: ['/repo/.claude/skills'],
  tools: ['Read', 'Grep', 'Glob', 'Edit'],
  permissionMode: 'plan',
})
```

You can define personas during container boot, inside a command, or in whatever module owns your orchestration setup.

## Listing Available Personas

Use `listPersonas()` to see the personas registered on this controller instance.

```ts
const personas = controller.listPersonas()

for (const { name, persona } of personas) {
  console.log(name, persona.description ?? '')
}
```

Use `getPersona(name)` to inspect one persona:

```ts
const reviewer = controller.getPersona('reviewer')
if (!reviewer) throw new Error('reviewer persona is not registered')

console.log(reviewer.systemPrompt)
```

Personas live in memory on the controller. If you need persistence, store your persona definitions in your project config and call `definePersona()` during startup.

## Starting One Persona

`create()` constructs a worker without starting tmux. `start()` constructs and starts it immediately.

```ts
const controller = container.feature('claudeController')

const worker = controller.create({
  id: 'docs-worker',
  cwd: '/repo',
  persona: 'docs',
})

await worker.start()
await worker.ask('Update docs for the new command.')
```

Or:

```ts
await controller.start({
  id: 'docs-worker',
  cwd: '/repo',
  persona: 'docs',
})

const worker = controller.session('docs-worker')
await worker?.ask('Update docs for the new command.')
```

## Starting Multiple Personas

Use `startMany()` to launch multiple interactive Claude Code sessions with different personas.

```ts
await controller.startMany([
  { id: 'planner', cwd: repo, persona: 'architect' },
  { id: 'tester', cwd: repo, persona: 'tdd' },
  { id: 'reviewer', cwd: repo, persona: 'reviewer' },
])

await controller.session('planner')?.ask('Plan the refactor.')
await controller.session('tester')?.ask('Write focused tests for the refactor.')
await controller.session('reviewer')?.ask('Review the diff for Luca convention issues.')
```

Each session has its own tmux session, cwd, arguments, state snapshot, prompt choices, and input methods.

## Inline Personas

You do not have to register a persona first. Pass a persona object directly in `create()` or `start()` for one-off sessions.

```ts
const spike = controller.create({
  id: 'spike',
  cwd: repo,
  persona: {
    description: 'One-off exploration worker',
    systemPrompt: 'Explore the codebase and report options. Do not edit files.',
    tools: ['Read', 'Grep', 'Glob'],
    permissionMode: 'plan',
  },
})

await spike.start()
await spike.ask('Find the likely files involved in adding OAuth support.')
```

## Overriding Persona Options per Session

Spawn options override scalar persona fields such as `systemPrompt`, `appendSystemPrompt`, `permissionMode`, `tools`, `allowedTools`, and `settingsFile`.

Array-like context fields are combined:

- `mcpConfig`: persona entries first, then session entries
- `addDirs`: persona entries first, then session entries
- `skillsFolders`: appended to the `--add-dir` list after regular dirs
- `args`: raw extra Claude CLI args appended last

```ts
const worker = controller.create({
  id: 'docs-opus',
  persona: 'docs',
  cwd: repo,
  systemPrompt: 'Use the docs persona, but focus on API reference only.',
  addDirs: ['/another/repo'],
  args: ['--model', 'opus'],
})
```

This keeps personas reusable while still letting each worker tune model, directories, or instructions for one run.

## Full Persona Example with MCP

```ts
controller.definePersona('luca-architect', {
  description: 'Architect for Luca framework changes',
  systemPrompt: `
You are an architect for the Luca framework.
Think in terms of container features, helpers, commands, and runtime discovery.
Do not use claude -p. You are running as an interactive tmux-backed Claude Code session.
`,
  appendSystemPrompt: `
Before proposing implementation details, inspect the runtime surface with luca describe when useful.
Prefer container.paths and container.feature('fs') over direct path/fs imports.
`,
  addDirs: [
    '/Users/jonathansoeder/@soederpop/projects/luca',
    '/Users/jonathansoeder/@agentic-loop',
  ],
  skillsFolders: [
    '/Users/jonathansoeder/@agentic-loop/.claude/skills',
  ],
  mcpConfig: [
    './.claude/mcp.shared.json',
  ],
  mcpServers: {
    luca: {
      type: 'stdio',
      command: 'bun',
      args: ['run', './mcp/luca-server.ts'],
    },
  },
  strictMcpConfig: true,
  tools: ['Read', 'Grep', 'Glob', 'Bash', 'Edit'],
  allowedTools: [
    'Bash(git status *)',
    'Bash(git diff *)',
    'Bash(bun test *)',
    'Bash(luca describe *)',
    'Bash(luca eval *)',
  ],
  permissionMode: 'acceptEdits',
  settingsFile: './.claude/settings.architect.json',
})
```

Then start it:

```ts
const architect = controller.create({
  id: 'architect',
  cwd: '/Users/jonathansoeder/@soederpop/projects/luca',
  persona: 'luca-architect',
})

await architect.start()
await architect.ask('Design a small API for persisted persona profiles.')
```

## Persona Options

| Option | Type | CLI output | Notes |
|--------|------|------------|-------|
| `description` | `string` | none | Human-readable note for `listPersonas()` output. |
| `systemPrompt` | `string` | `--system-prompt <text>` | Main system prompt for Claude Code. Session option overrides persona value. |
| `appendSystemPrompt` | `string` | `--append-system-prompt <text>` | Additional system prompt text. Session option overrides persona value. |
| `mcpConfig` | `string[]` | `--mcp-config <configs...>` | Paths to MCP config files. Persona and session arrays are combined. |
| `mcpServers` | `Record<string, any>` | `--mcp-config '{"mcpServers": ...}'` | Inline MCP servers are merged with session servers and passed as an MCP config JSON argument. |
| `strictMcpConfig` | `boolean` | `--strict-mcp-config` | Requires Claude Code to validate MCP config strictly. |
| `addDirs` | `string[]` | `--add-dir <dirs...>` | Additional directories Claude may access. Persona and session arrays are combined. |
| `skillsFolders` | `string[]` | included in `--add-dir <dirs...>` | Directories that contain Claude skills. They are added as allowed dirs for interactive Claude sessions. |
| `tools` | `string[]` | `--tools <tools...>` | Tool names made available to Claude Code. Session option overrides persona value. |
| `allowedTools` | `string[]` | `--allowed-tools <tools...>` | Permission allow-list entries. Session option overrides persona value. |
| `permissionMode` | string enum | `--permission-mode <mode>` | One of `default`, `acceptEdits`, `auto`, `bypassPermissions`, `plan`, `dontAsk`. |
| `settingsFile` | `string` | `--settings <file>` | Claude Code settings file path. Session option overrides persona value. |

## Start Options Related to Personas

These options are passed to `create()`, `start()`, or each entry in `startMany()`:

| Option | Type | Notes |
|--------|------|-------|
| `id` | `string` | Worker/session id. Normalized to a compact tmux-safe id. |
| `cwd` | `string` | Working directory for this Claude Code session. |
| `persona` | `string | ClaudeControllerPersona` | Registered persona name or inline persona object. |
| `args` | `string[]` | Raw extra Claude CLI arguments appended after persona-compiled args. |
| `width` | `number` | tmux pane width. Defaults to controller option. |
| `height` | `number` | tmux pane height. Defaults to controller option. |
| `reuse` | `boolean` | Reuse an existing tmux session when supported by the worker. |

The start options also accept every persona option, so you can override or extend persona configuration per session.

## Permission Mode Notes

Common modes:

- `plan`: safest for exploration. Claude can plan and ask before edits.
- `acceptEdits`: useful for coding workers where you want Claude Code to accept file edits more smoothly.
- `default`: normal Claude Code permission behavior.
- `dontAsk`, `auto`, `bypassPermissions`: more permissive modes. Use only when you understand the local Claude Code behavior and trust the working directory.

For unattended or parallel sessions, prefer tight `allowedTools` plus a specific `cwd` and `addDirs` rather than broad permissions.

## Interacting with a Persona Worker

After the worker starts, use the session worker API, not the controller, for input.

```ts
const worker = controller.session('reviewer')
if (!worker) throw new Error('reviewer session was not started')

await worker.ask('Review the diff.')

const snapshot = await worker.refresh()
if (snapshot.awaitingInput) {
  console.log(snapshot.choices)
  await worker.chooseOption(0)
}
```

The controller intentionally does not expose `ask()`, `respond()`, or `chooseOption()` directly. Those methods belong to `ClaudeSessionController` because each worker already knows its own tmux session and Claude state.

## Troubleshooting

### Unknown persona

If `create({ persona: 'reviewer' })` throws `Unknown Claude controller persona: reviewer`, define it first or pass an inline persona object.

```ts
if (!controller.getPersona('reviewer')) {
  controller.definePersona('reviewer', { systemPrompt: 'Review code carefully.' })
}
```

### Persona did not change a running session

Personas compile into CLI args before a worker starts. Changing a persona after `worker.start()` does not rewrite the already-running Claude Code process. Stop and start a new worker to apply the changed persona.

### Claude cannot see files

Make sure `cwd`, `addDirs`, and `skillsFolders` include the directories Claude needs. For multi-repo work, set the worker `cwd` to the main repo and put sibling repos in `addDirs`.

### MCP server does not load

Check these first:

- `mcpConfig` paths are correct relative to the worker `cwd`
- inline `mcpServers` have the expected `command` and `args`
- `strictMcpConfig` is not rejecting a loose config
- the command works when run manually from the same `cwd`

## Minimal Pattern for Project Commands

A project command that spawns named workers can define personas once, list them for the operator, then start selected ones.

```ts
export default async function run({ container }) {
  const claude = container.feature('claudeController')
  const repo = container.paths.resolve('.')

  claude
    .definePersona('planner', {
      description: 'Plans the change without editing',
      systemPrompt: 'Plan the implementation. Do not edit files.',
      tools: ['Read', 'Grep', 'Glob'],
      permissionMode: 'plan',
    })
    .definePersona('implementer', {
      description: 'Writes code and tests',
      systemPrompt: 'Implement the requested change using Luca conventions.',
      tools: ['Read', 'Grep', 'Glob', 'Edit', 'Bash'],
      allowedTools: ['Bash(bun test *)', 'Bash(luca describe *)'],
      permissionMode: 'acceptEdits',
    })

  console.table(claude.listPersonas().map(({ name, persona }) => ({
    name,
    description: persona.description ?? '',
  })))

  await claude.startMany([
    { id: 'planner', cwd: repo, persona: 'planner' },
    { id: 'implementer', cwd: repo, persona: 'implementer' },
  ])
}
```
