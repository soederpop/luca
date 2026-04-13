import { Bus, type EventMap } from './bus.js'
import { State, type SetStateValue } from './state.js'
import type { Container } from './container.js'
import uuid from 'node-uuid'
import { z } from 'zod'

/**
 * An Entity is a lightweight, composable object with observable state, a typed event bus,
 * and a reference to the container. Unlike Helpers, Entities are not class-based — they
 * are plain objects created directly via `container.entity()` and extended via `.extend()`.
 *
 * Same id + options always returns the same underlying state/bus instance (cached).
 *
 * @template TState   - Shape of the entity's observable state
 * @template TOptions - Shape of the options passed at construction
 * @template TEvents  - Event map for the typed event bus
 */
export type Entity<
  TState extends Record<string, any> = Record<string, any>,
  TOptions extends Record<string, any> = Record<string, any>,
  TEvents extends EventMap = EventMap,
> = {
  /** The id passed to container.entity() */
  readonly id: string
  /** Per-instance UUID */
  readonly uuid: string
  /** The options the entity was created with */
  readonly options: TOptions
  /** Observable state */
  readonly state: State<TState>
  /** The container this entity belongs to */
  readonly container: Container<any>

  on<E extends keyof TEvents>(event: E, listener: (...args: TEvents[E]) => void): void
  off<E extends keyof TEvents>(event: E, listener?: (...args: TEvents[E]) => void): void
  once<E extends keyof TEvents>(event: E, listener: (...args: TEvents[E]) => void): void
  emit<E extends keyof TEvents>(event: E, ...args: TEvents[E]): void
  waitFor<E extends keyof TEvents>(event: E): Promise<TEvents[E]>
  setState(value: SetStateValue<TState>): void

  /**
   * Graft an object of functions and getters onto this entity, returning a new type-safe
   * object. The base entity (state, events, container, options) is accessible via `this`
   * in all grafted methods and getters. Chaining `.extend()` on the result works correctly —
   * each layer has access to everything in the layers below it.
   *
   * @example
   * ```ts
   * const session = container.entity('session:abc', { userId: '42' })
   * const rich = session.extend({
   *   greet() { return `Hello user ${this.options.userId}` },
   *   get label() { return `Session ${this.id}` },
   * })
   * rich.greet() // "Hello user 42"
   * ```
   */
  extend<Ext extends Record<string, any>>(
    extensions: Ext & ThisType<Entity<TState, TOptions, TEvents> & Ext>
  ): Entity<TState, TOptions, TEvents> & Ext

  /**
   * Register a method on this entity as an AI tool with the given Zod schema.
   * Chainable — returns `this` so you can stack multiple `.expose()` calls.
   *
   * @example
   * ```ts
   * const agent = container.entity('agent', {})
   *   .extend({ search({ query }: { query: string }) { ... } })
   *   .expose('search', z.object({ query: z.string() }))
   *
   * assistant.addTools(agent)
   * ```
   */
  expose(this: Entity<TState, TOptions, TEvents>, functionName: string, schema: z.ZodType): Entity<TState, TOptions, TEvents>

  /**
   * Returns `{ schemas, handlers }` for all tools registered via `.expose()`.
   * Compatible with `assistant.addTools()` and the standard `toTools` contract.
   */
  toTools(): { schemas: Record<string, z.ZodType>; handlers: Record<string, Function> }
}

/** @internal */
export function createEntityObject<
  TState extends Record<string, any> = Record<string, any>,
  TOptions extends Record<string, any> = Record<string, any>,
  TEvents extends EventMap = EventMap,
>(
  id: string,
  container: Container<any>,
  options: TOptions,
): Entity<TState, TOptions, TEvents> {
  const _events = new Bus<TEvents>()
  const _state = new State<TState>()

  const _exposed = new Map<string, z.ZodType>()

  const entity: Entity<TState, TOptions, TEvents> = {
    id,
    uuid: (uuid as any).v4(),
    options,
    state: _state,
    container,
    on(event: any, listener: any) { _events.on(event, listener) },
    off(event: any, listener?: any) { _events.off(event, listener) },
    once(event: any, listener: any) { _events.once(event, listener) },
    emit(event: any, ...args: any[]) { _events.emit(event, ...args as any) },
    waitFor(event: any) { return _events.waitFor(event) },
    setState(value: any) { _state.setState(value) },
    extend(extensions: any) { return applyExtensions(this as any, extensions) },
    expose(functionName: string, schema: z.ZodType) {
      // Each prototype layer gets its own _exposed map (lazy-created on write)
      if (!Object.prototype.hasOwnProperty.call(this, '_exposed')) {
        ;(this as any)._exposed = new Map<string, z.ZodType>()
      }
      ;(this as any)._exposed.set(functionName, schema)
      return this
    },
    toTools() {
      const schemas: Record<string, z.ZodType> = {}
      const handlers: Record<string, Function> = {}

      // Walk the prototype chain collecting _exposed maps; shallower layers win
      let obj: any = this
      while (obj !== null) {
        if (Object.prototype.hasOwnProperty.call(obj, '_exposed')) {
          for (const [name, schema] of (obj._exposed as Map<string, z.ZodType>)) {
            if (!(name in schemas)) {
              schemas[name] = schema
              handlers[name] = (args: any) => (this as any)[name](args)
            }
          }
        }
        obj = Object.getPrototypeOf(obj)
      }

      return { schemas, handlers }
    },
  }

  ;(entity as any)._exposed = _exposed

  return entity
}

/**
 * Graft extensions onto an entity via prototype delegation.
 *
 * The extended object's prototype is `base`, so all base properties (state, container,
 * on/off/emit, etc.) are reachable through `this` in any grafted method or getter.
 * Calling `.extend()` on the result correctly uses the extended object as the new base.
 */
function applyExtensions<
  TState extends Record<string, any>,
  TOptions extends Record<string, any>,
  TEvents extends EventMap,
  Ext extends Record<string, any>,
>(
  base: Entity<TState, TOptions, TEvents>,
  extensions: Ext,
): Entity<TState, TOptions, TEvents> & Ext {
  const extended = Object.create(base) as Entity<TState, TOptions, TEvents> & Ext

  for (const key of Object.getOwnPropertyNames(extensions)) {
    const descriptor = Object.getOwnPropertyDescriptor(extensions, key)!
    Object.defineProperty(extended, key, {
      ...descriptor,
      configurable: true,
    })
  }

  return extended
}
