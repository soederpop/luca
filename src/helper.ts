import { Bus, type EventMap } from "./bus.js";
import { type SetStateValue, State } from "./state.js";
import type { ContainerContext } from './container.js'
import uuid from 'node-uuid'
import { get } from 'lodash-es'
import { introspect, type HelperIntrospection, type IntrospectionSection, type HelperStability, type HelperCategory } from "./introspection/index.js";
import {
  filterIntrospection,
  resolveIntrospectAsTextArgs,
  presentIntrospectionAsMarkdown,
  presentIntrospectionAsTypeScript,
  renderTypeScriptParams,
  normalizeTypeString,
  isGenericObjectType,
} from './introspection/render.js'
import { z } from 'zod'
import { HelperStateSchema, HelperOptionsSchema, HelperEventsSchema } from './schemas/base.js'

// Re-export rendering utilities for backward compatibility
export {
  presentIntrospectionAsMarkdown,
  presentIntrospectionAsTypeScript,
  renderTypeScriptParams,
  normalizeTypeString,
  isGenericObjectType,
}

export type HelperState = z.infer<typeof HelperStateSchema>
export type HelperOptions = z.infer<typeof HelperOptionsSchema>

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
  static envVars: string[] = []

  /**
   * Stability index for this helper: `core` (essential to the golden path),
   * `stable` (batteries-included, safe to build on), or `experimental`
   * (may change or be removed without notice). Every built-in helper must
   * declare its own — the introspection build enforces this.
   */
  static stability?: HelperStability

  /**
   * Category slug for grouping this helper in `luca describe` output and
   * the framework index (see HELPER_CATEGORIES). Every built-in helper must
   * declare its own — the introspection build enforces this.
   */
  static category?: HelperCategory

  static stateSchema: z.ZodType = HelperStateSchema
  static optionsSchema: z.ZodType = HelperOptionsSchema
  static eventsSchema: z.ZodType = HelperEventsSchema
  static tools: Record<string, { schema: z.ZodType, handler?: Function }> = {}

  protected readonly _context: ContainerContext
  protected readonly _events = new Bus<E>()
  protected readonly _options: K
  protected readonly _instanceTools: Record<string, { schema: z.ZodType, handler?: Function }> = {}

  readonly state: State<T>

  readonly uuid = uuid.v4()

  get initialState() : T {
    return {} as T
  }

  static introspect(section?: IntrospectionSection) : HelperIntrospection | undefined {
    const data = introspect((this as any).shortcut || '')
    if (!data || !section) return data
    return filterIntrospection(data, section)
  }

  static introspectAsText(sectionOrDepth?: IntrospectionSection | number, startHeadingDepth?: number) : string {
    const { section, depth } = resolveIntrospectAsTextArgs(sectionOrDepth, startHeadingDepth)
    const introspection = this.introspect()
    if (!introspection) return ''
    return presentIntrospectionAsMarkdown(introspection, depth, section)
  }

  /**
   * Returns the introspection data formatted as a TypeScript interface declaration.
   * Useful for AI agents that reason better with structured type information,
   * or for generating `.d.ts` files that accurately describe a helper's public API.
   *
   * @example
   * ```ts
   * console.log(container.feature('fs').introspectAsType())
   * // interface FS {
   * //   readonly cwd: string;
   * //   readFile(path: string): Promise<string>;
   * //   ...
   * // }
   * ```
   */
  static introspectAsType(section?: IntrospectionSection) : string {
    const introspection = this.introspect()
    if (!introspection) return ''
    return presentIntrospectionAsTypeScript(introspection, section)
  }


  /**
   * All Helpers can be introspect()ed and, assuming the introspection data has been loaded into the registry,
   * will report information about the Helper that can only get extracted by reading the code, e.g. the type interfaces
   * for the helper's options, state, and the events it emits, as well as the documentation from the helpers code for
   * each of the methods and properties.
   *
   * Pass a section name to get only that section: `'methods'`, `'getters'`, `'events'`, `'state'`, `'options'`, `'envVars'`
  */
  introspect(section?: IntrospectionSection) : HelperIntrospection | undefined {
    const base = (this.constructor as any).introspect()
    if (!base || !section) return base
    return filterIntrospection(base, section)
  }

  /**
   * Returns the introspection data formatted as a markdown string.
   *
   * The first argument can be a section name (`'methods'`, `'getters'`, etc.) to render only
   * that section, or a number for the starting heading depth (backward compatible).
   */
  introspectAsText(sectionOrDepth?: IntrospectionSection | number, startHeadingDepth?: number) : string {
    const { section, depth } = resolveIntrospectAsTextArgs(sectionOrDepth, startHeadingDepth)
    const introspection = this.introspect()
    if (!introspection) return ''
    return presentIntrospectionAsMarkdown(introspection, depth, section)
  }

  /**
   * Returns the introspection data formatted as a TypeScript interface declaration.
   * Useful for AI agents that reason better with structured type information,
   * or for generating `.d.ts` files that accurately describe a helper's public API.
   */
  introspectAsType(section?: IntrospectionSection) : string {
    const introspection = this.introspect()
    if (!introspection) return ''
    return presentIntrospectionAsTypeScript(introspection, section)
  }

  constructor(options: K, context: ContainerContext) {
    const optionSchema = (this.constructor as any).optionsSchema
    if (optionSchema && typeof optionSchema.safeParse === 'function') {
      const parsed = optionSchema.safeParse(options || {})
      if (parsed.success) {
        this._options = parsed.data as K
      } else {
        const details = parsed.error.issues.map((issue: any) => `${issue.path?.join('.') || 'options'}: ${issue.message}`).join('; ')
        throw new Error(`Invalid options for ${(this.constructor as any).shortcut || this.constructor.name}: ${details || parsed.error.message}`)
      }
    } else {
      this._options = options
    }
    this._context = context;
    this.state = new State<T>({ initialState: this.initialState });

    this.hide('_context', '_state', '_options', '_events', '_instanceTools', 'uuid', '_afterInitializeHasRun')

    this.state.observe(() => {
      (this as any).emit('stateChange', this.state.current)
    })

    // NOTE: afterInitialize() is intentionally NOT called here. Calling it from
    // the base constructor means it runs during `super()` — BEFORE subclass
    // class-field declarations are defined. Under ES2022 field semantics
    // (`useDefineForClassFields`, bun's default) even an uninitialized declared
    // field like `socket!: WebSocketClient` is redefined to `undefined` after
    // `super()` returns, silently clobbering anything afterInitialize() assigned
    // to `this`. The container factory (createHelperInstance) calls
    // runAfterInitialize() synchronously once the entire constructor chain has
    // finished; the microtask below is a safety net for helpers constructed
    // directly with `new` (which is not the supported path).
    queueMicrotask(() => this.runAfterInitialize())
  }

  /** @internal Guards runAfterInitialize() so afterInitialize() only ever runs once. */
  protected _afterInitializeHasRun = false

  /**
   * Runs `afterInitialize()` exactly once, then emits `helperInitialized` on the
   * container. Called by the container factory immediately after construction —
   * i.e. after all subclass constructors and class-field initializers have run —
   * so property assignments made in afterInitialize() cannot be clobbered by
   * field declarations. Safe to call multiple times; subsequent calls are no-ops.
   *
   * @internal
   */
  runAfterInitialize(): this {
    if (this._afterInitializeHasRun) return this
    this._afterInitializeHasRun = true

    this.afterInitialize()

    this.container.emit('helperInitialized', this)

    return this
  }

  /**
   * Returns the names of the methods for this helper.
  */
  get $methods() : string[] {
    return Object.keys((this.introspect() || {}).methods || [])
  }
 
  /**
   * Returns the names of the getters for this helper.
  */
  get $getters() : string[] {
    return Object.keys((this.introspect() || {}).getters || [])
  }
  
  /**
   * The static shortcut identifier for this helper type, e.g. "features.assistant".
  */
  get shortcut(): string {
    return (this.constructor as any).shortcut || ''
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
   * Called automatically after the helper is fully constructed — after every
   * constructor in the chain and all class-field initializers have run. Override
   * this instead of overriding the constructor in your helper subclasses: it is
   * safe to assign instance properties here (e.g. `this.socket = ...`), even ones
   * declared as class fields.
   *
   * NOTE: the return value is NOT awaited. If you declare `async afterInitialize()`,
   * the container fires it and moves on — callers may use the helper before your
   * async work completes, and a rejection surfaces as an unhandled rejection.
   * Prefer synchronous setup here; put async work behind an explicit method
   * (e.g. `connect()`, `start()`) or track its completion in state.
  */
  afterInitialize(): void | Promise<void> {
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
   * Register a tool on this instance at runtime. Instance tools take precedence
   * over class-level static tools in toTools().
   */
  tool(name: string, options: { schema: z.ZodType, handler?: Function }): this {
    this._instanceTools[name] = options
    return this
  }

  /**
   * Called when another helper (e.g. an assistant) consumes this helper's
   * tools via `use()`. Override this to detect the consumer type and react —
   * for example, adding system prompt extensions to an assistant.
   *
   * Use `consumer.shortcut` to identify the consumer type:
   * ```typescript
   * override setupToolsConsumer(consumer: Helper) {
   *   if (consumer.shortcut === 'features.assistant') {
   *     (consumer as any).addSystemPromptExtension('myFeature', 'usage hints here')
   *   }
   * }
   * ```
   *
   * The default implementation is a no-op.
   *
   * @param consumer - The helper instance that is consuming this helper's tools
   */
  setupToolsConsumer(consumer: Helper): void {}

  /**
   * Collect all tools from the inheritance chain and instance, returning
   * { schemas, handlers } with matching keys. Walks the prototype chain
   * so subclass tools override parent tools. Instance tools win over all.
   *
   * If a tool has no explicit handler but this instance has a method with
   * the same name, a handler is auto-generated that delegates to that method.
   */
  toTools(options?: { only?: string[], except?: string[] }): { schemas: Record<string, z.ZodType>, handlers: Record<string, Function>, setup?: (consumer: Helper) => void } {
    // Walk the prototype chain collecting static tools (parent-first, child overwrites)
    const merged: Record<string, { schema: z.ZodType, description?: string, handler?: Function }> = {}
    const chain: Function[] = []

    let current = this.constructor as any
    while (current && current !== Object) {
      if (Object.hasOwn(current, 'tools') && current.tools) {
        chain.unshift(current)
      }
      current = Object.getPrototypeOf(current)
    }

    for (const ctor of chain) {
      Object.assign(merged, (ctor as any).tools)
    }

    // Instance tools win over static
    Object.assign(merged, this._instanceTools)

    // Filter tools by only/except before building schemas and handlers
    let names = Object.keys(merged)
    if (options?.only) names = names.filter(n => options.only!.includes(n))
    if (options?.except) names = names.filter(n => !options.except!.includes(n))

    const schemas: Record<string, z.ZodType> = {}
    const handlers: Record<string, Function> = {}

    for (const name of names) {
      const entry = merged[name]!
      // If the tool entry has a description but the schema doesn't, attach it
      // so addTool() picks it up from jsonSchema.description.
      schemas[name] = entry.description && !entry.schema.description
        ? entry.schema.describe(entry.description)
        : entry.schema
      if (entry.handler) {
        handlers[name] = (args: any) => entry.handler!(args, this)
      } else if (typeof (this as any)[name] === 'function') {
        handlers[name] = (args: any) => (this as any)[name](args)
      }
    }

    const result: { schemas: Record<string, z.ZodType>, handlers: Record<string, Function>, setup?: (consumer: Helper) => void } = { schemas, handlers }

    // If this helper has a setupToolsConsumer override, package it as a setup
    // function so consumers of toTools() can call it without needing the helper ref
    const proto = Object.getPrototypeOf(this)
    if (proto && proto.constructor !== Helper && typeof this.setupToolsConsumer === 'function' && this.setupToolsConsumer !== Helper.prototype.setupToolsConsumer) {
      result.setup = (consumer: Helper) => this.setupToolsConsumer(consumer)
    }

    return result
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

  on(event: '*', listener: (event: string, ...args: any[]) => void): this
  on<Ev extends string & keyof E>(event: Ev, listener: (...args: E[Ev]) => void): this
  on<Ev extends string & keyof E>(event: Ev | '*', listener: any) {
    this._events.on(event as any, listener)
    return this
  }

  off(event: '*', listener?: (event: string, ...args: any[]) => void): this
  off<Ev extends string & keyof E>(event: Ev, listener?: (...args: E[Ev]) => void): this
  off<Ev extends string & keyof E>(event: Ev | '*', listener?: any) {
    this._events.off(event as any, listener)
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
