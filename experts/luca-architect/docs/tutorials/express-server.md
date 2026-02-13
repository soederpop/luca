# Creating Your Own Express Server

Luca's `Server` system gives you a managed way to run HTTP servers. The built-in `ExpressServer` wraps Express.js with automatic port management, CORS, middleware, and hook points — all wired into the container's state and event system.

## Quick Start

```ts
import container from '@/node'
import '@/servers/express'

const web = container.server('express', { port: 3000 })

web.app.get('/hello', (req, res) => {
  res.json({ message: 'Hello from Luca!' })
})

await web.start()
console.log(`Listening on port ${web.port}`)
```

That's a running Express server with CORS, JSON parsing, and URL-encoded body parsing all configured automatically.

## What You Get for Free

When you create an `ExpressServer`, it automatically configures:

- **CORS** middleware (disable with `cors: false`)
- **JSON body parsing** (500mb limit)
- **URL-encoded body parsing** (500mb limit, 50k param limit)
- **Static file serving** (if you pass a `static` path)

## Server Options

```ts
const web = container.server('express', {
  port: 8080,                // Port to listen on (default 3000)
  host: '0.0.0.0',          // Host to bind to (default '0.0.0.0')
  cors: true,               // Enable CORS (default true)
  static: './public',        // Serve static files from this directory
  create: (app, server) => { // Hook to customize the Express app
    // add routes, middleware, etc.
    return app
  },
  beforeStart: async (options, server) => { // Hook that runs before listening
    // run migrations, warm caches, etc.
  }
})
```

## The `create` Hook

The `create` hook is the primary way to configure your Express app. It receives the Express app and the server instance, and should return the app:

```ts
const web = container.server('express', {
  port: 3000,
  create: (app, server) => {
    // Add middleware
    app.use((req, res, next) => {
      console.log(`${req.method} ${req.path}`)
      next()
    })

    // Add routes
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', uptime: process.uptime() })
    })

    app.get('/api/features', (req, res) => {
      res.json({ features: server.container.features.available })
    })

    return app
  }
})

await web.start()
```

## The `beforeStart` Hook

The `beforeStart` hook runs just before the server starts listening. It's async, so you can do setup work:

```ts
const web = container.server('express', {
  port: 3000,
  beforeStart: async (options, server) => {
    // Initialize database connections
    await setupDatabase()

    // Warm the cache
    const cache = server.container.feature('diskCache')
    await cache.set('serverStarted', Date.now())
  },
  create: (app) => {
    app.get('/', (req, res) => res.json({ ready: true }))
    return app
  }
})

await web.start()
```

## Server State

Every server has observable state:

```ts
const web = container.server('express', { port: 3000 })

web.isListening   // false
web.isConfigured  // false
web.isStopped     // false
web.port          // 3000

await web.start()

web.isListening   // true
web.port          // 3000

// Observe state changes
web.state.observe(() => {
  console.log('Server state:', web.state.current)
})
```

## Accessing the Express App Directly

The `app` getter gives you the raw Express instance for full control:

```ts
const web = container.server('express', { port: 3000 })

// The full Express API is available
web.app.get('/users', handler)
web.app.post('/users', handler)
web.app.use('/api', apiRouter)
web.app.set('view engine', 'ejs')

// Access Express itself for creating routers, etc.
const router = web.express.Router()
router.get('/', (req, res) => res.json({ ok: true }))
web.app.use('/v1', router)
```

## Port Management

Servers can auto-find open ports through the container's `networking` feature:

```ts
const web = container.server('express', { port: 3000 })

// configure() checks if the port is available and finds an alternative if not
await web.configure()
console.log(web.port) // might be 3001 if 3000 was taken

await web.start()
```

## Building a Custom Server Subclass

For more structured apps, extend `ExpressServer`:

```ts
// src/servers/api-server.ts
import { z } from 'zod'
import { servers } from '@/server/server'
import { ExpressServer, type ExpressServerOptions } from '@/servers/express'
import type { ServerState } from '@/server/server'
import type { ContainerContext } from '@/container'
import { ServerStateSchema } from '@/schemas/base'

declare module '@/server/index' {
  interface AvailableServers {
    api: typeof ApiServer
  }
}

export const ApiServerOptionsSchema = z.object({
  port: z.number().optional(),
  host: z.string().optional(),
  apiPrefix: z.string().optional().describe('URL prefix for all API routes'),
})

export type ApiServerOptions = z.infer<typeof ApiServerOptionsSchema>

export interface ApiServerState extends ServerState {
  requestCount: number
}

export class ApiServer extends ExpressServer<ApiServerState, ApiServerOptions & ExpressServerOptions> {
  static override shortcut = 'servers.api' as const

  override get initialState(): ApiServerState {
    return {
      ...super.initialState,
      requestCount: 0,
    }
  }

  get apiPrefix() {
    return this.options.apiPrefix || '/api'
  }

  override get hooks() {
    const server = this

    return {
      ...super.hooks,
      create: (app: any) => {
        // Request counting middleware
        app.use((req: any, res: any, next: any) => {
          const count = (server.state.get('requestCount') || 0) + 1
          server.state.set('requestCount', count)
          server.emit('request', { method: req.method, path: req.path, count })
          next()
        })

        // Error handler
        app.use((err: any, req: any, res: any, next: any) => {
          server.emit('error', err)
          res.status(500).json({ error: err.message })
        })

        return app
      }
    }
  }

  /**
   * Register a route group under the API prefix.
   */
  route(path: string, handler: (router: any) => void) {
    const router = this.express.Router()
    handler(router)
    this.app.use(`${this.apiPrefix}${path}`, router)
    return this
  }
}

servers.register('api', ApiServer)
```

Usage:

```ts
import '@/servers/api-server'

const api = container.server('api', {
  port: 4000,
  apiPrefix: '/v1',
})

api.route('/users', (router) => {
  router.get('/', (req, res) => res.json([]))
  router.post('/', (req, res) => res.json(req.body))
})

api.route('/posts', (router) => {
  router.get('/', (req, res) => res.json([]))
})

api.on('request', ({ method, path, count }) => {
  console.log(`#${count}: ${method} ${path}`)
})

await api.start()
```

## Combining with Features

The real power comes from wiring servers up with the container's features:

```ts
const web = container.server('express', {
  port: 3000,
  create: (app, server) => {
    const { git, fs, os } = server.container

    app.get('/api/status', (req, res) => {
      res.json({
        branch: git.branch,
        platform: os.platform,
        cwd: server.container.cwd,
        features: server.container.features.available,
      })
    })

    app.get('/api/files', (req, res) => {
      const pattern = req.query.pattern as string || '**/*.ts'
      const files = fs.glob(pattern)
      res.json({ files })
    })

    return app
  }
})

await web.start()
```

## Server Caching

Like features and clients, servers are cached by their options:

```ts
const a = container.server('express', { port: 3000 })
const b = container.server('express', { port: 3000 })
a === b // true

const c = container.server('express', { port: 4000 })
a === c // false
```

## Static File Serving

Serve a directory of static files:

```ts
const web = container.server('express', {
  port: 3000,
  static: container.paths.resolve('public'),
})

await web.start()
// Files in ./public are now served at /
```

## Next Steps

- [WebSocket Communication](./websocket-communication.md) — add real-time messaging to your server
- [Building for the Browser](./building-for-the-browser.md) — serve a WebContainer-powered frontend
- [The Shapeshifter](./the-shapeshifter.md) — Express + WebSocket + browser in one full-stack demo
- [How We Built the AGI Container](./building-the-agi-container.md) — see servers, clients, and features all working together
