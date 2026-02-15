---
title: Using Clients
tags: [clients, rest, graphql, websocket, http, api, axios]
---

# Using Clients

Clients connect your application to external services. Luca provides built-in clients for REST APIs, GraphQL, and WebSocket connections.

## REST Client

The REST client wraps axios with Luca's helper patterns (state, events, introspection):

```typescript
const api = container.client('rest', {
  baseURL: 'https://api.example.com',
  headers: {
    Authorization: 'Bearer my-token',
  },
})

await api.connect()

// Standard HTTP methods
const users = await api.get('/users')
const user = await api.get('/users/123')
const created = await api.post('/users', { name: 'Alice', email: 'alice@example.com' })
const updated = await api.put('/users/123', { name: 'Alice Updated' })
await api.delete('/users/123')
```

### REST Client Events

```typescript
api.on('requestStart', (config) => {
  console.log(`${config.method} ${config.url}`)
})

api.on('requestEnd', (response) => {
  console.log(`${response.status} (${response.data.length} bytes)`)
})

api.on('error', (err) => {
  console.error('Request failed:', err.message)
})
```

## GraphQL Client

```typescript
const graph = container.client('graph', {
  baseURL: 'https://api.example.com/graphql',
  headers: { Authorization: 'Bearer my-token' },
})

await graph.connect()

const result = await graph.query(`
  query GetUser($id: ID!) {
    user(id: $id) {
      name
      email
      posts { title }
    }
  }
`, { id: '123' })

const mutationResult = await graph.mutate(`
  mutation CreatePost($input: PostInput!) {
    createPost(input: $input) {
      id
      title
    }
  }
`, { input: { title: 'Hello World', body: '...' } })
```

## WebSocket Client

```typescript
const ws = container.client('websocket', {
  url: 'wss://realtime.example.com',
})

await ws.connect()

ws.on('message', (data) => {
  console.log('Received:', data)
})

ws.send({ type: 'subscribe', channel: 'updates' })

// Clean up
await ws.disconnect()
```

## Discovering Clients

```typescript
container.clients.available   // ['rest', 'graph', 'websocket']
container.clients.describe('rest')
```

## Using Clients in Endpoints

```typescript
// endpoints/proxy.ts
import { z } from 'zod'

export const path = '/api/external-data'

export const getSchema = z.object({
  query: z.string().describe('Search query'),
})

export async function get(params: z.infer<typeof getSchema>, ctx: EndpointContext) {
  const api = ctx.container.client('rest', {
    baseURL: 'https://external-api.com',
  })

  await api.connect()
  const data = await api.get(`/search?q=${encodeURIComponent(params.query)}`)

  return { results: data }
}
```

## Using Clients in Features

```typescript
class WeatherService extends Feature<WeatherState, WeatherOptions> {
  private api: any

  async initialize() {
    this.api = this.container.client('rest', {
      baseURL: 'https://api.weather.com',
      headers: { 'X-API-Key': this.options.apiKey },
    })
    await this.api.connect()
  }

  async getForecast(city: string) {
    const data = await this.api.get(`/forecast/${encodeURIComponent(city)}`)
    this.state.set('lastForecast', data)
    this.emit('forecastFetched', data)
    return data
  }
}
```
