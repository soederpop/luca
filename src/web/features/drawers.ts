import { WebContainer } from "../container.js";
import { features, Feature, FeatureState } from "../feature.js";

type DrawerPosition = 'top' | 'left' | 'right' | 'bottom'

interface DrawerConfig {
  id?: string;
  position?: DrawerPosition;
  size?: string | number; 
  title: string;
  children: React.ReactNode;
}

export interface DrawerManagerState extends FeatureState {
  drawers: Record<string, DrawerConfig>;
  top: string | null;
  bottom: string | null;
  left: string | null;
  right: string | null;
}

export class DrawerManager extends Feature<DrawerManagerState> {
  static override shortcut = "features.drawers" as const
  
  static override attach(container: WebContainer & { drawers: DrawerManager }) {
    container.features.register('drawers', DrawerManager)
    container.feature('drawers', { enable: true })
    return container;
  }

  override afterInitialize() {
    this.state
      .set("drawers", {})
      .set("right", null)
      .set("left", null)
      .set("bottom", null)
      .set("top", null)
  }
  
  create(id: string, config: DrawerConfig) {
    this.state.set('drawers', {
      ...this.state.current.drawers,
      [id]: {
        ...config,
        id: config.id || id
      } 
    })
  }
  
  toggle(config: DrawerConfig, position : DrawerPosition= config.position! || 'bottom') {
    if(this.state.get(position)) {
      this.state.set(position, null)
      return
    } else {
      this.show(config, position)
    }
  }

  show(config: DrawerConfig, position : DrawerPosition = config.position! || 'top') {
    let id = config.id || String(+new Date())

    this.create(id!, {
      ...config,
      size: config.size || "medium",
      position: position || config.position || 'top'
    })

    this.state.set(position, id!)
    return this.state.get('drawers')![id!] 
  }

  get right() : DrawerConfig | null {
    const { current } = this.state
    
    if(current.right && current.right in current.drawers) {
      return current.drawers[current.right] 
    }
    
    return null
  }

  get left() : DrawerConfig | null {
    const { current } = this.state
    
    if(current.left && current.left in current.drawers) {
      return current.drawers[current.left] 
    }
    
    return null
  }

  get bottom() : DrawerConfig | null {
    const { current } = this.state
    
    if(current.bottom && current.bottom in current.drawers) {
      return current.drawers[current.bottom] 
    }
    
    return null
  }

  get top() : DrawerConfig | null {
    const { current } = this.state
    
    if(current.top && current.top in current.drawers) {
      return current.drawers[current.top] 
    }
    
    return null
  }


}

export default features.register("drawers", DrawerManager);