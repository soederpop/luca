# VM (features.vm)

> Stability: `core`

The VM feature provides Node.js virtual machine capabilities for executing JavaScript code. This feature wraps Node.js's built-in `vm` module to provide secure code execution in isolated contexts. It is how ALL user code runs under the luca binary — commands, endpoints, `luca eval` snippets, `luca run` scripts, and runnable markdown blocks all execute through it, which is why a bare folder of .ts files needs no install step. Three capabilities compose the module system: - `run(code, ctx)` — execute a snippet; top-level `await` is auto-wrapped and the final expression's value is returned. TypeScript is accepted as-is. - `loadModule(filePath)` — load a .ts/.js file as a CommonJS module (ESM syntax is transpiled; `export default` becomes `module.exports.default`). - `defineModule(id, exports)` — register a virtual module that `require()`/`import` resolve BEFORE Node's native resolution. The runtime seeds `'luca'`, its subpaths, and `'zod'` this way, so user code can `import { z } from 'zod'` with zero installs. Contexts start near-empty by design: JS built-ins (Promise, Date, Math, JSON) come free from the realm, and luca injects console, timers, process, Buffer, fetch and friends, crypto, TextEncoder/TextDecoder, atob/btoa, plus every enabled container helper. **Shared container model.** A snippet run through `evalCode` (or `run`) is a live handle on the container, not a sandbox. Shared: every feature, command, helper, server, endpoint, the event bus, container state and context, and every file on disk; every assistant instance in this process (every session, channel, scheduled run) shares that one container, so a write from one session is visible to the next. Reset: only the snippet's own scope (variables, closures, imports, `globalThis`), fresh on every call. Boundary: the container is per process; a `luca` CLI call is a different process that shares only the filesystem, and separate daemons are separate containers, so never assume cross-daemon sharing. Carrying state: write it to the container and name it (`container.addContext('name', value)` puts it in scope for every later snippet; feature state and `container.store()` outlive the snippet; files outlive the process). `evalCode` errors come back as `{ error }` with a `Hint:` line when the failure is a guessed method name, `.then`/`.catch` on a synchronous method, an unregistered feature id, or an options object passed to `proc.spawnAndCapture`. The hint is built from the helpers' own introspection data, so it names the real method and marks it sync or async.

## Usage

```ts
container.feature('vm', {
  // Default context object to inject into the VM execution environment
  context,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `context` | `any` | Default context object to inject into the VM execution environment |

## Methods

### defineModule

Register a virtual module that will be available to `require()` inside VM-executed code. Modules registered here take precedence over Node's native resolution.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✓ | The module specifier (e.g. `'luca'`, `'zod'`) |
| `exports` | `any` | ✓ | The module's exports object |

**Returns:** `void`

```ts
const vm = container.feature('vm')

// Expose container helpers (or anything else) under a virtual module id
vm.defineModule('luca', { fs: container.fs, proc: container.feature('proc') })
vm.defineModule('answers', { magic: 42 })

// Now loadModule can resolve these in user code:
// const { magic } = require('answers')  → works
```



### defineLazyModule

Register a virtual module whose exports are produced on first `require()`. Like {@link defineModule}, the id is treated as external during bundling and resolves before Node's native require — but the loader only runs when (and if) VM-executed code actually requires the module, and its result is cached. This is how the runtime bridges `react` and `ink` into user code: registering them lazily keeps CLI startup free of their import cost, while guaranteeing that code which does `import React from 'react'` receives the SAME module instance the container's ink feature renders with. (A second React copy — e.g. inlined from a stray `node_modules` at bundle time — breaks all ink hooks with "Invalid hook call" / raw-mode errors.)

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✓ | The module specifier (e.g. `'react'`) |
| `loader` | `() => any` | ✓ | Synchronous function returning the module's exports; called once, then cached |

**Returns:** `void`

```ts
const vm = container.feature('vm')

let built = 0
vm.defineLazyModule('expensive', () => ({ builds: ++built }))

// The loader hasn't run yet — only code that requires 'expensive' triggers it
console.log(built) // 0
```



### createRequireFor

Build a require function that resolves from the virtual modules map first, falling back to Node's native `createRequire` for everything else.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | ✓ | The file path to scope native require resolution to |
| `opts` | `VMRequireOptions` |  | Parameter opts |

`VMRequireOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `chain` | `VMLoadChain` | When set, relative source imports are routed back through `loadModule` on this chain. |

**Returns:** `((id: string) => any) & { resolve: RequireResolve }`



### createScript

Creates a new VM script from the provided code. This method compiles JavaScript code into a VM script that can be executed multiple times in different contexts. The script is pre-compiled for better performance when executing the same code repeatedly.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | The JavaScript code to compile into a script |
| `options` | `vm.ScriptOptions` |  | Options for script compilation |

**Returns:** `vm.Script`

```ts
const script = vm.createScript('Math.max(a, b)')

// Execute the script multiple times with different contexts
const result1 = script.runInContext(vm.createContext({ a: 5, b: 3 }))
const result2 = script.runInContext(vm.createContext({ a: 10, b: 20 }))
```



### isContext

Check whether an object has already been contextified by `vm.createContext()`. Useful to avoid double-contextifying when you're not sure if the caller passed a plain object or an existing context.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ctx` | `unknown` | ✓ | The object to check |

**Returns:** `ctx is vm.Context`

```ts
const ctx = vm.createContext({ x: 1 })
vm.isContext(ctx)   // true
vm.isContext({ x: 1 }) // false
```



### createContext

Create an isolated JavaScript execution context. Combines the container's context with any additional variables provided. If the input is already a VM context, it is returned as-is.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ctx` | `any` |  | Additional context variables to include |

**Returns:** `vm.Context`

```ts
const context = vm.createContext({ user: { name: 'John' } })
const result = vm.runSync('user.name', context)

// Reuse the same context to share state across runs — variables accumulate
const ctx = vm.createContext({ counter: 0 })
vm.runSync('counter += 1', ctx)
vm.runSync('counter += 10', ctx)
vm.runSync('counter', ctx) // 11
```



### wrapTopLevelAwait

Wrap code containing top-level `await` in an async IIFE, injecting `return` before the final expression so its value is not lost. Resolution order: 1. No `await` substring → returned unchanged (native `vm.Script` completion-value semantics apply). 2. Code parses as a plain (non-async) function body via `new Function` → the `await` is inside a string, comment, or nested async function, not at the top level → returned unchanged. 3. Otherwise the code is scanned for top-level statement boundaries (string/comment-aware via {@link computeNonCodeMask}, depth-tracked) and, working from the last boundary backwards, the first `head / tail` split whose wrapped form parses gets `return (tail)` injected. 4. If no boundary yields a returnable tail (code ends in a declaration, loop, etc.), the whole body is wrapped with no injected return and the run resolves `undefined` — matching native completion semantics for declaration-final programs. `new Function` is used for *parsing only* — it is never invoked. Under bun, `new vm.Script` compiles lazily, so it cannot serve as an eager parse probe.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | Parameter code |

**Returns:** `string`



### run

Executes JavaScript code asynchronously in a controlled environment. This method creates a script from the provided code, sets up an execution context with the specified variables, and runs the code. Code containing top-level `await` is automatically wrapped in an async IIFE so the final expression's value is returned. TypeScript is accepted too, with no flag: code that doesn't parse as JS is transpiled (type syntax stripped, `import` rewritten to `require`) and run. Valid JS is never rewritten. The same applies to `runSync`, `runCaptured`, `perform`, and `performSync`. Dynamic `import()` is supported: virtual modules resolve first (same as `require`), relative specifiers resolve against `opts.filePath` (or `container.cwd` when omitted), and everything else falls through to native import. Errors thrown by the evaluated code propagate to the caller — wrap the call in try/catch if the snippet might throw.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | The JavaScript code to execute |
| `ctx` | `any` |  | Context variables to make available to the executing code |
| `opts` | `VMRunOptions` |  | Run options, e.g. the referrer `filePath` for dynamic imports |

`VMRunOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `filePath` | `string` | The file the code came from, used as the referrer for dynamic `import()`: relative specifiers resolve against its directory, and bare specifiers fall back to its `node_modules` resolution. Defaults to a synthetic file in `container.cwd`, so eval-style snippets resolve relative to the cwd. |

**Returns:** `Promise<T>`

```ts
// Simple calculation
const result = await vm.run('2 + 3 * 4')
console.log(result) // 14

// Using context variables
const greeting = await vm.run('`Hello ${name}!`', { name: 'Alice' })
console.log(greeting) // 'Hello Alice!'

// Array operations — any JS value can be passed through the context
const sum = await vm.run('numbers.reduce((a, b) => a + b, 0)', {
 numbers: [10, 20, 30, 40]
})
console.log(sum) // 100

// Error handling — a throwing snippet rejects, so catch it
try {
 await vm.run('undefinedFunction()')
} catch (err) {
 console.log('Execution failed:', err.message)
}
```



### runCaptured

Execute code and capture all console output as structured JSON. Returns both the execution result and an array of every `console.*` call made during execution, each entry recording the method name and arguments.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | The JavaScript code to execute |
| `ctx` | `any` |  | Context variables to make available to the executing code |
| `opts` | `VMRunOptions` |  | Run options, e.g. the referrer `filePath` for dynamic imports |

`VMRunOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `filePath` | `string` | The file the code came from, used as the referrer for dynamic `import()`: relative specifiers resolve against its directory, and bare specifiers fall back to its `node_modules` resolution. Defaults to a synthetic file in `container.cwd`, so eval-style snippets resolve relative to the cwd. |

**Returns:** `Promise<{
    result: T
    console: Array<{ method: string, args: any[] }>
    context: vm.Context
  }>`

```ts
const snippet = 'console.log("hi")\nconsole.warn("oh")\n42'
const { result, console: calls } = await vm.runCaptured(snippet)
// result === 42
// calls === [{ method: 'log', args: ['hi'] }, { method: 'warn', args: ['oh'] }]
```



### runSync

Execute JavaScript code synchronously in a controlled environment.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | The JavaScript code to execute |
| `ctx` | `any` |  | Context variables to make available to the executing code |
| `opts` | `VMRunOptions` |  | Run options, e.g. the referrer `filePath` for dynamic imports |

`VMRunOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `filePath` | `string` | The file the code came from, used as the referrer for dynamic `import()`: relative specifiers resolve against its directory, and bare specifiers fall back to its `node_modules` resolution. Defaults to a synthetic file in `container.cwd`, so eval-style snippets resolve relative to the cwd. |

**Returns:** `T`

```ts
const sum = vm.runSync('a + b', { a: 2, b: 3 })
console.log(sum) // 5
```



### perform

Execute code asynchronously and return both the result and the execution context. Unlike `run`, this method also returns the context object, allowing you to inspect variables set during execution.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | The JavaScript code to execute |
| `ctx` | `any` |  | Context variables to make available to the executing code |
| `opts` | `VMRunOptions` |  | Run options, e.g. the referrer `filePath` for dynamic imports |

`VMRunOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `filePath` | `string` | The file the code came from, used as the referrer for dynamic `import()`: relative specifiers resolve against its directory, and bare specifiers fall back to its `node_modules` resolution. Defaults to a synthetic file in `container.cwd`, so eval-style snippets resolve relative to the cwd. |

**Returns:** `Promise<{ result: T, context: vm.Context }>`

```ts
const { result, context } = await vm.perform('x = 42; x * 2', { x: 0 })
console.log(result)     // 84
console.log(context.x)  // 42
```



### performSync

Executes JavaScript code synchronously and returns both the result and the execution context. Unlike `runSync`, this method also returns the context object, allowing you to inspect variables set during execution (e.g. `module.exports`). This is the synchronous equivalent of `perform()`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | The JavaScript code to execute |
| `ctx` | `any` |  | Context variables to make available to the executing code |
| `opts` | `VMRunOptions` |  | Run options, e.g. the referrer `filePath` for dynamic imports |

`VMRunOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `filePath` | `string` | The file the code came from, used as the referrer for dynamic `import()`: relative specifiers resolve against its directory, and bare specifiers fall back to its `node_modules` resolution. Defaults to a synthetic file in `container.cwd`, so eval-style snippets resolve relative to the cwd. |

**Returns:** `{ result: T, context: vm.Context }`

```ts
const code = 'module.exports = { double: (n) => n * 2 }'
const { result, context } = vm.performSync(code, {
 exports: {},
 module: { exports: {} },
})
const moduleExports = context.module?.exports || context.exports
console.log(moduleExports.double(21)) // 42
```



### loadModule

Synchronously loads a JavaScript/TypeScript module from a file path, executing it in an isolated VM context and returning its exports. The module gets `require`, `exports`, and `module` globals automatically, plus any additional context you provide. Throws when the file does not exist — a typo'd path should fail here, not later as "tool X is not a function". Use {@link tryLoadModule} when a missing file is expected and should yield `null` instead.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | ✓ | Absolute path to the module file to load |
| `ctx` | `any` |  | Additional context variables to inject into the module's execution environment |
| `opts` | `{ chain?: VMLoadChain }` |  | Parameter opts |

**Returns:** `Record<string, any>`

```ts
const vm = container.feature('vm')

// Write a module to disk, then load it with extra context injected
container.fs.writeFile('tools.ts', 'module.exports = { greet: (name) => "hi " + name }')
const tools = vm.loadModule(container.paths.resolve('tools.ts'), { container })
console.log(tools.greet('luca')) // 'hi luca'
```



### tryLoadModule

Tolerant counterpart to {@link loadModule}: returns `null` when no file exists at `filePath` instead of throwing. Use it for optional modules (a project-level hooks file, an optional config module). Errors from a file that *does* exist but fails to transpile or execute still propagate — only the missing-file case is softened.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | ✓ | Absolute path to the module file to load |
| `ctx` | `any` |  | Additional context variables to inject into the module's execution environment |

**Returns:** `Record<string, any> | null`

```ts
const vm = container.feature('vm')

const optional = vm.tryLoadModule(container.paths.resolve('luca.hooks.ts'))
if (optional) {
 console.log('hooks loaded:', Object.keys(optional))
} else {
 console.log('no hooks file — that is fine')
}
```



### evalCode

Tool-facing live eval: run a snippet in this process with the container in scope, returning the result plus any console output. Values that can't survive JSON (circular graphs, functions, class instances) are rendered shallowly instead of throwing — the tool must always report *something* useful about what the snippet produced.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ code: string }` | ✓ | Arguments |

`{ code: string }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `code` | `any` | The snippet to execute |
| `extraContext` | `Record<string, any>` |  | Additional context entries (e.g. the consuming assistant) |

**Returns:** `Promise<{ result: any; console: Array<{ method: string; args: any[] }> } | { error: string }>`

```ts
await vm.evalCode({ code: 'container.features.enabled.length' })
// => { result: 42, console: [] }
```



### hintForEvalError

Turn the common classes of evalCode failure into a one-line hint that carries the answer, so the agent does not spend a second model turn on a guessed API. Field data from production loops showed 10-14% of snippets failing on exactly these shapes: a method name that does not exist on a helper, `.then`/`.catch` on a synchronous method, a feature id that is not registered, and an options object passed where `proc.spawnAndCapture` takes positional arguments. Everything here is derived from the helpers' own introspection data, so it never drifts from the real surface.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `string` | ✓ | The error message the snippet produced |
| `code` | `any` |  | The snippet source, used to spot which helper was called |
| `extraContext` | `Record<string, any>` |  | Extra scope entries given to evalCode (e.g. `assistant`) |

**Returns:** `string | undefined`

```ts
vm.hintForEvalError('fs.readDirectoryAsync is not a function', 'fs.readDirectoryAsync(".")')
// => 'fs has no readDirectoryAsync. Closest: readdirAsync (async), readdir (async), readDir (async). Signature: luca describe fs.readdirAsync ...'
```



### setupToolsConsumer

When a consumer mounts the vm via `use()`, rebind evalCode so the snippet context includes that consumer as `assistant`, and inject the tool's operating notes — scope, quirks, and limits — into its system prompt. The guidance here is deliberately generic: what evalCode does and how it behaves. Doctrine about a particular JOB (authoring assistants, editing definitions) belongs on the feature that owns that job.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `consumer` | `any` | ✓ | Parameter consumer |

**Returns:** `void`



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.vm**

```ts
const vm = container.feature('vm')

// Execute simple code
const result = await vm.run('1 + 2 + 3')
console.log(result) // 6

// Execute code with custom context
const result2 = await vm.run('greeting + " " + name', {
 greeting: 'Hello',
 name: 'World'
})
console.log(result2) // 'Hello World'

// Virtual modules take precedence over native require
vm.defineModule('answers', { magic: 42 })
```



**defineModule**

```ts
const vm = container.feature('vm')

// Expose container helpers (or anything else) under a virtual module id
vm.defineModule('luca', { fs: container.fs, proc: container.feature('proc') })
vm.defineModule('answers', { magic: 42 })

// Now loadModule can resolve these in user code:
// const { magic } = require('answers')  → works
```



**defineLazyModule**

```ts
const vm = container.feature('vm')

let built = 0
vm.defineLazyModule('expensive', () => ({ builds: ++built }))

// The loader hasn't run yet — only code that requires 'expensive' triggers it
console.log(built) // 0
```



**createScript**

```ts
const script = vm.createScript('Math.max(a, b)')

// Execute the script multiple times with different contexts
const result1 = script.runInContext(vm.createContext({ a: 5, b: 3 }))
const result2 = script.runInContext(vm.createContext({ a: 10, b: 20 }))
```



**isContext**

```ts
const ctx = vm.createContext({ x: 1 })
vm.isContext(ctx)   // true
vm.isContext({ x: 1 }) // false
```



**createContext**

```ts
const context = vm.createContext({ user: { name: 'John' } })
const result = vm.runSync('user.name', context)

// Reuse the same context to share state across runs — variables accumulate
const ctx = vm.createContext({ counter: 0 })
vm.runSync('counter += 1', ctx)
vm.runSync('counter += 10', ctx)
vm.runSync('counter', ctx) // 11
```



**run**

```ts
// Simple calculation
const result = await vm.run('2 + 3 * 4')
console.log(result) // 14

// Using context variables
const greeting = await vm.run('`Hello ${name}!`', { name: 'Alice' })
console.log(greeting) // 'Hello Alice!'

// Array operations — any JS value can be passed through the context
const sum = await vm.run('numbers.reduce((a, b) => a + b, 0)', {
 numbers: [10, 20, 30, 40]
})
console.log(sum) // 100

// Error handling — a throwing snippet rejects, so catch it
try {
 await vm.run('undefinedFunction()')
} catch (err) {
 console.log('Execution failed:', err.message)
}
```



**runCaptured**

```ts
const snippet = 'console.log("hi")\nconsole.warn("oh")\n42'
const { result, console: calls } = await vm.runCaptured(snippet)
// result === 42
// calls === [{ method: 'log', args: ['hi'] }, { method: 'warn', args: ['oh'] }]
```



**runSync**

```ts
const sum = vm.runSync('a + b', { a: 2, b: 3 })
console.log(sum) // 5
```



**perform**

```ts
const { result, context } = await vm.perform('x = 42; x * 2', { x: 0 })
console.log(result)     // 84
console.log(context.x)  // 42
```



**performSync**

```ts
const code = 'module.exports = { double: (n) => n * 2 }'
const { result, context } = vm.performSync(code, {
 exports: {},
 module: { exports: {} },
})
const moduleExports = context.module?.exports || context.exports
console.log(moduleExports.double(21)) // 42
```



**loadModule**

```ts
const vm = container.feature('vm')

// Write a module to disk, then load it with extra context injected
container.fs.writeFile('tools.ts', 'module.exports = { greet: (name) => "hi " + name }')
const tools = vm.loadModule(container.paths.resolve('tools.ts'), { container })
console.log(tools.greet('luca')) // 'hi luca'
```



**tryLoadModule**

```ts
const vm = container.feature('vm')

const optional = vm.tryLoadModule(container.paths.resolve('luca.hooks.ts'))
if (optional) {
 console.log('hooks loaded:', Object.keys(optional))
} else {
 console.log('no hooks file — that is fine')
}
```



**evalCode**

```ts
await vm.evalCode({ code: 'container.features.enabled.length' })
// => { result: 42, console: [] }
```



**hintForEvalError**

```ts
vm.hintForEvalError('fs.readDirectoryAsync is not a function', 'fs.readDirectoryAsync(".")')
// => 'fs has no readDirectoryAsync. Closest: readdirAsync (async), readdir (async), readDir (async). Signature: luca describe fs.readdirAsync ...'
```

