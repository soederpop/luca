// Test fixture: mirrors the bug report — a project-level client discovered via
// container.helpers.discover('clients') whose afterInitialize() assigns to a
// declared class field. Loaded through the VM virtual-module path in tests.
import { Client, RestClient } from 'luca/client'
import { ClientStateSchema, ClientOptionsSchema } from 'luca'

// Re-export what the virtual 'luca/client' module handed us so the test can
// assert the scaffold-documented imports resolve to the real classes.
export const importedClient = Client
export const importedRestClient = RestClient

export class DemoWs extends Client {
  static override shortcut = 'clients.demoWs'
  static override stability = 'experimental' as const
  static override stateSchema = ClientStateSchema
  static override optionsSchema = ClientOptionsSchema
  static { Client.register(this, 'demoWs') }

  // Declared-but-uninitialized class field — the clobbering trigger from the report.
  socket!: any

  override afterInitialize() {
    this.socket = this.container.client('websocket', { baseURL: 'ws://localhost:1' })
  }
}

export default DemoWs
