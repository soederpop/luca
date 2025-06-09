import { getMDXComponent } from 'mdx-bundler/client'

import { Feature, features } from '../feature'

export class MdxLoader extends Feature {
  static attach(container: any) {
    container.features.register('mdxLoader', MdxLoader)
  }

  static override shortcut = 'features.mdxLoader' as const

  load(source: string) {
    const Component = getMDXComponent(source)
    return Component
  }
}

export default features.register('mdxLoader', MdxLoader)