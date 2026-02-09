import { Bus, type EventMap } from "./bus.js";
import { type SetStateValue, State } from "./state.js";
import type { ContainerContext } from './container.js'
import uuid from 'node-uuid'
import { get } from 'lodash-es'
import { introspect, type HelperIntrospection } from "./introspection/index.js";
import { z } from 'zod'
import { HelperStateSchema, HelperOptionsSchema, HelperEventsSchema } from './schemas/base.js'

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
export abstract class Helper<T extends HelperState = HelperState, K extends HelperOptions = any, E extends EventMap = EventMap> {
  static shortcut: string = "unspecified"

  static description: string = "No description provided"

  static stateSchema: z.ZodType = HelperStateSchema
  static optionsSchema: z.ZodType = HelperOptionsSchema
  static eventsSchema: z.ZodType = HelperEventsSchema

  protected readonly _context: ContainerContext
  protected readonly _events = new Bus<E>()
  protected readonly _options: K

  readonly state: State<T>

  readonly uuid = uuid.v4()

  get initialState() : T {
    return {} as T
  }

  static introspect() : HelperIntrospection | undefined {
    return introspect((this as any).shortcut || '')
  }

  static introspectAsText(startHeadingDepth: number = 1) : string {
    const introspection = this.introspect()
    if (!introspection) return ''
    return presentIntrospectionJSONAsMarkdown(introspection, startHeadingDepth)
  }


  /**
   * All Helpers can be introspect()ed and, assuming the introspection data has been loaded into the registry,
   * will report information about the Helper that can only get extracted by reading the code, e.g. the type interfaces
   * for the helper's options, state, and the events it emits, as well as the documentation from the helpers code for
   * each of the methods and properties.
  */
  introspect() : HelperIntrospection | undefined {
    const base = (this.constructor as any).introspect()
    return base
  }

  introspectAsText(startHeadingDepth: number = 1) : string {
    const introspection = this.introspect()
    if (!introspection) return ''
    return presentIntrospectionJSONAsMarkdown(introspection, startHeadingDepth)
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

  emit<Ev extends string & keyof E>(event: Ev, ...args: E[Ev]) {
    this._events.emit(event, ...args)
    return this
  }

  on<Ev extends string & keyof E>(event: Ev, listener: (...args: E[Ev]) => void) {
    this._events.on(event, listener)
    return this
  }

  off<Ev extends string & keyof E>(event: Ev, listener?: (...args: E[Ev]) => void) {
    this._events.off(event, listener)
    return this
  }

  once<Ev extends string & keyof E>(event: Ev, listener: (...args: E[Ev]) => void) {
      this._events.once(event, listener)
      return this
  }

  async waitFor<Ev extends string & keyof E>(event: Ev) {
    const resp = await this._events.waitFor(event)
    return resp
  }
}

function presentIntrospectionJSONAsMarkdown(introspection: HelperIntrospection, startHeadingDepth: number = 1) {
  const sections: string[] = []
  
  // Helper function to generate heading markers based on depth
  const heading = (level: number) => '#'.repeat(Math.max(1, startHeadingDepth + level - 1))
  
  // Header
  sections.push(`${heading(1)} ${introspection.id}\n\n${introspection.description}`)

  // Methods section
  if (introspection.methods && Object.keys(introspection.methods).length > 0) {
    sections.push(`${heading(2)} Methods`)
    
    for (const [methodName, methodInfo] of Object.entries(introspection.methods)) {
      sections.push(`${heading(3)} ${methodName}`)
      
      if (methodInfo.description) {
        sections.push(methodInfo.description)
      }
      
      // Parameters table
      if (methodInfo.parameters && Object.keys(methodInfo.parameters).length > 0) {
        sections.push(`**Parameters:**`)
        sections.push(`| Name | Type | Required | Description |`)
        sections.push(`|------|------|----------|-------------|`)
        
        for (const [paramName, paramInfo] of Object.entries(methodInfo.parameters)) {
          const isRequired = methodInfo.required?.includes(paramName) ? '✓' : ''
          const type = paramInfo.type || 'any'
          const description = paramInfo.description || ''
          sections.push(`| \`${paramName}\` | \`${type}\` | ${isRequired} | ${description} |`)
        }
      }
      
      // Return type
      if (methodInfo.returns) {
        sections.push(`**Returns:** \`${methodInfo.returns}\``)
      }
      
      sections.push('') // Empty line between methods
    }
  }
  
  // Events section
  if (introspection.events && Object.keys(introspection.events).length > 0) {
    sections.push(`${heading(2)} Events`)
    
    for (const [eventName, eventInfo] of Object.entries(introspection.events)) {
      sections.push(`${heading(3)} ${eventName}`)
      
      if (eventInfo.description) {
        sections.push(eventInfo.description)
      }
      
      // Event arguments if any
      if (eventInfo.arguments && Object.keys(eventInfo.arguments).length > 0) {
        sections.push(`**Event Arguments:**`)
        sections.push(`| Name | Type | Description |`)
        sections.push(`|------|------|-------------|`)
        
        for (const [argName, argInfo] of Object.entries(eventInfo.arguments)) {
          const type = argInfo.type || 'any'
          const description = argInfo.description || ''
          sections.push(`| \`${argName}\` | \`${type}\` | ${description} |`)
        }
      }
      
      sections.push('') // Empty line between events
    }
  }
  
  // State section
  if (introspection.state && Object.keys(introspection.state).length > 0) {
    sections.push(`${heading(2)} State`)

    sections.push(`| Property | Type | Description |`)
    sections.push(`|----------|------|-------------|`)

    for (const [stateName, stateInfo] of Object.entries(introspection.state)) {
      const type = stateInfo.type || 'any'
      const description = stateInfo.description || ''
      sections.push(`| \`${stateName}\` | \`${type}\` | ${description} |`)
    }
  }

  // Options section
  if (introspection.options && Object.keys(introspection.options).length > 0) {
    sections.push(`${heading(2)} Options`)

    sections.push(`| Property | Type | Description |`)
    sections.push(`|----------|------|-------------|`)

    for (const [optName, optInfo] of Object.entries(introspection.options)) {
      const type = optInfo.type || 'any'
      const description = optInfo.description || ''
      sections.push(`| \`${optName}\` | \`${type}\` | ${description} |`)
    }
  }

  return sections.join('\n\n')
}