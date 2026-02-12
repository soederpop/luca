# Luca Feature Development - Detailed Patterns

Comprehensive reference material with annotated real-world examples from the codebase.

## AGI Feature Example: SkillsLibrary

A full-featured AGI feature that wraps two contentbase collections. Demonstrates lazy initialization, graceful error handling, CRUD operations, ContentBase integration, and conversion methods for AI consumption.

**File:** `src/agi/features/skills-library.ts`

```typescript
import { z } from 'zod'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import yaml from 'js-yaml'
import { kebabCase } from 'lodash-es'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@/container'
import { type AvailableFeatures, features, Feature } from '@/feature'
import { Collection, defineModel } from 'contentbase'
import type { ConversationTool } from './conversation'

// Module augmentation - MUST declare your feature here for TypeScript
declare module '@/feature' {
  interface AvailableFeatures {
    skillsLibrary: typeof SkillsLibrary
  }
}

// Return type interface - decouples callers from contentbase internals
export interface SkillEntry {
  name: string
  description: string
  body: string
  raw: string
  source: 'project' | 'user'
  pathId: string
  meta: Record<string, unknown>
}

// Contentbase model - defined outside the class, shared by both collections
const SkillMetaSchema = z.object({
  name: z.string().describe('Unique name identifier for the skill'),
  description: z.string().describe('What the skill does and when to use it'),
  version: z.string().optional().describe('Skill version'),
  tags: z.array(z.string()).optional().describe('Tags for categorization'),
})

const SkillModel = defineModel('Skill', {
  meta: SkillMetaSchema,
  match: (doc: { id: string; meta: Record<string, unknown> }) =>
    doc.id.endsWith('/SKILL') || doc.id === 'SKILL',
})

// Zod schemas - ALWAYS .describe() every field
export const SkillsLibraryStateSchema = FeatureStateSchema.extend({
  loaded: z.boolean().describe('Whether both collections have been loaded'),
  projectSkillCount: z.number().describe('Number of skills in the project collection'),
  userSkillCount: z.number().describe('Number of skills in the user-level collection'),
  totalSkillCount: z.number().describe('Total number of skills across both collections'),
})

export const SkillsLibraryOptionsSchema = FeatureOptionsSchema.extend({
  projectSkillsPath: z.string().optional().describe('Path to project-level skills directory'),
  userSkillsPath: z.string().optional().describe('Path to user-level global skills directory'),
})

// Inferred types from schemas
export type SkillsLibraryState = z.infer<typeof SkillsLibraryStateSchema>
export type SkillsLibraryOptions = z.infer<typeof SkillsLibraryOptionsSchema>

/**
 * JSDoc class description - the introspection AST scanner extracts this.
 * @extends Feature
 */
export class SkillsLibrary extends Feature<SkillsLibraryState, SkillsLibraryOptions> {
  // Override static schemas - REQUIRED for introspection to pick up custom state/options
  static override stateSchema = SkillsLibraryStateSchema
  static override optionsSchema = SkillsLibraryOptionsSchema
  static override shortcut = 'features.skillsLibrary' as const

  // Private backing fields for lazy initialization
  private _projectCollection?: Collection
  private _userCollection?: Collection

  // static attach() - called by container.use(SkillsLibrary)
  static attach(container: Container<AvailableFeatures, any>) {
    features.register('skillsLibrary', SkillsLibrary)
    return container
  }

  // initialState - MUST spread super.initialState
  override get initialState(): SkillsLibraryState {
    return {
      ...super.initialState,
      loaded: false,
      projectSkillCount: 0,
      userSkillCount: 0,
      totalSkillCount: 0,
    }
  }

  // Lazy-initialized getters for expensive resources
  get projectCollection(): Collection {
    if (this._projectCollection) return this._projectCollection
    const rootPath =
      this.options.projectSkillsPath ||
      (this.container as any).paths.resolve('.claude', 'skills')
    this._projectCollection = new Collection({ rootPath, extensions: ['md'] })
    this._projectCollection.register(SkillModel)
    return this._projectCollection
  }

  /** JSDoc on every public getter - introspection extracts these */
  get isLoaded(): boolean {
    return !!this.state.get('loaded')
  }

  /**
   * JSDoc on every public method - introspection extracts these.
   * Include @param and @returns tags.
   *
   * @returns {Promise<SkillsLibrary>} This instance
   */
  async load(): Promise<SkillsLibrary> {
    if (this.isLoaded) return this

    // Graceful error handling for missing directories
    try {
      await this.projectCollection.load()
    } catch {
      // Directory doesn't exist yet - zero skills, that's fine
    }

    this.updateCounts()
    this.state.set('loaded', true)
    this.emit('loaded')  // Emit lifecycle events
    return this
  }

  /**
   * Write operations use contentbase's saveItem.
   */
  async create(skill: { name: string; description: string; body: string }, target: 'project' | 'user' = 'project'): Promise<SkillEntry> {
    const collection = target === 'project' ? this.projectCollection : this.userCollection

    // Build markdown with YAML frontmatter
    const frontmatter = (yaml.dump({ name: skill.name, description: skill.description }) as string).trim()
    const content = `---\n${frontmatter}\n---\n\n${skill.body}`
    const pathId = `${kebabCase(skill.name)}/SKILL`

    // Ensure directory exists, save via contentbase
    await fs.mkdir((collection as any).rootPath, { recursive: true })
    await collection.saveItem(pathId, { content, extension: '.md' })
    await collection.load({ refresh: true })
    this.updateCounts()

    const entry = { name: skill.name, description: skill.description, body: skill.body, raw: content, source: target, pathId, meta: { name: skill.name, description: skill.description } }
    this.emit('skillCreated', entry)  // Emit operation events
    return entry
  }

  // Private helpers - no JSDoc needed
  private updateCounts(): void {
    const projectCount = this.listFromCollection(this.projectCollection, 'project').length
    this.state.setState({ projectSkillCount: projectCount, totalSkillCount: projectCount })
  }
}

// MUST be the default export - this is how the module system registers features
export default features.register('skillsLibrary', SkillsLibrary)
```

## AGI Feature Example: Identity

Demonstrates loading from disk, diskCache persistence, memory management, and how features that manage persona data are structured.

**Key patterns:**

```typescript
// Typed container getter - cast to NodeContainer for node-specific features
override get container() {
  return super.container as NodeContainer<NodeFeatures, any>
}

// DiskCache for persistence
get diskCache() {
  return this.container.feature('diskCache') as DiskCache
}

get memoryCacheKey(): string {
  const name = this.options.name || this.options.basePath || 'default'
  return `identity:${name}:memories`
}

// Load from filesystem
async load() {
  const systemPrompt = await this.container.fs.readFileAsync(
    this.container.paths.resolve(this.options.basePath!, 'SYSTEM-PROMPT.md')
  )
  this.state.set('systemPrompt', systemPrompt.toString())
  return this
}

// DiskCache read/write
async remember(memory: Memory): Promise<Memory[]> {
  const saved = await this.loadSavedMemories()
  saved.push(memory)
  await this.diskCache.set(this.memoryCacheKey, saved)
  // Update state to keep it in sync
  this.state.set('memories', [...hardcoded, ...saved])
  return all
}
```

## AGI Feature Example: Expert

Demonstrates dynamic code loading (skills.ts, hooks.ts from disk), VM execution, tool building for Conversation integration, and composing other features (Identity, Conversation).

**Key patterns:**

```typescript
// Composing other features - create instances with specific options
get identity(): Identity {
  return this.container.feature('identity', {
    name: this.options.name,
    basePath: (this.container as any).paths.resolve('experts', this.options.folder)
  })
}

// Dynamic code loading via VM
async loadSkills() {
  const source = await c.fs.readFileAsync(skillsPath)
  // Transform TypeScript to CJS using esbuild feature
  const transformed = await c.feature('esbuild').transform(source.toString(), { format: 'cjs' })
  // Execute in VM with container in scope
  const mod = { exports: {} as Record<string, any> }
  await c.feature('vm').run(transformed.code, { container: c, module: mod, exports: mod.exports })
  const { schemas = {}, ...skills } = mod.exports
  this.skills = skills
  this.skillSchemas = schemas
}

// Building ConversationTools from skills + schemas
buildTools(): Record<string, ConversationTool> {
  const tools: Record<string, ConversationTool> = {}
  for (const [name, handler] of Object.entries(this.skills)) {
    const schema = this.skillSchemas[name]
    if (!schema) continue
    const jsonSchema = toJsonSchema(schema)
    tools[name] = {
      handler,
      description: jsonSchema.description || name,
      parameters: {
        type: jsonSchema.type || 'object',
        properties: jsonSchema.properties || {},
        ...(jsonSchema.required ? { required: jsonSchema.required } : {}),
      }
    }
  }
  return tools
}

// Composing Conversation with identity prompt + tools
createConversation(): Conversation {
  return this.container.feature('conversation', {
    model: 'gpt-5',
    tools: this.buildTools(),
    history: [{ role: 'system', content: this.identity.generatePrompt() }]
  })
}
```

## Node Feature Example: ContentDb

Demonstrates wrapping an external library (contentbase) in a Feature, lazy collection initialization, and model definition API.

**File:** `src/node/features/content-db.ts`

```typescript
import { Feature, features, type FeatureOptions, type FeatureState } from '../feature.js'
import { Collection, defineModel, section, hasMany, belongsTo, type ModelDefinition } from 'contentbase'

export class ContentDb extends Feature<ContentDbState, ContentDbOptions> {
  static override shortcut = 'features.contentDb' as const

  // Expose library utilities for consumers
  get library() {
    return { Collection, defineModel, section, hasMany, belongsTo }
  }

  // Model registry pattern
  modelDefinitions: Map<string, ModelDefinition> = new Map()

  // Lazy collection initialization from options
  _collection?: Collection
  get collection() {
    if (this._collection) return this._collection
    return this._collection = new Collection({ rootPath: this.options.rootPath })
  }

  // Fluent API - return this for chaining
  async load(): Promise<ContentDb> {
    if (this.isLoaded) return this
    await this.collection.load()
    this.state.set('loaded', true)
    return this
  }

  // Callback pattern for model definition
  defineModel(definerFunction: (library: typeof this.library) => ModelDefinition) {
    const model = definerFunction(this.library)
    this.modelDefinitions.set(model.name, model)
    return model
  }
}

export default features.register('contentDb', ContentDb)
```

## Node Feature Registration in NodeContainer

Node features use side-effect imports. The import itself triggers `features.register()`:

```typescript
// In src/node/container.ts
import "./features/fs";
import "./features/git";
import "./features/os";
// ... each file's default export calls features.register()

export class NodeContainer extends Container<NodeFeatures, any> {
  constructor() {
    super()
    // Auto-enable core features
    this.use('fs').use('proc').use('git').use('os').use('networking').use('ui').use('vm')
  }
}
```

## AGI Feature Registration in AGIContainer

AGI features use explicit `.use(Class)` which calls `static attach()`:

```typescript
// In src/agi/container.server.ts
import { SkillsLibrary } from './features/skills-library'

export class AGIContainer extends NodeContainer {
  skillsLibrary?: SkillsLibrary  // typed property for autocomplete
}

const container = new AGIContainer()
  .use(SkillsLibrary)  // calls SkillsLibrary.attach(container)
```

## ConversationTool Interface

When building features that integrate with the AI conversation system, tools follow this shape:

```typescript
// From src/agi/features/conversation.ts
export interface ConversationTool {
  handler: (...args: any[]) => Promise<any>
  description: string
  parameters: Record<string, any>  // JSON Schema format
}
```

## Common Import Paths

Depending on which layer the feature lives in:

```typescript
// AGI features (src/agi/features/*.ts)
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@/container'
import { type AvailableFeatures, features, Feature } from '@/feature'

// Node features (src/node/features/*.ts)
import { Feature, features, type FeatureOptions, type FeatureState } from '../feature.js'

// Core features (src/*.ts)
import { Feature, features } from './feature.js'
```

## Events Schema Pattern

For features that want typed events in introspection:

```typescript
import { FeatureEventsSchema } from '../../schemas/base.js'

export const MyFeatureEventsSchema = FeatureEventsSchema.extend({
  loaded: z.tuple([]).describe('Emitted when the feature has loaded'),
  itemCreated: z.tuple([
    z.any().describe('The created item')
  ]).describe('Emitted when a new item is created'),
})

export class MyFeature extends Feature<MyState, MyOptions> {
  static override eventsSchema = MyFeatureEventsSchema
  // ...
}
```

## Scaffold Script

The project includes an interactive scaffolder at `scripts/scaffold.ts` that generates boilerplate. Run with `bun run scripts/scaffold` and select "feature" to get a starter file. However, the generated file will need manual adjustment for AGI features (different import paths, `static attach()`, container registration).
