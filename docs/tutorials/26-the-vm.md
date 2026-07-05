# The VM: How Your Code Actually Runs

Every piece of user code in a luca project — commands, endpoints, `luca eval` snippets,
`luca run` scripts, runnable markdown blocks — executes through the container's `vm`
feature. Understanding this one layer explains most of luca's "magic" (a bare folder of
`.ts` files runs with zero installs) and most of its gotchas (why a global you expected
isn't there). This tutorial is for both humans and agents: it is the contract.

## The execution contract

Luca has **one execution contract with three entry points**:

- **`luca eval`** is *expression-oriented*: your code runs with the container in scope
  and the value of the final expression is printed. Declarations and loops print
  nothing. TypeScript syntax is fine — input is transpiled first.
- **`luca run script.ts`** is *program-oriented*: the file's top-level code runs first
  (module evaluation), then, if the script exports a `default` function (or a named
  `main`), it is called as the entry point with the container context and its return
  value is printed:

  ```ts skip
  export default async function main({ container }) {
    const fs = container.feature('fs')
    return await fs.readJsonAsync('data.json')
  }
  ```

  A non-function `default` export is treated as a data module and printed. Scripts with
  no exports just run top to bottom, exactly as before.
- **`luca run doc.md`** is *literate eval*: each fenced `ts`/`js` block runs like an
  eval snippet in one shared context, top to bottom, and each block's final expression
  value is displayed beneath it (`⇒ ...`). Mark a block ` ```ts silent` to run it
  without displaying its value, or ` ```ts skip` to not run it at all.

In all three, the container is in scope and **top-level `await` just works** — code
containing it is wrapped in an async IIFE, and the final expression's value survives the
wrapping (the boundary between "everything before" and "the final expression" is found
by real parsing, not line heuristics).

## Why a VM at all

The `luca` binary bundles its whole runtime. When it loads *your* files — which may
import `luca` or `zod`, neither of which exists in your `node_modules` (you don't need a
`node_modules`) — something has to resolve those imports to the binary's bundled copies.
That something is the VM feature plus **virtual modules**.

## Virtual modules

`vm.defineModule(id, exports)` registers a module that `require()` / `import` resolves
**before** Node's native resolution:

```ts
const vm = container.feature('vm')
vm.defineModule('answers', { magic: 42 })
const { magic } = vm.createRequireFor(container.cwd)('answers')
magic
```

Before any of your files load, the runtime seeds:

| Module id | What you get |
|---|---|
| `luca`, `luca/node` | the full luca exports + the singleton container as `default` |
| `luca/schemas`, `luca/client`, `luca/server`, ... | the corresponding subpath exports |
| `@soederpop/luca` (+ subpaths) | legacy aliases of the above |
| `zod` | zod v4 — `import { z }`, `import * as z`, and `import z` all work |

Two consequences worth internalizing:

1. **zod is always available.** Endpoint and command files should export zod schemas
   unconditionally — you get argument validation and the auto-generated OpenAPI spec
   for free. (`container.zod` is the same instance, so schemas built inside and outside
   the VM share one zod identity.)
2. Virtual-module precedence is also a **sandboxing tool**: registering an inert stub
   under `'fs'` and `'node:fs'` means `require('fs')` inside VM code gets your stub, not
   the real thing. Register both forms — `require('fs')` is normalized to `node:fs`
   during resolution, so a stub under only one id can be bypassed.

## The globals model

VM contexts start deliberately close to empty. Three tiers:

- **Free from the JS realm** (always there, nothing injects them): `Promise`, `Date`,
  `Math`, `JSON`, `Object`, `Array`, `RegExp`, ...
- **Injected by luca**: `console`, `setTimeout`/`setInterval` (+clears), `process`,
  `Buffer`, `URL`/`URLSearchParams`, `AbortController`/`AbortSignal`, `FormData`,
  `Blob`/`File`, `Headers`/`Request`/`Response`/`fetch`, `crypto`,
  `TextEncoder`/`TextDecoder` — plus every **enabled container helper** by name
  (`fs`, `ui`, `proc`, ...) via `container.context`. Module loading additionally gets
  `require`, `exports`, `module`, `__filename`, `__dirname`.
- **Not there**: everything else. `Bun.spawn`/`Bun.serve` are unavailable in
  command/endpoint handlers — use `container.feature('proc')` or Node's
  `child_process`. If you build your own context with `vm.createContext({...})` and
  pass only your own keys, remember you are opting out of the injected tier — add back
  what your code needs.

This applies to *command and endpoint handlers too*, not just code you run through
`vm.run` yourself — they are VM-loaded modules. If you hit a missing global that
`globalThis.X` can reach, that's a candidate for the injected tier: raise it.

## ESM in, CJS through

Your files are written as ESM (`import`/`export`), but the VM executes CommonJS. The
transpiler rewrites on the way in:

- `import { a } from './x.ts'` → `const { a } = require('./x.ts')` — relative imports
  between your own files work, so commands can share a local `lib/` module.
- `export const a = ...` → `exports.a = ...`
- `export default ...` → `module.exports.default = ...` — which is exactly what
  `luca run` reads back to find your entry point.

Markdown blocks are the exception: they are snippets, not modules — no `import`/`export`
inside blocks; use the injected container instead.

## The three vm primitives

```ts skip
const vm = container.feature('vm')

// 1. run — execute a snippet, get the final expression's value
const sum = await vm.run('numbers.reduce((a, b) => a + b, 0)', { numbers: [1, 2, 3] })

// 2. loadModule — load a file as a CJS module (what command discovery uses)
const mod = vm.loadModule(container.paths.resolve('commands/hello.ts'))

// 3. defineModule — make a virtual module resolvable inside VM code
vm.defineModule('config', { port: 3000 })
```

For a worked sandboxing example (Proxy-wrapped container + stubbed `fs`/`child_process`),
see the script-runner pattern in `docs/examples/`.

## Debugging tips

- `luca eval` is the fastest probe: it runs through the exact same VM pipeline as your
  command, so "works in eval, fails in my command" almost always means a missing
  context key, not a VM difference.
- `luca describe vm` lists the full API with runnable examples.
- If a script "does nothing": check you aren't expecting an ignored export shape — the
  entry point is `default` (or `main`); other named exports are data, not entry points.
