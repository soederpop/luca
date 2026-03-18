export * from '../container.js'
import { Container } from '../container.js'
import { Client } from '../client.js'
import { RestClient } from '../clients/rest.js'
import { SocketClient } from './clients/socket.js'
import type { AvailableFeatures } from '../feature.js'
import type { ContainerState, ContainerArgv } from '../container.js' 
import type { ClientsInterface } from '../client.js'
import type { AssetLoader } from './features/asset-loader.js'
import type { VoiceRecognition } from './features/voice-recognition.js'
import type { Speech } from './features/speech.js'
import type { Network } from './features/network.js'
import type { WebVault } from './features/vault.js'
import type { VM } from './features/vm.js'
import type { Esbuild } from './features/esbuild.js'
import type { Helpers } from './features/helpers.js'
import type { ContainerLink } from './features/container-link.js'

import * as WebContainerExtensions from './extension.js'

export { Client, RestClient, SocketClient }

export interface WebFeatures extends AvailableFeatures {
  assetLoader: typeof AssetLoader
  voice: typeof VoiceRecognition
  speech: typeof Speech
  vault: typeof WebVault
  vm: typeof VM;
  esbuild: typeof Esbuild
  helpers: typeof Helpers
  containerLink: typeof ContainerLink
}

export interface WebContainer extends ClientsInterface {
  assetLoader?: AssetLoader
  voice?: VoiceRecognition
  speech?: Speech
  network?: Network
  vault?: WebVault
  helpers?: Helpers
  containerLink?: ContainerLink
}

export interface WebContainerState extends ContainerState { }

/**
 * Browser-specific container that extends the base Container with web client support
 * and browser-specific features like speech, voice recognition, and asset loading.
 */
export class WebContainer<Features extends WebFeatures = WebFeatures, K extends WebContainerState = WebContainerState> extends Container<Features, K> {
  /** Returns the base Client class for creating custom clients. */
  get Client() {
    return Client
  }

  /** Returns the SocketClient class for WebSocket connections. */
  get SocketClient() {
    return SocketClient
  }

  /** Returns the RestClient class for HTTP REST API connections. */
  get RestClient() {
    return RestClient
  }

  useHelpers: any[] = [WebContainerExtensions]

  constructor(options: any = {}) {
    super(options)
    this.use(WebContainerExtensions as any)
    this.feature("helpers" as any, { enable: true })
  }
}

export const helperCache = new Map()