# Creating Your Own Features

This tutorial will guide you through creating custom features for the Luca framework. Features are pluggable functionality modules that extend your container's capabilities and can be enabled/disabled as needed.

## Understanding Features

Features in Luca are classes that extend the base `Feature` class, which itself extends the `Helper` class. This gives features:

- **Observable state management** via `this.state`
- **Event system** for communication
- **Container access** for interacting with other features
- **Automatic caching** and lifecycle management
- **Runtime introspection** capabilities

## Basic Feature Structure

Here's the essential structure every feature needs:

```typescript
import { Feature, type FeatureState, type FeatureOptions, features } from '../feature.js'

// 1. Define your feature's state interface
export interface MyFeatureState extends FeatureState {
  customProperty: string
  isReady: boolean
}

// 2. Define your feature's options interface  
export interface MyFeatureOptions extends FeatureOptions {
  apiKey?: string
  timeout?: number
}

// 3. Implement your feature class
export class MyFeature extends Feature<MyFeatureState, MyFeatureOptions> {
  // Required: Define the shortcut path for container access
  static override shortcut = 'features.myFeature' as const
  
  // Optional: Set default state
  get initialState(): MyFeatureState {
    return {
      ...super.initialState, // Always include the base state
      customProperty: 'default',
      isReady: false
    }
  }

  // Your feature's functionality
  async doSomething() {
    this.state.set('isReady', true)
    this.emit('ready')
    return 'success'
  }
}

// 4. Register your feature
export default features.register('myFeature', MyFeature)

// 5. Add TypeScript support via module augmentation
declare module '../feature.js' {
  interface AvailableFeatures {
    myFeature: typeof MyFeature
  }
}
```

## Step-by-Step Example: Creating a Logger Feature

Let's create a practical example - a logging feature that can write to different outputs:

### Step 1: Define the Interfaces

```typescript
// src/features/logger.ts
import { Feature, type FeatureState, type FeatureOptions, features } from '../feature.js'

export interface LoggerState extends FeatureState {
  logCount: number
  outputs: string[]
}

export interface LoggerOptions extends FeatureOptions {
  level?: 'debug' | 'info' | 'warn' | 'error'
  outputs?: ('console' | 'file')[]
  filename?: string
}
```

### Step 2: Implement the Feature Class

```typescript
export class Logger extends Feature<LoggerState, LoggerOptions> {
  static override shortcut = 'features.logger' as const
  
  get initialState(): LoggerState {
    return {
      ...super.initialState,
      logCount: 0,
      outputs: this.options.outputs || ['console']
    }
  }

  private logLevels = {
    debug: 0,
    info: 1, 
    warn: 2,
    error: 3
  }

  private shouldLog(level: string): boolean {
    const currentLevel = this.options.level || 'info'
    return this.logLevels[level] >= this.logLevels[currentLevel]
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString()
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`
  }

  async log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) {
    if (!this.shouldLog(level)) return

    const formatted = this.formatMessage(level, message)
    const outputs = this.state.get('outputs')

    // Increment log count
    this.state.set('logCount', this.state.get('logCount') + 1)

    // Output to configured destinations
    if (outputs.includes('console')) {
      console[level](formatted, data || '')
    }

    if (outputs.includes('file') && this.options.filename) {
      // Use the container's fs feature if available
      if (this.container.fs) {
        await this.container.fs.appendFile(this.options.filename, formatted + '\n')
      }
    }

    // Emit event for other features to listen to
    this.emit('logged', { level, message, data, count: this.state.get('logCount') })
  }

  // Convenience methods
  debug(message: string, data?: any) { return this.log('debug', message, data) }
  info(message: string, data?: any) { return this.log('info', message, data) }
  warn(message: string, data?: any) { return this.log('warn', message, data) }
  error(message: string, data?: any) { return this.log('error', message, data) }

  // Get statistics
  get stats() {
    return {
      totalLogs: this.state.get('logCount'),
      outputs: this.state.get('outputs'),
      level: this.options.level || 'info'
    }
  }
}
```

### Step 3: Register and Export

```typescript
// Register the feature
export default features.register('logger', Logger)

// Add TypeScript support
declare module '../feature.js' {
  interface AvailableFeatures {
    logger: typeof Logger
  }
}
```

## Advanced Patterns

### Auto-Attachment with Static Methods

For features that should automatically attach to specific container types:

```typescript
export class MyNodeFeature extends Feature {
  static override shortcut = 'features.myNodeFeature' as const
  
  // Automatically attach to Node containers
  static attach(container: NodeContainer) {
    container.feature('myNodeFeature', { enable: true })
  }
}
```

### State Synchronization Between Features

```typescript
export class SyncedFeature extends Feature {
  async enable() {
    await super.enable()
    
    // Listen to other features
    if (this.container.logger) {
      this.container.logger.on('logged', (logData) => {
        this.state.set('lastLogTime', Date.now())
      })
    }
    
    return this
  }
}
```

### Async Initialization with Dependencies

```typescript
export class DatabaseFeature extends Feature<DatabaseState, DatabaseOptions> {
  private connection: any = null

  async enable() {
    // Wait for required features
    if (!this.container.vault) {
      await this.container.feature('vault', { enable: true })
    }

    // Initialize with dependencies
    const credentials = await this.container.vault.decrypt(this.options.encryptedCredentials)
    this.connection = await this.connectToDatabase(credentials)
    
    this.state.set('connected', true)
    await super.enable()
    
    return this
  }

  private async connectToDatabase(credentials: string) {
    // Database connection logic
  }
}
```

## Using Your Features

Once registered, you can use your features in several ways:

### Method 1: Factory Pattern

```typescript
import container from './container'

// Create and enable manually
const logger = container.feature('logger', { 
  level: 'debug',
  outputs: ['console', 'file'],
  filename: 'app.log',
  enable: true 
})

await logger.info('Application started')
```

### Method 2: Auto-Enable with Use

```typescript
// Auto-enable and attach to container
container.use('logger', { level: 'info' })

// Now accessible directly on container
container.logger.info('Hello world')
```

### Method 3: Programmatic Enable

```typescript
const logger = container.feature('logger', { level: 'warn' })
await logger.enable()
logger.error('Something went wrong')
```

## Testing Your Features

Features can be tested in isolation:

```typescript
// test/logger.test.ts
import { Logger } from '../src/features/logger'
import { Container } from '../src/container'

describe('Logger Feature', () => {
  let container: Container
  let logger: Logger

  beforeEach(() => {
    container = new Container({})
    logger = container.feature('logger', { level: 'debug' })
  })

  it('should track log count', async () => {
    await logger.info('test message')
    expect(logger.state.get('logCount')).toBe(1)
  })

  it('should emit events on log', async () => {
    const loggedSpy = jest.fn()
    logger.on('logged', loggedSpy)
    
    await logger.info('test')
    expect(loggedSpy).toHaveBeenCalledWith({
      level: 'info',
      message: 'test',
      data: undefined,
      count: 1
    })
  })
})
```

## Best Practices

### 1. State Management
- Always extend the base state interfaces
- Use meaningful property names
- Update state atomically
- Emit events on significant state changes

### 2. Error Handling
- Emit 'error' events for failures
- Provide meaningful error context
- Handle async operations properly

### 3. Dependencies
- Check for required features in `enable()`
- Use container context to access other features
- Fail gracefully if dependencies are missing

### 4. Performance
- Leverage the automatic caching system
- Don't perform heavy operations in constructors
- Use state observation judiciously

### 5. Documentation
- Use TypeScript interfaces for self-documentation
- Add JSDoc comments for complex methods
- Provide usage examples in comments

## Platform-Specific Features

### Node.js Features

```typescript
// src/node/features/database.ts
import { Feature } from '../../feature.js'
import { NodeContainer } from '../container.js'

export class Database extends Feature {
  static attach(container: NodeContainer) {
    // Node-specific setup
    container.feature('database', { enable: true })
  }
  
  // Node-specific functionality using fs, networking, etc.
}
```

### Web Features

```typescript
// src/web/features/storage.ts  
import { Feature } from '../../feature.js'
import { WebContainer } from '../container.js'

export class LocalStorage extends Feature {
  static attach(container: WebContainer) {
    // Web-specific setup
    container.feature('localStorage', { enable: true })
  }
  
  // Browser-specific functionality using localStorage, IndexedDB, etc.
}
```

## Conclusion

Creating features in Luca follows a consistent pattern:

1. **Define interfaces** for state and options
2. **Extend Feature class** with proper generics
3. **Implement functionality** using state, events, and container access
4. **Register the feature** in the registry
5. **Add TypeScript support** via module augmentation

Features are powerful building blocks that can:
- Maintain observable state
- Communicate via events
- Access other container features
- Be introspected at runtime
- Work across different platforms

Start with simple features and gradually add complexity as needed. The framework's consistent patterns make it easy to build sophisticated functionality while maintaining clean, testable code.