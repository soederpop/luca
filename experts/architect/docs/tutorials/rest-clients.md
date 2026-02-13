# Creating Your Own REST Clients

Luca's `Client` system gives you a structured way to build API integrations. The `RestClient` base class wraps Axios with Luca's state management, event system, and caching — so you can focus on modeling the API, not the plumbing.

## The Client Registry

When you create a `NodeContainer`, it automatically attaches a `clients` registry and a `client()` factory:

```ts
import container from '@/node'

// See what's registered
container.clients.available // ['rest', 'graph', 'websocket']

// Create a basic REST client
const api = container.client('rest', {
  baseURL: 'https://jsonplaceholder.typicode.com',
  json: true,
})

const users = await api.get('/users')
const post = await api.post('/posts', { title: 'Hello', body: 'World' })
```

This works, but the real power comes when you build your own typed client classes.

## Building a Custom REST Client

Let's build a GitHub API client.

### Step 1: Define the class

```ts
// src/node/clients/github.ts
import { z } from 'zod'
import { RestClient, clients } from '@/client'
import type { ClientState, ClientOptions, AvailableClients } from '@/client'
import type { ContainerContext } from '@/container'
import { ClientStateSchema, ClientOptionsSchema } from '@/schemas/base'

// Module augmentation for autocomplete
declare module '@/client' {
  interface AvailableClients {
    github: typeof GithubClient
  }
}

// Define options schema
export const GithubClientOptionsSchema = ClientOptionsSchema.extend({
  token: z.string().optional().describe('GitHub personal access token'),
  owner: z.string().optional().describe('Default repository owner'),
  repo: z.string().optional().describe('Default repository name'),
})

export type GithubClientOptions = z.infer<typeof GithubClientOptionsSchema>

export class GithubClient extends RestClient<ClientState, GithubClientOptions> {
  static override shortcut = 'clients.github' as const
  static override optionsSchema = GithubClientOptionsSchema

  constructor(options: GithubClientOptions, context: ContainerContext) {
    super(
      {
        ...options,
        baseURL: 'https://api.github.com',
        json: true,
      },
      context,
    )
  }
}
```

### Step 2: Register it

```ts
clients.register('github', GithubClient)
```

### Step 3: Use it

```ts
const github = container.client('github', {
  token: process.env.GITHUB_TOKEN,
  owner: 'myorg',
  repo: 'myrepo',
})

const repos = await github.get('/user/repos')
```

## Authentication with `beforeRequest()`

The `RestClient` calls `beforeRequest()` before every HTTP call. Override it to inject auth headers:

```ts
export class GithubClient extends RestClient<ClientState, GithubClientOptions> {
  static override shortcut = 'clients.github' as const
  static override optionsSchema = GithubClientOptionsSchema

  constructor(options: GithubClientOptions, context: ContainerContext) {
    super({ ...options, baseURL: 'https://api.github.com', json: true }, context)
  }

  override async beforeRequest() {
    const token = this.options.token || process.env.GITHUB_TOKEN
    if (token) {
      this.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
  }
}
```

Now every `get`, `post`, `put`, `patch`, and `delete` call automatically includes the auth header.

## Adding Domain Methods

Wrap the raw HTTP calls with typed, domain-specific methods:

```ts
export class GithubClient extends RestClient<ClientState, GithubClientOptions> {
  static override shortcut = 'clients.github' as const
  static override optionsSchema = GithubClientOptionsSchema

  constructor(options: GithubClientOptions, context: ContainerContext) {
    super({ ...options, baseURL: 'https://api.github.com', json: true }, context)
  }

  override async beforeRequest() {
    const token = this.options.token || process.env.GITHUB_TOKEN
    if (token) {
      this.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
  }

  private get ownerRepo() {
    return `${this.options.owner}/${this.options.repo}`
  }

  async listRepos(org?: string) {
    if (org) return this.get(`/orgs/${org}/repos`)
    return this.get('/user/repos')
  }

  async getRepo(owner?: string, repo?: string) {
    const o = owner || this.options.owner
    const r = repo || this.options.repo
    return this.get(`/repos/${o}/${r}`)
  }

  async listIssues(params: { state?: 'open' | 'closed' | 'all' } = {}) {
    return this.get(`/repos/${this.ownerRepo}/issues`, params)
  }

  async createIssue(title: string, body?: string) {
    return this.post(`/repos/${this.ownerRepo}/issues`, { title, body })
  }

  async listPullRequests(params: { state?: 'open' | 'closed' | 'all' } = {}) {
    return this.get(`/repos/${this.ownerRepo}/pulls`, params)
  }

  async getContents(path: string) {
    return this.get(`/repos/${this.ownerRepo}/contents/${path}`)
  }
}

clients.register('github', GithubClient)
```

Usage:

```ts
const github = container.client('github', {
  token: process.env.GITHUB_TOKEN,
  owner: 'myorg',
  repo: 'myproject',
})

const issues = await github.listIssues({ state: 'open' })
await github.createIssue('Bug: something broke', 'Steps to reproduce...')
const readme = await github.getContents('README.md')
```

## Tracking State

Clients have built-in state. You can extend it to track API-specific things:

```ts
export const GithubClientStateSchema = ClientStateSchema.extend({
  rateLimit: z.number().describe('Remaining API calls'),
  rateLimitReset: z.number().describe('When the rate limit resets (unix timestamp)'),
})

export type GithubClientState = z.infer<typeof GithubClientStateSchema>

export class GithubClient extends RestClient<GithubClientState, GithubClientOptions> {
  // ...

  override get initialState(): GithubClientState {
    return {
      ...super.initialState,
      rateLimit: 5000,
      rateLimitReset: 0,
    }
  }

  // Update rate limit info after each response
  override async beforeRequest() {
    const token = this.options.token || process.env.GITHUB_TOKEN
    if (token) {
      this.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }

    // Add response interceptor to track rate limits
    this.axios.interceptors.response.use((response) => {
      const remaining = response.headers['x-ratelimit-remaining']
      const reset = response.headers['x-ratelimit-reset']
      if (remaining) this.state.set('rateLimit', parseInt(remaining))
      if (reset) this.state.set('rateLimitReset', parseInt(reset))
      return response
    })
  }
}
```

Now you can observe rate limit state:

```ts
github.state.observe(() => {
  const remaining = github.state.get('rateLimit')
  if (remaining && remaining < 100) {
    console.warn(`GitHub rate limit low: ${remaining} remaining`)
  }
})
```

## Error Handling

Override `handleError()` to customize error behavior:

```ts
override async handleError(error: AxiosError) {
  if (error.response?.status === 403) {
    this.emit('rateLimited', error)
    console.error('GitHub rate limit exceeded')
  } else if (error.response?.status === 404) {
    this.emit('notFound', error)
  }

  // Default behavior: emit 'failure' and return error JSON
  return super.handleError(error)
}
```

## Client Caching

Like features, clients are cached by their options. Same options = same instance:

```ts
const a = container.client('github', { token: 'abc' })
const b = container.client('github', { token: 'abc' })
a === b // true

const c = container.client('github', { token: 'xyz' })
a === c // false
```

## The `connect()` Lifecycle

Clients have a `connect()` method that sets `state.connected = true`. Use it for clients that need an initialization step:

```ts
override async connect() {
  // Verify the token works
  await this.get('/user')
  return super.connect()
}
```

```ts
const github = container.client('github', { token: process.env.GITHUB_TOKEN })
await github.connect()
github.isConnected // true
```

## Available Base Classes

Luca provides several client base classes:

| Class             | Use case                        |
|-------------------|---------------------------------|
| `Client`          | Abstract base for any client    |
| `RestClient`      | Axios-powered HTTP client       |
| `GraphClient`     | Base for GraphQL clients        |
| `WebSocketClient` | WebSocket connection wrapper    |

## Full File Structure

```
src/
  node/
    clients/
      github.ts       # Your custom client
  client.ts           # Base classes (Client, RestClient, etc.)
```

Import your client file in your container setup and it self-registers when loaded.

## Next Steps

- [Creating Express Servers](./express-server.md) — the server side of the equation
- [How We Built the AGI Container](./building-the-agi-container.md) — see the OpenAI client in action
