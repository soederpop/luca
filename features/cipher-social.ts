import { z } from 'zod'
import { Feature, FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from 'luca'
import type { ContainerContext } from 'luca'
import { x25519 } from '@noble/curves/ed25519.js'
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { blake3 } from '@noble/hashes/blake3.js'
import { randomBytes } from '@noble/hashes/utils.js'
import { Iroh } from '@number0/iroh'

// Blake3 of 'cipher/content/v1' — matches Cipher's topic_to_id() Rust implementation
const CIPHER_TOPIC_BYTES = Array.from(blake3(new TextEncoder().encode('cipher/content/v1')))

declare module 'luca' {
  interface AvailableFeatures {
    cipherSocial: typeof CipherSocialFeature
  }
}

export const CipherOptionsSchema = FeatureOptionsSchema.extend({
  /** Name for this agent — used as display name and to namespace stored identity */
  name: z.string().default('luca-agent').describe('Agent display name'),
  /** Override directory for Iroh node data and identity. Defaults to ~/.luca/cipher/<name> */
  dataDir: z.string().optional().describe('Data directory override'),
  /**
   * Full Iroh NodeAddr JSON objects for bootstrap peers.
   * Each entry: { nodeId: string, relayUrl?: string, addresses?: string[] }
   * Get this from another agent's `nodeAddr` state field.
   */
  bootstrapAddrs: z.array(z.string()).default([]).describe('JSON-encoded Iroh NodeAddr objects for bootstrap'),
})
export type CipherOptions = z.infer<typeof CipherOptionsSchema>

export const CipherStateSchema = FeatureStateSchema.extend({
  connected: z.boolean().default(false).describe('Whether connected to the Cipher gossip mesh'),
  nodeId: z.string().optional().describe('Iroh transport node ID'),
  nodeAddr: z.string().optional().describe('Full Iroh NodeAddr as JSON — share with peers for bootstrapping'),
  publicKey: z.string().optional().describe('Agent X25519 public key (base64) — share this with peers'),
  peers: z.number().default(0).describe('Known peers seen via presence announcements'),
})
export type CipherState = z.infer<typeof CipherStateSchema>

export const CipherEventsSchema = FeatureEventsSchema.extend({
  connected: z.tuple([z.object({
    nodeId: z.string(),
    publicKey: z.string(),
  })]).describe('Connected to mesh'),
  message: z.tuple([z.object({
    from: z.string(),
    payload: z.any(),
    timestamp: z.number(),
  })]).describe('Decrypted message received'),
  presence: z.tuple([z.object({
    publicKey: z.string(),
    name: z.string(),
    nodeId: z.string().optional(),
  })]).describe('Peer announced presence'),
  error: z.tuple([z.string()]).describe('Error occurred'),
})

/**
 * Cipher P2P feature — connects a Luca agent to the Cipher encrypted social network.
 *
 * Each agent gets a persistent X25519 identity. Messages are encrypted using
 * Cipher's GossipEnvelope/SealedBox format (ephemeral X25519 ECDH + XChaCha20-Poly1305),
 * fully compatible with the Cipher desktop app.
 *
 * @example
 * ```typescript
 * const cipher = container.feature('cipher', { name: 'planner-agent' })
 * await cipher.connect()
 * console.log('My public key:', cipher.publicKey)
 *
 * cipher.on('message', ({ from, payload }) => {
 *   console.log('Message from', from.slice(0, 8), payload)
 * })
 *
 * await cipher.send(recipientPublicKey, { type: 'task', data: { ... } })
 * ```
 */
export class CipherSocialFeature extends Feature<CipherState, CipherOptions> {
  static override shortcut = 'features.cipherSocial' as const
  static override stateSchema = CipherStateSchema
  static override optionsSchema = CipherOptionsSchema
  static override eventsSchema = CipherEventsSchema
  static { Feature.register(this, 'cipherSocial') }

  private _iroh: Awaited<ReturnType<typeof Iroh.persistent>> | null = null
  private _sender: any = null
  private _privateKey: Uint8Array | null = null
  private _publicKey: Uint8Array | null = null
  private _knownPeers: Map<string, { name: string; nodeId?: string }> = new Map()

  private get fs() { return this.container.feature('fs') }
  private get os() { return this.container.feature('os') as any }

  private get identityPath(): string {
    return this.container.paths.resolve(this.dataDir, 'identity.json')
  }

  private get irohDataDir(): string {
    return this.container.paths.resolve(this.dataDir, 'iroh')
  }

  /** Connect to the Cipher gossip mesh. Generates identity on first run. */
  async connect(): Promise<void> {
    await this.loadOrGenerateKeypair()

    this.fs.ensureFolder(this.irohDataDir)
    this._iroh = await Iroh.persistent(this.irohDataDir)
    const nodeId = await this._iroh.net.nodeId()
    const nodeAddr = await this._iroh.net.nodeAddr()

    // Add bootstrap peer addresses so Iroh knows how to reach them
    const bootstrapNodeIds: string[] = []
    for (const addrJson of this.options.bootstrapAddrs) {
      try {
        const addr = JSON.parse(addrJson)
        await this._iroh.net.addNodeAddr(addr)
        bootstrapNodeIds.push(addr.nodeId)
      } catch (e) {
        // ignore malformed bootstrap entries
      }
    }

    this._sender = await this._iroh.gossip.subscribe(
      CIPHER_TOPIC_BYTES,
      bootstrapNodeIds,
      (error: Error | null, event: any) => {
        if (error) {
          this.emit('error', error.message)
          return
        }
        if (event.received) {
          this.handleIncoming(event.received)
        }
      }
    )

    const publicKey = Buffer.from(this._publicKey!).toString('base64')
    this.setState({ connected: true, nodeId, nodeAddr: JSON.stringify(nodeAddr), publicKey })
    this.emit('connected', { nodeId, publicKey })

    await this.announcePresence()
  }

  /**
   * Send an encrypted message to a specific agent by their X25519 public key.
   * The payload can be any JSON-serializable value.
   */
  async send(recipientPublicKey: string, payload: any): Promise<void> {
    if (!this._sender || !this._publicKey) throw new Error('Not connected — call connect() first')

    const contentPayload = {
      DirectMessage: {
        content: JSON.stringify({ 'luca:v1': payload }),
        thread_id: null,
      }
    }

    const envelope = this.buildEnvelope([recipientPublicKey], contentPayload)
    const p2pMessage = { SealedEnvelope: { envelope_json: JSON.stringify(envelope) } }
    await this._sender.broadcast(Array.from(Buffer.from(JSON.stringify(p2pMessage))))
  }

  /** Broadcast presence so other agents learn your public key and name. */
  async announcePresence(): Promise<void> {
    if (!this._sender || !this._publicKey) return
    const presence = {
      Presence: {
        public_key: Buffer.from(this._publicKey).toString('base64'),
        display_name: this.options.name,
        node_id: this.state.get('nodeId') ?? '',
        timestamp: Date.now(),
        // Required fields for Cipher protocol compat
        user_id: this.agentUserId,
        encryption_public_key: Buffer.from(this._publicKey).toString('base64'),
        device_id: this.agentUserId,
        bio: 'Luca agent',
        profile_picture: '',
        profile_signature: null,
        node_addr: { node_id: this.state.get('nodeId') ?? '', relay_url: null, direct_addresses: [] },
      }
    }
    await this._sender.broadcast(Array.from(Buffer.from(JSON.stringify(presence))))
  }

  async disconnect(): Promise<void> {
    await this._sender?.close()
    await this._iroh?.node.shutdown()
    this._iroh = null
    this._sender = null
    this.setState({ connected: false })
  }

  get publicKey(): string | undefined {
    return this.state.get('publicKey')
  }

  get nodeId(): string | undefined {
    return this.state.get('nodeId')
  }

  /** Full NodeAddr JSON — pass this to other agents via --bootstrap-addr for immediate connectivity */
  get nodeAddrJson(): string | undefined {
    return this.state.get('nodeAddr')
  }

  get knownPeers(): Map<string, { name: string; nodeId?: string }> {
    return this._knownPeers
  }

  /**
   * Load or generate the keypair without starting the Iroh node.
   * Useful for printing identity without joining the network.
   */
  async loadIdentity(): Promise<void> {
    await this.loadOrGenerateKeypair()
    this.setState({ publicKey: Buffer.from(this._publicKey!).toString('base64') })
  }

  get dataDir(): string {
    if (this.options.dataDir) return this.options.dataDir
    const home = (this.os as any).homedir
    return this.container.paths.resolve(home, '.luca', 'cipher', this.options.name)
  }

  // Deterministic agent user ID derived from public key (hex prefix)
  private get agentUserId(): string {
    if (!this._publicKey) return 'unknown'
    return Buffer.from(this._publicKey.slice(0, 16)).toString('hex')
  }

  private async loadOrGenerateKeypair(): Promise<void> {
    this.fs.ensureFolder(this.dataDir)

    if (this.fs.exists(this.identityPath)) {
      const identity = this.fs.readJson(this.identityPath)
      this._privateKey = new Uint8Array(Buffer.from(identity.privateKey, 'base64'))
      this._publicKey = new Uint8Array(Buffer.from(identity.publicKey, 'base64'))
    } else {
      this._privateKey = x25519.utils.randomSecretKey()
      this._publicKey = new Uint8Array(x25519.getPublicKey(this._privateKey))
      this.fs.writeJson(this.identityPath, {
        name: this.options.name,
        publicKey: Buffer.from(this._publicKey).toString('base64'),
        privateKey: Buffer.from(this._privateKey).toString('base64'),
        createdAt: new Date().toISOString(),
      })
    }
  }

  private handleIncoming(received: { content: number[]; deliveredFrom: string }): void {
    try {
      const text = Buffer.from(received.content).toString('utf8')
      const msg = JSON.parse(text)

      if (msg.Presence) {
        const p = msg.Presence
        if (!p.public_key) return
        this._knownPeers.set(p.public_key, { name: p.display_name ?? 'unknown', nodeId: p.node_id })
        this.setState({ peers: this._knownPeers.size })
        this.emit('presence', { publicKey: p.public_key, name: p.display_name ?? 'unknown', nodeId: p.node_id })
        return
      }

      if (msg.SealedEnvelope) {
        const envelope = JSON.parse(msg.SealedEnvelope.envelope_json)
        const contentPayload = this.tryDecryptEnvelope(envelope)
        if (!contentPayload) return

        let payload = contentPayload
        if (contentPayload.DirectMessage?.content) {
          try {
            const parsed = JSON.parse(contentPayload.DirectMessage.content)
            payload = parsed['luca:v1'] ?? parsed
          } catch {
            payload = { type: 'text', text: contentPayload.DirectMessage.content }
          }
        }

        this.emit('message', {
          from: envelope.sender_public_key,
          payload,
          timestamp: envelope.timestamp,
        })
      }
    } catch {
      // ignore malformed messages
    }
  }

  private buildEnvelope(recipientKeys: string[], contentPayload: any): object {
    const sealedBoxes = recipientKeys.map(k => this.sealFor(k, contentPayload))
    return {
      message_id: Buffer.from(randomBytes(32)).toString('hex'),
      timestamp: Math.floor(Date.now() / 1000),
      content_type: 'DirectMessage',
      sender_public_key: Buffer.from(this._publicKey!).toString('base64'),
      sealed_boxes: sealedBoxes,
    }
  }

  private sealFor(recipientPubKeyB64: string, payload: any): object {
    const recipientPub = new Uint8Array(Buffer.from(recipientPubKeyB64, 'base64'))
    const ephPriv = x25519.utils.randomSecretKey()
    const ephPub = new Uint8Array(x25519.getPublicKey(ephPriv))
    const shared = x25519.getSharedSecret(ephPriv, recipientPub)
    const nonce = randomBytes(24)
    const ct = xchacha20poly1305(shared, nonce).encrypt(
      new TextEncoder().encode(JSON.stringify(payload))
    )
    return {
      ephemeral_pubkey: Buffer.from(ephPub).toString('base64'),
      recipient_hint: Buffer.from(recipientPub.slice(0, 8)).toString('hex'),
      nonce: Buffer.from(nonce).toString('base64'),
      ciphertext: Buffer.from(ct).toString('base64'),
    }
  }

  private tryDecryptEnvelope(envelope: any): any | null {
    if (!this._privateKey || !this._publicKey) return null
    const myHint = Buffer.from(this._publicKey.slice(0, 8)).toString('hex')
    for (const box of envelope.sealed_boxes ?? []) {
      if (box.recipient_hint !== myHint) continue
      const result = this.tryDecryptBox(box)
      if (result !== null) return result
    }
    return null
  }

  private tryDecryptBox(box: any): any | null {
    try {
      const ephPub = new Uint8Array(Buffer.from(box.ephemeral_pubkey, 'base64'))
      const shared = x25519.getSharedSecret(this._privateKey!, ephPub)
      const nonce = new Uint8Array(Buffer.from(box.nonce, 'base64'))
      const ct = new Uint8Array(Buffer.from(box.ciphertext, 'base64'))
      const pt = xchacha20poly1305(shared, nonce).decrypt(ct)
      return JSON.parse(new TextDecoder().decode(pt))
    } catch {
      return null
    }
  }
}

export default CipherSocialFeature
