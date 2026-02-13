# Defining Your Own Features

Features are the building blocks of a Luca container. They're the primary way you encapsulate functionality — filesystem access, git operations, caching, AI conversations — each one is a Feature.

This tutorial walks through creating your own features from scratch.

## Anatomy of a Feature

A Feature is a class that:
1. Extends `Feature` (which extends `Helper`)
2. Has a static `shortcut` that identifies it in the registry
3. Has observable `state` and emits `events`
4. Gets registered in the `features` registry
5. Gets created through `container.feature()`, never directly

Here's the minimal skeleton:

```ts
import { Feature, features } from '@/feature'
import type { FeatureState, FeatureOptions } from '@/feature'

export class Timer extends Feature {
  static override shortcut = 'features.timer' as const
}

features.register('timer', Timer)
```

That's a valid feature. You can now do:

```ts
const timer = container.feature('timer')
timer.isEnabled // false (not enabled yet)
await timer.enable()
timer.isEnabled // true
```

## Adding TypeScript Autocomplete

Use module augmentation so that `container.feature('timer')` is fully typed:

```ts
declare module '@/feature' {
  interface AvailableFeatures {
    timer: typeof Timer
  }
}
```

Now `container.feature('timer')` returns `Timer` with full IntelliSense.

## Defining State

Features track their state through an observable `State` object. Define what your feature's state looks like by overriding `initialState`:

```ts
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@/schemas/base'

export const TimerStateSchema = FeatureStateSchema.extend({
  running: z.boolean().describe('Whether the timer is currently running'),
  elapsed: z.number().describe('Elapsed time in milliseconds'),
})

export const TimerOptionsSchema = FeatureOptionsSchema.extend({
  interval: z.number().optional().describe('Tick interval in ms'),
})

export type TimerState = z.infer<typeof TimerStateSchema>
export type TimerOptions = z.infer<typeof TimerOptionsSchema>

export class Timer extends Feature<TimerState, TimerOptions> {
  static override shortcut = 'features.timer' as const
  static override stateSchema = TimerStateSchema
  static override optionsSchema = TimerOptionsSchema

  override get initialState(): TimerState {
    return {
      ...super.initialState,
      running: false,
      elapsed: 0,
    }
  }
}
```

The Zod schemas serve double duty: they validate state at development time and they power the introspection system so that the runtime can describe your feature's interface.

## Defining Options

Options are passed when creating the feature via `container.feature('timer', options)`. They're available on `this.options`:

```ts
const timer = container.feature('timer', { interval: 100 })
timer.options.interval // 100
```

The `FeatureOptions` base provides `name`, `cached`, and `enable` out of the box.

## Adding Behavior

Use `afterInitialize()` instead of overriding the constructor — it's cleaner and the container context is already wired up:

```ts
export class Timer extends Feature<TimerState, TimerOptions> {
  static override shortcut = 'features.timer' as const
  static override stateSchema = TimerStateSchema
  static override optionsSchema = TimerOptionsSchema

  private _interval?: ReturnType<typeof setInterval>

  override get initialState(): TimerState {
    return { ...super.initialState, running: false, elapsed: 0 }
  }

  start() {
    if (this.state.get('running')) return this

    const tick = this.options.interval || 1000
    this.state.set('running', true)
    this.emit('started')

    this._interval = setInterval(() => {
      const elapsed = (this.state.get('elapsed') || 0) + tick
      this.state.set('elapsed', elapsed)
      this.emit('tick', elapsed)
    }, tick)

    return this
  }

  stop() {
    if (!this.state.get('running')) return this

    clearInterval(this._interval!)
    this.state.set('running', false)
    this.emit('stopped', this.state.get('elapsed'))

    return this
  }

  reset() {
    this.stop()
    this.state.set('elapsed', 0)
    this.emit('reset')
    return this
  }
}
```

## Accessing the Container

Every feature has access to its parent container and all other enabled features through `this.container` and `this.context`:

```ts
export class Timer extends Feature<TimerState, TimerOptions> {
  // ...

  async saveElapsed() {
    // Access other features through the container
    const cache = this.container.feature('diskCache')
    await cache.set('timer:elapsed', this.state.get('elapsed'))
  }

  logWithColor(msg: string) {
    // Access auto-enabled features directly
    const ui = this.container.ui
    console.log(ui.colorize('green', msg))
  }
}
```

## Events

Features are event emitters. Consumers listen to your events:

```ts
const timer = container.feature('timer')
timer.on('tick', (elapsed) => console.log(`${elapsed}ms`))
timer.on('stopped', (elapsed) => console.log(`Final: ${elapsed}ms`))
timer.start()

// Or wait for a specific event
const elapsed = await timer.waitFor('stopped')
```

State changes also automatically emit a `stateChange` event:

```ts
timer.on('stateChange', (newState) => {
  console.log('State updated:', newState)
})
```

## The `enable()` Lifecycle

When `enable()` is called (or `{ enable: true }` is passed in options), the feature:

1. Attaches itself as a getter on the container (`container.timer`)
2. Emits an `'enabled'` event
3. Sets `state.enabled = true`
4. Notifies the container via `'featureEnabled'` event

You can override `enable()` to add setup logic:

```ts
override async enable(options: any = {}) {
  // Do your setup
  await this.loadConfig()
  // Then call super to complete the enable flow
  return super.enable(options)
}
```

## Hiding Internal Properties

For a cleaner REPL experience, hide properties that shouldn't show up when inspecting:

```ts
override afterInitialize() {
  this.hide('_interval', '_internalStuff')
}
```

## Full Example: A Logger Feature

Here's a complete, practical feature:

```ts
// src/node/features/logger.ts
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@/schemas/base'
import { Feature, features } from '@/feature'

declare module '@/feature' {
  interface AvailableFeatures {
    logger: typeof Logger
  }
}

export const LoggerOptionsSchema = FeatureOptionsSchema.extend({
  level: z.enum(['debug', 'info', 'warn', 'error']).optional().describe('Minimum log level'),
  prefix: z.string().optional().describe('Prefix for log messages'),
})

export const LoggerStateSchema = FeatureStateSchema.extend({
  messageCount: z.number().describe('Total messages logged'),
  level: z.string().describe('Current log level'),
})

export type LoggerOptions = z.infer<typeof LoggerOptionsSchema>
export type LoggerState = z.infer<typeof LoggerStateSchema>

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }

export class Logger extends Feature<LoggerState, LoggerOptions> {
  static override shortcut = 'features.logger' as const
  static override stateSchema = LoggerStateSchema
  static override optionsSchema = LoggerOptionsSchema

  override get initialState(): LoggerState {
    return {
      ...super.initialState,
      messageCount: 0,
      level: this.options.level || 'info',
    }
  }

  private shouldLog(level: keyof typeof LEVELS): boolean {
    const current = this.state.get('level') as keyof typeof LEVELS
    return LEVELS[level] >= LEVELS[current]
  }

  private log(level: keyof typeof LEVELS, ...args: any[]) {
    if (!this.shouldLog(level)) return

    const prefix = this.options.prefix ? `[${this.options.prefix}]` : ''
    const count = (this.state.get('messageCount') || 0) + 1
    this.state.set('messageCount', count)

    console[level](`${prefix}[${level.toUpperCase()}]`, ...args)
    this.emit('message', { level, args, count })
  }

  debug(...args: any[]) { this.log('debug', ...args) }
  info(...args: any[])  { this.log('info', ...args) }
  warn(...args: any[])  { this.log('warn', ...args) }
  error(...args: any[]) { this.log('error', ...args) }

  setLevel(level: keyof typeof LEVELS) {
    this.state.set('level', level)
  }
}

features.register('logger', Logger)
```

Import it in your container setup (e.g., `src/node/container.ts`) and use it:

```ts
const log = container.feature('logger', { prefix: 'app', level: 'debug', enable: true })
log.info('Server starting...')
log.debug('Config loaded:', config)
log.on('message', ({ level, count }) => {
  if (count % 100 === 0) console.log(`Logged ${count} messages`)
})
```

## Using the Scaffold Script

Luca includes a scaffold generator that creates boilerplate for you:

```bash
bun run scripts/scaffold
```

It will walk you through a wizard to generate a feature, client, or server with all the right patterns in place.

## Key Patterns to Remember

- **Always extend `Feature`** — never `Helper` directly for features
- **Always register** via `features.register('name', YourClass)`
- **Never instantiate directly** — always use `container.feature('name')`
- **Use `afterInitialize()`** instead of overriding the constructor
- **Define Zod schemas** for state and options to power introspection
- **Use module augmentation** for TypeScript autocomplete
- **Return `this`** from methods to enable chaining

## Next Steps

- [Creating REST Clients](./rest-clients.md) — the `Client` pattern for API integrations
- [Creating Express Servers](./express-server.md) — the `Server` pattern for HTTP
- [How We Built the AGI Container](./building-the-agi-container.md) — features in the real world
