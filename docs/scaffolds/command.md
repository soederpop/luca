# Building a Command

A command extends the `luca` CLI. Commands live in a project's `commands/` folder and are automatically discovered. They are Helper subclasses under the hood — the framework grafts your module exports into a Command class at runtime.

When to build a command:
- You need a CLI task for a project (build scripts, generators, automation)
- You want argument parsing, help text, and container access for free
- The task should be runnable via `luca yourCommand`

## Imports

```ts
import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
```

## Positional Arguments

Export a `positionals` array to map CLI positional args into named options fields. The first positional (`_[0]`) is always the command name — `positionals` maps `_[1]`, `_[2]`, etc.

```ts
// luca {{kebabName}} ./src  =>  options.target === './src'
export const positionals = ['target']
```

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
  // options._ contains the raw positional array if you need it directly

  // Your implementation here
}
```

## Complete Example

```ts
import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

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

## Raw Positional Access (options._)

Every command handler receives `options._` — an array of all positional words from the CLI. `_[0]` is always the command name; `_[1]`, `_[2]`, etc. are the words that follow. This is always available, even without a `positionals` export.

```ts
import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = '{{description}}'

// No positionals export — access raw words via options._
export const argsSchema = z.object({
  verbose: z.boolean().default(false).describe('Enable verbose output'),
})

export default async function {{camelName}}(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // luca {{kebabName}} hello world  →  options._ === ['{{kebabName}}', 'hello', 'world']
  const words = (options as any)._.slice(1) // everything after the command name
  console.log('positional words:', words)
}
```

## Conventions

- **File location**: `commands/{{kebabName}}.ts` in the project root. The `luca` CLI discovers these automatically.
- **Naming**: kebab-case for filename. `luca {{kebabName}}` maps to `commands/{{kebabName}}.ts`.
- **Use the container**: Never import `fs`, `path`, `child_process` directly. Use `container.feature('fs')`, `container.paths`, `container.feature('proc')`.
- **Positional args**: Export `positionals = ['name1', 'name2']` to map CLI positional args into named options fields. The raw array is also on `options._` where `_[0]` is the command name.
- **Exit codes**: Return nothing for success. Throw for errors — the CLI catches and reports them.
- **Help text**: Use `.describe()` on every schema field — it powers `luca {{kebabName}} --help`.
