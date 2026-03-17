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

## Args Schema

Define your command's arguments and flags with Zod. Each field becomes a `--flag` on the CLI.

```ts
export const argsSchema = z.object({
  // Add your flags here. Each becomes a --flag on the CLI.
  // Example: verbose: z.boolean().default(false).describe('Enable verbose output'),
  // Example: output: z.string().optional().describe('Output file path'),
})
```

## Description

Export a description string for `luca --help` display:

```ts
export const description = '{{description}}'
```

## Handler

Export a default async function. It receives parsed options and the container context. Use the container for all I/O.

```ts
export default async function {{camelName}}(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const fs = container.feature('fs')
  const args = container.argv._ as string[]

  // args[0] is your command name, args[1+] are positional arguments
  // options contains parsed --flags

  // Your implementation here
}
```

## Complete Example

```ts
import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = '{{description}}'

export const argsSchema = z.object({})

export default async function {{camelName}}(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const fs = container.feature('fs')

  console.log('{{kebabName}} running...')
}
```

## Conventions

- **File location**: `commands/{{kebabName}}.ts` in the project root. The `luca` CLI discovers these automatically.
- **Naming**: kebab-case for filename. `luca {{kebabName}}` maps to `commands/{{kebabName}}.ts`.
- **Use the container**: Never import `fs`, `path`, `child_process` directly. Use `container.feature('fs')`, `container.paths`, `container.feature('proc')`.
- **Positional args**: Access via `container.argv._` — it's an array where `_[0]` is the command name.
- **Exit codes**: Return nothing for success. Throw for errors — the CLI catches and reports them.
- **Help text**: Use `.describe()` on every schema field — it powers `luca {{kebabName}} --help`.
