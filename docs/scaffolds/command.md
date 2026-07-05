# Building a Command

A command extends the `luca` CLI. Commands live in a project's `commands/` folder and are automatically discovered. They are Helper subclasses under the hood — the framework grafts your module exports into a Command class at runtime.

When to build a command:
- You need a CLI task for a project (build scripts, generators, automation)
- You want argument parsing, help text, and container access for free
- The task should be runnable via `luca yourCommand`

## Imports

```ts
import { z } from 'zod'
import type { ContainerContext } from 'luca'
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

```ts
export default async function {{camelName}}(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const fs = container.feature('fs')

  // options.target is set from the first positional arg (via positionals export)
  // options.verbose, options.output, etc. come from --flags

  // Your implementation here
}
```

## Complete Example

```ts
import { z } from 'zod'
import type { ContainerContext } from 'luca'

export const description = '{{description}}'

// Map positional args to named options: luca {{kebabName}} myTarget => options.target === 'myTarget'
export const positionals = ['target']

export const argsSchema = z.object({
  target: z.string().optional().describe('The target to operate on'),
})

export default async function {{camelName}}(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const fs = container.feature('fs')

  console.log('{{kebabName}} running...', options.target)
}
```

## Container Properties

The `context.container` object provides useful properties beyond features:

```ts
export default async function {{camelName}}(options: z.infer<typeof argsSchema>, context: ContainerContext) {
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

A command that should keep running (a server, a poll loop, a queue worker) must hold the
process open explicitly and clean up on SIGINT. `container.feature('scheduler')` handles the
whole lifecycle: named recurring tasks (intervals or cron), and `run()` holds the process
open until SIGINT/SIGTERM, then stops every task:

```ts
export default async function {{camelName}}(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // Single-instance guard: exits if another copy is already running, cleans up the pid file on exit
  const proc = container.feature('proc')
  proc.establishLock('tmp/{{kebabName}}.pid')

  // Named tasks: intervals ('30s', '5m', ms) or cron ('0 9 * * mon-fri', '@hourly').
  // The next run never starts before the previous one finishes.
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

## Conventions

- **File location**: `commands/{{kebabName}}.ts` in the project root. The `luca` CLI discovers these automatically.
- **Naming**: kebab-case for filename. `luca {{kebabName}}` maps to `commands/{{kebabName}}.ts`.
- **Use the container**: Never import `fs`, `path`, `child_process` directly. Use `container.feature('fs')`, `container.paths`, `container.feature('proc')`.
- **Positional args**: Export `positionals = ['name1', 'name2']` to map CLI positional args into named options fields. For raw access, use `container.argv._` where `_[0]` is the command name.
- **Exit codes**: Return nothing for success. Throw for errors — the CLI catches and reports them.
- **Help text**: Use `.describe()` on every schema field — it powers `luca {{kebabName}} --help`. Export `examples` (and `subcommands` when you branch on a verb) so `--help` teaches real usage, not just flags.
