import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { Client, RestClient, GraphClient, WebSocketClient } from '../src/client'
import { RestClient as RestClientDirect } from '../src/clients/rest'
import { GraphClient as GraphClientDirect } from '../src/clients/graph'
import { WebSocketClient as WebSocketClientDirect } from '../src/clients/websocket'
import { ClientStateSchema, ClientOptionsSchema } from '../src/schemas/base'

/**
 * Regression tests for two bugs reported while building a custom websocket
 * client in a consumer project:
 *
 * 1. `import { RestClient } from 'luca/client'` — the client scaffold tutorial
 *    teaches this import, but src/client.ts previously only re-exported types.
 *
 * 2. Properties assigned in `afterInitialize()` were silently clobbered when the
 *    subclass declared them as class fields (e.g. `socket!: WebSocketClient`).
 *    afterInitialize() used to run inside the base Helper constructor — during
 *    `super()` — and under ES2022 class-field semantics the field declarations
 *    are (re)defined to `undefined` AFTER super() returns, wiping the values.
 *    The factory (createHelperInstance) now calls runAfterInitialize() once the
 *    entire constructor chain has completed.
 */

// Mirrors the reported project client: a declared-but-uninitialized class field
// that afterInitialize() assigns. Under the old behavior `socket` ended up
// undefined and `this.socket.connect(...)` crashed at first use.
class AfterInitFieldClient extends Client {
  static override stability = 'experimental' as const
  static override stateSchema = ClientStateSchema
  static override optionsSchema = ClientOptionsSchema
  static { Client.register(this, 'afterInitFieldClient') }

  socket!: WebSocketClient
  initializeCount = 0

  override afterInitialize() {
    this.initializeCount++
    this.socket = this.container.client('websocket', { baseURL: 'ws://localhost:1' }) as WebSocketClient
  }
}

describe('client.ts concrete class re-exports (scaffold tutorial imports)', () => {
  it('re-exports RestClient, GraphClient and WebSocketClient from luca/client', () => {
    expect(typeof RestClient).toBe('function')
    expect(typeof GraphClient).toBe('function')
    expect(typeof WebSocketClient).toBe('function')
  })

  it('re-exports are the same classes as the deep imports', () => {
    expect(RestClient).toBe(RestClientDirect)
    expect(GraphClient).toBe(GraphClientDirect)
    expect(WebSocketClient).toBe(WebSocketClientDirect)
  })

  it('client.ts can be imported as a fresh entry module without a TDZ crash', async () => {
    // The re-exports are circular (clients/*.ts import Client from client.ts),
    // so verify a subprocess whose module graph STARTS at client.ts still loads.
    const { spawnSync } = await import('child_process')
    const result = spawnSync(
      process.execPath,
      ['-e', `const m = await import(${JSON.stringify(require.resolve('../src/client.ts'))}); if (typeof m.RestClient !== 'function') process.exit(2)`],
      { encoding: 'utf-8' }
    )
    expect(result.status).toBe(0)
  })
})

describe('afterInitialize() vs subclass class fields', () => {
  it('assignments made in afterInitialize() survive declared class fields', () => {
    const c = new NodeContainer()
    const client = c.client('afterInitFieldClient' as any, {}) as AfterInitFieldClient

    // Before the fix `socket` was clobbered back to undefined by the
    // field declaration after super() returned.
    expect(client.socket).toBeDefined()
    expect(client.socket).toBeInstanceOf(WebSocketClient)
    expect(typeof client.socket.connect).toBe('function')
  })

  it('class fields WITH initializers keep their initialized values too', () => {
    const c = new NodeContainer()
    const client = c.client('afterInitFieldClient' as any, {}) as AfterInitFieldClient

    // initializeCount starts at 0 (field initializer), afterInitialize bumps it —
    // proving afterInitialize ran AFTER the field initializer, not before.
    expect(client.initializeCount).toBe(1)
  })

  it('afterInitialize() runs exactly once (microtask safety net does not double-fire)', async () => {
    const c = new NodeContainer()
    const client = c.client('afterInitFieldClient' as any, {}) as AfterInitFieldClient
    expect(client.initializeCount).toBe(1)

    // Flush microtasks — the constructor's queueMicrotask safety net must be a no-op.
    await Promise.resolve()
    await Promise.resolve()
    expect(client.initializeCount).toBe(1)
  })

  it('cached factory hits do not re-run afterInitialize()', () => {
    const c = new NodeContainer()
    const first = c.client('afterInitFieldClient' as any, {}) as AfterInitFieldClient
    const second = c.client('afterInitFieldClient' as any, {}) as AfterInitFieldClient

    expect(second).toBe(first)
    expect(first.initializeCount).toBe(1)
  })

  it('helpers constructed directly with `new` still get afterInitialize via the microtask net', async () => {
    const c = new NodeContainer()
    const client = new AfterInitFieldClient({ name: 'direct' } as any, c.context)

    // Not yet — runs on the next microtask for direct construction.
    await Promise.resolve()
    expect(client.initializeCount).toBe(1)
    expect(client.socket).toBeInstanceOf(WebSocketClient)
  })

  it('emits helperInitialized on the container after afterInitialize has run', () => {
    const c = new NodeContainer()
    let sawSocket: any = 'not-emitted'
    c.on('helperInitialized', (helper: any) => {
      if (helper instanceof AfterInitFieldClient) sawSocket = helper.socket
    })

    const client = c.client('afterInitFieldClient' as any, { name: 'emit-check' }) as AfterInitFieldClient
    expect(client).toBeInstanceOf(AfterInitFieldClient)
    expect(sawSocket).toBeInstanceOf(WebSocketClient)
  })
})

describe('project-discovered clients (helpers gateway, VM module path)', () => {
  it('discovers a clients/ folder client whose afterInitialize wires a websocket', async () => {
    const c = new NodeContainer()
    const fixtureRoot = new URL('./fixtures/discovery-project', import.meta.url).pathname

    // Rooting the helpers feature in a fixture without node_modules forces the
    // VM virtual-module path — the same path the compiled `luca` binary uses
    // for project-level clients/.
    const helpers = c.feature('helpers', { rootDir: fixtureRoot }) as any
    expect(helpers.useNativeImport).toBe(false)

    const names = await helpers.discover('clients')
    expect(names).toContain('demoWs')

    const demo = c.client('demoWs' as any, {}) as any
    expect(demo.socket).toBeDefined()
    expect(typeof demo.socket.connect).toBe('function')
    expect(demo.socket).toBeInstanceOf(WebSocketClient)
  })

  it("the VM's virtual 'luca/client' module exposes the concrete classes the scaffold teaches", async () => {
    const c = new NodeContainer()
    const fixtureRoot = new URL('./fixtures/discovery-project', import.meta.url).pathname
    const helpers = c.feature('helpers', { rootDir: fixtureRoot }) as any

    const fixtureFile = `${fixtureRoot}/clients/demo-ws.ts`
    const mod = await helpers.loadModuleExports(fixtureFile)

    // The fixture re-exports what it received from `import { ... } from 'luca/client'`
    expect(mod.importedRestClient).toBe(RestClient)
    expect(mod.importedClient).toBe(Client)
  })
})
