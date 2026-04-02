/// <reference lib="dom" />
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from "../feature.js";
import type { ContainerContext } from "../container.js";

export const NetworkStateSchema = FeatureStateSchema.extend({
  offline: z.boolean().describe('Whether the browser is currently offline'),
})

export const NetworkOptionsSchema = FeatureOptionsSchema.extend({})

export const NetworkEventsSchema = FeatureEventsSchema.extend({
  online: z.tuple([]).describe('Fires when the browser regains network connectivity'),
  offline: z.tuple([]).describe('Fires when the browser loses network connectivity'),
}).describe('Network events')

export type NetworkState = z.infer<typeof NetworkStateSchema>
export type NetworkOptions = z.infer<typeof NetworkOptionsSchema>

/**
 * Tracks browser online/offline connectivity state.
 *
 * Listens for the browser's `online` and `offline` events and keeps the
 * feature state in sync. Other features can observe the `offline` state
 * value or listen for change events to react to connectivity changes.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const network = container.feature('network')
 * console.log(network.state.get('offline')) // false when online
 *
 * network.on('stateChanged', ({ offline }) => {
 *   console.log(offline ? 'Went offline' : 'Back online')
 * })
 * ```
 */
export class Network<
  T extends NetworkState = NetworkState,
  K extends NetworkOptions = NetworkOptions
> extends Feature<T, K> {
  static override stateSchema = NetworkStateSchema
  static override optionsSchema = NetworkOptionsSchema
  static override eventsSchema = NetworkEventsSchema
  static override shortcut = "features.network" as const

  static { Feature.register(this as any, 'network') }
  
  constructor(options: K, context: ContainerContext) {
    super(options, context);
    this.state.set("offline", !navigator.onLine);
  }

  /** Whether the browser is currently offline. */
  get isOffline() {
    return this.state.get("offline") === true;
  }

  /** Whether the browser is currently online. */
  get isOnline() {
    return this.state.get("offline") === false;
  }

  private handleConnectionChange = () => {
    const isOffline = !navigator.onLine;
    this.state.set('offline', isOffline)
    this.emit(isOffline ? "offline" : "online");
  };

  start() {
    window.addEventListener("online", this.handleConnectionChange);
    window.addEventListener("offline", this.handleConnectionChange);
    return this
  }

  disable() {
    window.removeEventListener("online", this.handleConnectionChange);
    window.removeEventListener("offline", this.handleConnectionChange);
    return this
  }
}

export default Network