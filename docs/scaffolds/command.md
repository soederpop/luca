# Building a Command

A command extends the `luca` CLI. Commands live in a project's `commands/` folder and are automatically discovered. They are Helper subclasses under the hood — the framework grafts your module exports into a Command class at runtime.

When to build a command:
- You need a CLI task for a project (build scripts, generators, automation)
- You want argument parsing, help text, and container access for free
- The task should be runnable via `luca yourCommand`

## Imports

```ts
import { z } from 'zod'
import type { ContainerContext, CommandArgs } from 'luca'
```

## Positional Arguments

Export a `positionals` array to map CLI positional args into named options fields. The first positional (`_[0]`) is always the command name — `positionals` maps `_[1]`, `_[2]`, etc.

```ts
// luca {{kebabName}} ./src  =>  options.target === './src'
export const positionals = ['target']
```

Positionals show up in `--help` as an `Arguments:` section. The description comes from the matching `argsSchema` field. When a positional has no schema field, use the object form to describe it inline:

```ts
export const positionals = [
  { name: 'target', description: 'The file or folder to operate on', required: false },
]
```

A trailing `'...name'` positional collects all remaining args as an array (a trailing field typed `z.array(...)` in the schema does the same):

```ts
// luca {{kebabName}} sum 1 2 3  =>  options.request === 'sum', options.numbers === [1, 2, 3]
export const positionals = ['request', '...numbers']

export const argsSchema = z.object({
  request: z.string().describe('The operation to perform'),
  numbers: z.array(z.number()).default([]).describe('Values to operate on'),
})
```

Parsing agrees with your schema — no workarounds needed:
- Boolean flags never consume a following positional (`luca {{kebabName}} --json foo` keeps `foo` as a positional).
- Positionals arrive as strings and are coerced to what the schema field expects — `z.string()` accepts `8080`, `z.number()` accepts `'8080'`. Don't reach for `z.union([z.string(), z.number()])`.

## Rich Help: Subcommands and Examples

Commands are how you teach other developers (and agents) to use your project's tooling — `--help` should tell the whole story. Two more exports feed the help system:

```ts
// Renders a Subcommands: section, and gives each subcommand focused help:
// `luca {{kebabName}} sync --help` shows just that entry with its examples.
export const subcommands = {
  sync: {
    args: '<source>',
    description: 'Pull the latest data from a source',
    examples: ['luca {{kebabName}} sync ./data'],
  },
  status: {
    description: 'Show what would change without applying it',
  },
}

// Renders an Examples: section at the bottom of --help.
// Plain strings, or { command, description } to add a one-line comment.
export const examples = [
  'luca {{kebabName}} sync ./data',
  { command: 'luca {{kebabName}} status --json', description: 'Machine-readable output' },
]
```

Subcommand *dispatch* stays in your handler — read the subcommand from a positional (`export const positionals = ['subcommand']`, then branch on `options.subcommand`). The `subcommands` export is the declarative help metadata that makes it discoverable. Fields named in `positionals` are automatically excluded from the `Options:` listing so they aren't documented twice.

## Args Schema

Define your command's arguments and flags with Zod. Each field becomes a `--flag` on the CLI. Fields named in `positionals` also accept positional args.

```ts
export const argsSchema = z.object({
  // Positional: first arg after command name (via positionals array above)
  // target: z.string().optional().describe('The target to operate on'),

  // Flags: passed as --flag on the CLI
  // verbose: z.boolean().default(false).describe('Enable verbose output'),
  // output: z.string().optional().describe('Output file path'),
})
```

## Description

Export a description string for `luca --help` display:

```ts
export const description = '{{description}}'
```

## Handler

Export a default async function. It receives parsed options and the container context. Use the container for all I/O. Positional args declared in the `positionals` export are available as named fields on `options`.

Type the options with `CommandArgs<typeof argsSchema>` — it's the inferred schema fields plus the raw positional array `options._` (where `_[0]` is the command name):

```ts
export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // options.<field> comes from --flags and mapped positionals
  // options._ is the raw positional array, typed as string[]

  // Your implementation here
}
```

## Output and Exit Codes

Conventions that make commands scriptable and agent-friendly:

- **Support `--json` for machine output.** Declare `json: z.boolean().default(false)` and gate all human-facing output (`ui.print.*`, banners, spinners) behind `if (!options.json)`. With `--json`, print exactly one `JSON.stringify(...)` to stdout. If the command also writes an artifact (a report file), still write it — print the machine summary alongside.
- **Fail by throwing or by setting `process.exitCode = 1`.** A thrown error is reported cleanly (message only; `--verbose` or `DEBUG=1` adds the stack) and exits non-zero. For "soft" failures where you've already printed diagnostics, set `process.exitCode = 1` and return.
- **Verifier commands** (health checks, `status`, `doctor`) should exit non-zero on failure so shells and CI can branch on them. Test non-interactively with `luca {{kebabName}} || echo failed`.

```ts
export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const ui = container.feature('ui')

  const result = await doTheWork(container)

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  ui.print.green(`✓ processed ${result.count} items`) // ui.print prints; ui.colors composes strings
  if (!result.ok) process.exitCode = 1
}
```

## Complete Example

```ts
import { z } from 'zod'
import type { ContainerContext, CommandArgs } from 'luca'

export const description = '{{description}}'

export const argsSchema = z.object({
  json: z.boolean().default(false).describe('Output machine-readable JSON'),
  // Each field becomes a --flag. Add positional args via the positionals export:
  // target: z.string().optional().describe('The target to operate on'),
})

// export const positionals = ['target']  // luca {{kebabName}} ./src => options.target === './src'

export const examples = [
  'luca {{kebabName}}',
  { command: 'luca {{kebabName}} --json', description: 'Machine-readable output' },
]

export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const ui = container.feature('ui')

  const result = { ok: true }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  ui.print.green('{{kebabName}} ran successfully')
}
```

## Container Properties

The `context.container` object provides useful properties beyond features:

```ts
export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // Current working directory
  container.cwd                    // '/path/to/project'

  // Path utilities (scoped to cwd)
  container.paths.resolve('src')   // '/path/to/project/src'
  container.paths.join('a', 'b')   // '/path/to/project/a/b'
  container.paths.relative('src')  // 'src'

  // Package manifest (parsed package.json)
  container.manifest.name          // 'my-project'
  container.manifest.version       // '1.0.0'

  // Raw CLI arguments (from minimist) — prefer positionals export for positional args
  container.argv                   // { _: ['{{kebabName}}', ...], verbose: true, ... }
}
```

## Long-Running Commands (daemons, pollers, watchers)

A command that should keep running (a server, a watcher, a queue worker) ends with
`context.runUntilShutdown(cleanup)` — it holds the process open, wires SIGINT/SIGTERM,
runs your cleanup (5s guard; a second Ctrl-C exits immediately), then exits 0. Don't
hand-roll `await new Promise(() => {})` plus signal handlers:

```ts
export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  const server = container.server('express', { port: 4000 })
  await server.start()

  // Blocks until SIGINT/SIGTERM, then runs the cleanup and exits 0
  await context.runUntilShutdown(async () => {
    await server.stop()
  })
}
```

Multiple calls share one shutdown; cleanups run LIFO. It's also on the container
(`container.runUntilShutdown`) for `luca run` scripts.

For *recurring* work, layer `container.feature('scheduler')` on top — named tasks on
intervals (`'30s'`, `'5m'`) or cron (`'0 9 * * mon-fri'`, `'@hourly'`), where the next run
never starts before the previous one finishes:

```ts
export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // Single-instance guard: exits if another copy is already running, cleans up the pid file on exit
  const proc = container.feature('proc')
  proc.establishLock('tmp/{{kebabName}}.pid')

  const scheduler = container.feature('scheduler')
  scheduler.every('30s', () => doOneUnitOfWork(container), { name: 'worker', immediate: true })

  // Hold the process open; on Ctrl-C every task stops, then onShutdown runs
  await scheduler.run({ onShutdown: () => flushBuffers() })
}
```

Inspect `scheduler.tasks` for run counts, errors, and next-run times. For a bare loop
without the managed layer, the primitives live on utils: `container.utils.every(ms, fn)`
(non-overlapping poll loop, returns `stop()`), `container.utils.sleep(ms)`, and
`container.utils.backoff(fn, { attempts, delay })` for retrying flaky calls.

## State Shared Between Invocations

Every `luca` command is a separate process — a daemon and the sibling commands that
inspect or control it (`--stats`, `stop`, `status`) share no memory. Give that shared
state a named store instead of inventing a dotfile:

```ts
const stats = container.store('{{kebabName}}-stats', {
  schema: z.object({ processed: z.number().default(0), lastRunAt: z.string().optional() }),
})

// update() = lock → read → mutate → validate → atomic write.
// Concurrent invocations can never overwrite each other's writes.
await stats.update(s => { s.processed++; s.lastRunAt = new Date().toISOString() })

// A sibling process just reads — always fresh from disk
const { processed } = await stats.read()
```

The file lives at `.luca/store/{{kebabName}}-stats.json` — plain JSON you can `cat`.
Full API and the which-store decision guide: `luca describe store`.

## Conventions

- **File location**: `commands/{{kebabName}}.ts` in the project root. The `luca` CLI discovers these automatically.
- **Naming**: kebab-case for filename. `luca {{kebabName}}` maps to `commands/{{kebabName}}.ts`.
- **Project helpers are pre-discovered**: `luca <command>` discovers the project's `features/`, `clients/`, and `servers/` folders before dispatch — `container.feature('myProjectFeature')` just works. Opt out with `LUCA_COMMAND_DISCOVERY=commands-only`.
- **Use the container**: Never import `fs`, `path`, `child_process` directly. Use `container.feature('fs')`, `container.paths`, `container.feature('proc')`.
- **Positional args**: Export `positionals = ['name1', 'name2']` (trailing `'...rest'` collects the remainder). For raw access, use `options._` where `_[0]` is the command name.
- **Exit codes**: Return nothing for success. Throw for errors — the CLI reports the message cleanly (stack behind `--verbose`/`DEBUG=1`) and exits non-zero. Or set `process.exitCode = 1` for soft failures.
- **Help text**: Use `.describe()` on every schema field — it powers `luca {{kebabName}} --help`. Export `examples` (and `subcommands` when you branch on a verb) so `--help` teaches real usage, not just flags.
