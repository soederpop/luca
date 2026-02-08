import { bundleMDX } from 'mdx-bundler'

import { Feature, features } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

type CompileOptions = {
  files?: Record<string, string>
}

/**
 * The MdxBundler feature provides MDX compilation capabilities.
 * 
 * This feature wraps the mdx-bundler library to compile MDX content into
 * executable JavaScript. MDX allows you to use JSX components within Markdown
 * files, making it ideal for documentation and content that needs interactive elements.
 * 
 * @example
 * ```typescript
 * const mdxBundler = container.feature('mdxBundler')
 * 
 * const mdxSource = `
 *   # Hello World
 *   
 *   <Button onClick={() => alert('Hello!')}>
 *     Click me
 *   </Button>
 * `
 * 
 * const result = await mdxBundler.compile(mdxSource, {
 *   files: {
 *     './Button.tsx': 'export default function Button({ children, onClick }) { return <button onClick={onClick}>{children}</button> }'
 *   }
 * })
 * 
 * console.log(result.code) // Compiled JavaScript code
 * ```
 * 
 * @extends Feature
 */
export class MdxBundler extends Feature {
  static override shortcut = 'features.mdxBundler' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema
  
  /**
   * Compiles MDX source code into executable JavaScript.
   * 
   * This method takes MDX source code and optional file dependencies and compiles
   * them into JavaScript code that can be executed in a React environment.
   * The compilation process handles JSX transformation, import resolution, and bundling.
   * 
   * @param {string} source - The MDX source code to compile
   * @param {CompileOptions} [options={}] - Compilation options
   * @param {Record<string, string>} [options.files={}] - Additional files to include in the bundle (path -> content mapping)
   * @returns {Promise<any>} Promise that resolves to the compilation result containing the compiled code and frontmatter
   * @throws {Error} Throws an error if the MDX compilation fails
   * 
   * @example
   * ```typescript
   * // Simple MDX compilation
   * const result = await mdxBundler.compile('# Hello World\n\nThis is **bold** text.')
   * 
   * // MDX with custom components
   * const mdxWithComponents = `
   *   import { CustomButton } from './components'
   *   
   *   # Interactive Content
   *   
   *   <CustomButton>Click me!</CustomButton>
   * `
   * 
   * const result = await mdxBundler.compile(mdxWithComponents, {
   *   files: {
   *     './components.tsx': 'export function CustomButton({ children }) { return <button>{children}</button> }'
   *   }
   * })
   * 
   * // Access the compiled code
   * console.log(result.code)
   * ```
   */
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