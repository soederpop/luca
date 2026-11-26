# `luca.plugin.ts` — Packaging a Project as a Reusable Layer

Most Luca projects never need this file. Write one only when a project should be *mounted into other Luca projects* — for example a shared toolkit that runs standalone in `~/@toolkit` and also loads into other projects via `LUCA_PLUGINS=toolkit` in the consumer's `.env`.

## What the framework does before you get called

When a consumer project sets `LUCA_PLUGINS=your-project` (resolved through `~/.luca/plugins/your-project`) or calls `container.use('your-project')` from its `luca.cli.ts`, the framework:

1. Locates the plugin directory.
2. Auto-discovers everything in the plugin's `features/`, `commands/`, `endpoints/`, `clients/`, `servers/`, `selectors/` — no `attach` code required.
3. Calls the plugin's exported `attach(container, { pluginDir })` for anything that isn't standard-discovery-shaped.

The consumer project keeps its own `cwd`, its own docs collection, its own skills. The plugin's helpers are additive.

## Signature

```ts
export async function attach(container: any, { pluginDir }: { pluginDir: string }) {
  // pluginDir is where THIS plugin lives (features/ commands/ etc were discovered from here).
  // container.paths.cwd is the consumer project's cwd — DO NOT overwrite it.
}
```

`pluginDir` is the plugin's own root. Resolve plugin-owned assets against it. Resolve consumer-workspace assets against `container.paths.cwd` (or omit the base and let `container.paths.resolve` do it).

## What belongs in `attach`

Anything that isn't standard folder-discovery. Typical jobs:

- **Lending shared folders to registries** — e.g. adding the plugin's `skills/` to `skillsLibrary`. The consumer's own folder stays primary and wins on name conflicts:

  ```ts
  const skillsLibrary = container.feature('skillsLibrary')
  await skillsLibrary.addLocation(
    container.paths.resolve(pluginDir, 'skills'),
    { persist: false },   // process-only; don't touch ~/.luca/skills.json
  )
  ```

- **Registering assistants** — `assistants/` isn't a standard discovery folder, so the plugin does it explicitly:

  ```ts
  const assistantsManager = container.feature('assistantsManager')
  await assistantsManager.addDiscoveryFolder(
    container.paths.resolve(pluginDir, 'assistants'),
  )
  ```

- **Publishing plugin-scoped context** — expose a root path or a pre-built helper so plugin-owned tools can resolve their assets:

  ```ts
  container.state.set('toolkitRoot', pluginDir)
  ```

- **Reading workspace-level config** — parse `toolkit.yml` or similar from `container.paths.resolve(...)` (i.e. against consumer `cwd`), and apply overrides. Wrap it in `try/catch` so bad config doesn't block bootstrap:

  ```ts
  try {
    const fs = container.feature('fs')
    const configPath = container.paths.resolve('toolkit.yml')
    if (fs.exists(configPath)) {
      const cfg = container.feature('yaml').parse(
        fs.readFileSync(configPath, 'utf-8').toString('utf-8'),
      ) || {}
      // apply overrides
    }
  } catch {}
  ```

- **Priming the eval REPL** — `container.addContext('name', value)` makes names available in `luca eval` and `luca console`:

  ```ts
  container.addContext('helper', await assistantsManager.create('helper'))
  ```

## What does NOT belong in `attach`

- **Do not register features/commands/endpoints manually.** They were already discovered before `attach` ran. If a helper isn't loading, the fix is checking its discovery folder, not calling `container.features.register()` here.
- **Do not change `container.paths.cwd`.** The container is anchored to the consumer's workspace on purpose. Overriding it breaks docs, git, and every path-relative feature.
- **Do not do work that should be lazy.** `attach` runs at bootstrap on every plugin load. Anything expensive (opening a socket, spawning a background process, hitting the network) belongs behind an explicit lifecycle method the consumer calls when needed.

## Wiring

The consumer opts in via one of:

- `.env`: `LUCA_PLUGINS=your-project` (comma-separated for multiple plugins)
- `luca.cli.ts`: `await container.use('your-project')`

Plugin resolution reads `~/.luca/plugins/<name>` — a symlink or JSON manifest pointing at the plugin's root. Create it once per developer machine:

```sh
ln -s ~/@your-project ~/.luca/plugins/your-project
```

After that, any consumer project on the machine can mount the plugin.

## Debugging

- `luca describe features` in the consumer project — plugin features should appear alongside consumer features.
- `luca eval "container.state.get('toolkitRoot')"` — verifies `attach` actually ran and published context.
- If plugin features are missing, check that the plugin folder has `features/`, that the `~/.luca/plugins/<name>` resolver points where you think, and that `LUCA_PLUGINS` is actually in the consumer's `.env` (not just the plugin's own).
