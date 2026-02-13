# Exposing an Express Server to the Public with ngrok

In this tutorial, we'll define a custom Express server, start it on a local port, and then use Luca's `portExposer` feature to tunnel it through ngrok — giving it a public HTTPS URL that anyone on the internet can reach.

This is useful for sharing local dev servers, testing webhooks, demoing work to clients, or letting an AI agent expose an API it just built.

## What We're Building

1. A custom `ExpressServer` subclass with some API routes
2. Start it locally
3. Use the `portExposer` feature to get a public ngrok URL
4. React to connection events and state changes

## Step 1: Define a Custom Express Server

Let's build a small API server. We'll subclass `ExpressServer` so we can add structured routes and request tracking.

```ts
// src/servers/demo-api.ts
import { z } from 'zod'
import { servers, type ServerState } from '@/server/server'
import { ExpressServer, type ExpressServerOptions } from '@/servers/express'
import { ServerStateSchema } from '@/schemas/base'

declare module '@/server/index' {
  interface AvailableServers {
    demoApi: typeof DemoApiServer
  }
}

export const DemoApiStateSchema = ServerStateSchema.extend({
  requestCount: z.number().default(0),
  publicUrl: z.string().optional(),
})

export type DemoApiState = z.infer<typeof DemoApiStateSchema>

export class DemoApiServer extends ExpressServer<DemoApiState, ExpressServerOptions> {
  static override shortcut = 'servers.demoApi' as const

  override get initialState(): DemoApiState {
    return {
      ...super.initialState,
      requestCount: 0,
    }
  }

  override get hooks() {
    const server = this

    return {
      create(app: any) {
        // Request counter middleware
        app.use((req: any, res: any, next: any) => {
          const count = (server.state.get('requestCount') || 0) + 1
          server.state.set('requestCount', count)
          next()
        })

        // Routes
        app.get('/api/status', (req: any, res: any) => {
          res.json({
            status: 'ok',
            requests: server.state.get('requestCount'),
            publicUrl: server.state.get('publicUrl') || null,
            uptime: process.uptime(),
          })
        })

        app.get('/api/features', (req: any, res: any) => {
          res.json({
            features: server.container.features.available,
            enabled: server.container.enabledFeatureIds,
          })
        })

        app.post('/api/echo', (req: any, res: any) => {
          res.json({ echo: req.body })
        })

        return app
      },

      beforeStart() {},
    }
  }
}

servers.register('demoApi', DemoApiServer)
```

## Step 2: Start the Server

```ts
// scripts/expose-demo.ts
import container from '@/node'
import '@/servers/demo-api'

const server = container.server('demoApi', { port: 3000 })

await server.start()
console.log(`Local server running at http://localhost:${server.port}`)
```

At this point you've got a working Express server on port 3000. But it's only reachable on your machine.

## Step 3: Expose It with ngrok

The `portExposer` feature wraps the `@ngrok/ngrok` SDK. Enable it, point it at your server's port, and call `expose()`:

```ts
// scripts/expose-demo.ts
import container from '@/node'
import '@/servers/demo-api'

// Start the Express server
const server = container.server('demoApi', { port: 3000 })
await server.start()
console.log(`Local server running at http://localhost:${server.port}`)

// Expose it to the public
const exposer = container.feature('portExposer', { port: server.port })
const publicUrl = await exposer.expose()

console.log(`Public URL: ${publicUrl}`)
console.log(`Try it:    ${publicUrl}/api/status`)

// Store the public URL in the server's state so the /api/status route can report it
server.state.set('publicUrl', publicUrl)
```

Run it:

```bash
bun run scripts/expose-demo.ts
```

Output:

```
Local server running at http://localhost:3000
Public URL: https://a1b2c3d4.ngrok-free.app
Try it:    https://a1b2c3d4.ngrok-free.app/api/status
```

That HTTPS URL is live on the internet. Anyone can hit it and the traffic tunnels to your local Express server.

## Step 4: Reacting to Events

Both the server and the port exposer emit events and have observable state. Wire them together:

```ts
// Watch for new connections and requests
server.state.observe(() => {
  const count = server.state.get('requestCount')
  if (count && count % 10 === 0) {
    console.log(`Milestone: ${count} requests served`)
  }
})

// Listen for ngrok lifecycle events
exposer.on('exposed', ({ publicUrl, localPort }) => {
  console.log(`Tunnel open: ${publicUrl} -> localhost:${localPort}`)
})

exposer.on('closed', () => {
  console.log('Tunnel closed')
})

exposer.on('error', (err) => {
  console.error('Tunnel error:', err.message)
})
```

## Step 5: Inspecting Connection State

The port exposer tracks everything in observable state:

```ts
const info = exposer.getConnectionInfo()
// {
//   connected: true,
//   publicUrl: 'https://a1b2c3d4.ngrok-free.app',
//   localPort: 3000,
//   connectedAt: 2025-01-15T...,
//   sessionInfo: { authToken: '...', region: 'us', subdomain: undefined }
// }

exposer.isConnected()          // true
exposer.getPublicUrl()         // 'https://a1b2c3d4.ngrok-free.app'
exposer.state.get('localPort') // 3000
```

## ngrok Configuration Options

The `portExposer` supports the full range of ngrok features:

### Authentication Token

For higher rate limits and premium features, pass your ngrok auth token:

```ts
const exposer = container.feature('portExposer', {
  port: 3000,
  authToken: process.env.NGROK_AUTH_TOKEN,
})
```

### Custom Subdomain (Paid Plans)

```ts
const exposer = container.feature('portExposer', {
  port: 3000,
  authToken: process.env.NGROK_AUTH_TOKEN,
  subdomain: 'my-demo-app',
})

const url = await exposer.expose()
// https://my-demo-app.ngrok-free.app
```

### Custom Domain (Paid Plans)

```ts
const exposer = container.feature('portExposer', {
  port: 3000,
  authToken: process.env.NGROK_AUTH_TOKEN,
  domain: 'demo.mycompany.com',
})
```

### Region Selection

Route through a specific region for lower latency:

```ts
const exposer = container.feature('portExposer', {
  port: 3000,
  region: 'eu', // us, eu, ap, au, sa, jp, in
})
```

### Basic Auth Protection

Protect the tunnel with a username and password:

```ts
const exposer = container.feature('portExposer', {
  port: 3000,
  authToken: process.env.NGROK_AUTH_TOKEN,
  basicAuth: 'admin:secretpassword',
})
```

### OAuth Protection

Gate access behind an OAuth provider:

```ts
const exposer = container.feature('portExposer', {
  port: 3000,
  authToken: process.env.NGROK_AUTH_TOKEN,
  oauth: 'google',
})
```

## Reconnecting with Different Options

Need to change the tunnel configuration without restarting the server? Use `reconnect()`:

```ts
// Start on the default region
const url = await exposer.expose()
console.log(url) // https://abc123.ngrok-free.app

// Switch to EU region
const newUrl = await exposer.reconnect({ region: 'eu' })
console.log(newUrl) // https://def456.eu.ngrok-free.app
```

This closes the old tunnel and opens a new one.

## Graceful Shutdown

Close the tunnel when you're done:

```ts
// Close just the tunnel (server keeps running locally)
await exposer.close()
exposer.isConnected() // false

// Or shut everything down
await exposer.close()
await server.stop()
```

## Complete Script

Here's the full working example:

```ts
// scripts/expose-demo.ts
import container from '@/node'
import '@/servers/demo-api'

const { ui } = container

// Start local server
const server = container.server('demoApi', { port: 3000 })
await server.start()
console.log(ui.colorize('green', `Local server on http://localhost:${server.port}`))

// Expose via ngrok
const exposer = container.feature('portExposer', {
  port: server.port,
  authToken: process.env.NGROK_AUTH_TOKEN,
})

exposer.on('exposed', ({ publicUrl }) => {
  server.state.set('publicUrl', publicUrl)
  console.log(ui.colorize('cyan', `Public URL: ${publicUrl}`))
  console.log(ui.colorize('cyan', `Status:     ${publicUrl}/api/status`))
  console.log(ui.colorize('cyan', `Features:   ${publicUrl}/api/features`))
})

exposer.on('error', (err) => {
  console.error(ui.colorize('red', `Tunnel error: ${err.message}`))
})

server.state.observe(() => {
  const count = server.state.get('requestCount')
  if (count) {
    console.log(ui.colorize('dim', `Requests served: ${count}`))
  }
})

await exposer.expose()

// Keep the process alive
console.log(ui.colorize('dim', '\nPress Ctrl+C to stop\n'))
process.on('SIGINT', async () => {
  console.log('\nShutting down...')
  await exposer.close()
  await server.stop()
  process.exit(0)
})
```

```bash
NGROK_AUTH_TOKEN=your_token bun run scripts/expose-demo.ts
```

## Next Steps

- [Creating Express Servers](./express-server.md) — more on the server system
- [Defining Your Own Features](./defining-features.md) — understand how `portExposer` is built
- [Getting Started](./getting-started.md) — container fundamentals
