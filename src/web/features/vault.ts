import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'

export const WebVaultStateSchema = FeatureStateSchema.extend({
  vaultId: z.string().optional().describe('ID of the vault this key belongs to'),
  fingerprint: z.string().optional().describe('Short hash of the loaded key. Every payload records it, so the wrong key is caught before decrypting'),
  keySource: z.enum(['option', 'device', 'created', 'passphrase']).optional().describe('Where the loaded key came from'),
})

export const WebVaultOptionsSchema = FeatureOptionsSchema.extend({
  vaultId: z.string().optional().describe('ID for this app\'s vault. Required unless you pass `secret`; there is no shared default key'),
  secret: z.string().optional().describe('Explicit base64-encoded 32-byte key. Skips the device key and passphrase entirely'),
  dbName: z.string().optional().describe('IndexedDB database that holds device keys (default: luca-vault)'),
})

export type WebVaultState = z.infer<typeof WebVaultStateSchema>
export type WebVaultOptions = z.infer<typeof WebVaultOptionsSchema>

// WebCrypto rejects views over SharedArrayBuffer, so pin byte arrays to ArrayBuffer.
type Bytes = Uint8Array<ArrayBuffer>
type KeySource = NonNullable<WebVaultState['keySource']>
type StoredKey = { vaultId: string; key: CryptoKey; fingerprint: string; createdAt: number }

const PAYLOAD_VERSION = 'v1'
const LEGACY_DELIMITER = '\n------\n'
const STORE = 'keys'
const PBKDF2_ITERATIONS = 600_000

/**
 * AES-256-GCM encryption for the browser, with a key the page can use but never read.
 *
 * Keys are WebCrypto `CryptoKey` objects created as non-extractable: page code can
 * encrypt and decrypt with them, but cannot export the raw bytes. Script injected
 * into the page can still decrypt while it runs there, but cannot steal the key.
 *
 * Every vault needs a `vaultId`. The browser already keeps each origin's storage
 * apart; the ID keeps two apps on the same origin apart. There is no default key.
 *
 * Two ways to get a key:
 * - **Device key** (default): created on first `encrypt()` and kept in IndexedDB
 *   under the vault ID. It stays on this browser. Good for local data at rest.
 * - **Passphrase**: `unlock(passphrase)` derives the key with PBKDF2, so the same
 *   passphrase gives the same key on any device. It is never stored; `lock()` drops it.
 *
 * Payloads use the same single-line format as the node vault
 * (`v1:<fingerprint>:<iv>:<ciphertext>:<tag>`, base64url), so a payload from either
 * side decrypts on the other with the same key.
 *
 * **Never send server secrets (API keys, database passwords) to the browser**, even
 * encrypted. The page must decrypt them to use them, and then the user can read them.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const vault = container.feature('vault', { vaultId: 'notes-app' })
 * const encrypted = await vault.encrypt('draft text')   // creates the device key on first use
 * await vault.decrypt(encrypted)                         // 'draft text'
 *
 * // Same key on every device: derive it from a passphrase
 * const synced = container.feature('vault', { vaultId: 'notes-sync' })
 * await synced.unlock('correct horse battery staple')
 * const payload = await synced.encryptJson({ title: 'hello' })
 * synced.lock()
 * ```
 */
export class WebVault extends Feature<WebVaultState, WebVaultOptions> {
  static override stateSchema = WebVaultStateSchema
  static override optionsSchema = WebVaultOptionsSchema
  static override shortcut = "features.vault" as const
  static override stability = 'stable' as const
  static override category = 'system' as const

  static { Feature.register(this, 'vault') }

  // Kept off state on purpose: state is observable and serializable, the key must not be.
  private _key?: CryptoKey

  /**
   * This vault's ID, from the `vaultId` option.
   *
   * @returns {string | undefined} The vault ID
   */
  get vaultId(): string | undefined {
    return this.options.vaultId
  }

  /**
   * Short hash of the loaded key, recorded in every payload.
   *
   * @returns {string | undefined} 16 hex characters, or undefined until a key is loaded
   */
  get fingerprint(): string | undefined {
    return this.state.get('fingerprint')
  }

  /**
   * True when a key is loaded in memory.
   *
   * @returns {boolean} Whether the vault can encrypt and decrypt without loading a key
   */
  get isUnlocked(): boolean {
    return this._key !== undefined
  }

  /**
   * Creates a new random 32-byte key and returns it as base64. Has no side effects:
   * it does not change this vault's key. Pass the result as `secret` to use it.
   *
   * @returns {string} A base64-encoded 256-bit key
   */
  generateKey(): string {
    return toBase64(crypto.getRandomValues(new Uint8Array(32)))
  }

  /**
   * Derives this vault's key from a passphrase (PBKDF2-SHA256, 600,000 iterations,
   * salted by vault ID). The same passphrase and vault ID give the same key on any
   * device. The key is kept in memory only; it replaces any device key for this
   * instance until `lock()`.
   *
   * @param {string} passphrase - The passphrase to derive the key from
   * @returns {Promise<string>} The key's fingerprint, to check it matches the one you expect
   *
   * @example
   * ```typescript
   * const vault = container.feature('vault', { vaultId: 'notes-sync' })
   * await vault.unlock('correct horse battery staple')
   * ```
   */
  async unlock(passphrase: string): Promise<string> {
    const vaultId = this.requireVaultId()
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveBits'])
    const raw = new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(`luca-vault:${vaultId}`), iterations: PBKDF2_ITERATIONS },
      material,
      256,
    ))
    const fingerprint = await fingerprintOf(raw)
    const key = await importAesKey(raw)
    raw.fill(0)
    this.useKey(key, fingerprint, 'passphrase')
    return fingerprint
  }

  /**
   * Drops the key from memory. A passphrase key needs `unlock()` again; a device key
   * reloads from IndexedDB on next use.
   */
  lock(): void {
    this._key = undefined
    this.state.set('fingerprint', undefined)
    this.state.set('keySource', undefined)
  }

  /**
   * Deletes this vault's device key from IndexedDB, for example on sign-out.
   * **Anything encrypted with it can no longer be decrypted.**
   *
   * @returns {Promise<void>}
   */
  async forget(): Promise<void> {
    const vaultId = this.requireVaultId()
    const db = await this.openDb()
    await request(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(vaultId))
    db.close()
    if (this.state.get('keySource') === 'device' || this.state.get('keySource') === 'created') this.lock()
  }

  /**
   * Encrypts a string. Creates the device key on first use, unless a `secret` was
   * passed or `unlock()` was called.
   *
   * @param {string} plaintext - The string to encrypt
   * @returns {Promise<string>} A single-line payload: `v1:<fingerprint>:<iv>:<ciphertext>:<tag>`
   */
  async encrypt(plaintext: string): Promise<string> {
    const key = await this.loadKey({ create: true })
    const iv = crypto.getRandomValues(new Uint8Array(12))
    // WebCrypto appends the 16-byte auth tag to the ciphertext; split it out to match node.
    const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)))
    const ciphertext = sealed.slice(0, sealed.length - 16)
    const tag = sealed.slice(sealed.length - 16)
    return [PAYLOAD_VERSION, this.fingerprint, toBase64Url(iv), toBase64Url(ciphertext), toBase64Url(tag)].join(':')
  }

  /**
   * Decrypts a payload made by `encrypt()`, by this vault or the node vault with the
   * same key. Never creates a key.
   *
   * @param {string} payload - A payload from `encrypt()`
   * @returns {Promise<string>} The plaintext
   * @throws {Error} If the payload was made with a different key, was tampered with, or is malformed
   */
  async decrypt(payload: string): Promise<string> {
    const key = await this.loadKey({ create: false })
    let iv: Bytes, sealed: Bytes

    if (payload.startsWith(`${PAYLOAD_VERSION}:`)) {
      const parts = payload.split(':')
      if (parts.length !== 5) throw new Error('Malformed vault payload')
      const [, payloadFingerprint, ivText, ctText, tagText] = parts as [string, string, string, string, string]
      if (payloadFingerprint !== this.fingerprint) {
        throw new Error(`This payload was encrypted with a different key (fingerprint ${payloadFingerprint}); this vault's key is ${this.fingerprint}.`)
      }
      iv = fromBase64Url(ivText)
      sealed = concat(fromBase64Url(ctText), fromBase64Url(tagText))
    } else {
      // Payloads written before v1: node wrote iv/ciphertext/tag, the web vault wrote ciphertext+tag/iv.
      const parts = payload.split(LEGACY_DELIMITER)
      if (parts.length === 3) {
        iv = fromBase64(parts[0]!)
        sealed = concat(fromBase64(parts[1]!), fromBase64(parts[2]!))
      } else if (parts.length === 2) {
        sealed = fromBase64(parts[0]!)
        iv = fromBase64(parts[1]!)
      } else {
        throw new Error('Malformed vault payload')
      }
    }

    if (iv.length !== 12 || sealed.length < 16) throw new Error('Malformed vault payload')
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, sealed))
  }

  /**
   * Encrypts any JSON-serializable value.
   *
   * @param {any} value - The value to encrypt
   * @returns {Promise<string>} A payload, as from `encrypt()`
   */
  async encryptJson(value: any): Promise<string> {
    return this.encrypt(JSON.stringify(value))
  }

  /**
   * Decrypts a payload made by `encryptJson()` and parses it.
   *
   * @param {string} payload - A payload from `encryptJson()`
   * @returns {Promise<any>} The original value
   */
  async decryptJson<T = any>(payload: string): Promise<T> {
    return JSON.parse(await this.decrypt(payload))
  }

  private requireVaultId(): string {
    if (!this.options.vaultId) {
      throw new Error(`The web vault needs a vaultId: container.feature('vault', { vaultId: 'my-app' }). There is no shared default key.`)
    }
    return this.options.vaultId
  }

  private async loadKey({ create }: { create: boolean }): Promise<CryptoKey> {
    if (this._key) return this._key

    if (this.options.secret) {
      const raw = fromBase64(this.options.secret)
      if (raw.length !== 32) throw new Error(`Vault keys must be 32 bytes (got ${raw.length}). Use vault.generateKey() to make one.`)
      return this.useKey(await importAesKey(raw), await fingerprintOf(raw), 'option')
    }

    const vaultId = this.requireVaultId()
    const db = await this.openDb()
    try {
      const stored = await request<StoredKey | undefined>(db.transaction(STORE, 'readonly').objectStore(STORE).get(vaultId))
      if (stored) return this.useKey(stored.key, stored.fingerprint, 'device')

      if (!create) {
        throw new Error(`No key for vault ${vaultId} in this browser. Encrypt something to create one, or call unlock(passphrase).`)
      }

      // Fingerprint the raw bytes once, then keep only the non-extractable key.
      const raw = crypto.getRandomValues(new Uint8Array(32))
      const fingerprint = await fingerprintOf(raw)
      const key = await importAesKey(raw)
      raw.fill(0)
      const record: StoredKey = { vaultId, key, fingerprint, createdAt: Date.now() }
      await request(db.transaction(STORE, 'readwrite').objectStore(STORE).add(record))
      return this.useKey(key, fingerprint, 'created')
    } finally {
      db.close()
    }
  }

  private useKey(key: CryptoKey, fingerprint: string, source: KeySource): CryptoKey {
    this._key = key
    this.state.set('vaultId', this.options.vaultId)
    this.state.set('fingerprint', fingerprint)
    this.state.set('keySource', source)
    return key
  }

  private openDb(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is not available here. Pass a `secret` or call unlock(passphrase).'))
    }
    const open = indexedDB.open(this.options.dbName ?? 'luca-vault', 1)
    open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: 'vaultId' })
    return request(open)
  }
}

export default WebVault

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function importAesKey(raw: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function fingerprintOf(raw: Bytes): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', raw))
  return Array.from(digest.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
}

function concat(a: Bytes, b: Bytes): Bytes {
  const out = new Uint8Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(text: string): Bytes {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Bytes {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  return fromBase64(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
}
