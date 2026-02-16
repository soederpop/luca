import { describe, it, expect, vi } from 'vitest'
import { NodeContainer } from '../src/node/container'
import { WebSocketClient, GraphClient } from '../src/client'

describe('Clients', () => {
  it('container has clients registry after construction', () => {
    const c = new NodeContainer()
    expect(c.clients).toBeDefined()
    expect(typeof c.clients.has).toBe('function')
    expect(typeof c.clients.lookup).toBe('function')
  })

  it('has rest and graph clients registered', () => {
    const c = new NodeContainer()
    expect(c.clients.available).toContain('rest')
    expect(c.clients.available).toContain('graph')
  })

  it('container.client() factory creates a client', () => {
    const c = new NodeContainer()
    const rest = c.client('rest', { baseURL: 'https://example.com' })
    expect(rest).toBeDefined()
    expect(rest.uuid).toBeDefined()
    expect(rest.baseURL).toBe('https://example.com')
  })

  it('client has state with connected=false initially', () => {
    const c = new NodeContainer()
    const rest = c.client('rest')
    expect(rest.isConnected).toBe(false)
  })

  it('client.connect() sets connected state', async () => {
    const c = new NodeContainer()
    const rest = c.client('rest')
    await rest.connect()
    expect(rest.isConnected).toBe(true)
  })

  it('client has access to container via context', () => {
    const c = new NodeContainer()
    const rest = c.client('rest')
    expect(rest.container.uuid).toBe(c.uuid)
  })
})

describe('WebSocketClient', () => {
  it('is registered as websocket client', () => {
    const c = new NodeContainer()
    expect(c.clients.available).toContain('websocket')
  })

  it('factory creates a WebSocketClient instance', () => {
    const c = new NodeContainer()
    const ws = c.client('websocket', { baseURL: 'ws://localhost:8080' })
    expect(ws).toBeDefined()
    expect(ws).toBeInstanceOf(WebSocketClient)
    expect(ws.baseURL).toBe('ws://localhost:8080')
  })

  it('starts disconnected with correct initial state', () => {
    const c = new NodeContainer()
    const ws = c.client('websocket', { baseURL: 'ws://localhost:8080' })
    expect(ws.isConnected).toBe(false)
    expect(ws.hasError).toBe(false)
    expect(ws.state.get('reconnectAttempts')).toBe(0)
  })

  it('has send and disconnect methods', () => {
    const c = new NodeContainer()
    const ws = c.client('websocket', { baseURL: 'ws://localhost:8080' })
    expect(typeof ws.send).toBe('function')
    expect(typeof ws.disconnect).toBe('function')
  })

  it('accepts reconnect options', () => {
    const c = new NodeContainer()
    const ws = c.client('websocket', {
      baseURL: 'ws://localhost:8080',
      reconnect: true,
      reconnectInterval: 2000,
      maxReconnectAttempts: 5,
    })
    expect(ws.options.reconnect).toBe(true)
    expect(ws.options.reconnectInterval).toBe(2000)
    expect(ws.options.maxReconnectAttempts).toBe(5)
  })

  it('has proper event and state schemas', () => {
    expect(WebSocketClient.eventsSchema).toBeDefined()
    expect(WebSocketClient.stateSchema).toBeDefined()
    expect(WebSocketClient.optionsSchema).toBeDefined()
  })
})

describe('GraphClient', () => {
  it('is registered as graph client', () => {
    const c = new NodeContainer()
    expect(c.clients.available).toContain('graph')
  })

  it('factory creates a GraphClient instance', () => {
    const c = new NodeContainer()
    const gql = c.client('graph', { baseURL: 'https://api.example.com' })
    expect(gql).toBeDefined()
    expect(gql).toBeInstanceOf(GraphClient)
  })

  it('extends RestClient with HTTP methods', () => {
    const c = new NodeContainer()
    const gql = c.client('graph', { baseURL: 'https://api.example.com' })
    expect(typeof gql.get).toBe('function')
    expect(typeof gql.post).toBe('function')
    expect(typeof gql.put).toBe('function')
    expect(typeof gql.delete).toBe('function')
    expect(typeof gql.patch).toBe('function')
  })

  it('has query and mutate methods', () => {
    const c = new NodeContainer()
    const gql = c.client('graph', { baseURL: 'https://api.example.com' })
    expect(typeof gql.query).toBe('function')
    expect(typeof gql.mutate).toBe('function')
  })

  it('defaults endpoint to /graphql', () => {
    const c = new NodeContainer()
    const gql = c.client('graph', { baseURL: 'https://api.example.com' })
    expect(gql.endpoint).toBe('/graphql')
  })

  it('accepts custom endpoint option', () => {
    const c = new NodeContainer()
    const gql = c.client('graph', { baseURL: 'https://api.example.com', endpoint: '/api/graphql' })
    expect(gql.endpoint).toBe('/api/graphql')
  })

  it('query() posts to the endpoint and unwraps data', async () => {
    const c = new NodeContainer()
    const gql = c.client('graph', { baseURL: 'https://api.example.com' })

    // Mock the post method to simulate a GraphQL response
    vi.spyOn(gql, 'post').mockResolvedValue({
      data: { user: { name: 'Jon' } },
    })

    const result = await gql.query('{ user { name } }')
    expect(result).toEqual({ user: { name: 'Jon' } })
    expect(gql.post).toHaveBeenCalledWith('/graphql', { query: '{ user { name } }' })
  })

  it('query() passes variables and operationName', async () => {
    const c = new NodeContainer()
    const gql = c.client('graph', { baseURL: 'https://api.example.com' })

    vi.spyOn(gql, 'post').mockResolvedValue({
      data: { user: { name: 'Jon' } },
    })

    await gql.query('query GetUser($id: ID!) { user(id: $id) { name } }', { id: '1' }, 'GetUser')
    expect(gql.post).toHaveBeenCalledWith('/graphql', {
      query: 'query GetUser($id: ID!) { user(id: $id) { name } }',
      variables: { id: '1' },
      operationName: 'GetUser',
    })
  })

  it('mutate() posts to the endpoint and unwraps data', async () => {
    const c = new NodeContainer()
    const gql = c.client('graph', { baseURL: 'https://api.example.com' })

    vi.spyOn(gql, 'post').mockResolvedValue({
      data: { createUser: { id: '1' } },
    })

    const result = await gql.mutate('mutation { createUser(name: "Jon") { id } }')
    expect(result).toEqual({ createUser: { id: '1' } })
  })

  it('emits graphqlError and failure on GraphQL-level errors', async () => {
    const c = new NodeContainer()
    const gql = c.client('graph', { baseURL: 'https://api.example.com' })
    const errors = [{ message: 'Not found' }]

    vi.spyOn(gql, 'post').mockResolvedValue({
      data: null,
      errors,
    })

    const graphqlErrors: any[] = []
    const failures: any[] = []
    gql.on('graphqlError', (errs: any) => graphqlErrors.push(errs))
    gql.on('failure', (err: any) => failures.push(err))

    const result = await gql.query('{ user { name } }')
    expect(result).toBeNull()
    expect(graphqlErrors).toHaveLength(1)
    expect(graphqlErrors[0]).toEqual(errors)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toEqual(errors)
  })
})

describe('Servers', () => {
  it('container has servers registry after construction', () => {
    const c = new NodeContainer()
    expect(c.servers).toBeDefined()
    expect(typeof c.servers.has).toBe('function')
  })

  it('has express and websocket servers registered', () => {
    const c = new NodeContainer()
    expect(c.servers.available).toContain('express')
    expect(c.servers.available).toContain('websocket')
  })
})
