# Container Features Reference

The `container` object provides access to a comprehensive set of features for Node.js development. Each feature can be instantiated using `container.feature(id, options)` where `id` is the feature identifier and `options` is an optional configuration object.

## Available Features

### Core System Features

#### File System (`features.fs`)
**Usage:** `container.feature('features.fs')`

Provides methods for interacting with the file system relative to the container's working directory.

**Key Methods:**
- `readFile(path)` / `readFileAsync(path)` - Read file contents as string
- `writeFileAsync(path, content)` - Write content to file
- `ensureFile(path, content, overwrite?)` - Create file with content, creating directories as needed
- `ensureFolder(path)` - Create directory structure
- `exists(path)` / `existsAsync(path)` - Check if file/directory exists
- `readdir(path)` - List directory contents
- `walk(basePath, options?)` / `walkAsync(baseDir, options?)` - Recursively traverse directories
- `rm(path)` / `rmdir(dirPath)` - Remove files/directories
- `findUp(fileName, options?)` / `findUpAsync(fileName, options?)` - Find file by walking up directory tree
- `readJson(path)` - Read and parse JSON file

#### Process Management (`features.proc`)
**Usage:** `container.feature('features.proc')`

Execute external processes and commands with comprehensive output capture.

**Key Methods:**
- `execAndCapture(cmd, options?)` - Execute command string and capture output
- `spawnAndCapture(command, args, options?)` - Spawn process with real-time monitoring
- `exec(command, options?)` - Execute command synchronously

**Returns:** `{ stdout, stderr, error, exitCode, pid }`

#### Operating System (`features.os`)
**Usage:** `container.feature('features.os')`

Access to operating system utilities and information via Node.js's built-in `os` module.

### File Management & Discovery

#### File Manager (`features.fileManager`)
**Usage:** `container.feature('features.fileManager')`

Database-like indexing of project files with change watching capabilities.

**Key Methods:**
- `start(options?)` - Start file manager and scan project files
- `scanFiles(options?)` - Scan and update file index
- `watch(options?)` / `stopWatching()` - Watch for file changes
- `match(patterns)` - Match file IDs against patterns
- `matchFiles(patterns)` - Get file objects matching patterns
- `updateFile(path)` / `removeFile(path)` - Update file index

**Events:** `file:change`

#### Git Integration (`features.git`)
**Usage:** `container.feature('features.git')`

Git repository utilities for status, file listing, and metadata access.

**Key Methods:**
- `lsFiles(options?)` - List files using git ls-files with filtering options

### Data Processing

#### JSON Tree (`features.jsonTree`)
**Usage:** `container.feature('features.jsonTree')`

Recursively load JSON files from directory structures into hierarchical objects.

**Key Methods:**
- `loadTree(basePath, key?)` - Load JSON files into tree structure

**Path Processing:** Converts `config/database/production.json` → `tree.config.database.production`

#### YAML Tree (`features.yamlTree`)
**Usage:** `container.feature('features.yamlTree')`

Similar to JSON Tree but for YAML files (.yml/.yaml extensions).

**Key Methods:**
- `loadTree(basePath, key?)` - Load YAML files into tree structure

#### YAML Parser (`features.yaml`)
**Usage:** `container.feature('features.yaml')`

Parse and stringify YAML data using js-yaml library.

**Key Methods:**
- `parse(yamlStr)` - Parse YAML string to JavaScript object
- `stringify(data)` - Convert JavaScript object to YAML string

### Caching & Storage

#### Disk Cache (`features.diskCache`)
**Usage:** `container.feature('features.diskCache')`

DiskCache helper using cacache for persistent caching.

**Key Methods:**
- `set(key, value, meta?)` - Store value in cache
- `get(key, json?)` - Retrieve value from cache
- `has(key)` - Check if key exists
- `ensure(key, content)` - Set content if key doesn't exist
- `copy(source, destination, overwrite?)` - Copy cached item
- `move(source, destination, overwrite?)` - Move cached item
- `rm(key)` - Remove cached item
- `clearAll(confirm?)` - Clear all cached items
- `keys()` / `listKeys()` - Get all cache keys
- `saveFile(key, outputPath, isBase64?)` - Save cached file to disk
- `create(path?)` - Create cacache instance

#### Vault (`features.vault`)
**Usage:** `container.feature('features.vault')`

Encryption and decryption using AES-256-GCM.

**Key Methods:**
- `secret(options?)` - Get or generate secret key
- `encrypt(payload)` - Encrypt plaintext string
- `decrypt(payload)` - Decrypt encrypted payload

### Development Tools

#### ESBuild (`features.esbuild`)
**Usage:** `container.feature('features.esbuild')`

TypeScript/ESM compilation to JavaScript.

**Key Methods:**
- `transform(code, options?)` - Transform code asynchronously
- `transformSync(code, options?)` - Transform code synchronously

#### REPL (`features.repl`)
**Usage:** `container.feature('features.repl')`

Interactive Node.js REPL server with container context access.

**Key Methods:**
- `start(options?)` - Start REPL with history and custom context
- `createServer()` - Create configured REPL server

**Options:** `{ historyPath?, context?, exclude? }`

#### Virtual Machine (`features.vm`)
**Usage:** `container.feature('features.vm')`

Secure JavaScript execution in isolated contexts.

**Key Methods:**
- `createScript(code, options?)` - Compile code into VM script
- `createContext(ctx?)` - Create execution context
- `run(code, ctx?)` - Execute JavaScript code safely

#### Python Integration (`features.python`)
**Usage:** `container.feature('features.python')`

Python virtual machine with automatic environment detection.

**Key Methods:**
- `detectEnvironment()` - Detect Python environment (uv, conda, venv, system)
- `installDependencies()` - Install project dependencies
- `execute(code, variables?, options?)` - Execute Python code
- `executeFile(filePath, variables?)` - Execute Python file
- `getEnvironmentInfo()` - Get Python environment details

**Events:** `ready`, `environmentDetected`, `installingDependencies`, `dependenciesInstalled`, `codeExecuted`

### Package Management

#### Package Finder (`features.packageFinder`)
**Usage:** `container.feature('features.packageFinder')`

Comprehensive npm package discovery and analysis across workspace.

**Key Methods:**
- `start()` - Begin package scanning
- `scan(options?)` - Scan all node_modules directories
- `findByName(name)` - Find package by name
- `findDependentsOf(packageName)` - Find packages that depend on target
- `find(filter)` - Find first package matching filter function
- `filter(filter)` - Find all packages matching filter function
- `exclude(filter)` - Find packages NOT matching filter function

**Properties:** `packages`, `duplicates` (detected during scan)

#### Script Runner (`features.scriptRunner`)
**Usage:** `container.feature('features.scriptRunner')`

Execute npm scripts from package.json with programmatic access.

Automatically generates camelCase methods for each script in package.json.

### Networking & Services

#### Networking (`features.networking`)
**Usage:** `container.feature('features.networking')`

Network utilities for port detection and availability.

**Key Methods:**
- `findOpenPort(startAt?)` - Find next available port from starting point
- `isPortOpen(checkPort?)` - Check if specific port is available

#### Port Exposer (`portExposer`)
**Usage:** `container.feature('portExposer')`

Expose local services via ngrok with SSL-enabled public URLs.

**Key Methods:**
- `expose(port?)` - Expose local port via ngrok
- `close()` - Stop exposing and close tunnel
- `getPublicUrl()` - Get current public URL
- `isConnected()` - Check connection status
- `getConnectionInfo()` - Get connection details
- `reconnect(newOptions?)` - Reconnect with new options

**Events:** `exposed`, `error`, `closed`

#### Downloader (`features.downloader`)
**Usage:** `container.feature('features.downloader')`

Download files from URLs to local filesystem.

**Key Methods:**
- `download(url, targetPath)` - Download file from URL to local path

### Communication

#### IPC Socket (`features.ipcSocket`)
**Usage:** `container.feature('features.ipcSocket')`

Inter-process communication via Unix domain sockets.

**Server Mode:**
- `listen(socketPath, removeLock?)` - Start IPC server
- `broadcast(message)` - Send message to all connected clients
- `stopServer()` - Stop server and cleanup connections

**Client Mode:**
- `connect(socketPath)` - Connect to IPC server
- `send(message)` - Send message to server

**Events:** `message`, `connection` (server only)

### User Interface

#### UI (`features.ui`)
**Usage:** `container.feature('features.ui')`

Interactive terminal UI with colors, ASCII art, and prompts.

**Color & Styling:**
- `assignColor(name)` - Get consistent color for named entity
- `colors` - Full chalk API access for text styling
- `print` - Direct color printing methods (red, green, blue, etc.)

**ASCII Art:**
- `asciiArt(text, font)` - Generate ASCII art with specified font
- `banner(text, options)` - Create styled banner with gradients
- `applyGradient(text, colors, direction)` - Apply color gradients
- `applyHorizontalGradient(text, colors)` - Character-by-character gradients
- `applyVerticalGradient(text, colors)` - Line-by-line gradients

**Text Utilities:**
- `padLeft(str, length, padChar?)` - Left-pad text to specified length
- `padRight(str, length, padChar?)` - Right-pad text to specified length

**Interactive Elements:**
- `wizard(questions, initialAnswers?)` - Create interactive prompts
- `openInEditor(text, extension?)` - Open text in external editor

### Documentation Processing

#### MDX Bundler (`features.mdxBundler`)
**Usage:** `container.feature('features.mdxBundler')`

Compile MDX content into executable JavaScript.

**Key Methods:**
- `compile(source, options?)` - Compile MDX source to JavaScript

## Usage Patterns

### Basic Feature Access
```javascript
// Get a feature instance
const fs = container.feature('features.fs');
const ui = container.feature('features.ui');

// Use feature methods
const content = fs.readFile('package.json');
ui.print.green('File read successfully!');
```

### Feature with Options
```javascript
// Start REPL with custom configuration
const repl = container.feature('features.repl');
await repl.start({
  historyPath: '.custom_history',
  context: { myVar: 'value' }
});
```

### Event Handling
```javascript
// Listen to file changes
const fileManager = container.feature('features.fileManager');
fileManager.on('file:change', (data) => {
  console.log('File changed:', data);
});
await fileManager.start();
```

### Chaining Operations
```javascript
// Complex workflow example
const fs = container.feature('features.fs');
const vault = container.feature('features.vault');
const cache = container.feature('features.diskCache');

// Read, encrypt, and cache data
const data = fs.readFile('sensitive.txt');
const encrypted = vault.encrypt(data);
cache.set('secure-data', encrypted);
```

## Notes

- Features are lazily instantiated - they're only created when first accessed
- Many features auto-attach to the container and are immediately available
- State is maintained within each feature instance
- File paths are generally relative to the container's working directory
- Most async operations return Promises and can be awaited
