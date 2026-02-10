export * from '../container.js'
import { Container } from '../container.js'
import { Client, RestClient } from '../client.js'
import { SocketClient } from './clients/socket.js'
import type { AvailableFeatures } from '../feature.js'
import type { ContainerState, ContainerArgv } from '../container.js' 
import type { ClientsInterface } from '../client.js'
import type { AssetLoader } from './features/asset-loader.js'
import type { VoiceRecognition } from './features/voice-recognition.js'
import type { Speech } from './features/speech.js'
import type { Network } from './features/network.js'
import type { WebVault } from './features/vault.js'
import type { MdxLoader } from './features/mdx-loader.js'
import type { VM } from './features/vm.js'
import type { Esbuild } from './features/esbuild.js'

import * as WebContainerExtensions from './extension.js'

export { Client, RestClient, SocketClient }

export interface WebFeatures extends AvailableFeatures {
  assetLoader: typeof AssetLoader
  voice: typeof VoiceRecognition
  speech: typeof Speech
  vault: typeof WebVault
  mdxLoader: typeof MdxLoader
  vm: typeof VM;
  esbuild: typeof Esbuild
}

export interface WebContainer extends ClientsInterface {
  assetLoader?: AssetLoader
  voice?: VoiceRecognition
  speech?: Speech
  network?: Network
  vault?: WebVault
}

export interface WebContainerState extends ContainerState { }

export class WebContainer<Features extends WebFeatures = WebFeatures, K extends WebContainerState = WebContainerState> extends Container<Features, K> {
  get Client() {
    return Client
  }
  
  get SocketClient() {
    return SocketClient
  }
  
  get RestClient() {
    return RestClient
  }

  override useHelpers: any[] = [WebContainerExtensions]

  constructor(options: any = {}) {
    super(options)
    this.use(WebContainerExtensions as any)
  }
}

export const helperCache = new Map()