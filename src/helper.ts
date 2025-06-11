import { Bus } from "./bus.js";
import { type SetStateValue, State } from "./state.js";
import type { ContainerContext } from './container.js'
import uuid from 'node-uuid'
import { get } from 'lodash-es'
import { introspect, type HelperIntrospection } from "./introspection/index.js";

// @ts-ignore-next-line
export interface HelperState { }

export interface HelperOptions {
  name?: string;
  _cacheKey?: string;
}

/**
 * Helpers are used to represent types of modules.
 *
 * You don't create instances of helpers directly, the container creates instances through
 * factory functions that use the subclasses of Helper as a template.  The container
 * provides dependency injection and injects a context object into the Helper constructor.
 * 
 * A Helper is something that can be introspected at runtime to learn about the interface.
 * 
 * A helper has state.
 * 
 * A helper is an event bus.
 * 
 * A helper is connected to the container and can access the container's state, events, shared context, or 
 * other helpers and features in the container's registry.
 */
export abstract class Helper<T extends HelperState = HelperState, K extends HelperOptions = any> {
  static shortcut: string = "unspecified"

  protected readonly _context: ContainerContext
  protected readonly _events = new Bus()
  protected readonly _options: K 

  readonly state: State<T>

  readonly uuid = uuid.v4()

  get initialState() : T {
    return {} as T
  }

  /** 
   * All Helpers can be introspect()ed and, assuming the introspection data has been loaded into the registry,
   * will report information about the Helper that can only get extracted by reading the code, e.g. the type interfaces
   * for the helper's options, state, and the events it emits, as well as the documentation from the helpers code for
   * each of the methods and properties.
  */
  introspect() : HelperIntrospection | undefined {
    return introspect((this.constructor as any).shortcut || '')
  }
  
  constructor(options: K, context: ContainerContext) {
    this._options = options;
    this._context = context;
    this.state = new State<T>({ initialState: this.initialState });
    
    this.hide('_context', '_state', '_options', '_events', 'uuid')
    
    this.state.observe(() => {
      this.emit('stateChange', this.state.current)
    })
    
    this.afterInitialize()

    this.container.emit('helperInitialized', this)
  }
  
  /** 
   * Every helper has a cache key which is computed at the time it is created through the container.
   * 
   * This ensures only a single instance of the helper exists for the requested options.
  */
  get cacheKey() {
    return this._options._cacheKey
  }

  /** 
   * This method will get called in the constructor and can be used instead of overriding the constructor
   * in your helper subclases.
  */
  afterInitialize() {
    // override this method to do something after the helper is initialized
  }
  
  setState(newState: SetStateValue<T>) {
    this.state.setState(newState)
    return this
  }

  /** 
   * Convenience method for putting properties on the helper that aren't enumerable,
   * which is a convenience for the REPL mainly.
  */
  hide(...propNames: string[]) {
    propNames.map((propName) => {
      Object.defineProperty(this, propName, { enumerable: false })
    })
    
    return this
  }
  
  /** 
   * python / lodash style get method, which will get a value from the container using dot notation
   * and will return a default value if the value is not found.
  */
  tryGet<K extends (string | string[]), T extends object = any>(key: K, defaultValue?: T) {
    return get(this, key, defaultValue)
  }

  /** 
   * The options passed to the helper when it was created.
  */
  get options() {
    return this._options;
  }

  /** 
   * The context object that was passed to the helper when it was created, this is decided by the container
   * and not something you would manipulate.
  */
  get context() {
    return this._context;
  }

  /** 
   * The container that the helper is connected to.
  */
  get container() {
    return this.context.container;
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

  async waitFor(event:string) {
    const resp = await this._events.waitFor(event)
    return resp
  }
}