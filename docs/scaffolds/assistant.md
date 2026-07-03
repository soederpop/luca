# Building an Assistant

An assistant is an AI chat agent defined by a folder of files. Assistants live in a project's `assistants/` folder (or `~/.luca/assistants/` for user-global assistants) and are automatically discovered — any subdirectory containing a `CORE.md` is treated as an assistant definition.

When to build an assistant:
- You want a conversational agent with a custom system prompt
- You want to give a model tools (plain TypeScript functions) it can call
- You want to react to the agent's lifecycle (turns, tool calls, responses) with hooks

Unlike the other scaffold types, an assistant is not a single file. `luca scaffold assistant <name>` generates a folder:

```
assistants/<name>/
  CORE.md    — system prompt (markdown, optional YAML frontmatter)
  tools.ts   — tool functions the assistant can call
  hooks.ts   — lifecycle event handlers
  voice.yml  — optional voice/TTS config (commented out by default)
```

Start chatting with it immediately:

```sh
luca scaffold assistant chief-of-staff
luca chat chief-of-staff
```

## CORE.md — The System Prompt

`CORE.md` is a markdown file that gets injected into the system prompt of every chat completion call. Write it the way you would write instructions for the agent: who it is, what it knows, how it should behave.

Optional YAML frontmatter at the top of `CORE.md` is parsed as metadata (`assistant.meta`) and can provide default options for the assistant.

```md
---
description: Runs my calendar and inbox
---
# Chief of Staff

You manage my schedule. Be terse. Always confirm before creating events.
```

## tools.ts — Tool Functions

`tools.ts` exports plain functions, plus a `schemas` object whose keys match the exported function names and whose values are Zod v4 schemas describing each function's parameters. Every exported function with a matching schema becomes a tool the model can call.

The luca `container` is globally available inside `tools.ts` — do not import `fs`, `path`, or other builtins; use container features.

```ts
import { z } from 'zod'

export const schemas = {
	listTodos: z.object({
		include: z.string().optional().describe('Glob of files to search, e.g. "*.ts"'),
	}).describe('Find TODO/FIXME comments in the project'),
}

export async function listTodos(options: z.infer<typeof schemas.listTodos>) {
	const grep = container.feature('grep')
	const matches = await grep.todos({ include: options.include })
	return matches.map((m) => `${m.file}:${m.line} ${m.content}`).join('\n')
}
```

Schema rules:
- Use `.describe()` on the schema and every field — descriptions are what the model sees.
- Do NOT use `z.any()` or `z.record(z.any())` in tool schemas — Zod v4's JSON Schema serializer cannot handle them. Accept a `z.string()` of JSON and parse it at runtime instead.

## hooks.ts — Lifecycle Event Handlers

`hooks.ts` exports functions whose names match events emitted by the assistant. Each exported function runs (and is awaited) when the matching event fires. The `container` global is available here too.

Hookable events include: `created`, `started`, `turnStart`, `turnEnd`, `chunk`, `preview`, `response`, `toolCall`, `toolResult`, and `toolError`. Run `luca describe assistant --events` for the full list with payloads.

```ts
export function started() {
	console.log('Assistant started!')
}

export function toolCall(name: string, args: unknown) {
	console.log(`calling ${name}`, args)
}

export async function response(text: string) {
	await container.fs.appendFileAsync('assistant.log', text + '\n')
}
```

## voice.yml — Optional Voice Config

When `voice.yml` is present the assistant can become voice-capable via the `voiceMode` feature. The scaffolded file ships fully commented out; uncomment a provider (`elevenlabs` requires `ELEVENLABS_API_KEY`, `voicebox` requires a local VoiceBox service) to enable it.

```yaml
# provider: elevenlabs
# voiceId: REPLACE_WITH_YOUR_VOICE_ID
```

## Conventions

- **Folder location**: `assistants/<name>/` in the project root, or `~/.luca/assistants/<name>/` to make it available in every project. `--output <dir>` overrides the destination.
- **Discovery**: any folder under `assistants/` with a `CORE.md` is an assistant. `tools.ts`, `hooks.ts`, and `voice.yml` are optional.
- **Run it**: `luca chat <name>` starts an interactive session. `luca chat <name> --use <feature>` attaches container features to the assistant.
- **Use the container**: `container` is a global inside `tools.ts` and `hooks.ts`. Never import `fs`, `path`, or `child_process` — use `container.feature('fs')`, `container.paths`, `container.feature('proc')`.
- **Describe it**: `luca describe assistant` documents the assistant feature's full API, events, and options.
