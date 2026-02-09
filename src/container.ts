// @ts-nocheck
import { Bus } from './bus.js'
import { SetStateValue, State } from './state.js'
import { AvailableFeatures, features, Feature, FeaturesRegistry } from './feature.js'
import { Helper } from './helper.js'
import uuid from 'node-uuid'
import hashObject from './hash-object'
import { uniq, keyBy, uniqBy, groupBy, debounce, throttle, mapValues, mapKeys, pick, get, set, omit, kebabCase, camelCase, upperFirst, lowerFirst } from 'lodash-es'
import { pluralize, singularize } from 'inflect'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { zodToTs, printNode, createAuxiliaryTypeStore} from 'zod-to-ts'

const auxilaryTypeStore = createAuxiliaryTypeStore()

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

export interface ContainerState { 
  started: boolean;
  enabledFeatures: string[];
}

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
      
    this._hide('options', '_state', '_events', 'uuid', '_plugins')
    
    this.on('featureEnabled', (featureId: string, feature: any) => {
      const featureKey = featureId.replace(/^features\./,'')
      const mapKey = `${this.uuid}/${featureKey}`
      featureIdToHelperCacheKeyMap.set(mapKey, feature.cacheKey)
      this.state.set('enabledFeatures', uniq([
        ...this.state.get('enabledFeatures')!,
        featureId
      ]))  
    })

    this.state.observe(() => {
      this.emit('stateChange', this.state.current)
    })
  }

  z = z

  get state() {
    return this._state
  }
  
  get enabledFeatureIds() {
    return this.state.get('enabledFeatures') || []
  }
  
  get enabledFeatures() : Partial<AvailableInstanceTypes<Features>> {
    return Object.fromEntries(
      this.enabledFeatureIds.map((featureId) => [featureId, (this as any)[featureId]])  
    ) as AvailableInstanceTypes<Features>
  }
  
  utils = {
    zodToJsonSchema: (schema: z.ZodType) => zodToJsonSchema(schema),
    zodToTs: (schema: z.ZodType) => {
      const node = zodToTs(schema, { auxilaryTypeStore })
      return printNode(node.node, { auxiliaryTypeStore })
    },
    hashObject: (obj: any) => hashObject(obj),
    get stringUtils() { return stringUtils },
    uuid: () => v4(),
    lodash: {
      uniq, keyBy, uniqBy, groupBy, debounce, throttle, mapValues, mapKeys, pick, get, set, omit,
    }
  }

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

  get features(): FeaturesRegistry & AvailableInstanceTypes<Features> {
    const container = this

    return new Proxy(features, {
      get(target, prop) {
        if (prop in target) {
          return target[prop]
        } else {
          const cached = helperCache.get(featureIdToHelperCacheKeyMap.get(`${container.uuid}/${prop}`))
          if (cached) {
            return cached
          } else {
            return container.feature(prop)
          }
        }
      }
    }) as FeaturesRegistry & AvailableInstanceTypes<Features>
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
    const BaseClass = this.features.lookup(id as string) as Features[T];

    const cacheKey = hashObject({ id, options: omit(options!, 'enable'), uuid: this.uuid })
    const cached = helperCache.get(cacheKey)
    
    if (cached) {
      return cached as InstanceType<Features[T]>
    }
    
    const instance = new (BaseClass as any)({
      ...options,
      name: options?.name || id,
      _cacheKey: cacheKey,
    }, { container: this }) as InstanceType<Features[T]>;
    
    helperCache.set(cacheKey, instance)
    
    return instance
  }
  
  /** 
   * TODO:
   * 
   * A container should be able to container.use(plugin) and that plugin should be able to define
   * an asynchronous method that will be run when the container is started.  Right now there's nothing
   * to do with starting / stopping a container but that might be neat.
  */
  async start() {
    this.emit('started')
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

  emit(event: string, ...args: any[]) {
    this._events.emit(event, ...args)
    return this
  }

  on(event: string, listener: (...args: any[]) => void) {
    this._events.on(event, listener)
    return this
  }

  off(event: string, listener?: (...args: any[]) => void) {
    this._events.off(event, listener)
    return this
  }

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

  _hide(...propNames: string[]) {
    propNames.map((propName) => {
      Object.defineProperty(this, propName, { enumerable: false })
    })
    
    return this
  }

  async sleep(ms = 1000) {
    await new Promise((res) => setTimeout(res,ms))    
    return this
  }

  _plugins: (() => void)[] = []
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
