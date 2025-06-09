import { WebContainer } from "../container.js";
import { features, Feature, type FeatureState } from "../feature.js";

interface OverlayConfig {
  title: string;
  children: React.ReactNode;
  height?: number;
  width?: number;
}

export interface OverlayManagerState extends FeatureState {
  config: OverlayConfig | null;
  show: boolean;
}

export class OverlayManager extends Feature<OverlayManagerState> {
  static attach(container: WebContainer & { overlays: OverlayManager }) {
    container.features.register('overlays', OverlayManager)
    container.feature('overlays', { enable: true })
    return container;
  }

  static override shortcut = "features.overlays" as const

  override afterInitialize() {
    this.state.set('config', null)
    this.state.set('show', false)
  }
  
  show(config: OverlayConfig) {
    this.state.set('config', config)  
    this.state.set('show', true)
  }
  
  close(delay = 0) {
    if (!delay) {
      this.state.set('show', false)
    } else {
      setTimeout(() => {
        console.log("closing overlays")
        this.state.set('show', false)
      }, delay)
    }

    return this
  }
  
  get config() {
    const base = this.state.get('config')!
    
    return {
      height: 600,
      width: 600,
      ...base
    }
  }
  
  toggle() {
    this.state.set('show', !this.state.get('show'))  
    return this
  }

}

export default features.register("overlays", OverlayManager);