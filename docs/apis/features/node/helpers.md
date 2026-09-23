# Helpers (features.helpers)

> Stability: `core`

The Helpers feature is a unified gateway for discovering and registering project-level helpers from conventional folder locations. It scans known folder names (features/, clients/, servers/, commands/, endpoints/, selectors/) and handles registration differently based on the helper type: - Class-based (features, clients, servers): Dynamic import, validate subclass, register - Config-based (commands, endpoints, selectors): Delegate to existing discovery mechanisms This is also the composition point for building your own plugin/registry systems ("meta-discovery"): call `discover(type, { directory })` once per plugin folder to load helpers from anywhere, not just the conventional locations. A missing directory simply yields no helpers. See `assistantsManager` for a production example. Note: registries (`container.commands`, `container.features`, ...) are class instances — enumerate them with `.available`, not `Object.keys()`.

## Usage

```ts
container.feature('helpers', {
  // Root directory to scan for helper folders. Defaults to container.cwd
  rootDir,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `rootDir` | `string` | Root directory to scan for helper folders. Defaults to container.cwd |

## Methods

### seedVirtualModules

Seeds the VM feature with virtual modules so that project-level files can `import` / `require('luca')`, `zod`, etc. without needing them in `node_modules`. Called automatically when `useNativeImport` is false. Can also be called externally (e.g. from the CLI) to pre-seed before discovery.

**Returns:** `void`



### getInstances

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `FilterClass` | `new (...args: any[]) => T` |  | Parameter FilterClass |

**Returns:** `Helper[] | T[]`



### discover

Discover and register project-level helpers of the given type. Idempotent: the first caller triggers the actual scan. Subsequent callers receive the cached results. If discovery is in-flight, callers await the same promise — no duplicate work.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `RegistryType` | ✓ | Which type of helpers to discover |
| `options` | `{ directory?: string }` |  | Optional overrides |

`{ directory?: string }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `directory` | `any` | Override the directory to scan. A missing directory |

**Returns:** `Promise<string[]>`

```ts
const names = await container.helpers.discover('features')
console.log(names) // ['myCustomFeature']
```

```ts
// Meta-discovery: build a plugin system by scanning each plugin's folders.
// To enumerate a registry afterwards use `.available` — registries are class
// instances, so `Object.keys(container.commands)` will NOT list helper names.
const pluginDirs = [container.paths.resolve(container.feature('os').tmpdir, 'my-plugin')]
for (const plugin of pluginDirs) {
 await container.helpers.discover('commands', { directory: `${plugin}/commands` })
}
console.log(container.commands.available)
```



### discoverAll

Discover all helper types from their conventional folder locations. Idempotent: safe to call from multiple places (luca.cli.ts, commands, etc.). The first caller triggers discovery; all others receive the same results.

**Returns:** `Promise<Record<string, string[]>>`

```ts
const results = await container.helpers.discoverAll()
// { features: ['myFeature'], clients: [], servers: [], commands: ['deploy'], endpoints: [] }
```



### resolvePluginDir

Resolve a plugin name or path to an existing plugin directory. Resolution order: 1. Anything that looks like a path (absolute, `./relative`, `~/...`, or containing a slash) is resolved directly (relative paths against the container cwd) 2. A bare name resolves to the `~/.luca/plugins/<name>` convention

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `nameOrPath` | `string` | ✓ | Plugin name (looked up in ~/.luca/plugins) or a directory path |

**Returns:** `string | null`

```ts
container.helpers.resolvePluginDir('agentic-loop') // ~/.luca/plugins/agentic-loop (if it exists)
```



### usePlugin

Load a plugin directory into the container. A plugin is any folder that follows the standard luca project layout — its `features/`, `clients/`, `servers/`, `commands/`, `endpoints/`, and `selectors/` subfolders are discovered and registered, exactly as if they lived in the current project. If the plugin provides an entry module (`luca.plugin.ts` or `plugin.ts`), it is loaded after discovery and its `attach(container, context)` (or `main(container, context)`) export is called with `context.pluginDir` set to the plugin's absolute directory — the hook for anything beyond the standard folders (assistants, workflows, contexts, ...). Idempotent per resolved directory: concurrent and repeated calls coalesce on the same load. Bare names resolve through the `~/.luca/plugins/<name>` convention (see resolvePluginDir); the `LUCA_PLUGINS` env var and `container.use('<name>')` both route here.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `nameOrPath` | `string` | ✓ | Plugin name (in ~/.luca/plugins) or a directory path |
| `options` | `any` |  | Extra options passed through to the plugin's entry module context |

**Returns:** `Promise<Record<string, string[]>>`

```ts
// ~/.luca/plugins/agentic-loop is a checkout (or symlink) of a luca project
await container.helpers.usePlugin('agentic-loop')
container.commands.available // now includes the plugin's commands
```



### lookup

Look up a helper class by type and name.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `RegistryType` | ✓ | The registry type (features, clients, servers, commands, endpoints) |
| `name` | `string` | ✓ | The helper name within that registry |

**Returns:** `any`

```ts
const FsClass = container.helpers.lookup('features', 'fs')
```



### describeHelper

Get the introspection description for a specific helper.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `RegistryType` | ✓ | The registry type |
| `name` | `string` | ✓ | The helper name |

**Returns:** `string`



### loadModuleExports

Load a module either via native `import()` or the VM's virtual module system. Uses the same `useNativeImport` check as discovery to decide the loading strategy. Prefer this over a raw dynamic `import()` when loading project files: it works both in dev and inside the compiled `luca` binary (where project modules must go through the VM), so plugin loaders built on it don't break in production.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `absPath` | `string` | ✓ | Absolute path to the module file |
| `options` | `{ cacheBust?: boolean }` |  | Optional settings |

`{ cacheBust?: boolean }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `cacheBust` | `any` | When true, appends a timestamp query to bypass the native import cache (useful for hot reload) |

**Returns:** `Promise<Record<string, any>>`

```ts
const mod = await container.helpers.loadModuleExports('/abs/path/to/plugin.ts')
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `rootDir` | `string` | The root directory to scan for helper folders. |
| `useNativeImport` | `boolean` | Whether to use native `import()` for loading project helpers. Never inside a compiled binary — a standalone executable cannot resolve bare `import 'luca'` specifiers from disk files at runtime, so the VM's virtual modules are the only working path there. In dev (running under plain bun), native import is used when `luca` is resolvable in `node_modules` under either package name. |
| `available` | `Record<string, string[]>` | Returns a unified view of all available helpers across all registries. Each key is a registry type, each value is the list of helper names in that registry. |

## Events (Zod v4 schema)

### discovered

Emitted after a registry type has been discovered

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Registry type that was discovered |
| `arg1` | `array` | Names of newly registered helpers |



### registered

Emitted when a single helper is registered

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Registry type |
| `arg1` | `string` | Helper name |
| `arg2` | `any` | The helper class or module |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `discovered` | `object` | Which registry types have been discovered |
| `registered` | `array` | Names of project-level helpers that were discovered (type.name) |

## Examples

**features.helpers**

```ts
const helpers = container.feature('helpers', { enable: true })

// Discover all helper types
await helpers.discoverAll()

// Discover a specific type
await helpers.discover('features')

// Unified view of all available helpers
console.log(helpers.available)
```

```ts
// Meta-discovery: load each plugin's commands from its own folder
for (const dir of ['./plugins/analytics/commands', './plugins/billing/commands']) {
 await container.helpers.discover('commands', { directory: dir })
}
console.log(container.commands.available) // all registered command names
```



**discover**

```ts
const names = await container.helpers.discover('features')
console.log(names) // ['myCustomFeature']
```

```ts
// Meta-discovery: build a plugin system by scanning each plugin's folders.
// To enumerate a registry afterwards use `.available` — registries are class
// instances, so `Object.keys(container.commands)` will NOT list helper names.
const pluginDirs = [container.paths.resolve(container.feature('os').tmpdir, 'my-plugin')]
for (const plugin of pluginDirs) {
 await container.helpers.discover('commands', { directory: `${plugin}/commands` })
}
console.log(container.commands.available)
```



**discoverAll**

```ts
const results = await container.helpers.discoverAll()
// { features: ['myFeature'], clients: [], servers: [], commands: ['deploy'], endpoints: [] }
```



**resolvePluginDir**

```ts
container.helpers.resolvePluginDir('agentic-loop') // ~/.luca/plugins/agentic-loop (if it exists)
```



**usePlugin**

```ts
// ~/.luca/plugins/agentic-loop is a checkout (or symlink) of a luca project
await container.helpers.usePlugin('agentic-loop')
container.commands.available // now includes the plugin's commands
```



**lookup**

```ts
const FsClass = container.helpers.lookup('features', 'fs')
```



**loadModuleExports**

```ts
const mod = await container.helpers.loadModuleExports('/abs/path/to/plugin.ts')
```



**available**

```ts
container.helpers.available
// { features: ['fs', 'git', ...], clients: ['rest', 'websocket'], ... }
```

