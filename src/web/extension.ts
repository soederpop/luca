import type { Container } from '../container'

import { Client, type ClientsInterface } from '../client.js'
import { AssetLoader } from './features/asset-loader.js'
import { Helpers } from './features/helpers.js'
import { VoiceRecognition } from './features/voice-recognition.js'
import { Speech } from './features/speech.js'
import { SocketClient } from './clients/socket.js'
import { Network } from './features/network.js'
import { WebVault } from './features/vault.js'
import { VM } from './features/vm.js'
import { Esbuild } from './features/esbuild.js'
import { ContainerLink } from './features/container-link.js'
import { Embeddings } from './features/embeddings.js'
import { Transformers } from './features/transformers.js'
import { LocalLlm } from './features/local-llm.js'
import { Transcriber } from './features/transcriber.js'
import { Vision } from './features/vision.js'

export function attach<K extends Container & ClientsInterface>(container: K, options?: any) : Container & ClientsInterface {
  container
    .use(Client)
    .use(AssetLoader)
    .use(Helpers)
    .use(VoiceRecognition)
    .use(Speech)
    .use(SocketClient)
    .use(Network)
    .use(VM)
    .use(WebVault)
    .use(Esbuild)
    .use(ContainerLink)
    .use(Transformers)
    .use(Embeddings)
    .use(LocalLlm)
    .use(Transcriber)
    .use(Vision)

  return container
}
