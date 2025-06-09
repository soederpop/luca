import { bundleMDX } from 'mdx-bundler'

import { Feature, features } from '../feature.js'

type CompileOptions = {
  files?: Record<string, string>
}

export class MdxBundler extends Feature {
  static override shortcut = 'features.mdxBundler' as const
  
  async compile(source: string, options: CompileOptions = {}) {
    const { files = {} } = options

    try {
      return bundleMDX({
        source,
        files
      })
    } catch(error) {
      console.error(error)
      throw error      
    }
  }
}

export default features.register('mdxBundler', MdxBundler)