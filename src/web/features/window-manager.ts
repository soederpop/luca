import { dropRight } from 'lodash-es';
import { WebContainer } from '../container.js';
import { features, Feature, FeatureState } from '../feature.js'
import { Corner, getPathToCorner, getOtherDirection, updateTree, getLeaves, getNodeAtPath } from 'react-mosaic-component';
import type { MosaicDirection, MosaicNode, MosaicParent, MosaicPath } from 'react-mosaic-component'

export interface WindowManagerState extends FeatureState {
  panels: Record<string,any>
  layout: MosaicNode<string> | null
}

export class WindowManager extends Feature<WindowManagerState> {
  static attach(container: WebContainer & { wm: WindowManager }) {
    container.features.register('windowManager', WindowManager)
    container.feature('windowManager', { enable: true })
    return container
  }
  
  utils = {
    getNodeAtPath,
    getLeaves,
    getOtherDirection,
    updateTree,
    getPathToCorner,
    Corner
  }

  get initialState() {
    const initial : WindowManagerState = {
      enabled: true,
      panels: { },
      layout: null
    }
    
    return initial
  }

  open(id: string, config: any, forceDirection?: MosaicDirection) {
    this.panel(id, config)
    
    if(this.layout == null) {
      this.state.set('layout', id)
      return
    }
    
    const currentNode = this.layout
    
    const path = getPathToCorner(currentNode, Corner.BOTTOM_LEFT);
    const parent = getNodeAtPath(currentNode, dropRight(path)) as MosaicParent<string>;
    const destination = getNodeAtPath(currentNode, path) as MosaicNode<string>;
    const direction: MosaicDirection = forceDirection || (parent ? getOtherDirection(parent.direction) : 'column');

    let first: MosaicNode<string>;
    let second: MosaicNode<string>;

    if (direction === 'row') {
      first = destination;
      second = id 
    } else {
      first = id 
      second = destination;
    }

    this.update([
      {
        path,
        spec: {
          $set: {
            direction,
            first,
            second,
          },
        },
      },
    ])
  }

  panel(id: string, update?: any) {
    const exists = id in this.panelsConfig 
    
    if (!exists && update) {
      this.panelsConfig[id] = update
    }

    if(update) {
      const config = this.panelsConfig[id]!      
      return this.panelsConfig[id] = {
        ...config,
        props: {
          ...config.props,
          ...update.props
        }
      }
    }

    return this.panelsConfig[id]
  }

  get panelsConfig() {
    return this.state.get('panels')! || {}
  }
  
  get layout() {
    return this.state.get('layout')
  }
  
  get panels() {
    return Object.values(this.panelsConfig)
  }
  
  get leaves() {
    if(!this.layout) {
      return []
    }

    return getLeaves(this.layout)
  }
 
  parentOfPath(path: MosaicPath) {
    if(!this.layout) {
      return null
    }

    return getNodeAtPath(this.layout, dropRight(path))
  }
  
  nodeAtPath(path: MosaicPath) {
    if(!this.layout) {
      return null
    }
    return getNodeAtPath(this.layout, path)
  }
  
  update(update: any) {
    this.state.set('layout', updateTree(this.layout!, update))
    return this.layout
  }
  
  get shortcut() {
    return 'windowManager' as const
  }
}

export default features.register('windowManager', WindowManager)