import { getMDXComponent } from 'mdx-bundler/client'

import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature, features } from '../feature'

export class MdxLoader extends Feature {
  static attach(container: any) {
    container.features.register('mdxLoader', MdxLoader)
  }

  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema
  static override shortcut = 'features.mdxLoader' as const

  load(source: string) {
    const Component = getMDXComponent(source)
    return Component
  }
}

export default features.register('mdxLoader', MdxLoader)