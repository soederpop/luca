---
name: building-assistants
description: How to build, configure and test a Luca assistant: the `assistants/<name>/` folder, CORE.md frontmatter (provider, model, skills, config), tools.ts with `schemas`, functions and the `use` export, hooks.ts, `assistants/options.yml` overrides, and the assistantsManager tools that create, edit, roll back and test a definition. Use it whenever the request is to make an assistant, give one tools or skills, pick or change its provider or model, or fix one that does not behave. Start with the inventory recipe, which gathers providers, skills, existing assistants and tool-bearing features in one `evalCode` call.
---

# Building Assistants

An assistant is a folder with a `CORE.md`. Everything else is optional. You build one in four moves, each one tool call where it can be:

1. **Inventory** with one `evalCode` snippet: providers and the default, skills, existing assistants, features that have tools. See [references/recipes.md](references/recipes.md).
2. **Create** with `createAssistant({ name, corePrompt })`. It writes `CORE.md` and an empty `tools.ts`, then rediscovers.
3. **Edit** `tools.ts`, `hooks.ts`, `ABOUT.md` with `writeDefinitionFile`. A `.ts` file is parse-checked in the vm before it lands, the old file goes to `.history/`, and live instances reload. `rollbackDefinitionFile` undoes.
4. **Test** with `testAssistant({ name, message })` (real model call, detached instance), or a dry check in `evalCode`: `manager.create(name, { cached: false })` and read `tools`, `effectiveOptions`, `effectiveSystemPrompt`.

`luca scaffold assistant <name>` is the shell alternative to step 2. It also writes `hooks.ts` and `voice.yml`. Use it when the human wants the scaffold's example files to start from.

## The folder

```
assistants/<name>/
  CORE.md     the system prompt, with optional YAML frontmatter
  tools.ts    `schemas` + one exported function per key, optional `use` export
  hooks.ts    exported functions named after lifecycle events
  ABOUT.md    for humans; shown in lists
  voice.yml   optional TTS config
  skills/     optional skill folders this assistant brings with it
  guides/     optional scripted chats
```

`~/.luca/assistants/<name>/` makes an assistant available in every project. A plugin's `assistants/` folder is read only from a project.

## CORE.md frontmatter

Every key is an assistant option. The frontmatter is the default; `assistants/options.yml` and `create()` options win over it.

```yaml
---
description: One line for lists and the lobby
provider: anthropic          # a modelProviders id. Omit to use the machine's default.
model: some-model            # one that provider serves; its defaultModel when omitted. Rides with its provider.
skills:                      # preloaded into the system prompt; needs skillsLibrary in `use`
  - luca-framework
config:                      # free-form, read with assistant.setting('key')
  projectsFolder: ~/projects
historyMode: daily           # lifecycle | daily | persistent | session
---
```

Other keys that work the same way: `maxToolTurns`, `contextWindow`, `temperature`, `allowTools`, `forbidTools`, `extraBody`, `providerOptions`, `visionSupport`, `injectTimestamps`. `luca describe assistant` lists them with their meaning.

**Provider and model.** Set them only when the human asked for a specific one, or when the inventory shows the default cannot do the job (no vision, an agent provider where tools must run in-process). A frontmatter `model` belongs to its frontmatter `provider`: when something overrides the provider, the model is dropped so the new provider's default wins. Check the provider first: `modelProviders.describeProvider(id)` shows `transportAvailable`, `hasApiKey` and `defaultModel`. A provider with `transportAvailable: false` or `hasApiKey: false` fails at the first message. `isAgentProvider(id)` is true for `claude-code` and `codex`: they run their own loop and get the assistant's tools through a `luca mcp` server, so hooks like `beforeToolCall` do not fire.

**Skills.** `skills:` preloads the whole SKILL.md into every request. Only skills the assistant's `skillsLibrary` instance can see count, so the names must come from its `locations` and `only`. A name it cannot find is a warning at start, not an error: check the inventory. Skills not preloaded are still loadable by the model with `loadSkill` when `skillsLibrary` is in `use`.

## tools.ts

```ts
import { z } from 'zod'
import type { Assistant, AGIContainer } from 'luca/agi'
declare global { var assistant: Assistant; var container: AGIContainer }

export const schemas = {
  listTodos: z.object({
    include: z.string().optional().describe('Glob of files to search, e.g. "*.ts"'),
  }).describe('Find TODO and FIXME comments in the project. Not for searching arbitrary text; use searchFiles for that.'),
}

export async function listTodos(options: z.infer<typeof schemas.listTodos>) {
  const matches = await container.feature('grep').todos({ include: options.include })
  return matches.map((m) => `${m.file}:${m.line} ${m.content.trim()}`).join('\n')
}

// Features and tool bundles the assistant gets on top of the functions above.
export const use = [
  container.feature('skillsLibrary', { locations: [container.paths.resolve(assistant.resolvedFolder, 'skills')], only: ['my-*'] }),
  container.feature('fileTools').toTools({ only: ['readFile', 'searchFiles'] }),
]
```

- `container` and `assistant` are globals here. `assistant.setting('key')` reads `config:`.
- Every schema and field gets `.describe()`. Say when **not** to use the tool. The model sees the descriptions and nothing else.
- No `z.any()` or `z.record(z.any())`: the JSON Schema conversion throws. Take a `z.string()` of JSON and parse it.
- `use` takes anything with `toTools()`: a feature with tools (`container.features.availableToolsProviders` lists them), an entity with `.expose()`, or a plain `{ schemas, handlers }` bundle. A tool-bearing feature can also be attached per chat with `luca chat <name> --use feature`.

## hooks.ts

Exported functions named after events, called as `(assistant, ...args)`. The common ones: `started` (the place for `assistant.use(...)` and `addSystemPromptExtension(key, text)` that need the live instance), `beforeToolCall(ctx)` (set `ctx.skip = true` and `ctx.result` to answer a call yourself), `afterToolCall(ctx)`, `answered(result)`, `stopped`. `luca describe assistant --events` has the full list with payloads.

## options.yml

`assistants/options.yml` in the project configures assistants the project does not own (a plugin's, one from `~/.luca/assistants`) and overrides the ones it does:

```yaml
defaults:
  provider: local
lucaArchitect:
  model: qwen3-coder
  config:
    projectsFolder: ~/code
disabled:
  - googleWorkspace
```

Keys that are not assistant options are dropped with a warning. Project settings go under `config:`.

## Proving it

- `manager.create(name, { cached: false })` then `Object.keys(a.tools)` and `a.effectiveOptions`: the tools and routing it will have, no model call.
- `testAssistant({ name, message })`: one real turn, returns `reply`, `toolCalls` and `availableTools`.
- `luca chat <name>` for the human to try it. Say that.

Gotchas: `assistant.tools.x` is `{ handler, parameters, description }`, so call `assistant.tools.x.handler(args)`. An assistant created in this process does not see a tools.ts you wrote by hand until `reloadAssistant`; `writeDefinitionFile` reloads for you. An assistant in another project needs `luca eval` in that project's `cwd`.
