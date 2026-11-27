# Assistant recipes

One `evalCode` call each. End with a named value, never a bare `({ ... })`.

## Inventory: everything you need to design an assistant

Run this first. Providers and the default, skills the project can see, existing assistants, features that carry tools, and the project's options.yml.

```ts
const manager = container.feature('assistantsManager')
const providers = container.feature('modelProviders')
const yaml = container.feature('yaml')
await manager.discover()
const skillsLib = container.feature('skillsLibrary', {
  useAgentsFolders: true,
  locations: [container.paths.resolve(container.cwd, 'skills'), ...fs.glob('assistants/*/skills', { onlyFiles: false }).map(p => container.paths.resolve(container.cwd, p))].filter(p => fs.existsSync(p)),
})
await skillsLib.start()
const inventory = {
  defaultProvider: providers.resolveDefaultId(),
  providers: providers.summary().filter(p => p.transportAvailable).map(p => ({ id: p.id, model: p.defaultModel, auth: p.auth, hasKey: p.hasApiKey, agent: providers.isAgentProvider(p.id) })),
  unavailable: providers.summary().filter(p => !p.transportAvailable).map(p => p.id),
  skills: skillsLib.skillsTable,
  assistants: manager.available,
  toolFeatures: container.features.availableToolsProviders,
  optionsYml: fs.existsSync('assistants/options.yml') ? yaml.parse(await fs.readFileAsync('assistants/options.yml')) : null,
}
container.addContext('inventory', inventory)
inventory
```

Later snippets read `inventory.providers`, `inventory.skills`.

## Can this provider do the job?

```ts
const providers = container.feature('modelProviders')
const id = 'anthropic'
const info = providers.describeProvider(id)
const resolved = await providers.resolve({ provider: id }).then(r => ({ model: r.model, capabilities: r.capabilities })).catch(e => ({ error: e.message }))
const out = { info, resolved, agent: providers.isAgentProvider(id) }
out
```

`capabilities` says what the transport supports (tools, vision, streaming). `error` means it will fail at the first message.

## What an existing assistant really has

Tools, routing, preloaded skills and the prompt it sends, with no model call.

```ts
const manager = container.feature('assistantsManager')
await manager.discover()
const a = await manager.create('lucaExpert', { cached: false })
const out = {
  folder: a.resolvedFolder,
  frontmatter: a.meta,
  routing: { provider: a.effectiveOptions.provider ?? 'default', model: a.effectiveOptions.model ?? 'provider default' },
  tools: Object.keys(a.tools),
  extensions: Object.keys(a.systemPromptExtensions),
  promptChars: a.effectiveSystemPrompt.length,
}
out
```

## Which tool-bearing features fit this assistant

Read the tool names and descriptions a feature would add before you put it in `use`.

```ts
const pick = ['fileTools', 'processManager', 'skillsLibrary', 'memory']
const out = Object.fromEntries(pick.map(id => {
  const t = container.feature(id).toTools()
  return [id, Object.fromEntries(Object.entries(t.schemas).map(([name, s]: any) => [name, (s.description || '').slice(0, 100)]))]
}))
out
```

## Create the assistant

Through the manager, so discovery and the parse check happen for you. Frontmatter only where the inventory justified it.

```ts
const manager = container.feature('assistantsManager')
const name = 'todoScout'
const core = `---
description: Finds open TODO and FIXME comments and groups them by file
skills:
  - luca-framework
---
# TODO Scout

You find open work left in code comments. Call listTodos first, then summarize by file. Keep answers under ten lines.
`
const tools = `import { z } from 'zod'
import type { Assistant, AGIContainer } from 'luca/agi'
declare global { var assistant: Assistant; var container: AGIContainer }

export const schemas = {
  listTodos: z.object({
    include: z.string().optional().describe('Glob of files to search, e.g. "*.ts". Omit for every file.'),
  }).describe('Find TODO and FIXME comments in the project. Not for general text search.'),
}

export async function listTodos(options: z.infer<typeof schemas.listTodos>) {
  const matches = await container.feature('grep').todos({ include: options.include, exclude: 'node_modules' })
  return matches.map((m) => m.file + ':' + m.line + ' ' + m.content.trim()).join('\\n')
}

export const use = [
  container.feature('skillsLibrary', { useAgentsFolders: true, only: ['luca-framework'] }),
]
`
const created = await manager.createAssistant({ name, corePrompt: core })
const wrote = await manager.writeDefinitionFile({ name, file: 'tools.ts', content: tools })
const a = await manager.create(name, { cached: false })
const out = { created, wrote, tools: Object.keys(a.tools), skills: a.effectiveOptions.skills }
out
```

The same two calls exist as tools (`createAssistant`, `writeDefinitionFile`) when you have the file contents ready and need no check in between.

## Change one thing in an existing assistant

Read, edit, write. The old file is kept in `.history/`.

```ts
const manager = container.feature('assistantsManager')
const name = 'todoScout'
const core = manager.readDefinitionFile({ name, file: 'CORE.md' })
const next = core.replace(/^description: .*$/m, 'description: Finds open TODO and FIXME comments, grouped by file, oldest first')
const out = await manager.writeDefinitionFile({ name, file: 'CORE.md', content: next })
out
```

Undo: `manager.rollbackDefinitionFile({ name, file: 'CORE.md' })`. History: `manager.listDefinitionHistory({ name })`.

## Give an assistant a provider or model for this project only

`assistants/options.yml` instead of its frontmatter, so the definition stays portable.

```ts
const yaml = container.feature('yaml')
const path = 'assistants/options.yml'
const current = fs.existsSync(path) ? yaml.parse(await fs.readFileAsync(path)) || {} : {}
current.todoScout = { ...(current.todoScout || {}), provider: 'local' }
await fs.writeFileAsync(path, yaml.stringify(current))
const manager = container.feature('assistantsManager')
await manager.discover()   // discover() re-reads options.yml; nothing else does
const a = await manager.create('todoScout', { cached: false })
const out = { file: path, routing: { provider: a.effectiveOptions.provider, model: a.effectiveOptions.model } }
out
```

## Test with one real turn

```ts skip
const manager = container.feature('assistantsManager')
const out = await manager.testAssistant({ name: 'todoScout', message: 'What is left to do in commands/?' })
out
```

Returns `reply`, `toolCalls` and `availableTools`. It calls the model. Say in your report which provider answered.

## Hand tools from an entity to an assistant

For a tool that needs state across calls without a feature file.

```ts
const counter = container.entity('askCounter', {}).extend({
  bump({ by }: { by: number }) { this.setState(s => ({ n: (s.n || 0) + by })); return this.state.get('n') },
}).expose('bump', z.object({ by: z.number().describe('How much to add') }).describe('Add to the running counter and return it'))
const bundle = counter.toTools()
const out = { tools: Object.keys(bundle.schemas), five: bundle.handlers.bump({ by: 5 }) }
out
```

In `tools.ts`: `export const use = [counter]`. In a running assistant: `assistant.use(counter)`.
