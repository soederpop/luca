# Building a Command

A command extends the `luca` CLI. Commands live in a project's `commands/` folder and are automatically discovered. They receive parsed options and a container context.

When to build a command:
- You need a CLI task for a project (build scripts, generators, automation)
- You want argument parsing, help text, and container access for free
- The task should be runnable via `luca yourCommand`

## Imports

```ts
import { z } from 'zod'
import { commands, CommandOptionsSchema } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'
```

## Args Schema

Define your command's arguments and flags. Extend `CommandOptionsSchema` which gives you `_` (positional args) and `name` for free.

```ts
export const argsSchema = CommandOptionsSchema.extend({
  // Add your flags here. Each becomes a --flag on the CLI.
  // Example: verbose: z.boolean().default(false).describe('Enable verbose output'),
  // Example: output: z.string().optional().describe('Output file path'),
})
```

## Handler

The handler function receives parsed options and the container context. Use the container for all I/O.

```ts
export default async function {{camelName}}(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const container = context.container as any
  const fs = container.feature('fs')
  const args = container.argv._ as string[]

  // args[0] is your command name, args[1+] are positional arguments
  // options contains parsed --flags

  // Your implementation here
}
```

## Registration

Register the command at the bottom of the file. The `description` shows up in `luca --help`.

```ts
commands.registerHandler('{{camelName}}', {
  description: '{{description}}',
  argsSchema,
  handler: {{camelName}},
})
```

## Module Augmentation

Optional but gives TypeScript autocomplete for `commands.lookup('yourCommand')`.

```ts
declare module '@soederpop/luca' {
  interface AvailableCommands {
    {{camelName}}: ReturnType<typeof commands.registerHandler>
  }
}
```

## Complete Example

```ts
import { z } from 'zod'
import { commands, CommandOptionsSchema } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'

declare module '@soederpop/luca' {
  interface AvailableCommands {
    {{camelName}}: ReturnType<typeof commands.registerHandler>
  }
}

export const argsSchema = CommandOptionsSchema.extend({})

export default async function {{camelName}}(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const container = context.container as any
  const fs = container.feature('fs')

  console.log('{{camelName}} running...')
}

commands.registerHandler('{{camelName}}', {
  description: '{{description}}',
  argsSchema,
  handler: {{camelName}},
})
```

## Conventions

- **File location**: `commands/{{camelName}}.ts` in the project root. The `luca` CLI discovers these automatically.
- **Naming**: camelCase for both file and registration ID. `luca my-command` maps to `commands/my-command.ts`.
- **Use the container**: Never import `fs`, `path`, `child_process` directly. Use `container.feature('fs')`, `container.paths`, `container.feature('proc')`.
- **Positional args**: Access via `container.argv._` — it's an array where `_[0]` is the command name.
- **Exit codes**: Return nothing for success. Throw for errors — the CLI catches and reports them.
