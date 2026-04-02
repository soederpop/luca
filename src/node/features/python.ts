import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from "../feature.js";
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { bridgeScript } from '../../python/generated.js';
import type { ChildProcess } from 'child_process';

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
  /** Whether a persistent Python session is currently active */
  sessionActive: z.boolean().default(false).describe('Whether a persistent Python session is currently active'),
  /** Unique ID of the current persistent session */
  sessionId: z.string().nullable().default(null).describe('Unique ID of the current persistent session'),
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

export const PythonEventsSchema = FeatureEventsSchema.extend({
  ready: z.tuple([]).describe('When the Python environment is ready for execution'),
  environmentDetected: z.tuple([z.object({
    pythonPath: z.string().nullable().describe('Path to the detected Python executable'),
    environmentType: z.enum(['uv', 'conda', 'venv', 'system']).nullable().describe('Detected environment type'),
  }).describe('Environment detection result')]).describe('When the Python environment type is detected'),
  installingDependencies: z.tuple([z.object({
    command: z.string().describe('The install command being run'),
  }).describe('Install details')]).describe('When dependency installation begins'),
  dependenciesInstalled: z.tuple([z.object({
    stdout: z.string().describe('Standard output from install'),
    stderr: z.string().describe('Standard error from install'),
    exitCode: z.number().describe('Process exit code'),
  }).describe('Install result')]).describe('When dependencies are successfully installed'),
  dependencyInstallFailed: z.tuple([z.object({
    stdout: z.string().describe('Standard output from install'),
    stderr: z.string().describe('Standard error from install'),
    exitCode: z.number().describe('Process exit code'),
  }).describe('Install result')]).describe('When dependency installation fails'),
  codeExecuted: z.tuple([z.object({
    code: z.string().describe('The Python code that was executed'),
    variables: z.record(z.string(), z.any()).describe('Variables passed to the execution'),
    result: z.object({
      stdout: z.string().describe('Standard output'),
      stderr: z.string().describe('Standard error'),
      exitCode: z.number().describe('Process exit code'),
    }).describe('Execution result'),
  }).describe('Code execution details')]).describe('When Python code finishes executing'),
  fileExecuted: z.tuple([z.object({
    filePath: z.string().describe('Path to the executed Python file'),
    variables: z.record(z.string(), z.any()).describe('Variables passed as arguments'),
    result: z.object({
      stdout: z.string().describe('Standard output'),
      stderr: z.string().describe('Standard error'),
      exitCode: z.number().describe('Process exit code'),
    }).describe('Execution result'),
  }).describe('File execution details')]).describe('When a Python file finishes executing'),
  localsParseError: z.tuple([z.any().describe('The parse error')]).describe('When captured locals fail to parse as JSON'),
  sessionStarted: z.tuple([z.object({
    sessionId: z.string().describe('Unique session identifier'),
  }).describe('Session start details')]).describe('When a persistent Python session starts'),
  sessionStopped: z.tuple([z.object({
    sessionId: z.string().describe('Session identifier that stopped'),
  }).describe('Session stop details')]).describe('When a persistent Python session stops'),
  sessionError: z.tuple([z.object({
    error: z.string().describe('Error message'),
    sessionId: z.string().nullable().describe('Session identifier, if available'),
  }).describe('Session error details')]).describe('When a session-level error occurs'),
}).describe('Python events')

/** Result from a persistent session run() call. */
export interface RunResult {
  ok: boolean
  result: any
  stdout: string
  error?: string
  traceback?: string
}

/**
 * The Python VM feature provides Python virtual machine capabilities for executing Python code.
 *
 * This feature automatically detects Python environments (uv, conda, venv, system) and provides
 * methods to install dependencies and execute Python scripts. It can manage project-specific
 * Python environments and maintain context between executions.
 *
 * Supports two modes:
 * - **Stateless** (default): `execute()` and `executeFile()` spawn a fresh process per call
 * - **Persistent session**: `startSession()` spawns a long-lived bridge process that maintains
 *   state across `run()` calls, enabling real codebase interaction with imports and session variables
 *
 * @example
 * ```typescript
 * const python = container.feature('python', {
 *   dir: "/path/to/python/project",
 * })
 *
 * // Stateless execution
 * const result = await python.execute('print("Hello from Python!")')
 *
 * // Persistent session
 * await python.startSession()
 * await python.run('import myapp.models')
 * await python.run('users = myapp.models.User.objects.all()')
 * const result = await python.run('print(len(users))')
 * await python.stopSession()
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
  static override eventsSchema = PythonEventsSchema
  static { Feature.register(this, 'python') }

  private _bridgeProcess: ChildProcess | null = null
  private _bridgeScriptPath: string | null = null
  private _pendingRequests = new Map<string, { resolve: (v: any) => void, reject: (e: any) => void }>()
  private _stdoutBuffer = ''

  override get initialState(): T {
    return {
      ...super.initialState,
      pythonPath: null,
      projectDir: null,
      environmentType: null,
      isReady: false,
      lastExecutedScript: null,
      sessionActive: false,
      sessionId: null,
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

    const proc = this.container.feature('proc')

    /** Resolve a binary to its full path via `which`, falling back to the bare name. */
    const resolveBin = (name: string): string => {
      try { return proc.exec(`which ${name}`).trim() } catch { return name }
    }

    // Use explicitly provided Python path
    if (this.options.pythonPath) {
      pythonPath = this.options.pythonPath
      environmentType = 'system'
    }
    // Check for uv
    else if (existsSync(join(projectDir, 'uv.lock')) || existsSync(join(projectDir, 'pyproject.toml'))) {
      try {
        const uvBin = resolveBin('uv')
        const result = await proc.execAndCapture(`${uvBin} run python --version`)
        if (result.exitCode === 0) {
          pythonPath = `${uvBin} run python`
          environmentType = 'uv'
        }
      } catch (error) {
        // Fall through to next detection method
      }
    }
    // Check for conda
    else if (existsSync(join(projectDir, 'environment.yml')) || existsSync(join(projectDir, 'conda.yml'))) {
      try {
        const condaBin = resolveBin('conda')
        const result = await proc.execAndCapture(`${condaBin} run python --version`)
        if (result.exitCode === 0) {
          pythonPath = `${condaBin} run python`
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
        const python3Bin = resolveBin('python3')
        const result = await proc.execAndCapture(`${python3Bin} --version`)
        if (result.exitCode === 0) {
          pythonPath = python3Bin
          environmentType = 'system'
        } else {
          const pythonBin = resolveBin('python')
          const result2 = await proc.execAndCapture(`${pythonBin} --version`)
          if (result2.exitCode === 0) {
            pythonPath = pythonBin
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

    // Create temporary script in system temp dir (not inside the project)
    const tempDir = `${tmpdir()}/luca-python-temp`
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

  // ---------------------------------------------------------------------------
  // Persistent session methods
  // ---------------------------------------------------------------------------

  /**
   * Splits the (possibly multi-word) pythonPath into a command and args array
   * suitable for proc.spawn(). For example, `uv run python` becomes
   * `{ command: 'uv', args: ['run', 'python', ...extraArgs] }`.
   */
  private _parsePythonCommand(extraArgs: string[]): { command: string, args: string[] } {
    const parts = this.pythonPath.split(/\s+/)
    return { command: parts[0] ?? 'python', args: [...parts.slice(1), ...extraArgs] }
  }

  /**
   * Writes the bundled bridge.py to a temp directory and returns its path.
   * Reuses the same path across calls within a process.
   */
  private async _ensureBridgeScript(): Promise<string> {
    if (this._bridgeScriptPath) return this._bridgeScriptPath

    const fs = this.container.feature('fs')
    const bridgeDir = `${tmpdir()}/luca-python-bridge`
    await fs.ensureFolder(bridgeDir)
    const scriptPath = `${bridgeDir}/bridge.py`
    await fs.writeFileAsync(scriptPath, bridgeScript)
    this._bridgeScriptPath = scriptPath
    return scriptPath
  }

  /**
   * Sends a JSON-line request to the bridge process and returns a promise
   * that resolves when the matching response (by id) arrives.
   *
   * @param type - The request type (exec, eval, import, call, get_locals, reset)
   * @param payload - Additional fields to include in the request
   * @param timeout - Timeout in ms (default 30000)
   */
  private _sendRequest(type: string, payload: Record<string, any> = {}, timeout = 30000): Promise<any> {
    if (!this._bridgeProcess || !this._bridgeProcess.stdin) {
      return Promise.reject(new Error('No active Python session. Call startSession() first.'))
    }

    const id = this.container.utils.uuid()
    const request = JSON.stringify({ id, type, ...payload }) + '\n'

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pendingRequests.delete(id)
        reject(new Error(`Python bridge request timed out after ${timeout}ms (type: ${type})`))
      }, timeout)

      this._pendingRequests.set(id, {
        resolve: (value: any) => {
          clearTimeout(timer)
          resolve(value)
        },
        reject: (err: any) => {
          clearTimeout(timer)
          reject(err)
        },
      })

      this._bridgeProcess!.stdin!.write(request)
    })
  }

  /**
   * Handles incoming stdout data from the bridge process. Buffers partial
   * lines and parses complete JSON-line responses, resolving their matching
   * pending requests.
   */
  private _onBridgeData(chunk: Buffer | string): void {
    this._stdoutBuffer += chunk.toString()

    const lines = this._stdoutBuffer.split('\n')
    // Keep the last (possibly incomplete) segment in the buffer
    this._stdoutBuffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const response = JSON.parse(line)
        const id = response.id
        if (id && this._pendingRequests.has(id)) {
          const pending = this._pendingRequests.get(id)!
          this._pendingRequests.delete(id)
          pending.resolve(response)
        }
        // Non-id responses (like the initial "ready") are handled by startSession
      } catch {
        // Not JSON — could be stray output, ignore
      }
    }
  }

  /**
   * Starts a persistent Python session by spawning the bridge process.
   *
   * The bridge sets up sys.path for the project directory, then enters a
   * JSON-line REPL loop. State (variables, imports) persists across run() calls
   * until stopSession() or resetSession() is called.
   *
   * @example
   * ```typescript
   * const python = container.feature('python', { dir: '/path/to/project' })
   * await python.enable()
   * await python.startSession()
   * await python.run('x = 42')
   * const result = await python.run('print(x)')
   * console.log(result.stdout) // '42\n'
   * await python.stopSession()
   * ```
   */
  async startSession(): Promise<void> {
    if (this.state.get('sessionActive')) {
      throw new Error('A Python session is already active. Call stopSession() first.')
    }

    const proc = this.container.feature('proc')
    const bridgePath = await this._ensureBridgeScript()
    const { command, args } = this._parsePythonCommand(['-u', bridgePath])

    const child = proc.spawn(command, args, {
      cwd: this.projectDir,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    this._bridgeProcess = child
    this._stdoutBuffer = ''

    // Wait for the ready signal from the bridge
    const readyPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Python bridge failed to start within 15 seconds'))
      }, 15000)

      const onData = (chunk: Buffer | string) => {
        this._stdoutBuffer += chunk.toString()
        const lines = this._stdoutBuffer.split('\n')
        this._stdoutBuffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line)
            if (msg.type === 'ready' && msg.ok) {
              clearTimeout(timer)
              // Switch to the normal data handler
              child.stdout!.removeListener('data', onData)
              child.stdout!.on('data', this._onBridgeData.bind(this))
              resolve()
              return
            }
          } catch {
            // ignore non-JSON during init
          }
        }
      }

      child.stdout!.on('data', onData)

      child.on('error', (err: Error) => {
        clearTimeout(timer)
        reject(new Error(`Python bridge process error: ${err.message}`))
      })

      child.on('exit', (code: number | null) => {
        clearTimeout(timer)
        reject(new Error(`Python bridge exited during startup with code ${code}`))
      })
    })

    // Send init handshake with project directory
    child.stdin!.write(JSON.stringify({ project_dir: this.projectDir }) + '\n')

    await readyPromise

    // Register crash handler (after successful startup)
    child.removeAllListeners('exit')
    child.on('exit', (code: number | null) => {
      const sessionId = this.state.get('sessionId')
      this.state.set('sessionActive', false)
      this._bridgeProcess = null

      // Reject all pending requests
      for (const [id, pending] of this._pendingRequests) {
        pending.reject(new Error(`Python bridge exited unexpectedly with code ${code}`))
      }
      this._pendingRequests.clear()

      this.emit('sessionError', { error: `Bridge exited with code ${code}`, sessionId })
    })

    // Capture stderr for diagnostics (don't interfere with protocol)
    child.stderr!.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString().trim()
      if (text) {
        this.emit('sessionError', { error: text, sessionId: this.state.get('sessionId') })
      }
    })

    const sessionId = this.container.utils.uuid()
    this.state.set('sessionActive', true)
    this.state.set('sessionId', sessionId)
    this.emit('sessionStarted', { sessionId })
  }

  /**
   * Stops the persistent Python session and cleans up the bridge process.
   *
   * @example
   * ```typescript
   * await python.stopSession()
   * ```
   */
  async stopSession(): Promise<void> {
    const sessionId = this.state.get('sessionId')

    if (this._bridgeProcess) {
      this._bridgeProcess.removeAllListeners('exit')
      this._bridgeProcess.kill('SIGTERM')
      this._bridgeProcess = null
    }

    // Reject any pending requests
    for (const [id, pending] of this._pendingRequests) {
      pending.reject(new Error('Python session stopped'))
    }
    this._pendingRequests.clear()
    this._stdoutBuffer = ''

    this.state.set('sessionActive', false)
    this.state.set('sessionId', null)

    if (sessionId) {
      this.emit('sessionStopped', { sessionId })
    }
  }

  /**
   * Executes Python code in the persistent session. Variables and imports
   * survive across calls. This is the session equivalent of execute().
   *
   * @param code - Python code to execute
   * @param variables - Variables to inject into the namespace before execution
   * @returns The execution result including captured stdout and any error info
   *
   * @example
   * ```typescript
   * await python.startSession()
   *
   * // State persists across calls
   * await python.run('x = 42')
   * const result = await python.run('print(x * 2)')
   * console.log(result.stdout) // '84\n'
   *
   * // Inject variables from JS
   * const result2 = await python.run('print(f"Hello {name}!")', { name: 'World' })
   * console.log(result2.stdout) // 'Hello World!\n'
   * ```
   */
  async run(code: string, variables: Record<string, any> = {}): Promise<RunResult> {
    const response = await this._sendRequest('exec', { code, variables })
    return {
      ok: response.ok,
      result: response.result ?? null,
      stdout: response.stdout ?? '',
      error: response.error,
      traceback: response.traceback,
    }
  }

  /**
   * Evaluates a Python expression in the persistent session and returns its value.
   *
   * @param expression - Python expression to evaluate
   * @returns The evaluated result (JSON-serializable, or repr() string for complex types)
   *
   * @example
   * ```typescript
   * await python.run('x = 42')
   * const result = await python.eval('x * 2')
   * console.log(result) // 84
   * ```
   */
  async eval(expression: string): Promise<any> {
    const response = await this._sendRequest('eval', { expression })
    if (!response.ok) {
      throw new Error(response.error || 'eval failed')
    }
    return response.result
  }

  /**
   * Imports a Python module into the persistent session namespace.
   *
   * @param moduleName - Dotted module path (e.g. 'myapp.models')
   * @param alias - Optional alias for the import (defaults to the last segment)
   *
   * @example
   * ```typescript
   * await python.importModule('json')
   * await python.importModule('myapp.models', 'models')
   * const result = await python.eval('models.User')
   * ```
   */
  async importModule(moduleName: string, alias?: string): Promise<void> {
    const response = await this._sendRequest('import', { module: moduleName, alias })
    if (!response.ok) {
      throw new Error(response.error || `Failed to import ${moduleName}`)
    }
  }

  /**
   * Calls a function by dotted path in the persistent session namespace.
   *
   * @param funcPath - Dotted path to the function (e.g. 'json.dumps' or 'my_func')
   * @param args - Positional arguments
   * @param kwargs - Keyword arguments
   * @returns The function's return value
   *
   * @example
   * ```typescript
   * await python.importModule('json')
   * const result = await python.call('json.dumps', [{ a: 1 }], { indent: 2 })
   * ```
   */
  async call(funcPath: string, args: any[] = [], kwargs: Record<string, any> = {}): Promise<any> {
    const response = await this._sendRequest('call', { function: funcPath, args, kwargs })
    if (!response.ok) {
      throw new Error(response.error || `Failed to call ${funcPath}`)
    }
    return response.result
  }

  /**
   * Returns all non-dunder variables from the persistent session namespace.
   *
   * @returns A record of variable names to their JSON-serializable values
   *
   * @example
   * ```typescript
   * await python.run('x = 42\ny = "hello"')
   * const locals = await python.getLocals()
   * console.log(locals) // { x: 42, y: 'hello' }
   * ```
   */
  async getLocals(): Promise<Record<string, any>> {
    const response = await this._sendRequest('get_locals')
    if (!response.ok) {
      throw new Error(response.error || 'Failed to get locals')
    }
    return response.result
  }

  /**
   * Clears all variables and imports from the persistent session namespace.
   * The session remains active — you can continue calling run() after reset.
   *
   * @example
   * ```typescript
   * await python.run('x = 42')
   * await python.resetSession()
   * // x is now undefined
   * ```
   */
  async resetSession(): Promise<void> {
    const response = await this._sendRequest('reset')
    if (!response.ok) {
      throw new Error(response.error || 'Failed to reset session')
    }
  }
}

export default Python
// Module augmentation for type safety
declare module '../feature.js' {
  interface AvailableFeatures {
    python: typeof Python;
  }
} 