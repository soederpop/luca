import { Feature, features } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

/**
 * The ScriptRunner feature provides convenient access to npm scripts defined in package.json.
 * 
 * This feature automatically generates camelCase methods for each script in the package.json
 * file, allowing you to execute them programmatically with additional arguments and options.
 * 
 * @example
 * ```typescript
 * const scriptRunner = container.feature('scriptRunner')
 * 
 * // If package.json has "build:dev" script, you can call:
 * await scriptRunner.scripts.buildDev(['--watch'], { cwd: '/custom/path' })
 * 
 * // If package.json has "test" script:
 * await scriptRunner.scripts.test(['--verbose'])
 * ```
 * 
 * @extends Feature
 */
export class ScriptRunner extends Feature {
  static override shortcut = 'features.scriptRunner' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema
  
  /**
   * Gets an object containing executable functions for each npm script.
   * 
   * Each script name from package.json is converted to camelCase and becomes
   * a method that can be called with additional arguments and spawn options.
   * Script names with colons (e.g., "build:dev") are converted by replacing
   * colons with underscores before camelCasing.
   * 
   * @returns {Record<string, Function>} Object with camelCase methods for each npm script
   * 
   * @example
   * ```typescript
   * const runner = scriptRunner.scripts
   * 
   * // For a script named "build:dev" in package.json:
   * await runner.buildDev(['--watch'], { stdio: 'inherit' })
   * 
   * // For a script named "test":
   * const result = await runner.test(['--coverage'])
   * console.log(result.stdout)
   * ```
   */
  get scripts() {
    const { proc } = this.container
    const { stringUtils } = this.container.utils
    
    type spawner = (args: string[], options: any) => ReturnType<typeof proc.spawnAndCapture>
    type Runner = Record<string, spawner>
    
    const scriptNames = Object.keys(this.container.manifest.scripts || {})
    
    const runner : Runner = {}
    
    scriptNames.forEach(scriptName => {
      const id = stringUtils.camelCase(stringUtils.kebabCase(scriptName.replace(/:/g, '_')))
      runner[id] = ((args: string[], opts: any = {}) => proc.spawnAndCapture('npm',['run', scriptName].concat(args), opts)) as spawner
    })
   
    return runner
  }
  
}

export default features.register('scriptRunner', ScriptRunner)