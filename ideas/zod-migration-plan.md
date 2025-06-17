# Zod Migration Plan: Helper System Overhaul

## Executive Summary

This document outlines a comprehensive plan to migrate the Luca2 Helper system from TypeScript interfaces to Zod schemas for runtime validation, better type safety, and enhanced developer experience. The migration will affect all core components: Helper, Feature, Client, Server, Registry, and Container.

## Current System Analysis

### Current Architecture

1. **Helper Base Class**
   - Generic types: `Helper<T extends HelperState, K extends HelperOptions>`
   - `HelperState` is an empty interface for extension
   - `HelperOptions` contains `name?: string` and `_cacheKey?: string`
   - State managed through reactive `State<T>` class

2. **Feature/Client/Server Pattern**
   - Each extends Helper with specific State/Options interfaces
   - Module augmentation through `AvailableFeatures`, `AvailableClients` interfaces
   - Registry system for type-safe factory methods
   - Compile-time only type safety

3. **Container Factory System**
   - Uses registries to create instances: `container.feature()`, `container.client()`
   - Caching based on `hashObject(options)`
   - No runtime validation of options or state

### Current Problems

1. **No Runtime Validation**: Options and state are only type-checked at compile time
2. **Poor Error Messages**: No validation errors when invalid data is passed
3. **No Schema Introspection**: Can't generate docs, OpenAPI specs, or validate API payloads
5. **Testing Challenges**: Hard to generate test fixtures or validate inputs
6. **Configuration Issues**: No way to validate user config files or environment variables

## Benefits of Zod Migration

### Core Advantages

1. **Runtime Validation**: Validate options/state at runtime with detailed error messages
2. **Type Inference**: Automatically derive TypeScript types from schemas
3. **Schema Introspection**: Generate documentation, OpenAPI specs, form schemas
4. **Better Error Messages**: Descriptive validation errors with paths and contexts
5. **Developer Experience**: Better auto-completion and IntelliSense
6. **API Integration**: Seamless validation of API payloads and responses
7. **Configuration Validation**: Validate config files, environment variables, user inputs
8. **Testing**: Generate mock data and test fixtures from schemas

### Additional Benefits

- **Documentation**: Self-documenting schemas with descriptions and examples
- **Backwards Compatibility**: Can maintain existing interfaces during transition
- **Performance**: Zod is optimized for runtime validation
- **Ecosystem**: Rich ecosystem of Zod-based tools and integrations

## Migration Strategy

### Phase 1: Foundation

#### Core Schema Infrastructure

Create base Zod schemas and utilities:

```typescript
// src/schemas/base.ts
import { z } from 'zod'

// Base helper schemas
export const HelperStateSchema = z.object({
  // Empty base - allows for extension
}).passthrough() // Allow additional properties

export const HelperOptionsSchema = z.object({
  name: z.string().optional(),
  _cacheKey: z.string().optional(),
}).passthrough()

// Type inference utilities
export type InferState<T extends z.ZodType> = z.infer<T>
export type InferOptions<T extends z.ZodType> = z.infer<T>

// Schema composition helpers
export const createHelperSchemas = <
  StateSchema extends z.ZodType,
  OptionsSchema extends z.ZodType
>(
  stateSchema: StateSchema,
  optionsSchema: OptionsSchema
) => ({
  state: stateSchema,
  options: optionsSchema,
  types: {} as {
    State: InferState<StateSchema>
    Options: InferOptions<OptionsSchema>
  }
})
```

#### Enhanced State Management

Extend the State class to work with Zod schemas:

```typescript
// src/state.ts (enhanced)
export class ZodState<T extends z.ZodType> extends State<z.infer<T>> {
  constructor(
    private schema: T,
    options?: { initialState: Partial<z.infer<T>> }
  ) {
    // Validate initial state
    const validatedInitial = schema.partial().parse(options?.initialState || {})
    super({ initialState: validatedInitial })
  }

  override set<K extends keyof z.infer<T>>(key: K, value: z.infer<T>[K]): this {
    // Validate individual field updates
    const fieldSchema = this.schema.shape[key]
    if (fieldSchema) {
      const validatedValue = fieldSchema.parse(value)
      return super.set(key, validatedValue)
    }
    return super.set(key, value)
  }

  override setState(value: SetStateValue<z.infer<T>>): void {
    const newState = typeof value === 'function' ? value(this.current, this) : value
    // Validate partial state updates
    const validatedState = this.schema.partial().parse(newState)
    super.setState(validatedState)
  }

  // Validate complete state
  validate(): z.infer<T> {
    return this.schema.parse(this.current)
  }

  // Get schema for introspection
  getSchema(): T {
    return this.schema
  }
}
```

### Phase 2: Core Component Migration

#### Helper Base Class Migration

Create schema-aware Helper base class:

```typescript
// src/helper-zod.ts
export abstract class ZodHelper<
  StateSchema extends z.ZodType = z.ZodObject<{}>,
  OptionsSchema extends z.ZodType = z.ZodObject<{}>
> {
  protected readonly _context: ContainerContext
  protected readonly _events = new Bus()
  protected readonly _options: z.infer<OptionsSchema>
  
  readonly state: ZodState<StateSchema>
  readonly uuid = uuid.v4()

  // Abstract schemas - must be implemented by subclasses
  abstract get stateSchema(): StateSchema
  abstract get optionsSchema(): OptionsSchema

  // Default state for subclasses to override
  get defaultState(): Partial<z.infer<StateSchema>> {
    return {}
  }

  constructor(options: unknown, context: ContainerContext) {
    // Validate options at runtime
    this._options = this.optionsSchema.parse(options)
    this._context = context
    
    // Create validated state
    this.state = new ZodState(this.stateSchema, { 
      initialState: this.defaultState 
    })
    
    this.hide('_context', '_options', '_events', 'uuid')
    
    this.state.observe(() => {
      this.emit('stateChange', this.state.current)
    })
    
    this.afterInitialize()
    this.container.emit('helperInitialized', this)
  }

  // Introspection methods
  introspect() {
    return {
      shortcut: (this.constructor as any).shortcut,
      stateSchema: this.stateSchema,
      optionsSchema: this.optionsSchema,
      documentation: this.getDocumentation(),
    }
  }

  getDocumentation() {
    // Extract documentation from Zod schemas
    return {
      state: this.stateSchema.description || 'No description',
      options: this.optionsSchema.description || 'No description',
      // Could extract field-level docs too
    }
  }

  // Rest of Helper methods remain the same...
}
```

#### Feature Migration

Create Zod-based Feature class:

```typescript
// src/feature-zod.ts
export const FeatureStateSchema = HelperStateSchema.extend({
  enabled: z.boolean().default(false)
})

export const FeatureOptionsSchema = HelperOptionsSchema.extend({
  cached: z.boolean().optional(),
  enable: z.boolean().optional(),
})

export abstract class ZodFeature<
  StateSchema extends z.ZodType = typeof FeatureStateSchema,
  OptionsSchema extends z.ZodType = typeof FeatureOptionsSchema
> extends ZodHelper<StateSchema, OptionsSchema> {
  
  get stateSchema(): StateSchema {
    return FeatureStateSchema as StateSchema
  }

  get optionsSchema(): OptionsSchema {
    return FeatureOptionsSchema as OptionsSchema
  }

  override get defaultState() {
    return {
      ...super.defaultState,
      enabled: false,
    }
  }

  get isEnabled() {
    return this.state.get('enabled')
  }

  async enable(options: any = {}) {
    this.attachToContainer()
    this.emit('enabled')
    this.state.set('enabled', true)
    this.container.emit('featureEnabled', this.shortcut, this)
    return this
  }

  // Rest of Feature methods...
}
```

#### Registry Enhancement

Enhance registries to work with Zod schemas:

```typescript
// src/registry-zod.ts
export abstract class ZodRegistry<T extends ZodHelper> extends Registry<T> {
  // Store schemas for introspection
  private schemas = new Map<string, { state: z.ZodType, options: z.ZodType }>()

  override register(
    id: string, 
    constructor: new (options: any, context: ContainerContext) => T
  ) {
    super.register(id, constructor)
    
    // Extract schemas for introspection
    try {
      const instance = new constructor({}, { container: {} as any })
      this.schemas.set(id, {
        state: instance.stateSchema,
        options: instance.optionsSchema
      })
    } catch (e) {
      // Handle cases where constructor requires valid context
    }
    
    return constructor
  }

  // Get schema for a registered helper
  getSchemas(id: string) {
    return this.schemas.get(id)
  }

  // Validate options before creating instance
  validateOptions(id: string, options: unknown) {
    const schemas = this.getSchemas(id)
    if (schemas) {
      return schemas.options.parse(options)
    }
    return options
  }

  // Generate documentation for all registered helpers
  generateDocs() {
    const docs = new Map()
    for (const [id, schemas] of this.schemas) {
      docs.set(id, {
        id,
        stateSchema: schemas.state,
        optionsSchema: schemas.options,
        // Could add more metadata
      })
    }
    return docs
  }
}
```

### Phase 3: Concrete Implementation Migration

#### Feature Implementation Examples

Migrate existing features to use Zod schemas:

```typescript
// src/node/features/python-zod.ts
export const PythonStateSchema = FeatureStateSchema.extend({
  pythonPath: z.string().nullable().default(null),
  projectDir: z.string().nullable().default(null),
  environmentType: z.enum(['uv', 'conda', 'venv', 'system']).nullable().default(null),
  isReady: z.boolean().default(false),
  lastExecutedScript: z.string().nullable().default(null)
}).describe('Python feature state containing environment and execution information')

export const PythonOptionsSchema = FeatureOptionsSchema.extend({
  dir: z.string().optional().describe('Directory containing the Python project'),
  installCommand: z.string().optional().describe('Custom install command to override auto-detection'),
  contextScript: z.string().optional().describe('Path to Python script that will populate locals/context'),
  pythonPath: z.string().optional().describe('Specific Python executable to use')
}).describe('Python feature configuration options')

export class ZodPython extends ZodFeature<
  typeof PythonStateSchema,
  typeof PythonOptionsSchema
> {
  static override shortcut = "features.python" as const

  override get stateSchema() {
    return PythonStateSchema
  }

  override get optionsSchema() {
    return PythonOptionsSchema
  }

  override get defaultState() {
    return {
      ...super.defaultState,
      pythonPath: null,
      projectDir: null,
      environmentType: null,
      isReady: false,
      lastExecutedScript: null
    }
  }

  // All existing methods remain the same, but now with runtime validation
  async detectEnvironment(): Promise<void> {
    const projectDir = this.state.get('projectDir')!
    // ... existing implementation
    
    // State updates are now validated
    this.state.set('pythonPath', pythonPath)  // Validates string | null
    this.state.set('environmentType', environmentType)  // Validates enum
  }
}
```

#### Client Implementation Examples

```typescript
// src/ai/openai-client-zod.ts
export const OpenAIClientStateSchema = ClientStateSchema.extend({
  requestCount: z.number().default(0),
  lastRequestTime: z.number().nullable().default(null),
  tokenUsage: z.object({
    prompt: z.number().default(0),
    completion: z.number().default(0),
    total: z.number().default(0)
  }).default({ prompt: 0, completion: 0, total: 0 })
}).describe('OpenAI client state tracking usage and requests')

export const OpenAIClientOptionsSchema = ClientOptionsSchema.extend({
  apiKey: z.string().optional(),
  organization: z.string().optional(), 
  project: z.string().optional(),
  dangerouslyAllowBrowser: z.boolean().optional(),
  defaultModel: z.string().default('gpt-3.5-turbo'),
  timeout: z.number().positive().optional(),
  maxRetries: z.number().nonnegative().optional()
}).describe('OpenAI client configuration options')

export class ZodOpenAIClient extends ZodClient<
  typeof OpenAIClientStateSchema,
  typeof OpenAIClientOptionsSchema
> {
  // Implementation with validated options and state...
}
```

### Phase 4: Container Integration

#### Container Factory Enhancement

Update container to work with Zod-based helpers:

```typescript
// src/container-zod.ts
export class ZodContainer extends Container {
  override feature<T extends keyof AvailableFeatures>(
    id: T,
    options?: unknown  // Accept unknown, validate at runtime
  ): InstanceType<AvailableFeatures[T]> {
    const BaseClass = this.features.lookup(id as string) as AvailableFeatures[T]
    
    // Validate options using registry schema validation
    const validatedOptions = this.features.validateOptions(id as string, options)
    
    const cacheKey = hashObject({ 
      id, 
      options: omit(validatedOptions, 'enable'), 
      uuid: this.uuid 
    })
    
    const cached = helperCache.get(cacheKey)
    if (cached) {
      return cached as InstanceType<AvailableFeatures[T]>
    }
    
    const instance = new (BaseClass as any)({
      ...validatedOptions,
      name: validatedOptions?.name || id,
      _cacheKey: cacheKey,
    }, { container: this }) as InstanceType<AvailableFeatures[T]>
    
    helperCache.set(cacheKey, instance)
    return instance
  }

  // New methods for schema introspection
  getFeatureSchema(id: keyof AvailableFeatures) {
    return this.features.getSchemas(id as string)
  }

  generateApiDocs() {
    return {
      features: this.features.generateDocs(),
      clients: this.clients.generateDocs(),
      // ... other registries
    }
  }
}
```

### Phase 5: Migration & Backwards Compatibility

#### Coexistence Strategy

Create adapters to allow gradual migration:

```typescript
// src/adapters/legacy-adapter.ts
export class LegacyFeatureAdapter<T extends FeatureState, K extends FeatureOptions> 
  extends Feature<T, K> {
  
  private zodImplementation?: ZodFeature<any, any>

  constructor(options: K, context: ContainerContext) {
    super(options, context)
    
    // Try to create Zod version if available
    try {
      const ZodClass = this.getZodImplementation()
      if (ZodClass) {
        this.zodImplementation = new ZodClass(options, context)
      }
    } catch (e) {
      // Fall back to legacy implementation
    }
  }

  protected getZodImplementation(): any {
    // Override in subclasses to provide Zod implementation
    return null
  }

  // Delegate to Zod implementation if available
  override async enable(options: any = {}) {
    if (this.zodImplementation) {
      return this.zodImplementation.enable(options)
    }
    return super.enable(options)
  }
}
```

#### Migration Utilities

Create utilities to help migrate existing code:

```typescript
// src/utils/migration.ts
export function createFeatureFromLegacy<
  LegacyState extends FeatureState,
  LegacyOptions extends FeatureOptions
>(
  LegacyClass: new (options: LegacyOptions, context: ContainerContext) => Feature<LegacyState, LegacyOptions>,
  stateSchema: z.ZodType<LegacyState>,
  optionsSchema: z.ZodType<LegacyOptions>
) {
  return class extends ZodFeature<typeof stateSchema, typeof optionsSchema> {
    override get stateSchema() { return stateSchema }
    override get optionsSchema() { return optionsSchema }
    
    // Delegate to legacy implementation
    private legacy = new LegacyClass(this._options, this._context)
    
    // Proxy all methods to legacy implementation
    // This allows gradual migration of individual methods
  }
}
```

## Implementation Phases

### Phase 1: Foundation
- Install and configure Zod
- Create base schema infrastructure
- Enhance State class for Zod support
- Create ZodHelper base class
- Write comprehensive tests

### Phase 2: Core Components
- Migrate Feature base class
- Migrate Client base class  
- Migrate Server base class
- Enhance Registry system
- Update Container factory methods

### Phase 3: Concrete Implementations
- Migrate key features (python, fs, yaml)
- Migrate important clients (openai, rest)
- Create migration utilities
- Comprehensive testing

### Phase 4: Container Integration
- Full container integration
- Schema introspection APIs
- Documentation generation
- Performance optimization

### Phase 5: Polish & Backwards Compatibility
- Backwards compatibility adapters
- Migration guides
- API documentation
- Performance benchmarks

## Success Metrics

1. **Runtime Validation**: All helper options validated at creation time
2. **Type Safety**: No loss of compile-time type safety
3. **Performance**: < 5% performance impact on helper creation
4. **Documentation**: Auto-generated API docs from schemas
5. **Developer Experience**: Improved error messages and auto-completion
6. **Backwards Compatibility**: Existing code continues to work during migration

## Risk Mitigation

1. **Performance**: Benchmark early and optimize hot paths
2. **Breaking Changes**: Maintain backwards compatibility through adapters
3. **Migration Complexity**: Provide automated migration tools
4. **Learning Curve**: Comprehensive documentation and examples
5. **Ecosystem Impact**: Gradual rollout with feature flags

## Future Enhancements

1. **API Integration**: Generate OpenAPI specs from schemas
2. **Form Generation**: Auto-generate admin UIs from schemas
3. **Configuration Management**: Validate config files and environment variables
4. **Testing**: Generate mock data and test fixtures
5. **Serialization**: Enhanced JSON serialization with validation
6. **Plugin Ecosystem**: Third-party plugins with schema validation

This migration will significantly enhance the Luca2 Helper system by adding runtime validation, better developer experience, and powerful introspection capabilities while maintaining backwards compatibility and existing functionality. 