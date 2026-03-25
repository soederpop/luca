# Introspection

Luca's introspection system lets you discover everything about a container and its helpers at runtime. This document is a runnable demo — every code block works in the Luca REPL or as a script.

## Container Introspection

The container knows what it is, what registries it has, and what's available in each one.

```ts
const info = container.introspect()
console.log(info.className)
console.log(info.registries.map(r => `${r.name}: ${r.available.length} available`))
console.log('factories:', info.factoryNames)
console.log('enabled features:', info.enabledFeatures)
```

You can get the full introspection as markdown:

```ts
console.log(container.introspectAsText())
```

Or request a single section:

```ts
console.log(container.introspectAsText('methods'))
```

```ts
console.log(container.introspectAsText('getters'))
```

## Querying Registries

Every registry exposes what's available and can describe its members.

```ts
console.log('features:', container.features.available)
```

```ts
console.log('clients:', container.clients.available)
```

```ts
console.log('servers:', container.servers.available)
```

Describe a single member — returns markdown documentation derived from the code:

```ts
console.log(container.features.describe('git'))
```

Describe everything in a registry at once:

```ts
const allFeatureDocs = container.features.describeAll()
console.log(`${allFeatureDocs.length} features documented`)
console.log(allFeatureDocs[0].slice(0, 200) + '...')
```

## Helper Introspection — Structured Data

Every helper instance (feature, client, server, etc.) can introspect itself. The result is a typed object you can traverse programmatically.

```ts
const git = container.feature('git')
const data = git.introspect()
console.log(data.id)
console.log(data.description.slice(0, 100) + '...')
console.log('methods:', Object.keys(data.methods))
console.log('getters:', Object.keys(data.getters))
```

### Filtering by Section

Pass a section name to get just that part:

```ts
const git = container.feature('git')
const methodsOnly = git.introspect('methods')
console.log(Object.keys(methodsOnly.methods))
console.log(Object.keys(methodsOnly.getters)) // empty — filtered out
```

Valid sections: `'methods'`, `'getters'`, `'events'`, `'state'`, `'options'`.

### Expanded Type Properties

When a method parameter uses a custom type, introspection resolves it to show the type's members:

```ts
const git = container.feature('git')
const lsFiles = git.introspect('methods').methods.lsFiles
console.log(lsFiles.parameters.options.type) // "LsFilesOptions"
console.log(lsFiles.parameters.options.properties)
// { cached: { type: 'boolean', description: 'Show cached/staged files' }, ... }
```

## Helper Introspection — As Text

Get the full markdown documentation for a helper:

```ts
const git = container.feature('git')
console.log(git.introspectAsText())
```

Or just one section:

```ts
const git = container.feature('git')
console.log(git.introspectAsText('methods'))
```

```ts
const git = container.feature('git')
console.log(git.introspectAsText('getters'))
```

The heading depth can be controlled — useful when embedding in larger documents:

```ts
const git = container.feature('git')
console.log(git.introspectAsText('methods', 3)) // headings start at ###
```

## Introspecting State and Options

Features that declare Zod schemas for state and options expose them through introspection:

```ts
const git = container.feature('git')
const stateInfo = git.introspect('state')
console.log(stateInfo.state)
```

```ts
const ui = container.feature('ui')
const stateInfo = ui.introspect('state')
console.log(stateInfo.state)
```

## Putting It Together

A quick way to survey everything the container offers:

```ts
for (const name of container.registryNames) {
  const registry = container[name]
  console.log(`\n${name}: ${registry.available.join(', ')}`)
}
```
