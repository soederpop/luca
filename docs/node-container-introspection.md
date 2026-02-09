# Features

# features.diskCache

DiskCache helper

## Methods

### saveFile

Retrieve a file from the disk cache and save it to the local disk

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `key` | `string` | ✓ | Parameter key |

| `outputPath` | `string` | ✓ | Parameter outputPath |

| `isBase64` | `any` |  | Parameter isBase64 |

**Returns:** `void`



### ensure

Ensure a key exists in the cache, setting it with the provided content if it doesn't exist

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `key` | `string` | ✓ | Parameter key |

| `content` | `string` | ✓ | Parameter content |

**Returns:** `void`



### copy

Copy a cached item from one key to another

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `source` | `string` | ✓ | Parameter source |

| `destination` | `string` | ✓ | Parameter destination |

| `overwrite` | `boolean` |  | Parameter overwrite |

**Returns:** `void`



### move

Move a cached item from one key to another (copy then delete source)

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `source` | `string` | ✓ | Parameter source |

| `destination` | `string` | ✓ | Parameter destination |

| `overwrite` | `boolean` |  | Parameter overwrite |

**Returns:** `void`



### has

Check if a key exists in the cache

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `key` | `string` | ✓ | Parameter key |

**Returns:** `void`



### get

Retrieve a value from the cache

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `key` | `string` | ✓ | Parameter key |

| `json` | `any` |  | Parameter json |

**Returns:** `void`



### set

Store a value in the cache

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `key` | `string` | ✓ | Parameter key |

| `value` | `any` | ✓ | Parameter value |

| `meta` | `any` |  | Parameter meta |

**Returns:** `void`



### rm

Remove a cached item

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `key` | `string` | ✓ | Parameter key |

**Returns:** `void`



### clearAll

Clear all cached items

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `confirm` | `any` |  | Parameter confirm |

**Returns:** `void`



### keys

Get all cache keys

**Returns:** `Promise<string[]>`



### listKeys

List all cache keys (alias for keys())

**Returns:** `Promise<string[]>`



### create

Create a cacache instance with the specified path

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `path` | `string` |  | Parameter path |

**Returns:** `void`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

# features.downloader

A feature that provides file downloading capabilities from URLs. The Downloader feature allows you to fetch files from remote URLs and save them to the local filesystem. It handles the network request, buffering, and file writing operations automatically.

## Methods

### download

Downloads a file from a URL and saves it to the specified local path. This method fetches the file from the provided URL, converts it to a buffer, and writes it to the filesystem at the target path. The target path is resolved relative to the container's configured paths.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `url` | `string` | ✓ | The URL to download the file from. Must be a valid HTTP/HTTPS URL. |

| `targetPath` | `string` | ✓ | The local file path where the downloaded file should be saved. |

**Returns:** `void`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

# features.esbuild

A Feature for compiling typescript / esm modules, etc to JavaScript that the container can run at runtime.

## Methods

### transformSync

Transform code synchronously

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `code` | `string` | ✓ | Parameter code |

| `options` | `esbuild.TransformOptions` |  | Parameter options |

**Returns:** `void`



### transform

Transform code asynchronously

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `code` | `string` | ✓ | Parameter code |

| `options` | `esbuild.TransformOptions` |  | Parameter options |

**Returns:** `void`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

# features.fileManager

The FileManager feature creates a database like index of all of the files in the project, and provides metadata about these files, and also provides a way to watch for changes to the files.

## Methods

### match

Matches the file IDs against the pattern(s) provided

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `patterns` | `string | string[]` | ✓ | The patterns to match against the file IDs |

**Returns:** `void`



### matchFiles

Matches the file IDs against the pattern(s) provided and returns the file objects for each.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `patterns` | `string | string[]` | ✓ | The patterns to match against the file IDs |

**Returns:** `void`



### start

Starts the file manager and scans the files in the project.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `options` | `{ exclude?: string | string[] }` |  | Parameter options |

**Returns:** `void`



### scanFiles

Scans the files in the project and updates the file manager state.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `options` | `{ exclude?: string | string[] }` |  | Parameter options |

**Returns:** `void`



### watch

Watches the files in the project and updates the file manager state.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `options` | `{ exclude?: string | string[] }` |  | Parameter options |

**Returns:** `void`



### stopWatching

**Returns:** `void`



### updateFile

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `path` | `string` | ✓ | Parameter path |

**Returns:** `void`



### removeFile

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `path` | `string` | ✓ | Parameter path |

**Returns:** `void`



## Events

### file:change

Event emitted by FileManager



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `started` | `boolean` | Whether the file manager has completed its initial scan |

| `starting` | `boolean` | Whether the file manager is currently scanning files |

| `watching` | `boolean` | Whether the file watcher is actively monitoring for changes |

| `failed` | `boolean` | Whether the initial file scan failed |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

| `exclude` | `any` | Glob patterns to exclude from file scanning |

# features.fs

The FS feature provides methods for interacting with the file system, relative to the container's cwd.

## Methods

### readFileAsync

Asynchronously reads a file and returns its contents as a string.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `path` | `string` | ✓ | The file path relative to the container's working directory |

**Returns:** `void`



### readdir

Asynchronously reads the contents of a directory.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `path` | `string` | ✓ | The directory path relative to the container's working directory |

**Returns:** `void`



### walk

Recursively walks a directory and returns an array of relative path names for each file and directory.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `basePath` | `string` | ✓ | The base directory path to start walking from |

| `options` | `WalkOptions` |  | Options to configure the walk behavior |

**Returns:** `void`



### walkAsync

Asynchronously and recursively walks a directory and returns an array of relative path names.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `baseDir` | `string` | ✓ | The base directory path to start walking from |

| `options` | `WalkOptions` |  | Options to configure the walk behavior |

**Returns:** `void`



### ensureFileAsync

Asynchronously ensures a file exists with the specified content, creating directories as needed.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `path` | `string` | ✓ | The file path where the file should be created |

| `content` | `string` | ✓ | The content to write to the file |

| `overwrite` | `any` |  | Parameter overwrite |

**Returns:** `void`



### writeFileAsync

Asynchronously writes content to a file.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `path` | `string` | ✓ | The file path where content should be written |

| `content` | `Buffer | string` | ✓ | The content to write to the file |

**Returns:** `void`



### ensureFolder

Synchronously ensures a directory exists, creating parent directories as needed.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `path` | `string` | ✓ | The directory path to create |

**Returns:** `void`



### ensureFile

Synchronously ensures a file exists with the specified content, creating directories as needed.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `path` | `string` | ✓ | The file path where the file should be created |

| `content` | `string` | ✓ | The content to write to the file |

| `overwrite` | `any` |  | Parameter overwrite |

**Returns:** `void`



### findUp

Synchronously finds a file by walking up the directory tree from the current working directory.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `fileName` | `string` | ✓ | The name of the file to search for |

| `options` | `{ cwd?: string }` |  | Parameter options |

**Returns:** `string | null`



### existsAsync

Asynchronously checks if a file or directory exists.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `path` | `string` | ✓ | The path to check for existence |

**Returns:** `void`



### exists

Synchronously checks if a file or directory exists.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `path` | `string` | ✓ | The path to check for existence |

**Returns:** `boolean`



### rm

Asynchronously removes a file.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `path` | `string` | ✓ | The path of the file to remove |

**Returns:** `void`



### readJson

Synchronously reads and parses a JSON file.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `path` | `string` | ✓ | The path to the JSON file |

**Returns:** `void`



### readFile

Synchronously reads a file and returns its contents as a string.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `path` | `string` | ✓ | The path to the file |

**Returns:** `void`



### rmdir

Asynchronously removes a directory and all its contents.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `dirPath` | `string` | ✓ | The path of the directory to remove |

**Returns:** `void`



### findUpAsync

Asynchronously finds a file by walking up the directory tree.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `fileName` | `string` | ✓ | The name of the file to search for |

| `options` | `{ cwd?: string; multiple?: boolean }` |  | Parameter options |

**Returns:** `Promise<string | string[] | null>`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

# features.git

The Git feature provides utilities for interacting with Git repositories. This feature allows you to check repository status, list files, get branch information, and access Git metadata for projects within a Git repository.

## Methods

### lsFiles

Lists files in the Git repository using git ls-files command. This method provides a flexible interface to the git ls-files command, allowing you to filter files by various criteria such as cached, deleted, modified, untracked, and ignored files.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `options` | `LsFilesOptions` |  | Parameter options |

**Returns:** `void`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `repoRoot` | `string` | Absolute path to the Git repository root directory |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

# features.ipcSocket

IpcSocket Feature - Inter-Process Communication via Unix Domain Sockets This feature provides robust IPC (Inter-Process Communication) capabilities using Unix domain sockets. It supports both server and client modes, allowing processes to communicate efficiently through file system-based socket connections. **Key Features:** - Dual-mode operation: server and client functionality - JSON message serialization/deserialization - Multiple client connection support (server mode) - Event-driven message handling - Automatic socket cleanup and management - Broadcast messaging to all connected clients - Lock file management for socket paths **Communication Pattern:** - Messages are automatically JSON-encoded with unique IDs - Both server and client emit 'message' events for incoming data - Server can broadcast to all connected clients - Client maintains single connection to server **Socket Management:** - Automatic cleanup of stale socket files - Connection tracking and management - Graceful shutdown procedures - Lock file protection against conflicts **Usage Examples:** **Server Mode:** ```typescript const ipc = container.feature('ipcSocket'); await ipc.listen('/tmp/myapp.sock', true); // removeLock=true ipc.on('connection', (socket) => { console.log('Client connected'); }); ipc.on('message', (data) => { console.log('Received:', data); ipc.broadcast({ reply: 'ACK', original: data }); }); ``` **Client Mode:** ```typescript const ipc = container.feature('ipcSocket'); await ipc.connect('/tmp/myapp.sock'); ipc.on('message', (data) => { console.log('Server says:', data); }); await ipc.send({ type: 'request', payload: 'hello' }); ```

## Methods

### listen

Starts the IPC server listening on the specified socket path. This method sets up a Unix domain socket server that can accept multiple client connections. Each connected client is tracked, and the server automatically handles connection lifecycle events. Messages received from clients are JSON-parsed and emitted as 'message' events. **Server Behavior:** - Tracks all connected clients in the sockets Set - Automatically removes clients when they disconnect - JSON-parses incoming messages and emits 'message' events - Emits 'connection' events when clients connect - Prevents starting multiple servers on the same instance **Socket File Management:** - Resolves the socket path relative to the container's working directory - Optionally removes existing socket files to prevent "address in use" errors - Throws error if socket file exists and removeLock is false

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `socketPath` | `string` | ✓ | Parameter socketPath |

| `removeLock` | `any` |  | Parameter removeLock |

**Returns:** `Promise<Server>`



### stopServer

Stops the IPC server and cleans up all connections. This method gracefully shuts down the server by: 1. Closing the server listener 2. Destroying all active client connections 3. Clearing the sockets tracking set 4. Resetting the server instance

**Returns:** `Promise<void>`



### broadcast

Broadcasts a message to all connected clients (server mode only). This method sends a JSON-encoded message with a unique ID to every client currently connected to the server. Each message is automatically wrapped with metadata including a UUID for tracking. **Message Format:** Messages are automatically wrapped in the format: ```json { "data": <your_message>, "id": "<uuid>" } ```

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `message` | `any` | ✓ | Parameter message |

**Returns:** `void`



### send

Sends a message to the server (client mode only). This method sends a JSON-encoded message with a unique ID to the connected server. The message is automatically wrapped with metadata for tracking purposes. **Message Format:** Messages are automatically wrapped in the format: ```json { "data": <your_message>, "id": "<uuid>" } ```

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `message` | `any` | ✓ | Parameter message |

**Returns:** `void`



### connect

Connects to an IPC server at the specified socket path (client mode). This method establishes a client connection to an existing IPC server. Once connected, the client can send messages to the server and receive responses. The connection is maintained until explicitly closed or the server terminates. **Connection Behavior:** - Sets the socket mode to 'client' - Returns existing connection if already connected - Automatically handles connection events and cleanup - JSON-parses incoming messages and emits 'message' events - Cleans up connection reference when socket closes **Error Handling:** - Throws error if already in server mode - Rejects promise on connection failures - Automatically cleans up on connection close

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `socketPath` | `string` | ✓ | Parameter socketPath |

**Returns:** `Promise<Socket>`



## Events

### message

Event emitted by IpcSocket



### connection

Event emitted by IpcSocket



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `mode` | `string` | The current mode of the IPC socket - either server or client |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

# features.jsonTree

JsonTree Feature - A powerful JSON file tree loader and processor This feature provides functionality to recursively load JSON files from a directory structure and build a hierarchical tree representation. It automatically processes file paths to create a nested object structure where file paths become object property paths. **Key Features:** - Recursive JSON file discovery in directory trees - Automatic path-to-property mapping using camelCase conversion - Integration with FileManager for efficient file operations - State-based tree storage and retrieval - Native JSON parsing for optimal performance **Path Processing:** Files are processed to create a nested object structure: - Directory names become object properties (camelCased) - File names become the final property names (without .json extension) - Nested directories create nested objects **Usage Example:** ```typescript const jsonTree = container.feature('jsonTree', { enable: true }); await jsonTree.loadTree('data', 'appData'); const userData = jsonTree.tree.appData.users.profiles; ``` **Directory Structure Example:** ``` data/ users/ profiles.json    -> tree.data.users.profiles settings.json    -> tree.data.users.settings config/ app-config.json  -> tree.data.config.appConfig ```

## Methods

### loadTree

Loads a tree of JSON files from the specified base path and stores them in state. This method recursively scans the provided directory for JSON files, processes their content, and builds a hierarchical object structure. File paths are converted to camelCase property names, and the resulting tree is stored in the feature's state. **Processing Steps:** 1. Uses FileManager to discover all .json files recursively 2. Reads each file's content using the file system feature 3. Parses JSON content using native JSON.parse() 4. Converts file paths to nested object properties 5. Stores the complete tree in feature state **Path Transformation:** - Removes the base path prefix from file paths - Converts directory/file names to camelCase - Creates nested objects based on directory structure - Removes .json file extension **Example Transformation:** ``` config/ database/ production.json  -> tree.config.database.production staging.json     -> tree.config.database.staging api/ endpoints.json   -> tree.config.api.endpoints ```

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `basePath` | `string` | ✓ | Parameter basePath |

| `key` | `string` |  | Parameter key |

**Returns:** `void`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

# features.mdxBundler

The MdxBundler feature provides MDX compilation capabilities. This feature wraps the mdx-bundler library to compile MDX content into executable JavaScript. MDX allows you to use JSX components within Markdown files, making it ideal for documentation and content that needs interactive elements.

## Methods

### compile

Compiles MDX source code into executable JavaScript. This method takes MDX source code and optional file dependencies and compiles them into JavaScript code that can be executed in a React environment. The compilation process handles JSX transformation, import resolution, and bundling.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `source` | `string` | ✓ | The MDX source code to compile |

| `options` | `CompileOptions` |  | Parameter options |

**Returns:** `void`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

# features.networking

The Networking feature provides utilities for network-related operations. This feature includes utilities for port detection and availability checking, which are commonly needed when setting up servers or network services.

## Methods

### findOpenPort

Finds the next available port starting from the specified port number. This method will search for the first available port starting from the given port number. If the specified port is available, it returns that port. Otherwise, it returns the next available port.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `startAt` | `any` |  | Parameter startAt |

**Returns:** `void`



### isPortOpen

Checks if a specific port is available for use. This method attempts to detect if the specified port is available. It returns true if the port is available, false if it's already in use.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `checkPort` | `any` |  | Parameter checkPort |

**Returns:** `void`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

# features.os

The OS feature provides access to operating system utilities and information. This feature wraps Node.js's built-in `os` module and provides convenient getters for system information like architecture, platform, directories, network interfaces, and hardware details.

## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

# features.packageFinder

PackageFinder Feature - Comprehensive package discovery and analysis tool This feature provides powerful capabilities for discovering, indexing, and analyzing npm packages across the entire project workspace. It recursively scans all node_modules directories and builds a comprehensive index of packages, enabling: **Core Functionality:** - Recursive node_modules scanning across the workspace - Package manifest parsing and indexing - Duplicate package detection and analysis - Dependency relationship mapping - Scoped package organization (@scope/package) - Package count and statistics **Use Cases:** - Dependency auditing and analysis - Duplicate package identification - Package version conflict detection - Dependency tree analysis - Workspace package inventory **Performance Features:** - Parallel manifest reading for fast scanning - Efficient duplicate detection using unique paths - Lazy initialization - only scans when started - In-memory indexing for fast queries **Usage Example:** ```typescript const finder = container.feature('packageFinder'); await finder.start(); // Find duplicates console.log('Duplicate packages:', finder.duplicates); // Find package by name const lodash = finder.findByName('lodash'); // Find dependents of a package const dependents = finder.findDependentsOf('react'); ```

## Methods

### afterInitialize

Initializes the feature state after construction. Sets the started flag to false, indicating the initial scan hasn't completed.

**Returns:** `void`



### addPackage

Adds a package manifest to the internal index. This method ensures uniqueness based on file path and maintains an array of all versions/instances of each package found across the workspace. Packages with the same name but different paths (versions) are tracked separately.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `manifest` | `PartialManifest` | ✓ | Parameter manifest |

| `path` | `string` | ✓ | Parameter path |

**Returns:** `void`



### start

Starts the package finder and performs the initial workspace scan. This method is idempotent - calling it multiple times will not re-scan if already started. It triggers the complete workspace scanning process.

**Returns:** `void`



### scan

Performs a comprehensive scan of all node_modules directories in the workspace. This method orchestrates the complete scanning process: 1. Discovers all node_modules directories recursively 2. Finds all package directories (including scoped packages) 3. Reads and parses all package.json files in parallel 4. Indexes all packages for fast querying The scan is performed in parallel for optimal performance, reading multiple package.json files simultaneously.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `options` | `{ exclude?: string | string[] }` |  | Parameter options |

**Returns:** `void`



### findByName

Finds the first package manifest matching the given name. If multiple versions of the package exist, returns the first one found. Use the packages property directly if you need all versions.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `name` | `string` | ✓ | Parameter name |

**Returns:** `void`



### findDependentsOf

Finds all packages that declare the specified package as a dependency. Searches through dependencies and devDependencies of all packages to find which ones depend on the target package. Useful for impact analysis when considering package updates or removals.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `packageName` | `string` | ✓ | Parameter packageName |

**Returns:** `void`



### find

Finds the first package manifest matching the provided filter function.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `filter` | `(manifest: PartialManifest) => boolean` | ✓ | Parameter filter |

**Returns:** `void`



### filter

Finds all package manifests matching the provided filter function.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `filter` | `(manifest: PartialManifest) => boolean` | ✓ | Parameter filter |

**Returns:** `void`



### exclude

Returns all packages that do NOT match the provided filter function. This is the inverse of filter() - returns packages where filter returns false.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `filter` | `(manifest: PartialManifest) => boolean` | ✓ | Parameter filter |

**Returns:** `void`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `started` | `boolean` | Whether the package finder has been started and initial scan completed |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

| `option` | `string` | Optional configuration parameter |

# portExposer

Port Exposer Feature Exposes local HTTP services via ngrok with SSL-enabled public URLs. Perfect for development, testing, and sharing local services securely. Features: - SSL-enabled public URLs for local services - Custom subdomains and domains (with paid plans) - Authentication options (basic auth, OAuth) - Regional endpoint selection - Connection state management

## Methods

### expose

Expose the local port via ngrok

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `port` | `number` |  | Parameter port |

**Returns:** `Promise<string>`



### close

Stop exposing the port and close the ngrok tunnel

**Returns:** `Promise<void>`



### getPublicUrl

Get the current public URL if connected

**Returns:** `string | undefined`



### isConnected

Check if currently connected

**Returns:** `boolean`



### getConnectionInfo

Get connection information

**Returns:** `void`



### reconnect

Reconnect with new options

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `newOptions` | `Partial<PortExposerOptions>` |  | Parameter newOptions |

**Returns:** `Promise<string>`



### disable

Override disable to ensure cleanup

**Returns:** `Promise<this>`



## Events

### exposed

Event emitted by PortExposer



### error

Event emitted by PortExposer



### closed

Event emitted by PortExposer



## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

| `port` | `number` | Local port to expose |

| `authToken` | `string` | Ngrok auth token for premium features |

| `region` | `string` | Preferred ngrok region (us, eu, ap, au, sa, jp, in) |

| `subdomain` | `string` | Custom subdomain (requires paid plan) |

| `domain` | `string` | Domain to use (requires paid plan) |

| `basicAuth` | `string` | Basic auth credentials for the tunnel |

| `oauth` | `string` | OAuth provider for authentication |

| `config` | `any` | Additional ngrok configuration |

# features.python

The Python VM feature provides Python virtual machine capabilities for executing Python code. This feature automatically detects Python environments (uv, conda, venv, system) and provides methods to install dependencies and execute Python scripts. It can manage project-specific Python environments and maintain context between executions.

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



### installDependencies

Installs dependencies for the Python project. This method automatically detects the appropriate package manager and install command based on the environment type. If a custom installCommand is provided in options, it will use that instead.

**Returns:** `Promise<{ stdout: string; stderr: string; exitCode: number }>`



### execute

Executes Python code and returns the result. This method creates a temporary Python script with the provided code and variables, executes it using the detected Python environment, and captures the output.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `code` | `string` | ✓ | The Python code to execute |

| `variables` | `Record<string, any>` |  | Parameter variables |

| `options` | `{ captureLocals?: boolean }` |  | Parameter options |

**Returns:** `Promise<{ stdout: string; stderr: string; exitCode: number; locals?: any }>`



### executeFile

Executes a Python file and returns the result.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `filePath` | `string` | ✓ | Path to the Python file to execute |

| `variables` | `Record<string, any>` |  | Parameter variables |

**Returns:** `Promise<{ stdout: string; stderr: string; exitCode: number }>`



### getEnvironmentInfo

Gets information about the current Python environment.

**Returns:** `Promise<{ version: string; path: string; packages: string[] }>`



## Events

### ready

Event emitted by Python



### environmentDetected

Event emitted by Python



### installingDependencies

Event emitted by Python



### dependenciesInstalled

Event emitted by Python



### dependencyInstallFailed

Event emitted by Python



### localsParseError

Event emitted by Python



### codeExecuted

Event emitted by Python



### fileExecuted

Event emitted by Python



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `pythonPath` | `any` | Path to the detected Python executable |

| `projectDir` | `any` | Root directory of the Python project |

| `environmentType` | `any` | Detected Python environment type (uv, conda, venv, or system) |

| `isReady` | `boolean` | Whether the Python environment is ready for execution |

| `lastExecutedScript` | `any` | Path to the last executed Python script |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

| `dir` | `string` | Directory containing the Python project |

| `installCommand` | `string` | Custom install command to override auto-detection |

| `contextScript` | `string` | Path to Python script that will populate locals/context |

| `pythonPath` | `string` | Specific Python executable path to use |

# features.proc

The ChildProcess feature provides utilities for executing external processes and commands. This feature wraps Node.js child process functionality to provide convenient methods for executing shell commands, spawning processes, and capturing their output. It supports both synchronous and asynchronous execution with various options.

## Methods

### execAndCapture

Executes a command string and captures its output asynchronously. This method takes a complete command string, splits it into command and arguments, and executes it using the spawnAndCapture method. It's a convenient wrapper for simple command execution.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `cmd` | `string` | ✓ | The complete command string to execute (e.g., "git status --porcelain") |

| `options` | `any` |  | Parameter options |

**Returns:** `Promise<{
    stderr: string;
    stdout: string;
    error: null | any;
    exitCode: number;
    pid: number | null;
  }>`



### spawnAndCapture

Spawns a process and captures its output with real-time monitoring capabilities. This method provides comprehensive process execution with the ability to capture output, monitor real-time data streams, and handle process lifecycle events. It's ideal for long-running processes where you need to capture output as it happens.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `command` | `string` | ✓ | The command to execute (e.g., 'node', 'npm', 'git') |

| `args` | `string[]` | ✓ | Array of arguments to pass to the command |

| `options` | `SpawnOptions` |  | Parameter options |

**Returns:** `Promise<{
    stderr: string;
    stdout: string;
    error: null | any;
    exitCode: number;
    pid: number | null;
  }>`



### exec

Executes a command synchronously and returns its output. This method runs a command and waits for it to complete before returning. It's useful for simple commands where you need the result immediately and don't require real-time output monitoring.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `command` | `string` | ✓ | The command to execute |

| `options` | `any` |  | Parameter options |

**Returns:** `string`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

# features.repl

Repl Feature - Interactive Node.js REPL (Read-Eval-Print Loop) server This feature provides a fully-featured REPL server with support for: - Custom evaluation context with container access - Persistent command history - Promise-aware evaluation (async/await support) - Customizable prompts and settings - Integration with the container's context and features The REPL runs in a sandboxed VM context but provides access to the container and all its features, making it perfect for interactive debugging and exploration. **Key Features:** - VM-based evaluation for security - Automatic promise resolution in REPL output - Persistent history across sessions - Full container context access - Colored terminal output support **Usage Example:** ```typescript const repl = container.feature('repl'); await repl.start({ historyPath: '.repl_history', context: { customVar: 'value' } }); // REPL is now running and accessible ```

## Methods

### createServer

Creates and configures a new REPL server instance. This method sets up the REPL with custom evaluation logic that: - Runs code in a VM context for isolation - Automatically handles Promise resolution - Provides colored terminal output - Uses the configured prompt The REPL evaluation supports both synchronous and asynchronous code execution, automatically detecting and awaiting Promises in the result.

**Returns:** `void`



### start

Starts the REPL server with the specified configuration. This method initializes the REPL server, sets up command history persistence, and configures the evaluation context. The context includes: - All container features and properties - Custom context variables passed in options - Helper functions like `client()` for creating clients **History Management:** - Creates history file directory if it doesn't exist - Uses provided historyPath or defaults to node_modules/.cache/.repl_history - Persists command history across sessions **Context Setup:** - Inherits full container context - Adds custom context variables - Provides convenience methods for container interaction

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `options` | `{ historyPath?: string, context?: any, exclude?: string | string[] }` |  | Parameter options |

**Returns:** `void`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `started` | `boolean` | Whether the REPL server has been started |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

| `prompt` | `string` | The prompt string to display in the REPL (default: "> ") |

| `historyPath` | `string` | Path to the REPL history file for command persistence |

# features.scriptRunner

The ScriptRunner feature provides convenient access to npm scripts defined in package.json. This feature automatically generates camelCase methods for each script in the package.json file, allowing you to execute them programmatically with additional arguments and options.

## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

# features.ui

UI Feature - Interactive Terminal User Interface Builder This feature provides comprehensive tools for creating beautiful, interactive terminal experiences. It combines several popular libraries (chalk, figlet, inquirer) into a unified interface for building professional CLI applications with colors, ASCII art, and interactive prompts. **Core Capabilities:** - Rich color management using chalk library - ASCII art generation with multiple fonts - Interactive prompts and wizards - Automatic color assignment for consistent theming - Text padding and formatting utilities - Gradient text effects (horizontal and vertical) - Banner creation with styled ASCII art **Color System:** - Full chalk API access for complex styling - Automatic color assignment with palette cycling - Consistent color mapping for named entities - Support for hex colors and gradients **ASCII Art Features:** - Multiple font options via figlet - Automatic font discovery and caching - Banner creation with color gradients - Text styling and effects **Interactive Elements:** - Wizard creation with inquirer integration - External editor integration - User input validation and processing **Usage Examples:** **Basic Colors:** ```typescript const ui = container.feature('ui'); // Direct color usage ui.print.red('Error message'); ui.print.green('Success!'); // Complex styling console.log(ui.colors.blue.bold.underline('Important text')); ``` **ASCII Art Banners:** ```typescript const banner = ui.banner('MyApp', { font: 'Big', colors: ['red', 'white', 'blue'] }); console.log(banner); ``` **Interactive Wizards:** ```typescript const answers = await ui.wizard([ { type: 'input', name: 'name', message: 'Your name?' }, { type: 'confirm', name: 'continue', message: 'Continue?' } ]); ``` **Automatic Color Assignment:** ```typescript const userColor = ui.assignColor('john'); const adminColor = ui.assignColor('admin'); console.log(userColor('John\'s message')); console.log(adminColor('Admin notice')); ```

## Methods

### markdown

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `text` | `string` | ✓ | Parameter text |

**Returns:** `void`



### assignColor

Assigns a consistent color to a named entity. This method provides automatic color assignment that remains consistent across the application session. Each unique name gets assigned a color from the palette, and subsequent calls with the same name return the same color function. **Assignment Strategy:** - First call with a name assigns the next available palette color - Subsequent calls return the previously assigned color - Colors cycle through the palette when all colors are used - Returns a chalk hex color function for styling text

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `name` | `string` | ✓ | Parameter name |

**Returns:** `(str: string) => string`



### wizard

Creates an interactive wizard using inquirer prompts. This method provides a convenient wrapper around inquirer for creating interactive command-line wizards. It supports all inquirer question types and can handle complex validation and conditional logic. **Supported Question Types:** - input: Text input fields - confirm: Yes/no confirmations - list: Single selection from options - checkbox: Multiple selections - password: Hidden text input - editor: External editor integration **Advanced Features:** - Conditional questions based on previous answers - Input validation and transformation - Custom prompts and styling - Initial answer pre-population

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `questions` | `any[]` | ✓ | Parameter questions |

| `initialAnswers` | `any` |  | Parameter initialAnswers |

**Returns:** `void`



### askQuestion

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `question` | `string` | ✓ | Parameter question |

**Returns:** `void`



### openInEditor

Opens text in the user's external editor for editing. This method integrates with the user's configured editor (via $EDITOR or $VISUAL environment variables) to allow editing of text content. The edited content is returned when the user saves and closes the editor. **Editor Integration:** - Respects $EDITOR and $VISUAL environment variables - Creates temporary file with specified extension - Returns modified content after editor closes - Handles editor cancellation gracefully

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `text` | `string` | ✓ | Parameter text |

| `extension` | `any` |  | Parameter extension |

**Returns:** `void`



### asciiArt

Generates ASCII art from text using the specified font. This method converts regular text into stylized ASCII art using figlet's extensive font collection. Perfect for creating eye-catching headers, logos, and decorative text in terminal applications. **Font Capabilities:** - Large collection of artistic fonts - Various styles: block, script, decorative, technical - Different sizes and character sets - Consistent spacing and alignment

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `text` | `string` | ✓ | Parameter text |

| `font` | `Fonts` | ✓ | Parameter font |

**Returns:** `void`



### banner

Creates a styled banner with ASCII art and color gradients. This method combines ASCII art generation with color gradient effects to create visually striking banners for terminal applications. It automatically applies color gradients to the generated ASCII art based on the specified options. **Banner Features:** - ASCII art text generation - Automatic color gradient application - Customizable gradient directions - Multiple color combinations - Professional terminal presentation

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `text` | `string` | ✓ | Parameter text |

| `options` | `{ font: Fonts; colors: Color[] }` | ✓ | Parameter options |

**Returns:** `void`



### endent

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `args` | `any[]` | ✓ | Parameter args |

**Returns:** `void`



### applyGradient

Applies color gradients to text with configurable direction. This method creates smooth color transitions across text content, supporting both horizontal (character-by-character) and vertical (line-by-line) gradients. Perfect for creating visually appealing terminal output and ASCII art effects. **Gradient Types:** - Horizontal: Colors transition across characters in each line - Vertical: Colors transition across lines of text - Customizable color sequences and transitions - Automatic color cycling for long content

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `text` | `string` | ✓ | Parameter text |

| `lineColors` | `Color[]` |  | Parameter lineColors |

| `direction` | `"horizontal" | "vertical"` |  | Parameter direction |

**Returns:** `void`



### applyHorizontalGradient

Applies horizontal color gradients character by character. This method creates color transitions across characters within the text, cycling through the provided colors to create smooth horizontal gradients. Each character gets assigned a color based on its position in the sequence. **Horizontal Gradient Behavior:** - Each character is individually colored - Colors cycle through the provided array - Creates smooth transitions across text width - Works well with ASCII art and single lines

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `text` | `string` | ✓ | Parameter text |

| `lineColors` | `Color[]` |  | Parameter lineColors |

**Returns:** `void`



### applyVerticalGradient

Applies vertical color gradients line by line. This method creates color transitions across lines of text, with each line getting a different color from the sequence. Perfect for multi-line content like ASCII art, banners, and structured output. **Vertical Gradient Behavior:** - Each line is colored uniformly - Colors cycle through the provided array - Creates smooth transitions across text height - Ideal for multi-line ASCII art and structured content

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `text` | `string` | ✓ | Parameter text |

| `lineColors` | `Color[]` |  | Parameter lineColors |

**Returns:** `void`



### padLeft

Pads text on the left to reach the specified length. This utility method adds padding characters to the left side of text to achieve a desired total length. Useful for creating aligned columns, formatted tables, and consistent text layout in terminal applications. **Padding Behavior:** - Adds padding to the left (start) of the string - Uses specified padding character (default: space) - Returns original string if already at or beyond target length - Handles multi-character padding by repeating the character

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `str` | `string` | ✓ | Parameter str |

| `length` | `number` | ✓ | Parameter length |

| `padChar` | `any` |  | Parameter padChar |

**Returns:** `void`



### padRight

Pads text on the right to reach the specified length. This utility method adds padding characters to the right side of text to achieve a desired total length. Essential for creating properly aligned columns, tables, and formatted output in terminal applications. **Padding Behavior:** - Adds padding to the right (end) of the string - Uses specified padding character (default: space) - Returns original string if already at or beyond target length - Handles multi-character padding by repeating the character

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `str` | `string` | ✓ | Parameter str |

| `length` | `number` | ✓ | Parameter length |

| `padChar` | `any` |  | Parameter padChar |

**Returns:** `void`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `fonts` | `array` | Array of available fonts for ASCII art generation |

| `colorPalette` | `array` | Color palette of hex colors for automatic color assignment |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

# features.vault

The Vault feature provides encryption and decryption capabilities using AES-256-GCM. This feature allows you to securely encrypt and decrypt sensitive data using industry-standard encryption. It manages secret keys and provides a simple interface for cryptographic operations.

## Methods

### secret

Gets or generates a secret key for encryption operations.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `{ refresh = false, set = true }` | `any` |  | Parameter { refresh = false, set = true } |

**Returns:** `Buffer`



### decrypt

Decrypts an encrypted payload that was created by the encrypt method.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `payload` | `string` | ✓ | The encrypted payload to decrypt (base64 encoded with delimiters) |

**Returns:** `void`



### encrypt

Encrypts a plaintext string using AES-256-GCM encryption.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `payload` | `string` | ✓ | The plaintext string to encrypt |

**Returns:** `void`



# features.vm

The VM feature provides Node.js virtual machine capabilities for executing JavaScript code. This feature wraps Node.js's built-in `vm` module to provide secure code execution in isolated contexts. It's useful for running untrusted code, creating sandboxed environments, or dynamically executing code with controlled access to variables and modules.

## Methods

### createScript

Creates a new VM script from the provided code. This method compiles JavaScript code into a VM script that can be executed multiple times in different contexts. The script is pre-compiled for better performance when executing the same code repeatedly.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `code` | `string` | ✓ | The JavaScript code to compile into a script |

| `options` | `vm.ScriptOptions` |  | Parameter options |

**Returns:** `void`



### createContext

Creates a new execution context for running VM scripts. This method creates an isolated JavaScript execution context that combines the container's context with any additional context variables provided. The resulting context can be used to run scripts with controlled variable access.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `ctx` | `any` |  | Parameter ctx |

**Returns:** `void`



### run

Executes JavaScript code in a controlled environment. This method creates a script from the provided code, sets up an execution context with the specified variables, and runs the code safely. It handles errors gracefully and returns either the result or the error object.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `code` | `string` | ✓ | The JavaScript code to execute |

| `ctx` | `any` |  | Parameter ctx |

**Returns:** `Promise<T>`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

| `context` | `any` | Default context object to inject into the VM execution environment |

# features.yamlTree

YamlTree Feature - A powerful YAML file tree loader and processor This feature provides functionality to recursively load YAML files from a directory structure and build a hierarchical tree representation. It automatically processes file paths to create a nested object structure where file paths become object property paths. **Key Features:** - Recursive YAML file discovery in directory trees - Automatic path-to-property mapping using camelCase conversion - Integration with FileManager for efficient file operations - State-based tree storage and retrieval - Support for both .yml and .yaml file extensions

## Methods

### loadTree

Loads a tree of YAML files from the specified base path and stores them in state. This method recursively scans the provided directory for YAML files (.yml and .yaml), processes their content, and builds a hierarchical object structure. File paths are converted to camelCase property names, and the resulting tree is stored in the feature's state. **Path Processing:** - Removes the base path prefix from file paths - Converts directory/file names to camelCase - Creates nested objects based on directory structure - Removes file extensions (.yml/.yaml) **Example:** ``` config/ database/ production.yml  -> tree.config.database.production staging.yml     -> tree.config.database.staging api/ endpoints.yaml  -> tree.config.api.endpoints ```

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `basePath` | `string` | ✓ | Parameter basePath |

| `key` | `string` |  | Parameter key |

**Returns:** `void`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

# features.yaml

The YAML feature provides utilities for parsing and stringifying YAML data. This feature wraps the js-yaml library to provide convenient methods for converting between YAML strings and JavaScript objects. It's automatically attached to Node containers for easy access.

## Methods

### stringify

Converts a JavaScript object to a YAML string. This method serializes JavaScript data structures into YAML format, which is human-readable and commonly used for configuration files.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `data` | `any` | ✓ | The data to convert to YAML format |

**Returns:** `string`



### parse

Parses a YAML string into a JavaScript object. This method deserializes YAML content into JavaScript data structures. It supports all standard YAML features including nested objects, arrays, and various data types.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `yamlStr` | `string` | ✓ | The YAML string to parse |

**Returns:** `T`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

# features.docker

Docker CLI interface feature for managing containers, images, and executing Docker commands. Provides comprehensive Docker operations including: - Container management (list, start, stop, create, remove) - Image management (list, pull, build, remove) - Command execution inside containers - Docker system information

## Methods

### checkDockerAvailability

Check if Docker is available and working

**Returns:** `Promise<boolean>`



### listContainers

List all containers (running and stopped)

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `options` | `{ all?: boolean }` |  | Parameter options |

**Returns:** `Promise<DockerContainer[]>`



### listImages

List all images

**Returns:** `Promise<DockerImage[]>`



### startContainer

Start a container

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `containerIdOrName` | `string` | ✓ | Parameter containerIdOrName |

**Returns:** `Promise<void>`



### stopContainer

Stop a container

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `containerIdOrName` | `string` | ✓ | Parameter containerIdOrName |

| `timeout` | `number` |  | Parameter timeout |

**Returns:** `Promise<void>`



### removeContainer

Remove a container

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `containerIdOrName` | `string` | ✓ | Parameter containerIdOrName |

| `options` | `{ force?: boolean }` |  | Parameter options |

**Returns:** `Promise<void>`



### runContainer

Create and run a new container

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `image` | `string` | ✓ | Parameter image |

| `options` | `{
      name?: string
      ports?: string[]
      volumes?: string[]
      environment?: Record<string, string>
      detach?: boolean
      interactive?: boolean
      tty?: boolean
      command?: string[]
      workdir?: string
      user?: string
      entrypoint?: string
      network?: string
      restart?: string
    }` |  | Parameter options |

**Returns:** `Promise<string>`



### execCommand

Execute a command inside a running container

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `containerIdOrName` | `string` | ✓ | Parameter containerIdOrName |

| `command` | `string[]` | ✓ | Parameter command |

| `options` | `{
      interactive?: boolean
      tty?: boolean
      user?: string
      workdir?: string
      detach?: boolean
    }` |  | Parameter options |

**Returns:** `Promise<{ stdout: string; stderr: string; exitCode: number }>`



### pullImage

Pull an image from a registry

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `image` | `string` | ✓ | Parameter image |

**Returns:** `Promise<void>`



### removeImage

Remove an image

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `imageIdOrName` | `string` | ✓ | Parameter imageIdOrName |

| `options` | `{ force?: boolean }` |  | Parameter options |

**Returns:** `Promise<void>`



### buildImage

Build an image from a Dockerfile

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `contextPath` | `string` | ✓ | Parameter contextPath |

| `options` | `{
      tag?: string
      dockerfile?: string
      buildArgs?: Record<string, string>
      target?: string
      nocache?: boolean
    }` |  | Parameter options |

**Returns:** `Promise<void>`



### getLogs

Get container logs

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `containerIdOrName` | `string` | ✓ | Parameter containerIdOrName |

| `options` | `{
      follow?: boolean
      tail?: number
      since?: string
      timestamps?: boolean
    }` |  | Parameter options |

**Returns:** `Promise<string>`



### getSystemInfo

Get Docker system information

**Returns:** `Promise<any>`



### prune

Prune unused Docker resources

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `options` | `{
    containers?: boolean
    images?: boolean
    volumes?: boolean
    networks?: boolean
    all?: boolean
    force?: boolean
  }` |  | Parameter options |

**Returns:** `Promise<void>`



### enable

Initialize the Docker feature

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `options` | `any` |  | Parameter options |

**Returns:** `Promise<this>`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `containers` | `array` | List of known Docker containers |

| `images` | `array` | List of known Docker images |

| `isDockerAvailable` | `boolean` | Whether Docker CLI is available on this system |

| `lastError` | `string` | Last error message from a Docker operation |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

| `dockerPath` | `string` | Path to docker executable |

| `timeout` | `number` | Command timeout in milliseconds |

| `autoRefresh` | `boolean` | Auto refresh containers/images after operations |

# features.runpod

Uses ssh to run commands, or scp to transfer files between a remote host.

## Methods

### createRemoteShell

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `podId` | `string` | ✓ | Parameter podId |

**Returns:** `void`



### getPodHttpURLs

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `podId` | `string` | ✓ | Parameter podId |

**Returns:** `void`



### listPods

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `detailed` | `any` |  | Parameter detailed |

**Returns:** `Promise<PodInfo[]>`



### getPodInfo

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `podId` | `string` | ✓ | Parameter podId |

**Returns:** `Promise<PodInfo>`



### listSecureGPUs

**Returns:** `void`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

# features.secureShell

Uses ssh to run commands, or scp to transfer files between a remote host.

## Methods

### testConnection

Test the SSH connection

**Returns:** `Promise<boolean>`



### exec

Executes a command on the remote host.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `command` | `string` | ✓ | Parameter command |

**Returns:** `Promise<string>`



### download

Downloads a file from the remote host.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `source` | `string` | ✓ | Parameter source |

| `target` | `string` | ✓ | Parameter target |

**Returns:** `Promise<string>`



### upload

Uploads a file to the remote host.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `source` | `string` | ✓ | Parameter source |

| `target` | `string` | ✓ | Parameter target |

**Returns:** `Promise<string>`



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `connected` | `boolean` | Whether an SSH connection is currently active |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `cached` | `boolean` | Whether to cache this feature instance |

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

| `host` | `string` | Remote host address |

| `port` | `number` | SSH port number (default: 22) |

| `username` | `string` | Username for SSH authentication |

| `password` | `string` | Password for SSH authentication |

| `key` | `string` | Path to SSH private key file |

# Servers

# servers.express

ExpressServer helper

## Methods

### start

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `options` | `StartOptions` |  | Parameter options |

**Returns:** `void`



### configure

**Returns:** `void`



## State

| Property | Type | Description |

|----------|------|-------------|

| `port` | `number` | The port the server is bound to |

| `listening` | `boolean` | Whether the server is actively listening for connections |

| `configured` | `boolean` | Whether the server has been configured |

| `stopped` | `boolean` | Whether the server has been stopped |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `port` | `number` | Port number to listen on |

| `host` | `string` | Hostname or IP address to bind to |

| `cors` | `boolean` | Whether to enable CORS middleware |

| `static` | `string` | Path to serve static files from |

| `create` | `any` | (app: Express, server: Server) => Express |

| `beforeStart` | `any` | (options: StartOptions, server: Server) => Promise<any> |

# servers.websocket

WebsocketServer helper

## Methods

### broadcast

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `message` | `any` | ✓ | Parameter message |

**Returns:** `void`



### send

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `ws` | `any` | ✓ | Parameter ws |

| `message` | `any` | ✓ | Parameter message |

**Returns:** `void`



### start

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `options` | `StartOptions` |  | Parameter options |

**Returns:** `void`



## Events

### connection

Event emitted by WebsocketServer



### message

Event emitted by WebsocketServer



## State

| Property | Type | Description |

|----------|------|-------------|

| `port` | `number` | The port the server is bound to |

| `listening` | `boolean` | Whether the server is actively listening for connections |

| `configured` | `boolean` | Whether the server has been configured |

| `stopped` | `boolean` | Whether the server has been stopped |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `port` | `number` | Port number to listen on |

| `host` | `string` | Hostname or IP address to bind to |

| `json` | `boolean` | Whether to automatically JSON parse/stringify messages |

# Clients

# clients.rest

No description provided

## State

| Property | Type | Description |

|----------|------|-------------|

| `connected` | `boolean` | Whether the client is currently connected |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `baseURL` | `string` | Base URL for the client connection |

| `json` | `boolean` | Whether to automatically parse responses as JSON |

# clients.graph

No description provided

## State

| Property | Type | Description |

|----------|------|-------------|

| `connected` | `boolean` | Whether the client is currently connected |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `baseURL` | `string` | Base URL for the client connection |

| `json` | `boolean` | Whether to automatically parse responses as JSON |

# clients.websocket

No description provided

## State

| Property | Type | Description |

|----------|------|-------------|

| `connected` | `boolean` | Whether the client is currently connected |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `name` | `string` | Optional name identifier for this helper instance |

| `_cacheKey` | `string` | Internal cache key used for instance deduplication |

| `baseURL` | `string` | Base URL for the client connection |

| `json` | `boolean` | Whether to automatically parse responses as JSON |
