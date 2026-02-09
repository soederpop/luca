# Getting Started with Luca

Luca is a dependency injection container for JavaScript/TypeScript that provides your application with **features**, **clients**, **servers**, observable **state**, and an **event bus** — all wired together automatically. Runtime is Bun.

## Installation

```bash
bun add @luca/core
```

## Your First Container

The `NodeContainer` is the server-side container. It comes pre-loaded with core features that are auto-enabled: filesystem access, child processes, git, OS info, networking, terminal UI, and a VM.

```ts
import container from '@/node'
```

That's it. You now have a fully wired container with dozens of capabilities at your fingertips.

## What's Available Out of the Box

Every `NodeContainer` auto-enables these features:

| Feature    | Shortcut      | What it does                        |
|------------|---------------|-------------------------------------|
| `fs`       | `container.fs`       | Filesystem operations (sync + async) |
| `proc`     | `container.proc`     | Spawn child processes               |
| `git`      | `container.git`      | Git repository operations            |
| `os`       | `container.os`       | OS and environment info              |
| `networking` | `container.networking` | Find open ports, network checks   |
| `ui`       | `container.ui`       | Terminal colors, markdown, banners   |
| `vm`       | `container.vm`       | Execute code in a sandboxed VM       |

These are accessed directly as properties on the container:

```ts
// Read a file
const content = container.fs.readFile('package.json')

// Get current git branch
const branch = container.git.branch

// Find an open port
const port = await container.networking.findOpenPort(3000)

// Run a shell command
const result = await container.proc.exec('ls -la')

// Pretty-print markdown in the terminal
console.log(container.ui.markdown('# Hello World'))
```

## Enabling Optional Features

Beyond the auto-enabled core, `NodeContainer` has many more features you can opt into:

```ts
// Enable the disk cache
const cache = container.feature('diskCache', { enable: true })
await cache.set('myKey', { hello: 'world' })
const data = await cache.get('myKey')

// Enable the file manager (watches files with glob patterns)
const fm = container.feature('fileManager', { enable: true })
await fm.start()
const tsFiles = fm.matchFiles('**/*.ts')

// Enable the REPL
const repl = container.feature('repl', { enable: true })
await repl.start()
```

You can also enable features from the command line:

```bash
bun run my-script.ts --enable diskCache --enable repl
```

## The Feature Factory

`container.feature(id, options)` is the primary way you interact with Luca. It returns a cached singleton — calling it with the same arguments gives you the same instance:

```ts
const a = container.feature('diskCache')
const b = container.feature('diskCache')
a === b // true — same object

const c = container.feature('diskCache', { name: 'separate' })
a === c // false — different options = different instance
```

Pass `cached: false` in options if you need a fresh instance every time.

## Observable State

Every container and every feature has observable state. You can watch for changes and react:

```ts
// Container state
container.state.observe(() => {
  console.log('Container state changed:', container.currentState)
})

// Create your own state objects
const appState = container.newState({
  count: 0,
  loading: false,
})

appState.observe(() => {
  console.log('Count is now:', appState.get('count'))
})

appState.set('count', 1)  // triggers observer
appState.set('count', 2)  // triggers again
```

## Event Bus

The container is an event emitter. Features emit events too:

```ts
// Listen for any feature being enabled
container.on('featureEnabled', (featureId, feature) => {
  console.log(`${featureId} was enabled`)
})

// Create your own bus
const bus = container.bus()
bus.on('message', (text) => console.log(text))
bus.emit('message', 'hello')

// Wait for an event (returns a promise)
const result = await container.waitFor('someEvent')
```

## Clients and Servers

The `NodeContainer` also attaches `clients` and `servers` registries. These follow the same factory pattern:

```ts
// Create a REST client
const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
const data = await api.get('/users')

// Create an Express server
const web = container.server('express', { port: 3000 })
web.app.get('/hello', (req, res) => res.json({ message: 'hi' }))
await web.start()
```

## Path Utilities

`NodeContainer` provides path helpers rooted at `cwd`:

```ts
container.cwd                          // '/Users/you/project'
container.paths.resolve('src/index.ts') // '/Users/you/project/src/index.ts'
container.paths.join('dist', 'bundle.js') // '/Users/you/project/dist/bundle.js'
container.paths.relative('src/foo.ts')    // 'src/foo.ts'
```

## Environment Detection

```ts
container.isNode        // true
container.isBun         // true (when running under Bun)
container.isBrowser     // false
container.isDevelopment // true when NODE_ENV=development
container.isProduction  // true when NODE_ENV=production
container.isCI          // true when CI env var is set
```

## Introspection

One of Luca's most powerful capabilities is runtime introspection. You can discover everything about any feature, client, or server at runtime:

```ts
// List all available features
console.log(container.features.available)

// Get introspection data for a specific feature
const info = container.features.introspect('git')

// Get markdown-formatted docs at runtime
const docs = container.features.describeAll()
```

This makes Luca especially powerful for REPL-driven development and for AI agents that need to understand their own runtime.

## The Plugin Pattern

The `container.use()` method lets you compose capabilities:

```ts
// Use a feature by name (enables it automatically)
container.use('diskCache')

// Use a class with a static attach() method
import { Client } from '@/client'
container.use(Client)

// Use any object with an attach() method
container.use({
  attach(container) {
    container.addContext('myThing', { hello: 'world' })
  }
})
```

## Utility Belt

The container bundles commonly needed utilities:

```ts
container.utils.uuid()                          // generate a UUID
container.utils.hashObject({ foo: 'bar' })      // deterministic hash
container.utils.stringUtils.camelCase('foo-bar') // 'fooBar'
container.utils.stringUtils.kebabCase('fooBar')  // 'foo-bar'
container.utils.stringUtils.pluralize('feature') // 'features'
container.utils.lodash.pick(obj, ['a', 'b'])     // lodash subset
container.utils.zodToJsonSchema(someZodSchema)   // convert zod to JSON schema
```

## Writing Scripts

Luca is great for writing scripts. Here's a complete example:

```ts
// scripts/my-script.ts
import container from '@/node'

const { fs, git, ui, proc } = container

console.log(ui.markdown(`# Project Info`))
console.log(`Branch: ${git.branch}`)
console.log(`Files: ${fs.lsFiles().length}`)

const result = await proc.exec('echo "hello from luca"')
console.log(result.stdout)
```

Run it:

```bash
bun run scripts/my-script.ts
```

## Next Steps

- [Defining Your Own Features](./defining-features.md) — extend the container with custom capabilities
- [Creating REST Clients](./rest-clients.md) — build typed API clients
- [Creating Express Servers](./express-server.md) — serve HTTP with the container
- [Building for the Browser](./building-for-the-browser.md) — use the WebContainer in web applications
- [Observable State Sync](./observable-state-sync.md) — deep dive on observable state and synchronization patterns
- [How We Built the AGI Container](./building-the-agi-container.md) — a walkthrough of the second-layer container
