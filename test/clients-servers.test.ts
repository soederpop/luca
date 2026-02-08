import { describe, it, expect } from 'vitest'
import { NodeContainer } from '../src/node/container'

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
