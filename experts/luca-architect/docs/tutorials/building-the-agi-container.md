# How We Built the AGI Container

This tutorial walks through the `AGIContainer` — a real-world example of Luca's layered architecture. It demonstrates how to build a second-layer container that inherits everything from `NodeContainer` and adds AI-specific capabilities on top.

This is the container that powers self-coding, self-modifying agentic systems.

## The Layered Philosophy

Luca's architecture mirrors Docker's layer caching:

- **Layer 1: `NodeContainer`** — core platform features (filesystem, git, processes, networking, etc.). You solve this once and rarely touch it again.
- **Layer 2: `AGIContainer`** — features specific to a category of applications. In this case: AI agents with identity, memory, conversations, and tool use.
- **Layer 3: Your application** — the specific agent, chatbot, or tool you're building. This is where you spend your time.

The `AGIContainer` is Layer 2 for AI applications.

## The Complete Container

Here's the full `AGIContainer` definition:

```ts
// src/agi/container.server.ts
import { NodeContainer } from '@/node/container'
import { OpenAIClient } from '@/agi/openai-client'
import { Identity } from './features/identity'
import { HelperChat } from './features/helper-chat'
import { ContainerChat } from './features/container-chat'
import { Snippets } from './features/snippets'
import { ClaudeCode } from './features/claude-code'
import { Conversation } from './features/conversation'
import { Expert } from './features/expert'

import type { ContentDb } from '@/node/features/content-db'

export class AGIContainer extends NodeContainer {
  identity!: Identity
  openai!: OpenAIClient
  snippets!: Snippets
  claudeCode?: ClaudeCode
  docs!: ContentDb
}

const container = new AGIContainer()
  .use(OpenAIClient)
  .use(Identity)
  .use(HelperChat)
  .use(ContainerChat)
  .use(Snippets)
  .use(ClaudeCode)
  .use(Conversation)
  .use(Expert)

container.docs = container.feature('contentDb', {
  rootPath: container.paths.resolve('docs')
})

export default container
```

Let's break down every piece.

## Step 1: Extend NodeContainer

```ts
export class AGIContainer extends NodeContainer {
  identity!: Identity
  openai!: OpenAIClient
  snippets!: Snippets
  claudeCode?: ClaudeCode
  docs!: ContentDb
}
```

The class declaration with TypeScript `!` assertions tells the type system these properties will be set after construction (by the `use()` calls). Optional properties use `?` for features that might not be enabled.

By extending `NodeContainer`, the `AGIContainer` automatically has:
- All 7 auto-enabled features (`fs`, `proc`, `git`, `os`, `networking`, `ui`, `vm`)
- Access to 20+ optional features (`diskCache`, `esbuild`, `fileManager`, etc.)
- The `clients` and `servers` registries
- Path utilities, argv parsing, manifest reading
- All the state, events, and introspection capabilities

## Step 2: Compose with `use()`

```ts
const container = new AGIContainer()
  .use(OpenAIClient)
  .use(Identity)
  .use(HelperChat)
  .use(ContainerChat)
  .use(Snippets)
  .use(ClaudeCode)
  .use(Conversation)
  .use(Expert)
```

Each `use()` call invokes the class's static `attach()` method, which registers the class in the appropriate registry and optionally enables it. The chain is fluent — each `use()` returns the container.

Let's look at what each `attach()` does.

## The OpenAI Client

The `OpenAIClient` extends `Client` (not `RestClient`) because it wraps the official OpenAI SDK directly:

```ts
export class OpenAIClient extends Client<OpenAIClientState, OpenAIClientOptions> {
  private openai!: OpenAI

  static override shortcut = 'clients.openai' as const

  constructor(options: OpenAIClientOptions, context: ContainerContext) {
    super(options, context)
    this.openai = new OpenAI({
      apiKey: options.apiKey || process.env.OPENAI_API_KEY,
      // ...
    })
  }

  // Convenience methods
  async ask(question: string): Promise<string> { /* ... */ }
  async chat(messages: Message[]): Promise<string> { /* ... */ }

  // Full SDK access
  get raw(): OpenAI { return this.openai }
}

clients.register('openai', OpenAIClient)
```

Its `attach()` is minimal — it just registers in the clients registry. The AGI container accesses it as:

```ts
const openai = container.client('openai')
const answer = await openai.ask("What is TypeScript?")
```

The client tracks state like `requestCount`, `lastRequestTime`, and cumulative `tokenUsage`.

## The Identity Feature

Identity manages the agent's persona — its system prompt and accumulated memories:

```ts
export class Identity extends Feature<IdentityState, IdentityOptions> {
  static override shortcut = 'features.identity' as const

  static attach(container) {
    features.register('identity', Identity)
    container.feature('identity').enable()  // auto-enable
    return container
  }

  async load() {
    // Reads SYSTEM-PROMPT.md and memories.json from basePath
    const systemPrompt = await this.container.fs.readFileAsync(
      this.container.paths.resolve(this.options.basePath!, 'SYSTEM-PROMPT.md')
    )
    const hardcodedMemories = await this.container.fs.readJson(
      this.container.paths.resolve(this.options.basePath!, 'memories.json')
    )
    const savedMemories = await this.loadSavedMemories()
    // ...
  }

  async remember(memory: Memory) { /* persists to diskCache */ }
  async forget(predicate) { /* removes matching memories */ }
  recall(type?) { /* filter memories by type */ }
  generatePrompt() { /* system prompt + formatted memories */ }
}
```

Identity stores memories in categories: `biographical`, `procedural`, `longterm-goal`, `shortterm-goal`, `notes`, and `capability`. It persists saved memories using the `diskCache` feature (which it accesses through `this.container.feature('diskCache')`).

The folder structure for an identity:

```
experts/my-agent/
  SYSTEM-PROMPT.md    # The agent's system prompt
  memories.json       # Hardcoded seed memories
  skills.ts           # Optional executable skills
```

## The Conversation Feature

Conversation handles streaming chat with OpenAI, including automatic tool calling:

```ts
export class Conversation extends Feature<ConversationState, ConversationOptions> {
  static override shortcut = 'features.conversation' as const

  static attach(container) {
    features.register('conversation', Conversation)
    return container
  }

  async ask(content: string): Promise<string> {
    // Adds user message, runs streaming completion loop
    // Automatically handles tool calls and loops until text response
  }
}
```

The key insight: Conversation supports **tool calling**. You pass tools as options, each with a handler function, description, and JSON schema parameters:

```ts
const chat = container.feature('conversation', {
  model: 'gpt-5',
  tools: {
    get_weather: {
      handler: async ({ city }) => ({ city, temp: 62, conditions: 'foggy' }),
      description: 'Get the current weather for a given city',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'The city name' }
        },
        required: ['city']
      }
    }
  }
})

const reply = await chat.ask("What's the weather in San Francisco?")
// The model calls get_weather, gets the result, and responds naturally
```

Conversation emits rich events for monitoring:

```ts
chat.on('chunk', (text) => { /* each streaming token */ })
chat.on('preview', (fullText) => { /* accumulated text so far */ })
chat.on('toolCall', (name, args) => { /* when a tool is invoked */ })
chat.on('toolResult', (name, result) => { /* when a tool returns */ })
chat.on('response', (fullText) => { /* final complete response */ })
```

## The Expert Feature

Expert ties Identity and Conversation together into a complete agent:

```ts
export class Expert extends Feature<ExpertState, ExpertOptions> {
  static override shortcut = 'features.expert' as const

  async start() {
    // 1. Load the identity (system prompt + memories)
    await this.identity.load()
    // 2. Load skills from skills.ts (if it exists)
    await this.loadSkills()
    // 3. Create a conversation seeded with the identity's prompt
    this.conversation = this.createConversation()
  }

  async ask(question: string) {
    if (!this.isStarted) await this.start()
    return this.conversation.ask(question)
  }
}
```

The skill loading is worth highlighting — it reads a TypeScript file, transforms it to CJS with esbuild, and executes it in the VM:

```ts
async loadSkills() {
  const source = await this.container.fs.readFileAsync(skillsPath)
  const transformed = await this.container.feature('esbuild').transform(
    source.toString(),
    { format: 'cjs' }
  )

  const mod = { exports: {} }
  await this.container.feature('vm').run(transformed.code, {
    container: this.container,
    module: mod,
    exports: mod.exports,
  })

  const { schemas = {}, ...skills } = mod.exports
  this.skills = skills
  this.skillSchemas = schemas
}
```

This means experts can have **dynamic, hot-reloadable skills** defined in plain TypeScript files.

Usage:

```ts
const expert = container.feature('expert', {
  name: 'luca-core',
  folder: 'luca-core-framework',
})

const answer = await expert.ask("How do I create a new feature?")
```

## Content Database

The container also sets up a `ContentDb` for managing structured markdown documents:

```ts
container.docs = container.feature('contentDb', {
  rootPath: container.paths.resolve('docs')
})

container.docs.defineModel(({ defineModel, section, toString }) => {
  const Idea = defineModel('Idea', {
    meta: z.object({
      stage: z.string(),
      term: z.enum(['short', 'medium', 'long']).default('long'),
    })
  })

  container.docs.collection.register(Idea)
  return Idea
})
```

This creates a typed model for markdown files in the `docs/` directory with YAML frontmatter that validates against the Zod schema.

## How the Pieces Work Together

Here's a real-world script using the AGI container:

```ts
import container from '@/agi'

// Stream a conversation with real-time terminal output
const conversation = container.feature('conversation', {
  model: 'gpt-4o-mini',
})

conversation.on('preview', (chunk) => {
  console.clear()
  console.log(container.ui.markdown(chunk))
})

await conversation.ask("Explain typescript module augmentation")
```

Or use an expert with full tool calling:

```ts
import container from '@/agi'

const expert = container.feature('expert', {
  name: 'code-assistant',
  folder: 'code-assistant',
})

// The expert loads its identity, skills, and creates a conversation
// all automatically on first .ask()
const answer = await expert.ask("Review the container.ts file for improvements")

expert.on('preview', (text) => {
  console.clear()
  console.log(container.ui.markdown(text))
})
```

## Building Your Own Second-Layer Container

The pattern is straightforward:

### 1. Define the class

```ts
import { NodeContainer } from '@/node/container'

export class MyAppContainer extends NodeContainer {
  // Type declarations for features you'll attach
  myFeature!: MyFeature
  myClient!: MyClient
}
```

### 2. Compose with `use()`

```ts
const container = new MyAppContainer()
  .use(MyClient)
  .use(MyFeature)
  .use(AnotherFeature)
```

### 3. Do any additional setup

```ts
container.feature('diskCache', { enable: true })
// ...any other initialization
```

### 4. Export the singleton

```ts
export default container
```

### 5. Use it everywhere

```ts
import container from '@/my-app'

// Everything is wired up and ready
container.myFeature.doSomething()
const data = await container.myClient.fetchData()
```

## The Power of the Architecture

What makes this layered approach powerful:

1. **You solve Layer 1 once.** Filesystem, git, processes, networking — these never change between projects.

2. **You solve Layer 2 per domain.** If you're building AI agents, the `AGIContainer` has everything you need. Building e-commerce? Create a `CommerceContainer` with payment clients, inventory features, etc.

3. **Layer 3 is just application code.** It imports a container and gets on with building the actual product.

4. **Everything is introspectable.** An AI agent using the `AGIContainer` can discover its own capabilities at runtime — what features are available, what methods they have, what state they track.

5. **Everything is observable.** State changes and events flow through the system, making it trivial to monitor, debug, and react to changes.

6. **Features compose naturally.** The Expert uses Identity, which uses DiskCache, which uses FS. Each layer accesses what it needs through the container without knowing about the others' internals.
