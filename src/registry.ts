import type { Helper, HelperOptions } from './helper.js';
import type { ContainerContext } from './container.js';
import { Bus } from './bus.js';

import { introspect, interceptRegistration } from './introspection/index.js';
import type { HelperIntrospection } from './introspection/index.js';

export type { HelperIntrospection }

abstract class Registry<T extends Helper> {
  scope: string = "unspecified"
 
  baseClass?: new (options: HelperOptions, context: ContainerContext) => T
  
  private members = new Map<string, new (options: HelperOptions, context: ContainerContext) => T>();

  private readonly _events = new Bus();

  constructor() {}

  /** 
   * A registry can discover members from a variety of sources.
   * 
   * Imagine a Remix or Next.js app which has a pages directory from which
   * it wires up all of your routes.  You could do something similar and register
   * a page helper for each file in the pages subtree.
  */
  async discover(options: any) {}

  /** 
   * Lists the keys of all available helpers in this registry.
  */
  get available() : string[] {
    return Array.from(this.members.keys()).map(r => r.replace(`${this.scope}.`, ''))
  }

  /** 
   * Register a new helper in this registry.
   * 
   * @param id - The id of the helper to register.
   * @param constructor - The constructor for the helper.
   * @returns The constructor for the helper.
  */
  register(id: string, constructor: new (options: HelperOptions, context: ContainerContext) => T) {
    this.members.set(id.replace(`${this.scope}.`, ''), constructor);
    interceptRegistration(this, constructor)
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
  lookup(id: string) : new (options: HelperOptions, context: ContainerContext) => T {
    if (!this.members.has(id) && this.members.has([this.scope, id].join('.'))) {
      id = [this.scope, id].join(".")
    }

    return this.members.get(id)!;
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
   * Learn about the interface for all available helpers in this registry.  Will tell you about the options
   * to create one, the state it maintains, the methods and properties it has, and the events it emits.
   * 
   * Will return information as a markdown string.
  */
  describeAll() : string[] {
    return this.available.map(id => {
      const Constructor = this.lookup(id) as any
      return Constructor.introspectAsText()
    })
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