---
title: 'Meta-Discovery: Building a Plugin System'
tags:
  - helpers
  - discovery
  - plugins
  - registry
  - commands
lastTested: '2026-07-03'
lastTestPassed: true
---

# Meta-Discovery: Building a Plugin System

The `helpers` feature isn't just how Luca loads your project's `commands/` folder — it's a composition point. Call `discover(type, { directory })` once per plugin folder and you have a plugin system: each plugin ships its own `commands/`, and they all land in the same registry. This is exactly how `assistantsManager` loads per-assistant helpers in production.

## Fake up two plugins

Each plugin is just a folder with a `commands/` directory inside. One of our plugins ships commands; the other doesn't — which must be fine.

```ts
const fs = container.feature('fs')
const base = container.paths.resolve('tmp', 'meta-discovery-plugins')

fs.ensureFolder(container.paths.resolve(base, 'analytics', 'commands'))
fs.writeFile(container.paths.resolve(base, 'analytics', 'commands', 'track.ts'), `
export const description = 'Track an analytics event'
export default async function track() { return 'tracked!' }
`)
fs.writeFile(container.paths.resolve(base, 'analytics', 'commands', 'report.ts'), `
export const description = 'Generate an analytics report'
export default async function report() { return 'reported!' }
`)

// the billing plugin declares no commands folder at all
fs.ensureFolder(container.paths.resolve(base, 'billing'))

console.log('plugins created under', base)
```

## Discover each plugin's commands

`discover(type, { directory })` scans any folder — not just the conventional project locations — and registers what it finds. A plugin with no `commands/` folder simply yields `[]`; it is not an error.

```ts
const helpers = container.feature('helpers')

const fromAnalytics = await helpers.discover('commands', {
  directory: container.paths.resolve(base, 'analytics', 'commands'),
})
console.log('analytics plugin registered:', fromAnalytics)

const fromBilling = await helpers.discover('commands', {
  directory: container.paths.resolve(base, 'billing', 'commands'),
})
console.log('billing plugin registered:', fromBilling)
```

## Enumerate the registry — with .available, not Object.keys()

Registries are class instances — `Object.keys(container.commands)` returns internals like `["scope", "baseClass"]`, never the registered names. The accessor you want is `.available`.

```ts
console.log('Object.keys(container.commands):', Object.keys(container.commands))
console.log('container.commands.available:', container.commands.available.filter(n => ['track', 'report'].includes(n)))
```

## Run a discovered command

Everything discovered is a first-class registry member — dispatch it headlessly like any built-in, or from the CLI as `luca track`.

```ts
const cmd = container.command('track')
const result = await cmd.dispatch({}, 'headless')
console.log('track() →', JSON.stringify(result))
```

## Cleanup

```ts
await fs.rmdir(base)
console.log('cleaned up')
```

## The generalized plugin loader

The loop that turns this into a real plugin system — point it at a folder of plugin folders. Discovery results are cached per directory, so calling it twice is free. (Shown, not executed.)

```ts skip
const fs = container.feature('fs')
const helpers = container.feature('helpers')
const pluginsRoot = container.paths.resolve('plugins')

for (const plugin of fs.readdirSync(pluginsRoot)) {
  // each plugin may ship commands/, endpoints/, features/ — all optional
  for (const type of ['commands', 'endpoints', 'features']) {
    const names = await helpers.discover(type, {
      directory: container.paths.resolve(pluginsRoot, plugin, type),
    })
    if (names.length) console.log(`[${plugin}] loaded ${type}:`, names)
  }
}
```

For loading a single module file (a plugin manifest, say) use `helpers.loadModuleExports(absPath)` instead of a raw dynamic `import()` — it works both in dev and inside the compiled `luca` binary, where project files must load through the VM.

## Summary

`helpers.discover(type, { directory })` per plugin folder = a plugin system with no new machinery: missing folders yield `[]`, results cache per directory, and everything lands in the standard registries. Enumerate registries with `.available` (never `Object.keys()`), and load one-off modules with `helpers.loadModuleExports()` so the compiled binary stays happy.
