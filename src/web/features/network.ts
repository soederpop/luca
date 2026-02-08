import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { features, Feature } from "../feature.js";
import type { Container, ContainerContext } from "../container.js";

export const NetworkStateSchema = FeatureStateSchema.extend({
  offline: z.boolean(),
})

export const NetworkOptionsSchema = FeatureOptionsSchema.extend({})

export type NetworkState = z.infer<typeof NetworkStateSchema>
export type NetworkOptions = z.infer<typeof NetworkOptionsSchema>

export class Network<
  T extends NetworkState = NetworkState,
  K extends NetworkOptions = NetworkOptions
> extends Feature<T, K> {
  static override stateSchema = NetworkStateSchema
  static override optionsSchema = NetworkOptionsSchema
  static override shortcut = "features.network" as const
  
  static attach(container: Container & { network?: Network }) {
    container.features.register("network", Network);
  }
  
  constructor(options: K, context: ContainerContext) {
    super(options, context);
    this.state.set("offline", !navigator.onLine);
  }

  get isOffline() {
    return this.state.get("offline") === true;
  }

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

export default features.register('network', Network)