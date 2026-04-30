// @ts-nocheck
import { Bus } from './bus'
import { SetStateValue, State } from './state'
import { AvailableFeatures, features, Feature, FeaturesRegistry } from './feature'
import { Helper, normalizeTypeString, renderTypeScriptParams, isGenericObjectType } from './helper'
import uuid from 'node-uuid'
import hashObject from './hash-object'
import { uniq, keyBy, uniqBy, groupBy, debounce, throttle, mapValues, mapKeys, pick, get, set, omit, kebabCase, camelCase, upperFirst, lowerFirst } from 'lodash-es'
import { pluralize, singularize } from 'inflect'
import { z } from 'zod'
import { ContainerStateSchema, describeZodShape } from './schemas/base'
import { getContainerBuildTimeData, type ContainerIntrospection, type RegistryIntrospection, type IntrospectionSection } from './introspection/index'
import { ContainerDescriber } from './container-describer'
import { createEntityObject, type Entity, type EventMap as EntityEventMap } from './entity'

export { z }

const { v4 } = uuid

const stringUtils = { kebabCase, camelCase, upperFirst, lowerFirst, pluralize, singularize }

export type { AvailableFeatures }

// I want the InstanceType of each value of AvailableFeatures, AvailableClients, whatever
export type AvailableInstanceTypes<T> = {
  [K in keyof T]: T[K] extends new (...args: any) => any ? InstanceType<T[K]> : never
}

/**
 * Maps a feature registry to the INPUT type of each feature's optionsSchema.
 * This allows feature() to accept partial/optional options (e.g. omitting fields
 * that have .default() on them) rather than requiring the fully-parsed OUTPUT type.
 *
 * For any feature class that exposes a static `optionsSchema`, we use `z.input<S>` so
 * that callers can omit fields that have `.default(...)` — Zod's output type marks
 * defaulted fields as required, but the input type correctly makes them optional.
 */
export type FeatureInputOptions<Features> = {
  [K in keyof Features]: Features[K] extends { optionsSchema: infer S extends z.ZodType }
    ? z.input<S>
    : Features[K] extends new (options: infer O, ...args: any[]) => any
      ? O
      : Record<string, unknown>
}

/**
 * You'll want to use module augmentation to add your own options to the ContainerArgv interface
 */
export interface ContainerArgv {
  _?: string[]
}

export type ContainerState = z.infer<typeof ContainerStateSchema>

export interface Plugin<T> {
  attach?: (container: Container<any> & T, options?: any) => any 
}

export type Extension<T> = 'string' | keyof AvailableFeatures | Plugin<T> | { attach: (container: Container<any>, options?: any) => T}

export interface ContainerUtils {
  /** Generate a v4 UUID */
  uuid: () => string
  /** Deterministic hash of any object */
  hashObject: (obj: any) => string
  /** String case conversion and inflection utilities */
  stringUtils: { kebabCase: typeof kebabCase; camelCase: typeof camelCase; upperFirst: typeof upperFirst; lowerFirst: typeof lowerFirst; pluralize: typeof pluralize; singularize: typeof singularize }
  /** Lodash utility subset */
  lodash: { uniq: typeof uniq; keyBy: typeof keyBy; uniqBy: typeof uniqBy; groupBy: typeof groupBy; debounce: typeof debounce; throttle: typeof throttle; mapValues: typeof mapValues; mapKeys: typeof mapKeys; pick: typeof pick; get: typeof get; set: typeof set; omit: typeof omit }
}

export interface ContainerContext<T extends AvailableFeatures = any> {
  container: Container<T>
  [key: string]: unknown
}

/**
 * The Container is the core runtime object in Luca. It is a singleton per process that acts as an
 * event bus, state machine, and dependency injector. It holds registries of helpers (features, clients,
 * servers, commands, endpoints) and provides factory methods to create instances from them.
 *
 * All helper instances share the container's context, enabling them to communicate and coordinate.
 * The container detects its runtime environment (Node, Bun, browser, Electron) and can load
 * platform-specific feature implementations accordingly.
 *
 * Use `container.feature('name')` to create feature instances, `container.use(Plugin)` to extend
 * the container with new capabilities, and `container.on('event', handler)` to react to lifecycle events.
 *
 * @example
 * ```ts
 * // Create a feature instance (cached — same args return same instance)
 * const fs = container.feature('fs')
 * const content = fs.readFile('README.md')
 * ```
 *
 * @example
 * ```ts
 * // Listen for state changes
 * container.on('stateChange', (state) => console.log('State changed:', state))
 * container.setState({ started: true })
 * ```
 *
 * @example
 * ```ts
 * // Extend with a plugin
 * container.use(MyClient)  // calls MyClient.attach(container)
 * container.use('contentDb') // enable a feature by name
 * ```
*/
export class Container<Features extends AvailableFeatures = AvailableFeatures, ContainerState extends ContainerState = ContainerState > {
  static stateSchema = ContainerStateSchema

  readonly uuid = v4()
  private readonly _events = new Bus()
  private readonly _state: State<ContainerState>

  /**
   * You can use module augmentation to define the starting interface for your container
   * whether it is process.argv, process.env, or some combination thereof
   */
  readonly options: ContainerArgv

  constructor(options: ContainerArgv) {
    this.options = options
    this._state = new State<ContainerState>()
    this.z = z
    this.state
      .set('enabledFeatures', [])
      .set('started', false)
      .set('registries', ['features'])
      .set('factories', ['feature'])
      
    this._hide('options', '_state', '_events', 'uuid', '_plugins', 'z')
    
    this.on('featureEnabled', (featureId: string, feature: any) => {
      const featureKey = featureId.replace(/^features\./,'')
      const mapKey = `${this.uuid}/${featureKey}`
      featureIdToHelperCacheKeyMap.set(mapKey, feature.cacheKey)
      this.state.set('enabledFeatures', uniq([
        ...this.state.get('enabledFeatures')!,
        featureKey
      ]))  
      this.addContext(featureKey, feature)
    })

    this.state.observe(() => {
      this.emit('stateChange', this.state.current)
    })
  }

  /**
   * Creates a new subcontainer instance of the same concrete Container subclass.
   * The new instance is constructed with the same options as this container,
   * shallow-merged with any overrides you provide. This preserves the runtime
   * container type (e.g. NodeContainer, AGIContainer, etc.).
   *
   * @param options - Options to override for the new container instance
   * @returns A new container instance of the same subclass
   *
   * @example
   * ```ts
   * const child = container.subcontainer({ cwd: '/tmp/workspace' })
   * child.cwd // '/tmp/workspace'
   * ```
   */
  subcontainer<This extends Container<any, any>>(
    this: This,
    options: ConstructorParameters<This['constructor']>[0]
  ): This {
    const Ctor = this.constructor as new (options: ConstructorParameters<This['constructor']>[0]) => This
    const mergedOptions = {
      ...(this as any).options || {},
      ...(options || {}),
    }
    return new Ctor(mergedOptions)
  }

  z!: typeof z


  /** The observable state object for this container instance. */
  get state(): State<ContainerState> {
    return this._state
  }

  /** Returns the list of shortcut IDs for all currently enabled features. */
  get enabledFeatureIds(): string[] {
    return this.state.get('enabledFeatures') || []
  }

  /** Returns a map of enabled feature shortcut IDs to their instances. */
  get enabledFeatures() : Partial<AvailableInstanceTypes<Features>> {
    return Object.fromEntries(
      this.enabledFeatureIds.map((featureId) => [featureId, (this as any)[featureId]])  
    ) as AvailableInstanceTypes<Features>
  }
  
  /**
   * Common utilities available on every container. Provides UUID generation, object hashing,
   * string case conversion, and lodash helpers — no imports needed.
   *
   * - `utils.uuid()` — generate a v4 UUID
   * - `utils.hashObject(obj)` — deterministic hash of any object
   * - `utils.stringUtils` — `{ kebabCase, camelCase, upperFirst, lowerFirst, pluralize, singularize }`
   * - `utils.lodash` — `{ uniq, keyBy, uniqBy, groupBy, debounce, throttle, mapValues, mapKeys, pick, get, set, omit }`
   *
   * @example
   * ```ts
   * const id = container.utils.uuid()
   * const hash = container.utils.hashObject({ foo: 'bar' })
   * const name = container.utils.stringUtils.camelCase('my-feature')
   * const unique = container.utils.lodash.uniq([1, 2, 2, 3])
   * ```
   */
  get utils(): ContainerUtils {
    return {
      hashObject: (obj: any) => hashObject(obj),
      get stringUtils() { return stringUtils },
      uuid: () => v4(),
      lodash: {
        uniq, keyBy, uniqBy, groupBy, debounce, throttle, mapValues, mapKeys, pick, get, set, omit,
      }
    }
  }

  private _describer?: ContainerDescriber

  /**
   * Lazy-initialized ContainerDescriber for introspecting registries, helpers, and members.
   * @internal
   */
  get describer(): ContainerDescriber {
    if (!this._describer) {
      this._describer = new ContainerDescriber(this)
    }
    return this._describer
  }

  addContext<K extends keyof ContainerContext>(key: K, value: ContainerContext[K]): this
  addContext(context: Partial<ContainerContext>): this
  /**
   * Add a value to the container's shared context, which is passed to all helper instances.
   * Accepts either a key and value, or an object of key-value pairs to merge in.
   *
   * @param key - The context key, or an object of key-value pairs to merge
   * @param value - The context value (omit when passing an object)
   * @returns The container instance (for chaining)
   *
   * @example
   * ```ts
   * container.addContext('db', dbConnection)
   * container.addContext({ db: dbConnection, cache: redisClient })
   * ```
   */
  addContext(keyOrContext: keyof ContainerContext | Partial<ContainerContext>, value?: ContainerContext[keyof ContainerContext]): this {
    if (arguments.length === 1 && typeof keyOrContext === 'object' && keyOrContext !== null) {
      for (const [k, v] of Object.entries(keyOrContext)) {
        if (v !== undefined) {
          this.addContext(k as keyof ContainerContext, v as ContainerContext[keyof ContainerContext])
        }
      }
      return this
    }
    const contexts = contextMap.get(this) || new Map()
    contexts.set(keyOrContext as keyof ContainerContext, value)
    contextMap.set(this, contexts)
    return this
  }

  /** 
   * The Container's context is an object that contains the enabled features, the container itself, and any additional context that has been added to the container.
   * 
   * All helper instances that are created by the container will have access to the shared context.
  */
  get context(): ContainerContext<Features> & Partial<AvailableInstanceTypes<AvailableFeatures>> {
    const contexts = contextMap.get(this) || new Map()

    return { 
      ...this.enabledFeatures,
      ...Object.fromEntries(Array.from(contexts.entries())) as ContainerContext<Features>,
      container: this as Container<Features>,
    }
  }

  /** 
   * The current state of the container.
   * 
   * This is a snapshot of the container's state at the time this method is called.
   * 
   * @returns The current state of the container.
  */
  get currentState(): ContainerState {
    return this.state.current
  }

  /**
   * Sets the state of the container. Accepts a partial state object to merge, or a function
   * that receives the current state and returns the new state.
   *
   * @param newState - A partial state object to merge, or a function `(current) => newState`
   * @returns The container instance (for chaining)
   *
   * @example
   * ```ts
   * container.setState({ started: true })
   * container.setState((prev) => ({ ...prev, started: true }))
   * ```
  */
  setState(newState: SetStateValue<ContainerState>): this {
    this.state.setState(newState)
    return this
  }

  get Feature() {
    return Feature
  }

  get Helper() {
    return Helper
  }

  get State() {
    return State
  }

  /**
   * The features registry. Use it to check what features are available, look up feature classes,
   * or check if a feature is registered.
   *
   * @example
   * ```ts
   * container.features.available   // ['fs', 'git', 'grep', ...]
   * container.features.has('fs')   // true
   * container.features.lookup('fs') // FS class
   * ```
   */
  get features(): FeaturesRegistry {
    return features
  }
  
  /**
   * Create a new standalone event bus instance. Useful when you need a scoped event channel
   * that is independent of the container's own event bus.
   *
   * @returns A new Bus instance
   *
   * @example
   * ```ts
   * const myBus = container.bus()
   * myBus.on('data', (payload) => console.log(payload))
   * myBus.emit('data', { count: 42 })
   * ```
  */
  bus(): Bus {
    return new Bus()
  }

  /**
   * Create a new standalone observable State object. Useful when you need reactive state
   * that is independent of the container's own state.
   *
   * @param initialState - The initial state object (defaults to empty)
   * @returns A new State instance
   *
   * @example
   * ```ts
   * const myState = container.newState({ count: 0, loading: false })
   * myState.observe(() => console.log('Changed:', myState.current))
   * myState.set('count', 1)
   * ```
  */
  newState<T extends object = any>(initialState: T = {} as T): State<T> {
    return new State<T>({ initialState })
  }

  /**
   * Parse helper options through the helper's static options schema so defaults are materialized.
   * @internal
   */
  normalizeHelperOptions(BaseClass: any, options: any, fallbackName?: string) {
    const candidate = { ...(options || {}) }

    if (fallbackName && (candidate.name === undefined || candidate.name === null || candidate.name === '')) {
      candidate.name = fallbackName
    }

    const schema = BaseClass?.optionsSchema
    if (!schema || typeof schema.safeParse !== 'function') {
      return candidate
    }

    const parsed = schema.safeParse(candidate)
    if (parsed.success) {
      return parsed.data
    }

    const target = BaseClass?.shortcut || BaseClass?.name || 'helper'
    const details = parsed.error.issues
      .map((issue: any) => `${issue.path?.join('.') || 'options'}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid options for ${target}: ${details || parsed.error.message}`)
  }

  /** @internal */
  buildHelperCacheKey(type: string, id: string, options: any, omitOptionKeys: string[] = []) {
    const hashableOptions = omit(options || {}, uniq(['_cacheKey', ...omitOptionKeys]))

    return hashObject({
      __type: type,
      id,
      options: hashableOptions,
      uuid: this.uuid,
    })
  }

  /** @internal */
  createHelperInstance({
    cache,
    type,
    id,
    BaseClass,
    options,
    fallbackName,
    omitOptionKeys = [],
    context,
  }: {
    cache: Map<string, any>
    type: string
    id: string
    BaseClass: any
    options?: any
    fallbackName?: string
    omitOptionKeys?: string[]
    context?: any
  }) {
    const normalizedOptions = this.normalizeHelperOptions(BaseClass, options, fallbackName || id)
    const cacheKey = this.buildHelperCacheKey(type, id, normalizedOptions, omitOptionKeys)
    const cached = cache.get(cacheKey)

    if (cached) {
      return cached
    }

    const helperOptions = {
      ...normalizedOptions,
      _cacheKey: normalizedOptions._cacheKey || cacheKey,
    }

    const instance = new (BaseClass as any)(helperOptions, context || this.context)
    cache.set(cacheKey, instance)
    uuidCache.set(instance.uuid, instance)
    return instance
  }

  /** 
   * Creates a new instance of a feature.
   * 
   * If you pass the same arguments, it will return the same instance as last time you created that.
   * 
   * If you need the ability to create fresh instances, it is up to you how you define your options to support that.
   * 
   * @param id - The id of the feature to create.
   * @param options - The options to pass to the feature constructor.
   * @returns The new feature instance.
  */
  feature<T extends keyof Features>(
    id: T,
    options?: FeatureInputOptions<Features>[T] | Record<string, unknown>
  ): InstanceType<Features[T]> {
    const BaseClass = this.features.lookup(id as string) as Features[T]

    return this.createHelperInstance({
      cache: helperCache,
      type: 'feature',
      id: String(id),
      BaseClass,
      options,
      omitOptionKeys: ['enable'],
      context: { container: this },
    }) as InstanceType<Features[T]>
  }

  /**
   * Creates a lightweight entity object with observable state, a typed event bus, and
   * access to the container. Same id + options always returns the same cached base instance.
   *
   * An optional third argument auto-extends the entity with functions and getters.
   * All extended methods and getters can access the entity (state, options, container,
   * on/off/emit, etc.) via `this`.
   *
   * @param id         - Stable identifier for this entity (included in cache key)
   * @param options    - Arbitrary options stored on `entity.options` (included in cache key)
   * @param extensions - Optional object of functions/getters to graft onto the entity
   *
   * @example
   * ```ts
   * // Basic entity with typed state and events
   * const counter = container.entity<{ count: number }>('counter')
   * counter.setState({ count: 0 })
   * counter.on('tick', () => counter.setState(s => ({ count: s.count + 1 })))
   *
   * // With options and auto-extension
   * const user = container.entity('user:42', { name: 'Alice' }, {
   *   greet() { return `Hello ${this.options.name}` },
   *   get label() { return `User: ${this.options.name}` },
   * })
   * user.greet() // "Hello Alice"
   * ```
   */
  entity<
    TState extends Record<string, any> = Record<string, any>,
    TOptions extends Record<string, any> = Record<string, any>,
    TEvents extends EntityEventMap = EntityEventMap,
    Ext extends Record<string, any> = {},
  >(
    id: string,
    options?: TOptions,
    extensions?: Ext & ThisType<Entity<TState, TOptions, TEvents> & Ext>
  ): Entity<TState, TOptions, TEvents> & Ext {
    const normalizedOptions = (options || {}) as TOptions
    const cacheKey = this.buildHelperCacheKey('entity', id, normalizedOptions)

    let base = entityCache.get(cacheKey)
    if (!base) {
      base = createEntityObject<TState, TOptions, TEvents>(id, this, normalizedOptions)
      entityCache.set(cacheKey, base)
    }

    return extensions ? base.extend(extensions) : base
  }

  /**
   * Look up any helper instance (feature, client, server) by its UUID.
   * Returns undefined if the UUID is unknown or the instance was never created.
   *
   * @param uuid - The `instance.uuid` value assigned at construction time
   * @returns The helper instance, or undefined
   *
   * @example
   * ```ts
   * const assistant = container.feature('assistant')
   * const { uuid } = assistant
   * // ... later ...
   * const same = container.getHelperByUUID(uuid) // === assistant
   * ```
   */
  getHelperByUUID(uuid: string): Helper | undefined {
    return uuidCache.get(uuid)
  }

  /**
   * Start the container. Emits the 'started' event and sets `state.started` to true.
   * Plugins and features can listen for this event to perform initialization.
   *
   * @returns The container instance
   *
   * @example
   * ```ts
   * container.on('started', () => console.log('Ready'))
   * await container.start()
   * ```
  */
  async start(): Promise<this> {
    this.emit('started', this as Container<Features>)
    this.state.set('started', true)
    return this
  }
  
  /** 
   * ENVIRONMENT DETECTION METHODS
   * 
   * One of the ideas of the container is that it can detect what kind of environment it is running in and
   * e.g. perhaps load different versions of features to provide the same API with different implementations.
   * 
  */

  /**
   * Returns true if the container is running in a browser.
   */ 
  get isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined'
  }

  /**
   * Returns true if the container is running in Bun.
   */
  get isBun(): boolean {
    return this.isNode && typeof Bun !== 'undefined'
  }

  /**
   * Returns true if the container is running in Node.
   */
  get isNode(): boolean {
    return typeof process !== 'undefined' && typeof process.versions !== 'undefined' && typeof process.versions.node !== 'undefined'
  }

  /**
   * Returns true if the container is running in Electron.
   */
  get isElectron(): boolean {
    return typeof process !== 'undefined' && typeof process.versions !== 'undefined' && typeof process.versions.electron !== 'undefined'
  }

  /**
   * Returns true if the container is running in development mode.
   */
  get isDevelopment(): boolean {
    return typeof process !== 'undefined' && process.env.NODE_ENV === 'development'
  }

  /**
   * Returns true if the container is running in production mode.
   */
  get isProduction(): boolean {
    return typeof process !== 'undefined' && process.env.NODE_ENV === 'production'
  }

  /**
   * Returns true if the container is running in a CI environment.
   */
  get isCI(): boolean {
    return typeof process !== 'undefined' && process.env.CI !== undefined && String(process.env.CI).length > 0
  }

  /**
   * Emit an event on the container's event bus.
   *
   * @param event - The event name
   * @param args - Arguments to pass to listeners
   * @returns The container instance (for chaining)
   *
   * @example
   * ```ts
   * container.emit('taskCompleted', { id: 'abc', result: 42 })
   * ```
   */
  emit(event: string, ...args: any[]): this {
    this._events.emit(event, ...args)
    return this
  }

  /**
   * Subscribe to an event on the container's event bus.
   *
   * @param event - The event name
   * @param listener - The callback function
   * @returns The container instance (for chaining)
   *
   * @example
   * ```ts
   * container.on('featureEnabled', (id, feature) => {
   *   console.log(`Feature ${id} enabled`)
   * })
   * ```
   */
  on(event: string, listener: (...args: any[]) => void): this {
    this._events.on(event, listener)
    return this
  }

  /**
   * Unsubscribe a listener from an event on the container's event bus.
   *
   * @param event - The event name
   * @param listener - The listener to remove
   * @returns The container instance (for chaining)
   */
  off(event: string, listener?: (...args: any[]) => void): this {
    this._events.off(event, listener)
    return this
  }

  /**
   * Subscribe to an event on the container's event bus, but only fire once.
   *
   * @param event - The event name
   * @param listener - The callback function (invoked at most once)
   * @returns The container instance (for chaining)
   */
  once(event: string, listener: (...args: any[]) => void): this {
    this._events.once(event, listener)
    return this
  }

  /**
   * Returns a promise that resolves the next time the given event is emitted.
   * Useful for awaiting one-time lifecycle transitions.
   *
   * @param event - The event name to wait for
   * @returns A promise that resolves with the event arguments
   *
   * @example
   * ```ts
   * await container.waitFor('started')
   * console.log('Container is ready')
   * ```
  */
  async waitFor(event: string): Promise<any> {
    const resp = await this._events.waitFor(event)
    return resp
  }

  /**
   * Register a helper type (registry + factory pair) on this container.
   * Called automatically by Helper.attach() methods (e.g. Client.attach, Server.attach).
   * @internal
   */
  registerHelperType(registryName: string, factoryName: string) {
    const registries = uniq([...this.state.get('registries')!, registryName])
    const factories = uniq([...this.state.get('factories')!, factoryName])
    this.state.set('registries', registries)
    this.state.set('factories', factories)
    return this
  }

  /** Returns the names of all attached registries (e.g. ["features", "clients", "servers"]). */
  get registryNames(): string[] {
    return this.state.get('registries') || ['features']
  }

  /** Returns the names of all available factory methods (e.g. ["feature", "client", "server"]). */
  get factoryNames(): string[] {
    return this.state.get('factories') || ['feature']
  }

  /**
   * Returns a full introspection object for this container, merging build-time AST data
   * (JSDoc descriptions, methods, getters) with runtime data (registries, factories, state, environment).
   *
   * @returns The complete introspection data as a structured object
   *
   * @example
   * ```ts
   * const info = container.introspect()
   * console.log(info.methods)   // all public methods with descriptions
   * console.log(info.getters)   // all getters with return types
   * console.log(info.registries) // features, clients, servers, etc.
   * ```
   */
  introspect(): ContainerIntrospection {
    const className = this.constructor.name
    const buildTimeData = getContainerBuildTimeData(className) || {}

    // Walk up the prototype chain to merge inherited build-time data
    let mergedMethods = { ...(buildTimeData.methods || {}) }
    let mergedGetters = { ...(buildTimeData.getters || {}) }
    let mergedEvents = { ...(buildTimeData.events || {}) }
    let mergedDescription = buildTimeData.description || ''

    let proto = Object.getPrototypeOf(this.constructor)
    while (proto && proto.name) {
      const parentData = getContainerBuildTimeData(proto.name)
      if (parentData) {
        mergedMethods = { ...parentData.methods, ...mergedMethods }
        mergedGetters = { ...parentData.getters, ...mergedGetters }
        mergedEvents = { ...parentData.events, ...mergedEvents }
        if (!mergedDescription && parentData.description) {
          mergedDescription = parentData.description
        }
      }
      proto = Object.getPrototypeOf(proto)
    }

    // Build registry introspection from runtime data
    const registryNames = this.registryNames
    const registries: RegistryIntrospection[] = registryNames.map((name) => {
      const registry = (this as any)[name]
      return {
        name,
        baseClass: registry?.baseClass?.name || 'Helper',
        available: registry?.available || []
      }
    })

    // Get state description from the Zod schema
    const stateSchema = (this.constructor as any).stateSchema
    const stateDescription = stateSchema ? describeZodShape(stateSchema) : {}

    return {
      className,
      uuid: this.uuid,
      description: mergedDescription,
      registries,
      factories: this.factoryNames,
      methods: mergedMethods,
      getters: mergedGetters,
      events: mergedEvents,
      state: stateDescription,
      enabledFeatures: this.enabledFeatureIds,
      environment: {
        isBrowser: this.isBrowser,
        isNode: this.isNode,
        isBun: this.isBun,
        isElectron: this.isElectron,
        isDevelopment: this.isDevelopment,
        isProduction: this.isProduction,
        isCI: this.isCI
      }
    }
  }

  /**
   * Returns a human-readable markdown representation of this container's introspection data.
   * Useful in REPLs, AI agent contexts, or documentation generation. Pass a section name
   * to render only that section (e.g. 'methods', 'getters', 'events', 'state').
   *
   * @param sectionOrDepth - A section name to render, or heading depth number
   * @param startHeadingDepth - Starting markdown heading depth (default 1)
   * @returns Markdown-formatted introspection text
   *
   * @example
   * ```ts
   * console.log(container.introspectAsText())           // full description
   * console.log(container.introspectAsText('methods'))   // just methods
   * ```
   */
  introspectAsText(sectionOrDepth?: IntrospectionSection | number, startHeadingDepth?: number): string {
    let section: IntrospectionSection | undefined
    let depth = 1

    if (typeof sectionOrDepth === 'string') {
      section = sectionOrDepth
      depth = startHeadingDepth ?? 1
    } else if (typeof sectionOrDepth === 'number') {
      depth = sectionOrDepth
    }

    const data = this.introspect()
    return presentContainerIntrospectionAsMarkdown(data, depth, section)
  }

  /** Returns JSON introspection data. */
  introspectAsJSON(): ContainerIntrospection {
    return this.introspect()
  }

  /**
   * Returns the container's introspection data formatted as a TypeScript interface declaration.
   * Includes the container's own methods, getters, factories, and registered helper types.
   *
   * @example
   * ```ts
   * console.log(container.introspectAsType())
   * // interface NodeContainer {
   * //   feature<T>(id: string, options?: object): T;
   * //   readonly uuid: string;
   * //   ...
   * // }
   * ```
   */
  introspectAsType(): string {
    const data = this.introspect()
    return presentContainerIntrospectionAsTypeScript(data)
  }

  /** Make a property non-enumerable, which is nice for inspecting it in the REPL */
  _hide(...propNames: string[]) {
    propNames.map((propName) => {
      Object.defineProperty(this, propName, { enumerable: false })
    })
    
    return this
  }

  /** Sleep for the specified number of milliseconds. Useful for scripting and sequencing. */
  async sleep(ms: number = 1000): Promise<this> {
    await new Promise((res) => setTimeout(res,ms))
    return this
  }

  _plugins: (() => void)[] = []

  /**
   * Apply a plugin or enable a feature by string name. Plugins are classes with a static `attach(container)` method
   * that extend the container with new registries, factories, or capabilities.
   *
   * @param plugin - A feature name string, or a class/object with a static attach method
   * @param options - Options to pass to the plugin's attach method
   * @returns The container instance (with the plugin's type merged in)
   *
   * @example
   * ```ts
   * // Enable a feature by name
   * container.use('contentDb')
   *
   * // Attach a plugin class (e.g. Client, Server, or custom)
   * container.use(Client)    // registers the clients registry + client() factory
   * container.use(Server)    // registers the servers registry + server() factory
   * ```
   */
  use<T = {}>(plugin: Extension<T>, options: any = {}) : this & T {
    const container = this

    if(typeof plugin === 'string' && features.has(plugin)) {
      const featureId = plugin as keyof AvailableFeatures
      this.feature(featureId, {
        ...options,
        enable: true
      })
    } else if (typeof plugin === 'string' && !features.has(plugin)) { 
      throw new Error(`Feature ${plugin} is not available.`)
    } else if ((typeof plugin === 'object' || typeof plugin === 'function') && typeof plugin?.attach === 'function') {
      // This is like using a Helper or Feature subclass which declares a static attach method
      plugin.attach(container as this & T, options)  
    }
    
    return this as (this & T)
  }
}

const helperCache = new Map()
const entityCache = new Map()
const uuidCache = new Map<string, Helper>()
const featureIdToHelperCacheKeyMap= new Map()
const contextMap = new WeakMap()

/**
 * Returns all helper instances that have been created by any container in this process.
 * Optionally filtered by class.
 *
 * @param FilterClass - When provided, only instances of this class are returned.
 */
export function allHelperInstances(): Helper[]
export function allHelperInstances<T extends Helper>(FilterClass: new (...args: any[]) => T): T[]
export function allHelperInstances<T extends Helper>(FilterClass?: new (...args: any[]) => T): Helper[] | T[] {
  const all = [...uuidCache.values()]
  return FilterClass ? all.filter((h): h is T => h instanceof FilterClass) : all
}

function presentContainerIntrospectionAsMarkdown(data: ContainerIntrospection, startHeadingDepth: number = 1, section?: IntrospectionSection): string {
  const sections: string[] = []
  const heading = (level: number) => '#'.repeat(Math.max(1, startHeadingDepth + level - 1))

  const shouldRender = (name: IntrospectionSection | string) => !section || section === name

  if (!section) {
    // Header
    sections.push(`${heading(1)} ${data.className}\n\n${data.description || ''}`)

    // Container Properties section — dynamic from getters data, not hardcoded
    // (cwd, paths, manifest, argv, utils etc. come through as getters from the introspection scanner)

    // Registries section
    if (data.registries && data.registries.length > 0) {
      sections.push(`${heading(2)} Registries`)

      for (const reg of data.registries) {
        sections.push(`${heading(3)} ${reg.name} (${reg.baseClass})`)
        if (reg.available.length > 0) {
          sections.push(reg.available.map(a => `- \`${a}\``).join('\n'))
        } else {
          sections.push('_No members registered_')
        }
      }
    }

    // Factories section
    if (data.factories && data.factories.length > 0) {
      sections.push(`${heading(2)} Factory Methods`)
      sections.push(data.factories.map(f => `- \`${f}()\``).join('\n'))
    }
  }

  // Methods section
  if (shouldRender('methods') && data.methods && Object.keys(data.methods).length > 0) {
    sections.push(`${heading(2)} Methods`)

    for (const [methodName, methodInfo] of Object.entries(data.methods)) {
      sections.push(`${heading(3)} ${methodName}`)

      if (methodInfo.description) {
        sections.push(methodInfo.description)
      }

      if (methodInfo.parameters && Object.keys(methodInfo.parameters).length > 0) {
        const tableRows = [
          `**Parameters:**`,
          '',
          `| Name | Type | Required | Description |`,
          `|------|------|----------|-------------|`,
        ]

        for (const [paramName, paramInfo] of Object.entries(methodInfo.parameters)) {
          const isRequired = methodInfo.required?.includes(paramName) ? '✓' : ''
          tableRows.push(`| \`${paramName}\` | \`${paramInfo.type || 'any'}\` | ${isRequired} | ${paramInfo.description || ''} |`)

          if (paramInfo.properties && Object.keys(paramInfo.properties).length > 0) {
            tableRows.push('')
            tableRows.push(`\`${paramInfo.type}\` properties:`)
            tableRows.push('')
            tableRows.push(`| Property | Type | Description |`)
            tableRows.push(`|----------|------|-------------|`)

            for (const [propName, propInfo] of Object.entries(paramInfo.properties)) {
              tableRows.push(`| \`${propName}\` | \`${propInfo.type || 'any'}\` | ${propInfo.description || ''} |`)
            }
          }
        }
        sections.push(tableRows.join('\n'))
      }

      if (methodInfo.returns) {
        sections.push(`**Returns:** \`${methodInfo.returns}\``)
      }

      if ((methodInfo as any).examples && (methodInfo as any).examples.length > 0) {
        for (const example of (methodInfo as any).examples) {
          if (example.title) {
            sections.push(`**Example: ${example.title}**`)
          }
          sections.push(`\`\`\`${example.language || 'ts'}\n${example.code}\n\`\`\``)
        }
      }

      sections.push('')
    }
  }

  // Getters section
  if (shouldRender('getters') && data.getters && Object.keys(data.getters).length > 0) {
    const getterTableRows = [
      `${heading(2)} Getters`,
      '',
      `| Property | Type | Description |`,
      `|----------|------|-------------|`,
    ]

    const gettersWithExamples: [string, any][] = []

    for (const [getterName, getterInfo] of Object.entries(data.getters)) {
      // Truncate long descriptions in the table
      const desc = getterInfo.description || ''
      const shortDesc = desc.length > 120 ? desc.slice(0, 117) + '...' : desc
      getterTableRows.push(`| \`${getterName}\` | \`${getterInfo.returns || 'any'}\` | ${shortDesc} |`)
      if ((getterInfo as any).examples && (getterInfo as any).examples.length > 0) {
        gettersWithExamples.push([getterName, getterInfo])
      }
    }
    sections.push(getterTableRows.join('\n'))

    // Render examples for getters that have them
    if (gettersWithExamples.length > 0) {
      for (const [getterName, getterInfo] of gettersWithExamples) {
        for (const example of (getterInfo as any).examples) {
          sections.push(`\`\`\`${example.language || 'ts'}\n${example.code}\n\`\`\``)
        }
      }
    }
  }

  // Events section
  if (shouldRender('events') && data.events && Object.keys(data.events).length > 0) {
    sections.push(`${heading(2)} Events`)

    for (const [eventName, eventInfo] of Object.entries(data.events)) {
      sections.push(`${heading(3)} ${eventName}`)

      if (eventInfo.description) {
        sections.push(eventInfo.description)
      }

      if (eventInfo.arguments && Object.keys(eventInfo.arguments).length > 0) {
        const tableRows = [
          `**Event Arguments:**`,
          '',
          `| Name | Type | Description |`,
          `|------|------|-------------|`,
        ]

        for (const [argName, argInfo] of Object.entries(eventInfo.arguments)) {
          tableRows.push(`| \`${argName}\` | \`${argInfo.type || 'any'}\` | ${argInfo.description || ''} |`)
        }
        sections.push(tableRows.join('\n'))
      }

      sections.push('')
    }
  }

  // State section
  if (shouldRender('state') && data.state && Object.keys(data.state).length > 0) {
    const stateTableRows = [
      `${heading(2)} State`,
      '',
      `| Property | Type | Description |`,
      `|----------|------|-------------|`,
    ]

    for (const [stateName, stateInfo] of Object.entries(data.state)) {
      stateTableRows.push(`| \`${stateName}\` | \`${stateInfo.type || 'any'}\` | ${stateInfo.description || ''} |`)
    }
    sections.push(stateTableRows.join('\n'))
  }

  if (!section) {
    // Enabled features section
    if (data.enabledFeatures && data.enabledFeatures.length > 0) {
      sections.push(`${heading(2)} Enabled Features`)
      sections.push(data.enabledFeatures.map(f => `- \`${f}\``).join('\n'))
    }

    // Environment section
    if (data.environment) {
      const envTableRows = [
        `${heading(2)} Environment`,
        '',
        `| Flag | Value |`,
        `|------|-------|`,
      ]
      for (const [key, value] of Object.entries(data.environment)) {
        envTableRows.push(`| \`${key}\` | ${value} |`)
      }
      sections.push(envTableRows.join('\n'))
    }
  }

  return sections.join('\n\n')
}

function presentContainerIntrospectionAsTypeScript(data: ContainerIntrospection): string {
  const members: string[] = []

  // Getters
  if (data.getters && Object.keys(data.getters).length > 0) {
    for (const [name, info] of Object.entries(data.getters)) {
      if (info.description) {
        members.push(`  /** ${info.description} */`)
      }
      members.push(`  readonly ${name}: ${normalizeTypeString(info.returns || 'any')};`)
    }
  }

  // Methods
  if (data.methods && Object.keys(data.methods).length > 0) {
    if (members.length > 0) members.push('')
    for (const [name, info] of Object.entries(data.methods)) {
      if (info.description) {
        members.push(`  /** ${info.description} */`)
      }
      const params = renderTypeScriptParams(info)
      members.push(`  ${name}(${params}): ${normalizeTypeString(info.returns || 'void')};`)
    }
  }

  // Factory methods
  if (data.factories && data.factories.length > 0) {
    if (members.length > 0) members.push('')
    members.push('  // Factory methods')
    for (const factory of data.factories) {
      members.push(`  ${factory}(id: string, options?: Record<string, any>): any;`)
    }
  }

  // Registries
  if (data.registries && data.registries.length > 0) {
    if (members.length > 0) members.push('')
    members.push('  // Registries')
    for (const reg of data.registries) {
      const available = reg.available.length > 0
        ? reg.available.map(a => `'${a}'`).join(' | ')
        : 'string'
      members.push(`  readonly ${reg.name}: { available: (${available})[]; lookup(id: string): any; };`)
    }
  }

  // Events — as on() overloads
  if (data.events && Object.keys(data.events).length > 0) {
    if (members.length > 0) members.push('')
    for (const [eventName, eventInfo] of Object.entries(data.events)) {
      const args = Object.entries(eventInfo.arguments || {})
      const listenerParams = args.length > 0
        ? args.map(([argName, argInfo]) => `${argName}: ${normalizeTypeString(argInfo.type || 'any')}`).join(', ')
        : ''
      if (eventInfo.description) {
        members.push(`  /** ${eventInfo.description} */`)
      }
      members.push(`  on(event: '${eventName}', listener: (${listenerParams}) => void): this;`)
    }
  }

  // State
  if (data.state && Object.keys(data.state).length > 0) {
    if (members.length > 0) members.push('')
    const stateMembers = Object.entries(data.state)
      .map(([name, info]) => {
        const comment = info.description ? `    /** ${info.description} */\n` : ''
        return `${comment}    ${name}: ${normalizeTypeString(info.type || 'any')};`
      })
      .join('\n')
    members.push(`  state: {\n${stateMembers}\n  };`)
  }

  const description = data.description
    ? `/**\n * ${data.description.split('\n').join('\n * ')}\n */\n`
    : ''

  return `${description}interface ${data.className} {\n${members.join('\n')}\n}`
}
