import type { Helper } from './helper.js';
import type { ContainerContext } from './container.js';
import { Bus } from './bus.js';
import { inspect } from 'util';

import { introspect, interceptRegistration } from './introspection/index.js';
import type { HelperIntrospection } from './introspection/index.js';

export type { HelperIntrospection }

abstract class Registry<T extends Helper> {
  scope: string = "unspecified"

  baseClass?: new (options: any, context: ContainerContext) => T

  private readonly members! : Map<string, new (options: any, context: ContainerContext) => T>

  private readonly _events! : Bus

  constructor() {
    Object.defineProperty(this, 'members', { enumerable: false, value: new Map<string, new (options: any, context: ContainerContext) => T>() })
    Object.defineProperty(this, '_events', { enumerable: false, value: new Bus() })
    Object.defineProperty(this, 'scope', { enumerable: false })
    Object.defineProperty(this, 'baseClass', { enumerable: false })
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `${this.constructor.name} [${this.scope}] { ${this.available.join(', ')} }`
  }

  /**
   * Lists the keys of all available helpers in this registry.
  */
  get available() : string[] {
    return Array.from(this.members.keys()).map(r => r.replace(`${this.scope}.`, '')).sort()
  }

  /** 
   * Register a new helper in this registry.
   * 
   * @param id - The id of the helper to register.
   * @param constructor - The constructor for the helper.
   * @returns The constructor for the helper.
  */
  register(id: string, constructor: new (options: any, context: ContainerContext) => T) {
    this.members.set(id.replace(`${this.scope}.`, ''), constructor);
    interceptRegistration(this, constructor)
    this.emit('helperRegistered', id, constructor)
    return constructor
  }

  /** 
   * Check if a helper is registered in this registry.
   * 
   * @param id - The id of the helper to check.
   * @returns True if the helper is registered, false otherwise.
  */
  has(id: string) : boolean {
    return this.members.has(id) || this.members.has([this.scope, id].join('.'))
  }

  /** 
   * Lookup a helper by id.
   * 
   * @param id - The id of the helper to lookup.
   * @returns The constructor for the helper.
  */
  lookup(id: string) : new (options: any, context: ContainerContext) => T {
    if (!this.members.has(id) && this.members.has([this.scope, id].join('.'))) {
      id = [this.scope, id].join(".")
    }

    const Constructor = this.members.get(id);

    if (!Constructor) {
      const available = this.available
      const suggestion = available.length > 0
        ? `\n\nAvailable ${this.scope}: ${available.join(', ')}`
        : `\n\nNo ${this.scope} are registered. Make sure the module is imported or .use()'d on the container.`

      throw new Error(
        `${this.scope} "${id}" is not registered.${suggestion}\n\n` +
        `To fix this, ensure the module that defines "${id}" is imported (e.g. import './${this.scope}/${id}') ` +
        `or registered on the container (e.g. container.use(${id[0]!.toUpperCase() + id.slice(1)})).`
      )
    }

    return Constructor;
  }

  /** 
   * View data about the interface for a particular Helper.  Will tell you about the options
   * to create one, the state it maintains, the methods and properties it has, and the events it emits.
  */
  introspect(id: string) : HelperIntrospection | undefined {
    return introspect(id)
  }
 
  /** 
   * Learn about the interface for a particular Helper.  Will tell you about the options
   * to create one, the state it maintains, the methods and properties it has, and the events it emits.
   * 
   * Will return information as a markdown string.
  */
  describe(id: string) : string {
    const Constructor = this.lookup(id) as any
    return Constructor.introspectAsText()
  }
 

  /**
   * Returns a condensed overview of all available helpers in this registry.
   * Shows each helper's name and description, without the full introspection details.
   *
   * Use `describe(id)` to get the full details for a specific helper.
  */
  describeAll() : string {
    const sections: string[] = [`# Available ${this.scope}\n`]

    for (const id of this.available) {
      const Constructor = this.lookup(id) as any
      const introspection = Constructor.introspect?.()
      const description = introspection?.description || Constructor.description || 'No description provided'
      sections.push(`## ${id}\n\n${description}\n`)
    }

    return sections.join('\n')
  }

  /** 
   * Emit an event on the registry's event bus.
   * 
   * @param event - The event to emit.
   * @param args - The arguments to pass to the event listener.
   * @returns The registry instance.
  */
  emit(event: string, ...args: any[]) {
    this._events.emit(event, ...args)
    return this
  }

  /** 
   * Subscribe to an event on the registry's event bus.
   * 
   * @param event - The event to subscribe to.
   * @param listener - The listener to call when the event is emitted.
   * @returns The registry instance.
  */
  on(event: string, listener: (...args: any[]) => void) {
    this._events.on(event, listener)
    return this
  }

  /** 
   * Unsubscribe a listener from an event on the registry's event bus.
   * 
   * @param event - The event to unsubscribe from.
   * @param listener - The listener to unsubscribe.
   * @returns The registry instance.
  */
  off(event: string, listener: (...args: any[]) => void) {
    this._events.off(event, listener)
    return this
  }

  /** 
   * Subscribe to an event on the registry's event bus, but only fire once.
   * 
   * @param event - The event to subscribe to.
   * @param listener - The listener to call when the event is emitted.
   * @returns The registry instance.
  */
  once(event: string, listener: (...args: any[]) => void) {
      this._events.once(event, listener)
      return this
  }
}

export { Registry }