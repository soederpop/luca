# Repl (features.repl)

> Stability: `stable`

REPL feature — provides an interactive read-eval-print loop with tab completion and history. Launches a REPL session that evaluates JavaScript/TypeScript expressions in a sandboxed VM context populated with the container and its helpers (the same globals as `container.context` — `container`, `fs`, `git`, `proc`, `grep`, `os`, `ui`, and friends — plus anything you pass via `context`). Supports tab completion for dot-notation property access, per-project command history persistence, and top-level await. The last evaluated result is bound to `_` inside the session. Type `.exit` or `exit` to quit. Because `start()` blocks waiting for interactive input, it is not suitable for scripts or markdown-runner contexts — you can enable the feature and inspect its state without starting it. The typical workflow is the `--console` flag on `luca run`: ``` luca run setup.md --console ``` This executes all of the markdown's code blocks first, then drops into a REPL that inherits the accumulated context — every variable, enabled feature, and loaded piece of data from the preceding blocks carries over. Define your setup and data loading in code blocks, then explore the results interactively. History defaults to a per-project file keyed by a hash of the cwd (`~/.cache/luca/repl-{cwdHash}.history`); override it with the `historyPath` option.

## Usage

```ts
container.feature('repl', {
  // The prompt string to display in the REPL (default: "> ")
  prompt,
  // Path to the REPL history file for command persistence
  historyPath,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `prompt` | `string` | The prompt string to display in the REPL (default: "> ") |
| `historyPath` | `string` | Path to the REPL history file for command persistence |

## Methods

### start

Start the REPL session. Creates a VM context populated with the container and its helpers, sets up readline with tab completion and history, then enters the interactive loop. Type `.exit` or `exit` to quit. Supports top-level await, and binds the last evaluated result to `_`. The prompt string comes from the feature's `prompt` option (default: `"> "`). Calling `start()` again on an already-started REPL resumes with a fresh readline but reuses the existing VM context, merging in any new `context` variables — accumulated session state survives.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ historyPath?: string, context?: any }` |  | Configuration for the REPL session |

`{ historyPath?: string, context?: any }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `historyPath` | `any` | Custom path for the history file (defaults to ~/.cache/luca/repl-{cwdHash}.history) |
| `context` | `any` | Additional variables to inject into the VM context as globals |

**Returns:** `void`

```ts
const repl = container.feature('repl', { enable: true, prompt: 'luca> ' })
await repl.start({
 context: { db: myDatabase },
 historyPath: '.repl-history'
})
// Inside the session: `db`, `container`, `fs`, etc. are all in scope,
// tab completion works on dot paths, and `await` works at the top level.
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `isStarted` | `any` | Whether the REPL session is currently running. |
| `vmContext` | `any` | The VM context object used for evaluating expressions in the REPL. |

## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `started` | `boolean` | Whether the REPL server has been started |

## Examples

**features.repl**

```ts
// Enable without starting — safe in non-interactive contexts
const repl = container.feature('repl', { enable: true })
console.log('started:', repl.isStarted) // false until start() is called

// Start interactively (blocks until the user types .exit or exit).
// Variables passed as `context` become globals in the session.
await repl.start({ context: { myVar: 42 } })
```



**start**

```ts
const repl = container.feature('repl', { enable: true, prompt: 'luca> ' })
await repl.start({
 context: { db: myDatabase },
 historyPath: '.repl-history'
})
// Inside the session: `db`, `container`, `fs`, etc. are all in scope,
// tab completion works on dot paths, and `await` works at the top level.
```

