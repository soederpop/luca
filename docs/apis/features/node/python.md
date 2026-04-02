# Python (features.python)

The Python VM feature provides Python virtual machine capabilities for executing Python code. This feature automatically detects Python environments (uv, conda, venv, system) and provides methods to install dependencies and execute Python scripts. It can manage project-specific Python environments and maintain context between executions. Supports two modes: - **Stateless** (default): `execute()` and `executeFile()` spawn a fresh process per call - **Persistent session**: `startSession()` spawns a long-lived bridge process that maintains state across `run()` calls, enabling real codebase interaction with imports and session variables

## Usage

```ts
container.feature('python', {
  // Directory containing the Python project
  dir,
  // Custom install command to override auto-detection
  installCommand,
  // Path to Python script that will populate locals/context
  contextScript,
  // Specific Python executable path to use
  pythonPath,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `dir` | `string` | Directory containing the Python project |
| `installCommand` | `string` | Custom install command to override auto-detection |
| `contextScript` | `string` | Path to Python script that will populate locals/context |
| `pythonPath` | `string` | Specific Python executable path to use |

## Methods

### enable

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `any` |  | Parameter options |

**Returns:** `Promise<this>`



### detectEnvironment

Detects the Python environment type and sets the appropriate Python path. This method checks for various Python environment managers in order of preference: uv, conda, venv, then falls back to system Python. It sets the pythonPath and environmentType in the state.

**Returns:** `Promise<void>`

```ts
await python.detectEnvironment()
console.log(python.state.get('environmentType')) // 'uv' | 'conda' | 'venv' | 'system'
console.log(python.state.get('pythonPath')) // '/path/to/python/executable'
```



### installDependencies

Installs dependencies for the Python project. This method automatically detects the appropriate package manager and install command based on the environment type. If a custom installCommand is provided in options, it will use that instead.

**Returns:** `Promise<{ stdout: string; stderr: string; exitCode: number }>`

```ts
// Auto-detect and install
const result = await python.installDependencies()

// With custom install command
const python = container.feature('python', { 
 installCommand: 'pip install -r requirements.txt' 
})
const result = await python.installDependencies()
```



### execute

Executes Python code and returns the result. This method creates a temporary Python script with the provided code and variables, executes it using the detected Python environment, and captures the output.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | The Python code to execute |
| `variables` | `Record<string, any>` |  | Variables to make available to the Python code |
| `options` | `{ captureLocals?: boolean }` |  | Execution options |

`{ captureLocals?: boolean }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `captureLocals` | `any` | Whether to capture and return local variables after execution |

**Returns:** `Promise<{ stdout: string; stderr: string; exitCode: number; locals?: any }>`

```ts
// Simple execution
const result = await python.execute('print("Hello World")')
console.log(result.stdout) // 'Hello World'

// With variables
const result = await python.execute('print(f"Hello {name}!")', { name: 'Alice' })

// Capture locals
const result = await python.execute('x = 42\ny = x * 2', {}, { captureLocals: true })
console.log(result.locals) // { x: 42, y: 84 }
```



### executeFile

Executes a Python file and returns the result.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | ✓ | Path to the Python file to execute |
| `variables` | `Record<string, any>` |  | Variables to make available via command line arguments |

**Returns:** `Promise<{ stdout: string; stderr: string; exitCode: number }>`

```ts
const result = await python.executeFile('/path/to/script.py')
console.log(result.stdout)
```



### getEnvironmentInfo

Gets information about the current Python environment.

**Returns:** `Promise<{ version: string; path: string; packages: string[] }>`



### startSession

Starts a persistent Python session by spawning the bridge process. The bridge sets up sys.path for the project directory, then enters a JSON-line REPL loop. State (variables, imports) persists across run() calls until stopSession() or resetSession() is called.

**Returns:** `Promise<void>`

```ts
const python = container.feature('python', { dir: '/path/to/project' })
await python.enable()
await python.startSession()
await python.run('x = 42')
const result = await python.run('print(x)')
console.log(result.stdout) // '42\n'
await python.stopSession()
```



### stopSession

Stops the persistent Python session and cleans up the bridge process.

**Returns:** `Promise<void>`

```ts
await python.stopSession()
```



### run

Executes Python code in the persistent session. Variables and imports survive across calls. This is the session equivalent of execute().

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | Python code to execute |
| `variables` | `Record<string, any>` |  | Variables to inject into the namespace before execution |

**Returns:** `Promise<RunResult>`

```ts
await python.startSession()

// State persists across calls
await python.run('x = 42')
const result = await python.run('print(x * 2)')
console.log(result.stdout) // '84\n'

// Inject variables from JS
const result2 = await python.run('print(f"Hello {name}!")', { name: 'World' })
console.log(result2.stdout) // 'Hello World!\n'
```



### eval

Evaluates a Python expression in the persistent session and returns its value.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `expression` | `string` | ✓ | Python expression to evaluate |

**Returns:** `Promise<any>`

```ts
await python.run('x = 42')
const result = await python.eval('x * 2')
console.log(result) // 84
```



### importModule

Imports a Python module into the persistent session namespace.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `moduleName` | `string` | ✓ | Dotted module path (e.g. 'myapp.models') |
| `alias` | `string` |  | Optional alias for the import (defaults to the last segment) |

**Returns:** `Promise<void>`

```ts
await python.importModule('json')
await python.importModule('myapp.models', 'models')
const result = await python.eval('models.User')
```



### call

Calls a function by dotted path in the persistent session namespace.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `funcPath` | `string` | ✓ | Dotted path to the function (e.g. 'json.dumps' or 'my_func') |
| `args` | `any[]` |  | Positional arguments |
| `kwargs` | `Record<string, any>` |  | Keyword arguments |

**Returns:** `Promise<any>`

```ts
await python.importModule('json')
const result = await python.call('json.dumps', [{ a: 1 }], { indent: 2 })
```



### getLocals

Returns all non-dunder variables from the persistent session namespace.

**Returns:** `Promise<Record<string, any>>`

```ts
await python.run('x = 42\ny = "hello"')
const locals = await python.getLocals()
console.log(locals) // { x: 42, y: 'hello' }
```



### resetSession

Clears all variables and imports from the persistent session namespace. The session remains active — you can continue calling run() after reset.

**Returns:** `Promise<void>`

```ts
await python.run('x = 42')
await python.resetSession()
// x is now undefined
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `projectDir` | `any` | Returns the root directory of the Python project. |
| `pythonPath` | `any` | Returns the path to the Python executable for this environment. |
| `environmentType` | `any` | Returns the detected environment type: 'uv', 'conda', 'venv', or 'system'. |

## Events (Zod v4 schema)

### ready

When the Python environment is ready for execution



### environmentDetected

When the Python environment type is detected

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `pythonPath` | `any` | Path to the detected Python executable |
| `environmentType` | `any` | Detected environment type |



### installingDependencies

When dependency installation begins

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `command` | `string` | The install command being run |



### dependenciesInstalled

When dependencies are successfully installed

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `stdout` | `string` | Standard output from install |
| `stderr` | `string` | Standard error from install |
| `exitCode` | `number` | Process exit code |



### dependencyInstallFailed

When dependency installation fails

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `stdout` | `string` | Standard output from install |
| `stderr` | `string` | Standard error from install |
| `exitCode` | `number` | Process exit code |



### localsParseError

When captured locals fail to parse as JSON

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The parse error |



### codeExecuted

When Python code finishes executing

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `code` | `string` | The Python code that was executed |
| `variables` | `object` | Variables passed to the execution |
| `result` | `object` | Execution result |



### fileExecuted

When a Python file finishes executing

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `filePath` | `string` | Path to the executed Python file |
| `variables` | `object` | Variables passed as arguments |
| `result` | `object` | Execution result |



### sessionError

When a session-level error occurs

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `error` | `string` | Error message |
| `sessionId` | `any` | Session identifier, if available |



### sessionStarted

When a persistent Python session starts

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` | Unique session identifier |



### sessionStopped

When a persistent Python session stops

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` | Session identifier that stopped |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `pythonPath` | `any` | Path to the detected Python executable |
| `projectDir` | `any` | Root directory of the Python project |
| `environmentType` | `any` | Detected Python environment type (uv, conda, venv, or system) |
| `isReady` | `boolean` | Whether the Python environment is ready for execution |
| `lastExecutedScript` | `any` | Path to the last executed Python script |
| `sessionActive` | `boolean` | Whether a persistent Python session is currently active |
| `sessionId` | `any` | Unique ID of the current persistent session |

## Examples

**features.python**

```ts
const python = container.feature('python', {
 dir: "/path/to/python/project",
})

// Stateless execution
const result = await python.execute('print("Hello from Python!")')

// Persistent session
await python.startSession()
await python.run('import myapp.models')
await python.run('users = myapp.models.User.objects.all()')
const result = await python.run('print(len(users))')
await python.stopSession()
```



**detectEnvironment**

```ts
await python.detectEnvironment()
console.log(python.state.get('environmentType')) // 'uv' | 'conda' | 'venv' | 'system'
console.log(python.state.get('pythonPath')) // '/path/to/python/executable'
```



**installDependencies**

```ts
// Auto-detect and install
const result = await python.installDependencies()

// With custom install command
const python = container.feature('python', { 
 installCommand: 'pip install -r requirements.txt' 
})
const result = await python.installDependencies()
```



**execute**

```ts
// Simple execution
const result = await python.execute('print("Hello World")')
console.log(result.stdout) // 'Hello World'

// With variables
const result = await python.execute('print(f"Hello {name}!")', { name: 'Alice' })

// Capture locals
const result = await python.execute('x = 42\ny = x * 2', {}, { captureLocals: true })
console.log(result.locals) // { x: 42, y: 84 }
```



**executeFile**

```ts
const result = await python.executeFile('/path/to/script.py')
console.log(result.stdout)
```



**startSession**

```ts
const python = container.feature('python', { dir: '/path/to/project' })
await python.enable()
await python.startSession()
await python.run('x = 42')
const result = await python.run('print(x)')
console.log(result.stdout) // '42\n'
await python.stopSession()
```



**stopSession**

```ts
await python.stopSession()
```



**run**

```ts
await python.startSession()

// State persists across calls
await python.run('x = 42')
const result = await python.run('print(x * 2)')
console.log(result.stdout) // '84\n'

// Inject variables from JS
const result2 = await python.run('print(f"Hello {name}!")', { name: 'World' })
console.log(result2.stdout) // 'Hello World!\n'
```



**eval**

```ts
await python.run('x = 42')
const result = await python.eval('x * 2')
console.log(result) // 84
```



**importModule**

```ts
await python.importModule('json')
await python.importModule('myapp.models', 'models')
const result = await python.eval('models.User')
```



**call**

```ts
await python.importModule('json')
const result = await python.call('json.dumps', [{ a: 1 }], { indent: 2 })
```



**getLocals**

```ts
await python.run('x = 42\ny = "hello"')
const locals = await python.getLocals()
console.log(locals) // { x: 42, y: 'hello' }
```



**resetSession**

```ts
await python.run('x = 42')
await python.resetSession()
// x is now undefined
```

