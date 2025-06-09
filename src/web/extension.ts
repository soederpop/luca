import type { Container } from '../container'

import { Client, ClientsInterface } from '../client.js'
import { AssetLoader } from './features/asset-loader.js'
import { VoiceRecognition } from './features/voice-recognition.js'
import { Speech } from './features/speech.js'
import { SocketClient } from './clients/socket.js'
import { Network } from './features/network.js'
import { WindowManager } from './features/window-manager.js'
import { DrawerManager } from './features/drawers.js'
import { OverlayManager } from './features/overlays.js'
import { WebVault } from './features/vault.js'
import { VM } from './features/vm.js'
import { MdxLoader } from './features/mdx-loader.js'
import { Esbuild } from './features/esbuild.js'

export function attach<K extends Container & ClientsInterface>(container: K, options?: any) : Container & ClientsInterface {
  container
    .use(Client)
    .use(AssetLoader)
    .use(MdxLoader)
    .use(VoiceRecognition)
    .use(Speech)
    .use(SocketClient)
    .use(Network)
    .use(DrawerManager)
    .use(WindowManager)
    .use(OverlayManager)
    .use(VM)
    .use(WebVault)
    .use(Esbuild)
  
  return container
}

