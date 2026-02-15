---
title: Features Overview
tags: [features, built-in, fs, git, proc, vm, ui, networking, os, diskCache]
---

# Features Overview

Features are the core building blocks in Luca. A feature is a thing that emits events, has observable state, and provides an interface for doing something meaningful. The container comes with many built-in features.

## Using Features

```typescript
// Auto-enabled features have shortcuts
container.fs          // File system
container.git         // Git operations
container.proc        // Process execution
container.vm          // JavaScript VM
container.ui          // Terminal UI
container.os          // OS info
container.networking  // Port utilities

// On-demand features are created through the factory
const cache = container.feature('diskCache', { path: './.cache' })
const db = container.feature('contentDb', { rootPath: './docs' })
```

## Built-In Feature Reference

### fs -- File System

Read, write, and navigate the file system:

```typescript
const fs = container.fs

// Read files
const content = await fs.readFile('./README.md')
const json = await fs.readJson('./package.json')

// Write files
await fs.writeFile('./output.txt', 'Hello')
await fs.writeJson('./config.json', { key: 'value' })

// Check existence
fs.exists('./path/to/file')

// Walk directories
const files = await fs.walk('./src', { extensions: ['.ts'] })

// Find files upward
const configPath = await fs.findUp('tsconfig.json')
```

### git -- Git Operations

Work with git repositories:

```typescript
const git = container.git

const branch = await git.branch()          // Current branch name
const sha = await git.sha()                // Current commit SHA
const status = await git.status()           // Working tree status
const files = await git.lsFiles()           // List tracked files
```

### proc -- Process Execution

Run external processes:

```typescript
const proc = container.feature('proc')

// Execute and get output
const result = await proc.exec('ls', ['-la'])

// Execute with options
const result = await proc.exec('npm', ['test'], {
  cwd: '/path/to/project',
  env: { NODE_ENV: 'test' },
})
```

### vm -- JavaScript VM

Execute JavaScript in an isolated context:

```typescript
const vm = container.vm

const result = await vm.run('1 + 2 + 3')  // 6

const greeting = await vm.run('`Hello ${name}!`', { name: 'World' })
// 'Hello World!'

// The VM has access to the container context by default
const files = await vm.run('container.fs.walk("./src")')
```

### ui -- Terminal UI

Colors, prompts, and formatted output:

```typescript
const ui = container.ui

// Colors
ui.colors.green('Success!')
ui.colors.red('Error!')
ui.colors.yellow('Warning!')

// ASCII art
await ui.figlet('My App')

// Render markdown in the terminal
ui.markdown('# Hello\n\nThis is **bold**')
```

### networking -- Port Utilities

```typescript
const net = container.networking

// Find an available port
const port = await net.findOpenPort(3000)

// Check if a port is available
const available = await net.isPortAvailable(8080)
```

### os -- System Info

```typescript
const os = container.os

os.platform   // 'darwin', 'linux', 'win32'
os.arch       // 'x64', 'arm64'
os.cpus       // CPU info
os.tmpdir     // Temp directory path
```

### diskCache -- Disk-Based Cache

```typescript
const cache = container.feature('diskCache', { path: './.cache' })

await cache.set('key', { data: 'value' })
const data = await cache.get('key')
await cache.has('key')
await cache.delete('key')
```

### contentDb -- Markdown as a Database

Turn markdown folders into queryable collections. See the dedicated [ContentDb tutorial](./09-contentbase.md).

### fileManager -- Batch File Operations

```typescript
const fm = container.feature('fileManager')
// Batch read, write, copy, move operations
```

### grep -- Search File Contents

```typescript
const grep = container.feature('grep')
const results = await grep.search('./src', { pattern: /TODO/, extensions: ['.ts'] })
```

### tmux -- Terminal Multiplexer

```typescript
const tmux = container.feature('tmux')
const session = await tmux.createSession('my-session')
const layout = await session.split('horizontal')
const [left, right] = layout.panes
await left!.run('bun run dev')
await right!.run('bun test --watch')
```

### docker -- Docker Operations

```typescript
const docker = container.feature('docker')
// Build, run, manage containers
```

## Discovering Features

Don't memorize this list. You can always discover what's available at runtime:

```typescript
// List all registered features
container.features.available

// Get documentation for any feature
container.features.describe('diskCache')

// Get docs for everything
container.features.describeAll()

// Introspect a feature's full API
container.features.introspect('fs')
```
