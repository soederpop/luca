import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { features, Feature } from "../feature.js";
import { existsSync } from 'fs';
import { join, resolve } from 'path';

export const PythonStateSchema = FeatureStateSchema.extend({
  /** Path to the detected Python executable */
  pythonPath: z.string().nullable().default(null).describe('Path to the detected Python executable'),
  /** Root directory of the Python project */
  projectDir: z.string().nullable().default(null).describe('Root directory of the Python project'),
  /** Detected Python environment type */
  environmentType: z.enum(['uv', 'conda', 'venv', 'system']).nullable().default(null).describe('Detected Python environment type (uv, conda, venv, or system)'),
  /** Whether the Python environment is ready for execution */
  isReady: z.boolean().default(false).describe('Whether the Python environment is ready for execution'),
  /** Path to the last executed Python script */
  lastExecutedScript: z.string().nullable().default(null).describe('Path to the last executed Python script'),
})

export const PythonOptionsSchema = FeatureOptionsSchema.extend({
  /** Directory containing the Python project */
  dir: z.string().optional().describe('Directory containing the Python project'),
  /** Custom install command to override auto-detection */
  installCommand: z.string().optional().describe('Custom install command to override auto-detection'),
  /** Path to Python script that will populate locals/context */
  contextScript: z.string().optional().describe('Path to Python script that will populate locals/context'),
  /** Specific Python executable to use */
  pythonPath: z.string().optional().describe('Specific Python executable path to use'),
})

export type PythonState = z.infer<typeof PythonStateSchema>
export type PythonOptions = z.infer<typeof PythonOptionsSchema>

/**
 * The Python VM feature provides Python virtual machine capabilities for executing Python code.
 * 
 * This feature automatically detects Python environments (uv, conda, venv, system) and provides
 * methods to install dependencies and execute Python scripts. It can manage project-specific
 * Python environments and maintain context between executions.
 * 
 * @example
 * ```typescript
 * const python = container.feature('python', { 
 *   dir: "/path/to/python/project",
 *   contextScript: "/path/to/setup-context.py"
 * })
 * 
 * // Auto-install dependencies
 * await python.installDependencies()
 * 
 * // Execute Python code
 * const result = await python.execute('print("Hello from Python!")')
 * 
 * // Execute with custom variables
 * const result2 = await python.execute('print(f"Hello {name}!")', { name: 'World' })
 * ```
 * 
 * @extends Feature
 */
export class Python<
  T extends PythonState = PythonState,
  K extends PythonOptions = PythonOptions
> extends Feature<T, K> {
  static override shortcut = "features.python" as const
  static override stateSchema = PythonStateSchema
  static override optionsSchema = PythonOptionsSchema

  override get initialState(): T {
    return {
      ...super.initialState,
      pythonPath: null,
      projectDir: null,
      environmentType: null,
      isReady: false,
      lastExecutedScript: null
    } as T
  }

  override async enable(options: any = {}): Promise<this> {
    await super.enable(options)
    
    // Setup project directory
    if (this.options.dir) {
      this.state.set('projectDir', resolve(this.options.dir))
    } else {
      this.state.set('projectDir', this.container.cwd)
    }

    // Detect Python environment
    await this.detectEnvironment()
    
    // Execute context script if provided
    if (this.options.contextScript && existsSync(this.options.contextScript)) {
      await this.execute(`exec(open('${this.options.contextScript}').read())`)
    }

    this.state.set('isReady', true)
    this.emit('ready')
    
    return this
  }

	/** Returns the root directory of the Python project. */
	get projectDir() {
		return this.state.get('projectDir') || this.container.cwd
	}

	/** Returns the path to the Python executable for this environment. */
	get pythonPath() {
		return this.state.get('pythonPath') || 'python'
	}

	/** Returns the detected environment type: 'uv', 'conda', 'venv', or 'system'. */
	get environmentType() {
		return this.state.get('environmentType') || 'system'
	}

  /**
   * Detects the Python environment type and sets the appropriate Python path.
   * 
   * This method checks for various Python environment managers in order of preference:
   * uv, conda, venv, then falls back to system Python. It sets the pythonPath and
   * environmentType in the state.
   * 
   * @returns {Promise<void>}
   * 
   * @example
   * ```typescript
   * await python.detectEnvironment()
   * console.log(python.state.get('environmentType')) // 'uv' | 'conda' | 'venv' | 'system'
   * console.log(python.state.get('pythonPath')) // '/path/to/python/executable'
   * ```
   */
  async detectEnvironment(): Promise<void> {
    const projectDir = this.state.get('projectDir')!
    let pythonPath: string | null = null
    let environmentType: PythonState['environmentType'] = null

    // Use explicitly provided Python path
    if (this.options.pythonPath) {
      pythonPath = this.options.pythonPath
      environmentType = 'system'
    }
    // Check for uv
    else if (existsSync(join(projectDir, 'uv.lock')) || existsSync(join(projectDir, 'pyproject.toml'))) {
      try {
        const proc = this.container.feature('proc')
        const result = await proc.execAndCapture('uv run python --version')
        if (result.exitCode === 0) {
          pythonPath = 'uv run python'
          environmentType = 'uv'
        }
      } catch (error) {
        // Fall through to next detection method
      }
    }
    // Check for conda
    else if (existsSync(join(projectDir, 'environment.yml')) || existsSync(join(projectDir, 'conda.yml'))) {
      try {
        const proc = this.container.feature('proc')
        const result = await proc.execAndCapture('conda run python --version')
        if (result.exitCode === 0) {
          pythonPath = 'conda run python'
          environmentType = 'conda'
        }
      } catch (error) {
        // Fall through to next detection method
      }
    }
    // Check for venv
    else if (existsSync(join(projectDir, 'venv')) || existsSync(join(projectDir, '.venv'))) {
      const venvPath = existsSync(join(projectDir, 'venv')) ? 'venv' : '.venv'
      const venvPython = process.platform === 'win32' 
        ? join(projectDir, venvPath, 'Scripts', 'python.exe')
        : join(projectDir, venvPath, 'bin', 'python')
      
      if (existsSync(venvPython)) {
        pythonPath = venvPython
        environmentType = 'venv'
      }
    }

    // Fall back to system Python
    if (!pythonPath) {
      try {
        const proc = this.container.feature('proc')
        const result = await proc.execAndCapture('python3 --version')
        if (result.exitCode === 0) {
          pythonPath = 'python3'
          environmentType = 'system'
        } else {
          const result2 = await proc.execAndCapture('python --version')
          if (result2.exitCode === 0) {
            pythonPath = 'python'
            environmentType = 'system'
          }
        }
      } catch (error) {
        throw new Error('Could not find Python installation')
      }
    }

    this.state.set('pythonPath', pythonPath)
    this.state.set('environmentType', environmentType)
    
    this.emit('environmentDetected', { pythonPath, environmentType })
  }

  /**
   * Installs dependencies for the Python project.
   * 
   * This method automatically detects the appropriate package manager and install command
   * based on the environment type. If a custom installCommand is provided in options,
   * it will use that instead.
   * 
   * @returns {Promise<{ stdout: string; stderr: string; exitCode: number }>}
   * 
   * @example
   * ```typescript
   * // Auto-detect and install
   * const result = await python.installDependencies()
   * 
   * // With custom install command
   * const python = container.feature('python', { 
   *   installCommand: 'pip install -r requirements.txt' 
   * })
   * const result = await python.installDependencies()
   * ```
   */
  async installDependencies(): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const proc = this.container.feature('proc')
    const projectDir = this.state.get('projectDir')!
    const environmentType = this.state.get('environmentType')

    let installCommand: string

    if (this.options.installCommand) {
      installCommand = this.options.installCommand
    } else {
      switch (environmentType) {
        case 'uv':
          installCommand = 'uv sync'
          break
        case 'conda':
          if (existsSync(join(projectDir, 'environment.yml'))) {
            installCommand = 'conda env update -f environment.yml'
          } else if (existsSync(join(projectDir, 'conda.yml'))) {
            installCommand = 'conda env update -f conda.yml'
          } else {
            installCommand = 'conda install --file requirements.txt'
          }
          break
        case 'venv':
        case 'system':
        default:
          if (existsSync(join(projectDir, 'requirements.txt'))) {
            const pythonPath = this.state.get('pythonPath')!
            installCommand = `${pythonPath} -m pip install -r requirements.txt`
          } else if (existsSync(join(projectDir, 'pyproject.toml'))) {
            const pythonPath = this.state.get('pythonPath')!
            installCommand = `${pythonPath} -m pip install -e .`
          } else {
            throw new Error('No requirements.txt or pyproject.toml found for dependency installation')
          }
          break
      }
    }

    this.emit('installingDependencies', { command: installCommand })
    
    const result = await proc.execAndCapture(installCommand, { cwd: projectDir })
    
    if (result.exitCode === 0) {
      this.emit('dependenciesInstalled', result)
    } else {
      this.emit('dependencyInstallFailed', result)
    }

    return result
  }

  /**
   * Executes Python code and returns the result.
   * 
   * This method creates a temporary Python script with the provided code and variables,
   * executes it using the detected Python environment, and captures the output.
   * 
   * @param {string} code - The Python code to execute
   * @param {Record<string, any>} [variables={}] - Variables to make available to the Python code
   * @param {object} [options] - Execution options
   * @param {boolean} [options.captureLocals=false] - Whether to capture and return local variables after execution
   * @returns {Promise<{ stdout: string; stderr: string; exitCode: number; locals?: any }>}
   * 
   * @example
   * ```typescript
   * // Simple execution
   * const result = await python.execute('print("Hello World")')
   * console.log(result.stdout) // 'Hello World'
   * 
   * // With variables
   * const result = await python.execute('print(f"Hello {name}!")', { name: 'Alice' })
   * 
   * // Capture locals
   * const result = await python.execute('x = 42\ny = x * 2', {}, { captureLocals: true })
   * console.log(result.locals) // { x: 42, y: 84 }
   * ```
   */
  async execute(
    code: string, 
    variables: Record<string, any> = {},
    options: { captureLocals?: boolean } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number; locals?: any }> {
    const proc = this.container.feature('proc')
    const fs = this.container.feature('fs')
	
		const { projectDir, pythonPath } = this

    // Create temporary script
    const tempDir = join(projectDir, '.luca-python-temp')
    await fs.ensureFolder(tempDir)
    const scriptPath = join(tempDir, `script-${Date.now()}.py`)
    
    // Build the Python script
    let script = ''
    
    // Import json for serialization
    script += 'import json\nimport sys\n\n'
    
    // Set up variables
    if (Object.keys(variables).length > 0) {
      script += '# Variables\n'
      for (const [key, value] of Object.entries(variables)) {
        script += `${key} = ${JSON.stringify(value)}\n`
      }
      script += '\n'
    }
    
    // Add the user code
    script += '# User code\n'
    script += code
    
    // Capture locals if requested
    if (options.captureLocals) {
      script += '\n\n# Capture locals\n'
      script += 'locals_dict = {k: v for k, v in locals().items() if not k.startswith("__")}\n'
      script += 'print("__LOCALS__:" + json.dumps(locals_dict, default=str))\n'
    }

    await fs.writeFileAsync(scriptPath, script)

    // Execute the script
    const command = pythonPath.includes(' ') ? pythonPath : `${pythonPath}`
    const result = await proc.execAndCapture(`${command} ${scriptPath}`, { cwd: projectDir })

    // Parse locals if captured
    let locals: any = undefined
    if (options.captureLocals && result.stdout.includes('__LOCALS__:')) {
      try {
        const localsMatch = result.stdout.match(/__LOCALS__:(.+)$/m)
        if (localsMatch && localsMatch[1]) {
          locals = JSON.parse(localsMatch[1])
          // Remove the locals output from stdout
          result.stdout = result.stdout.replace(/__LOCALS__:.+$/m, '').trim()
        }
      } catch (error) {
        this.emit('localsParseError', error)
      }
    }

    // Clean up temporary file
    await fs.rm(scriptPath)

    this.state.set('lastExecutedScript', scriptPath)
    this.emit('codeExecuted', { code, variables, result })

    return { ...result, locals }
  }

  /**
   * Executes a Python file and returns the result.
   * 
   * @param {string} filePath - Path to the Python file to execute
   * @param {Record<string, any>} [variables={}] - Variables to make available via command line arguments
   * @returns {Promise<{ stdout: string; stderr: string; exitCode: number }>}
   * 
   * @example
   * ```typescript
   * const result = await python.executeFile('/path/to/script.py')
   * console.log(result.stdout)
   * ```
   */
  async executeFile(
    filePath: string,
    variables: Record<string, any> = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const proc = this.container.feature('proc')
    const projectDir = this.state.get('projectDir')!
    const pythonPath = this.state.get('pythonPath')!
    
    // Convert variables to command line arguments
    const args = Object.entries(variables).map(([key, value]) => `--${key}=${value}`).join(' ')
    const command = pythonPath.includes(' ') ? pythonPath : `${pythonPath}`
    
    const result = await proc.execAndCapture(`${command} ${filePath} ${args}`, { cwd: projectDir })
    
    this.emit('fileExecuted', { filePath, variables, result })
    
    return result
  }

  /**
   * Gets information about the current Python environment.
   * 
   * @returns {Promise<{ version: string; path: string; packages: string[] }>}
   */
  async getEnvironmentInfo(): Promise<{ version: string; path: string; packages: string[] }> {
    const proc = this.container.feature('proc')
    const pythonPath = this.state.get('pythonPath')!
    const projectDir = this.state.get('projectDir')!
    
    // Get Python version
    const versionResult = await proc.execAndCapture(`${pythonPath} --version`, { cwd: projectDir })
    const version = versionResult.stdout.trim()
    
    // Get Python path
    const pathResult = await proc.execAndCapture(`${pythonPath} -c "import sys; print(sys.executable)"`, { cwd: projectDir })
    const path = pathResult.stdout.trim()
    
    // Get installed packages
    const packagesResult = await proc.execAndCapture(`${pythonPath} -m pip list --format=freeze`, { cwd: projectDir })
    const packages = packagesResult.stdout.trim().split('\n').filter(line => line.length > 0)
    
    return { version, path, packages }
  }
}

export default features.register("python", Python);

// Module augmentation for type safety
declare module '../feature.js' {
  interface AvailableFeatures {
    python: typeof Python;
  }
} 