// @ts-nocheck
import { Bus } from './bus'
import { SetStateValue, State } from './state'
import { AvailableFeatures, features, Feature, FeaturesRegistry } from './feature'
import { Helper } from './helper'
import uuid from 'node-uuid'
import hashObject from './hash-object'
import { uniq, keyBy, uniqBy, groupBy, debounce, throttle, mapValues, mapKeys, pick, get, set, omit, kebabCase, camelCase, upperFirst, lowerFirst } from 'lodash-es'
import { pluralize, singularize } from 'inflect'
import { z } from 'zod'
import { ContainerStateSchema, describeZodShape } from './schemas/base'
import { getContainerBuildTimeData, type ContainerIntrospection, type RegistryIntrospection, type IntrospectionSection } from './introspection/index'


export { z }

const { v4 } = uuid

const stringUtils = { kebabCase, camelCase, upperFirst, lowerFirst, pluralize, singularize }

export type { AvailableFeatures }

// I want the InstanceType of each value of AvailableFeatures, AvailableClients, whatever
export type AvailableInstanceTypes<T> = {
  [K in keyof T]: T[K] extends new (...args: any) => any ? InstanceType<T[K]> : never
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

export interface ContainerContext<T extends AvailableFeatures = any> {
  container: Container<T> 
}

/** 
 * Containers are single objects that contain state, an event bus, and registries of helpers such as:
 * 
 * - features
 * - clients
 * - servers
 * 
 * A Helper represents a category of components in your program which have a common interface, e.g. all servers can be started / stopped, all features can be enabled, if supported, all clients can connect to something.
 * 
 * A Helper can be introspected at runtime to learn about the interface of the helper. A helper has state, and emits events.
 * 
 * You can design your own containers and load them up with the helpers you want for that environment.
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

    this.state
      .set('enabledFeatures', [])
      .set('started', false)
      .set('registries', ['features'])
      .set('factories', ['feature'])
      
    this._hide('options', '_state', '_events', 'uuid', '_plugins')
    
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

  z = z

  /** The observable state object for this container instance. */
  get state() {
    return this._state
  }

  /** Returns the list of shortcut IDs for all currently enabled features. */
  get enabledFeatureIds() {
    return this.state.get('enabledFeatures') || []
  }

  /** Returns a map of enabled feature shortcut IDs to their instances. */
  get enabledFeatures() : Partial<AvailableInstanceTypes<Features>> {
    return Object.fromEntries(
      this.enabledFeatureIds.map((featureId) => [featureId, (this as any)[featureId]])  
    ) as AvailableInstanceTypes<Features>
  }
  
  utils = {
    hashObject: (obj: any) => hashObject(obj),
    get stringUtils() { return stringUtils },
    uuid: () => v4(),
    lodash: {
      uniq, keyBy, uniqBy, groupBy, debounce, throttle, mapValues, mapKeys, pick, get, set, omit,
    }
  }

  /**
   * Add a value to the container's shared context, which is passed to all helper instances.
   *
   * @param {K} key - The context key
   * @param {ContainerContext[K]} value - The context value
   */
  addContext<K extends keyof ContainerContext>(key: K, value: ContainerContext[K]) {
    const contexts = contextMap.get(this) || new Map()
    contexts.set(key, value)
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
  get currentState() {
    return this.state.current
  }

  /** 
   * Sets the state of the container.
   * 
   * @param newState - The new state of the container.
   * @returns The container instance.
  */
  setState(newState: SetStateValue<ContainerState>) {
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

  get features(): FeaturesRegistry {
    return features
  }
  
  /** 
   * Convenience method for creating a new event bus instance.
  */
  bus() {
    return new Bus()
  }
  
  /** 
   * Convenience method for creating a new observable State object.
  */
  newState<T extends object = any>(initialState: T = {} as T) {
    return new State<T>({ initialState })
  }

  /**
   * Parse helper options through the helper's static options schema so defaults are materialized.
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

  buildHelperCacheKey(type: string, id: string, options: any, omitOptionKeys: string[] = []) {
    const hashableOptions = omit(options || {}, uniq(['_cacheKey', ...omitOptionKeys]))

    return hashObject({
      __type: type,
      id,
      options: hashableOptions,
      uuid: this.uuid,
    })
  }

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
    options?: ConstructorParameters<Features[T]>[0]
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
   * TODO:
   * 
   * A container should be able to container.use(plugin) and that plugin should be able to define
   * an asynchronous method that will be run when the container is started.  Right now there's nothing
   * to do with starting / stopping a container but that might be neat.
  */
  async start() {
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
  get isBrowser() {
    return typeof window !== 'undefined' && typeof document !== 'undefined'
  }
 
  /** 
   * Returns true if the container is running in Bun.
   */
  get isBun() {
    return this.isNode && typeof Bun !== 'undefined'
  }

  /** 
   * Returns true if the container is running in Node.
   */
  get isNode() {
    return typeof process !== 'undefined' && typeof process.versions !== 'undefined' && typeof process.versions.node !== 'undefined'
  }
  
  /** 
   * Returns true if the container is running in Electron.
   */
  get isElectron() {
    return typeof process !== 'undefined' && typeof process.versions !== 'undefined' && typeof process.versions.electron !== 'undefined'
  }
  
  /** 
   * Returns true if the container is running in development mode.
   */
  get isDevelopment() {
    return process.env.NODE_ENV === 'development'
  }
  
  /** 
   * Returns true if the container is running in production mode.
   */
  get isProduction() {
    return process.env.NODE_ENV === 'production'
  }
  
  /** 
   * Returns true if the container is running in a CI environment.
   */
  get isCI() {
    return process.env.CI !== undefined && String(process.env.CI).length > 0
  }

  /** Emit an event on the container's event bus. */
  emit(event: string, ...args: any[]) {
    this._events.emit(event, ...args)
    return this
  }

  /** Subscribe to an event on the container's event bus. */
  on(event: string, listener: (...args: any[]) => void) {
    this._events.on(event, listener)
    return this
  }

  /** Unsubscribe a listener from an event on the container's event bus. */
  off(event: string, listener?: (...args: any[]) => void) {
    this._events.off(event, listener)
    return this
  }

  /** Subscribe to an event on the container's event bus, but only fire once. */
  once(event: string, listener: (...args: any[]) => void) {
    this._events.once(event, listener)
    return this
  }

  /**
   * Returns a promise that will resolve when the event is emitted
  */
  async waitFor(event: string) {
    const resp = await this._events.waitFor(event)
    return resp
  }

  /**
   * Register a helper type (registry + factory pair) on this container.
   * Called automatically by Helper.attach() methods (e.g. Client.attach, Server.attach).
   *
   * @param registryName - The plural name of the registry, e.g. "clients", "servers"
   * @param factoryName - The singular factory method name, e.g. "client", "server"
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
   * @returns {ContainerIntrospection} The complete introspection data
   */
  inspect(): ContainerIntrospection {
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
   * Useful in REPLs, AI agent contexts, or documentation generation.
   *
   * The first argument can be a section name (`'methods'`, `'getters'`, etc.) to render only
   * that section, or a number for the starting heading depth (backward compatible).
   *
   * @returns {string} Markdown-formatted introspection text
   */
  inspectAsText(sectionOrDepth?: IntrospectionSection | number, startHeadingDepth?: number): string {
    let section: IntrospectionSection | undefined
    let depth = 1

    if (typeof sectionOrDepth === 'string') {
      section = sectionOrDepth
      depth = startHeadingDepth ?? 1
    } else if (typeof sectionOrDepth === 'number') {
      depth = sectionOrDepth
    }

    const data = this.inspect()
    return presentContainerIntrospectionAsMarkdown(data, depth, section)
  }

  /** Make a property non-enumerable, which is nice for inspecting it in the REPL */
  _hide(...propNames: string[]) {
    propNames.map((propName) => {
      Object.defineProperty(this, propName, { enumerable: false })
    })
    
    return this
  }

  /** Sleep for the specified number of milliseconds. Useful for scripting and sequencing. */
  async sleep(ms = 1000) {
    await new Promise((res) => setTimeout(res,ms))
    return this
  }

  _plugins: (() => void)[] = []

  /**
   * Apply a plugin or enable a feature by string name. Plugins must have a static attach(container) method.
   *
   * @param {Extension<T>} plugin - A feature name string, or a class/object with a static attach method
   * @param {any} options - Options to pass to the plugin's attach method
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
const featureIdToHelperCacheKeyMap= new Map()
const contextMap = new WeakMap()

function presentContainerIntrospectionAsMarkdown(data: ContainerIntrospection, startHeadingDepth: number = 1, section?: IntrospectionSection): string {
  const sections: string[] = []
  const heading = (level: number) => '#'.repeat(Math.max(1, startHeadingDepth + level - 1))

  const shouldRender = (name: IntrospectionSection | string) => !section || section === name

  if (!section) {
    // Header
    sections.push(`${heading(1)} ${data.className}\n\n${data.description || ''}`)

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
        sections.push(`**Parameters:**`)
        sections.push(`| Name | Type | Required | Description |`)
        sections.push(`|------|------|----------|-------------|`)

        for (const [paramName, paramInfo] of Object.entries(methodInfo.parameters)) {
          const isRequired = methodInfo.required?.includes(paramName) ? '✓' : ''
          sections.push(`| \`${paramName}\` | \`${paramInfo.type || 'any'}\` | ${isRequired} | ${paramInfo.description || ''} |`)

          if (paramInfo.properties && Object.keys(paramInfo.properties).length > 0) {
            sections.push('')
            sections.push(`\`${paramInfo.type}\` properties:`)
            sections.push(`| Property | Type | Description |`)
            sections.push(`|----------|------|-------------|`)

            for (const [propName, propInfo] of Object.entries(paramInfo.properties)) {
              sections.push(`| \`${propName}\` | \`${propInfo.type || 'any'}\` | ${propInfo.description || ''} |`)
            }
          }
        }
      }

      if (methodInfo.returns) {
        sections.push(`**Returns:** \`${methodInfo.returns}\``)
      }

      sections.push('')
    }
  }

  // Getters section
  if (shouldRender('getters') && data.getters && Object.keys(data.getters).length > 0) {
    sections.push(`${heading(2)} Getters`)
    sections.push(`| Property | Type | Description |`)
    sections.push(`|----------|------|-------------|`)

    for (const [getterName, getterInfo] of Object.entries(data.getters)) {
      sections.push(`| \`${getterName}\` | \`${getterInfo.returns || 'any'}\` | ${getterInfo.description || ''} |`)
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
        sections.push(`**Event Arguments:**`)
        sections.push(`| Name | Type | Description |`)
        sections.push(`|------|------|-------------|`)

        for (const [argName, argInfo] of Object.entries(eventInfo.arguments)) {
          sections.push(`| \`${argName}\` | \`${argInfo.type || 'any'}\` | ${argInfo.description || ''} |`)
        }
      }

      sections.push('')
    }
  }

  // State section
  if (shouldRender('state') && data.state && Object.keys(data.state).length > 0) {
    sections.push(`${heading(2)} State`)
    sections.push(`| Property | Type | Description |`)
    sections.push(`|----------|------|-------------|`)

    for (const [stateName, stateInfo] of Object.entries(data.state)) {
      sections.push(`| \`${stateName}\` | \`${stateInfo.type || 'any'}\` | ${stateInfo.description || ''} |`)
    }
  }

  if (!section) {
    // Enabled features section
    if (data.enabledFeatures && data.enabledFeatures.length > 0) {
      sections.push(`${heading(2)} Enabled Features`)
      sections.push(data.enabledFeatures.map(f => `- \`${f}\``).join('\n'))
    }

    // Environment section
    if (data.environment) {
      sections.push(`${heading(2)} Environment`)
      sections.push(`| Flag | Value |`)
      sections.push(`|------|-------|`)
      for (const [key, value] of Object.entries(data.environment)) {
        sections.push(`| \`${key}\` | ${value} |`)
      }
    }
  }

  return sections.join('\n\n')
}
