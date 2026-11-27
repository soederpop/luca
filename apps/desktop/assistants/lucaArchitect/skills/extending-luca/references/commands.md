# Commands — Deep Dive

Authoritative source is `luca scaffold command --tutorial`. This file is a distilled reference.

## Anatomy

A command is a module in `commands/` that exports named metadata plus a default handler:

```ts
import { z } from 'zod'
import type { ContainerContext, CommandArgs } from 'luca'

export const description = 'Pull data from staging'

export const argsSchema = z.object({
  json: z.boolean().default(false).describe('Machine-readable JSON output'),
  target: z.string().optional().describe('Directory to sync into'),
  verbose: z.boolean().default(false).describe('Extra logging'),
})

export const positionals = ['target']

export const examples = [
  'luca sync-data ./out',
  { command: 'luca sync-data --json', description: 'Machine-readable output' },
]

export default async function syncData(
  options: CommandArgs<typeof argsSchema>,
  context: ContainerContext,
) {
  const { container } = context
  const result = await container.feature('yourFeature').sync(options.target)
  if (options.json) return console.log(JSON.stringify(result))
  container.feature('ui').print.green(`✓ synced ${result.count}`)
}
```

## Named exports

| Export        | Purpose                                                                       |
|---------------|-------------------------------------------------------------------------------|
| `description` | One-liner shown in `luca --help` listing                                      |
| `argsSchema`  | Zod object describing flags (and positionals — each field becomes `--flag`)   |
| `positionals` | Array mapping CLI positional args to `argsSchema` fields                      |
| `subcommands` | Declarative help metadata for a `Subcommands:` section                        |
| `examples`    | Bottom-of-help `Examples:` section — strings or `{ command, description }`    |
| `default`     | The async handler `(options, context) => ...`                                 |

## Positionals

`positionals` maps `options._[1]`, `options._[2]`, ... into named fields.

```ts
export const positionals = ['target']
// luca sync-data ./src        =>  options.target === './src'
```

Fields named in `positionals` are excluded from the `Options:` listing so `--help` doesn't document them twice.

Inline description when there is no matching `argsSchema` field:

```ts
export const positionals = [
  { name: 'target', description: 'File or folder', required: false },
]
```

Trailing `...name` collects remaining args as an array (schema field typed `z.array(...)`):

```ts
export const positionals = ['request', '...numbers']

export const argsSchema = z.object({
  request: z.string().describe('Operation'),
  numbers: z.array(z.number()).default([]).describe('Values'),
})
// luca calc sum 1 2 3  =>  options.request === 'sum', options.numbers === [1,2,3]
```

Positionals arrive as strings and coerce to whatever the schema field wants — `z.number()` accepts `'8080'`. Don't reach for `z.union([z.string(), z.number()])`.

Boolean flags do not consume the following positional (`luca foo --json bar` keeps `bar` as a positional).

## Subcommands

The `subcommands` export is declarative help metadata — dispatch stays in your handler:

```ts
export const positionals = ['subcommand']

export const subcommands = {
  sync: {
    args: '<source>',
    description: 'Pull the latest data',
    examples: ['luca sync-data sync ./data'],
  },
  status: { description: 'Show what would change' },
}

export default async function syncData(options, { container }) {
  switch (options.subcommand) {
    case 'sync':   return doSync(container, options._[2])
    case 'status': return doStatus(container)
    default:       return doDefault(container)
  }
}
```

`luca sync-data sync --help` renders focused help for the `sync` subcommand.

## Output conventions

- **Always support `--json`.** Include `json: z.boolean().default(false)` in `argsSchema`. Gate every `ui.print.*`, banner, spinner behind `if (!options.json)`. With `--json`, emit exactly one `JSON.stringify(...)` to stdout.
- **`ui.print.*` writes to stdout.** `ui.colors.*` composes strings without printing — use it inside strings you pass to `ui.print`.
- **Do not use `console.log` for human output.** Route through `container.feature('ui')` so themes and quiet-mode work.

## Exit codes

- **Throw for real errors.** The framework prints the message (no stack unless `--verbose` / `DEBUG=1`) and exits non-zero.
- **Set `process.exitCode = 1` for soft failures** where you've already printed diagnostics.
- **Verifier commands** (`status`, `doctor`, health checks) must exit non-zero on failure so shells and CI can branch: `luca my-check || echo failed`.

## Long-running commands

Servers, watchers, daemons need to keep the process alive:

```ts
export default async function serve(options, { container }) {
  const server = container.server('express')
  await server.start(options.port)

  process.on('SIGINT', async () => {
    await server.stop()
    process.exit(0)
  })

  await new Promise(() => {})   // block forever
}
```

Without the final `await new Promise(() => {})`, the handler returns and the process exits.

## Reserved-word gotcha

For DELETE endpoint handlers (`endpoints/` folder), `delete` is a JS reserved word. Define the function under any name, then re-export:

```ts
async function del(ctx) { /* ... */ }
export { del as delete }
```

## Verifying

```sh
luca my-command --help                 # description, positionals, options, subcommands, examples
luca my-command --json | jq            # JSON round-trips
luca my-command --verbose              # exceptions include stack
luca my-command                        # exits non-zero on failure
```

If the command doesn't appear in `luca --help`, the file lives outside `commands/` or exports the handler as a named (not default) function.
