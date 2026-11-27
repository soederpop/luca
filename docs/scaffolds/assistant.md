# Building an Assistant

An assistant is an AI chat agent defined by a folder of files. Assistants live in a project's `assistants/` folder (or `~/.luca/assistants/` for user-global assistants) and are discovered automatically: any subdirectory containing a `CORE.md` is an assistant definition.

When to build an assistant:
- You want a conversational agent with a custom system prompt
- You want to give a model tools (plain TypeScript functions, or whole container features) it can call
- You want to react to the agent's lifecycle (turns, tool calls, responses) with hooks

Unlike the other scaffold types, an assistant is not a single file. `luca scaffold assistant <name>` generates a folder:

```
assistants/<name>/
  CORE.md    — system prompt (markdown, optional YAML frontmatter)
  tools.ts   — tool functions the assistant can call, plus an optional `use` export
  hooks.ts   — lifecycle event handlers
  voice.yml  — optional voice/TTS config (commented out by default)
```

Start chatting with it immediately:

```sh
luca scaffold assistant chief-of-staff
luca chat chief-of-staff
```

Before you write one, look at what is already there. One `luca eval` answers the four questions a new assistant raises:

```sh
luca eval "const p = container.feature('modelProviders'); const m = container.feature('assistantsManager'); await m.discover(); const out = { defaultProvider: p.resolveDefaultId(), providers: p.summary().filter(x => x.transportAvailable).map(x => x.id), assistants: m.available, toolFeatures: container.features.availableToolsProviders }; out"
```

## CORE.md — The System Prompt

`CORE.md` is a markdown file that gets injected into the system prompt of every chat completion call. Write it the way you would write instructions for the agent: who it is, what it knows, how it should behave.

Optional YAML frontmatter at the top is parsed as metadata (`assistant.meta`), and every key in it is an assistant option. The frontmatter sets the defaults; `assistants/options.yml` and `create()` options override it.

```md
---
description: Runs my calendar and inbox
provider: anthropic        # a modelProviders id; omit to use the machine's default
model: some-model          # a model that provider serves; omit for its default
skills:                    # preloaded into the system prompt; needs skillsLibrary in `use`
  - luca-framework
config:                    # your own settings, read with assistant.setting('key')
  timezone: America/New_York
historyMode: daily         # lifecycle | daily | persistent | session
---
# Chief of Staff

You manage my schedule. Be terse. Always confirm before creating events.
```

Other options that work the same way: `maxToolTurns`, `contextWindow`, `temperature`, `allowTools`, `forbidTools`, `extraBody`, `providerOptions`, `visionSupport`, `injectTimestamps`. `luca describe assistant` lists them all.

**Provider and model.** Set them only when you need a specific one. A frontmatter `model` belongs to its frontmatter `provider`: if something overrides the provider, the model is dropped so the new provider's default is used. `luca eval "container.feature('modelProviders').describeProvider('anthropic')"` shows whether a provider has its key and transport before you commit to it. `claude-code` and `codex` are agent providers: they run their own loop and get the assistant's tools through a `luca mcp` server, so the `beforeToolCall` hook does not fire for them.

**Skills.** `skills:` preloads each skill's whole SKILL.md into every request, so the assistant needs `skillsLibrary` in its `use` export and the names must be ones that library can see (its `locations` and `only`). An unknown name is a warning at start, not an error. Skills that are not preloaded can still be loaded by the model with `loadSkill`.

## tools.ts — Tool Functions

`tools.ts` exports plain functions, plus a `schemas` object whose keys match the exported function names and whose values are Zod v4 schemas describing each function's parameters. Every exported function with a matching schema becomes a tool the model can call.

The luca `container` and `assistant` (this assistant) are globals inside `tools.ts`. Do not import `fs`, `path`, or other builtins; use container features.

```ts
import { z } from 'zod'
import type { Assistant, AGIContainer } from 'luca/agi'
declare global { var assistant: Assistant; var container: AGIContainer }

export const schemas = {
	listTodos: z.object({
		include: z.string().optional().describe('Glob of files to search, e.g. "*.ts". Omit for every file.'),
	}).describe('Find TODO and FIXME comments in the project. Not for general text search.'),
}

export async function listTodos(options: z.infer<typeof schemas.listTodos>) {
	const grep = container.feature('grep')
	const matches = await grep.todos({ include: options.include, exclude: 'node_modules' })
	return matches.map((m) => `${m.file}:${m.line} ${m.content.trim()}`).join('\n')
}

// Features whose tools this assistant also gets.
export const use = [
	container.feature('skillsLibrary', { useAgentsFolders: true, only: ['luca-framework'] }),
	container.feature('fileTools').toTools({ only: ['readFile', 'searchFiles'] }),
]
```

Schema rules:
- Use `.describe()` on the schema and every field. Descriptions are what the model sees, and nothing else. Say when *not* to use the tool.
- Do NOT use `z.any()` or `z.record(z.any())` in tool schemas: Zod v4's JSON Schema serializer cannot handle them. Accept a `z.string()` of JSON and parse it at runtime instead.

The `use` export takes anything with a `toTools()`: a container feature that carries tools (`luca eval "container.features.availableToolsProviders"` lists them), an entity with `.expose()`, or a plain `{ schemas, handlers }` bundle. `assistant.setting('key')` reads the frontmatter `config:` block. The same feature can be attached for one chat only with `luca chat <name> --use <feature>`.

At runtime `assistant.tools.<name>` is `{ handler, parameters, description }`, so a tool is called by hand with `assistant.tools.listTodos.handler({})`, not `assistant.tools.listTodos({})`.

## hooks.ts — Lifecycle Event Handlers

`hooks.ts` exports functions whose names match events the assistant fires. Each is called as `(assistant, ...args)` and awaited. The `container` and `assistant` globals are available here too.

The ones you will reach for:

- `started()`: the conversation exists. The place for `assistant.use(...)` and `assistant.addSystemPromptExtension(key, text)` that need the live instance.
- `beforeToolCall(ctx)`: `ctx` is `{ name, args, result?, skip? }`. Set `ctx.skip = true` and `ctx.result` to answer the call yourself, or change `ctx.args`.
- `afterToolCall(ctx)`: change `ctx.result` to change what the model sees.
- `answered(result)`: the final answer of an `ask()`, after it is saved to history.
- `stopped()`: close servers, children and timers.
- Conversation events: `turnStart`, `turnEnd`, `chunk`, `response`, `toolCall`, `toolResult`, `toolError`.

Run `luca describe assistant` for the full list with payloads.

```ts
export function started(assistant) {
	assistant.addSystemPromptExtension('today', `Today is ${new Date().toDateString()}.`)
}

export function beforeToolCall(assistant, ctx) {
	if (ctx.name === 'listTodos' && !ctx.args.include) ctx.args = { include: '*.ts' }
}

export async function answered(assistant, text: string) {
	await container.fs.appendFileAsync('assistant.log', text + '\n')
}
```

## voice.yml — Optional Voice Config

When `voice.yml` is present the assistant can become voice-capable via the `voiceMode` feature. The scaffolded file ships fully commented out; uncomment a provider (`elevenlabs` requires `ELEVENLABS_API_KEY`, `voicebox` requires a local VoiceBox service) to enable it.

```yaml
# provider: elevenlabs
# voiceId: REPLACE_WITH_YOUR_VOICE_ID
```

## assistants/options.yml — Per-Project Overrides

A project configures assistants it does not own (a plugin's, one from `~/.luca/assistants/`) and overrides the ones it does, in `assistants/options.yml`. Only assistant options are accepted; anything else is dropped with a warning, so your own settings go under `config:`.

```yaml
defaults:
  provider: local
chiefOfStaff:
  model: qwen3-coder
  config:
    timezone: Europe/Berlin
disabled:
  - googleWorkspace
```

The file is read when the manager discovers assistants, so a change needs a new process (or `container.feature('assistantsManager').discover()`).

### Project docs and setup for a shared assistant

Two options let each project give a shared assistant its own context:

- **`preloadDocs`**: plaintext files appended to the system prompt, in order. Re-read on `reload()`.
- **`setup`**: `.ts` files run once, on the assistant's first `start()`. Each exports a default function or one named `setup`. It may be async, and it gets the assistant as its argument. A missing file or a module with no function makes `start()` throw.

Both take one path or a list. Paths in `options.yml` or `create()` resolve against the project root. Paths in CORE.md frontmatter resolve against the assistant folder and come first, so the assistant keeps its own docs and setup and the project adds to them.

```yaml
researcher:
  preloadDocs:
    - docs/house-style.md
    - docs/glossary.txt
  setup: assistants/researcher-setup.ts
```

```ts
// assistants/researcher-setup.ts
export default async function setup(assistant) {
  assistant.addSystemPromptExtension('project', `Project root: ${container.cwd}`)
}
```

## Editing and Testing from Code

The `assistantsManager` feature does the file work with guards, and exposes the same as tools to any assistant that `use`s it:

```ts
const manager = container.feature('assistantsManager')
await manager.createAssistant({ name: 'todoScout', corePrompt: '---\ndescription: Finds open TODOs\n---\n# TODO Scout\n...' })
await manager.writeDefinitionFile({ name: 'todoScout', file: 'tools.ts', content: toolsSource })  // parse-checked; old file kept in .history/
const a = await manager.create('todoScout', { cached: false })
Object.keys(a.tools)                                           // the tools it will have, no model call
await manager.testAssistant({ name: 'todoScout', message: 'What is left to do?' })  // one real turn
manager.rollbackDefinitionFile({ name: 'todoScout', file: 'tools.ts' })
```

## Conventions

- **Folder location**: `assistants/<name>/` in the project root, or `~/.luca/assistants/<name>/` to make it available in every project. `--output <dir>` overrides the destination.
- **Discovery**: any folder under `assistants/` with a `CORE.md` is an assistant. `tools.ts`, `hooks.ts`, and `voice.yml` are optional. `luca eval "container.feature('assistantsManager').availableAssistants"` confirms it.
- **Run it**: `luca chat <name>` starts an interactive session. `luca chat <name> --use <feature>` attaches container features to the assistant. `luca prompt <name> file.md` sends a prompt file.
- **Use the container**: `container` and `assistant` are globals inside `tools.ts` and `hooks.ts`. Never import `fs`, `path`, or `child_process`; use `container.feature('fs')`, `container.paths`, `container.feature('proc')`.
- **Describe it**: `luca describe assistant` documents the assistant feature's full API, events, and options. `luca describe assistantsManager` documents discovery, `options.yml` and the definition tools.
