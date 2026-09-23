import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import crypto from 'node:crypto'
// The fs feature has no chmod, and a key file readable by other users defeats the point.
import { chmodSync } from 'node:fs'
import { Feature } from '../feature.js'
import { type ContainerContext } from '../../container.js'
import { lucaHome } from '../../setup/paths.js'

export const VaultStateSchema = FeatureStateSchema.extend({
  vaultId: z.string().optional().describe('ID of the project vault this key belongs to (undefined for an explicit `secret`)'),
  fingerprint: z.string().optional().describe('Short hash of the loaded key. Every payload records it, so the wrong key is caught before decrypting'),
  keySource: z.enum(['option', 'env', 'file', 'created']).optional().describe('Where the loaded key came from'),
})
export type VaultState = z.infer<typeof VaultStateSchema>

export const VaultOptionsSchema = FeatureOptionsSchema.extend({
  secret: z.union([z.custom<Buffer>(), z.string()]).optional().describe('Explicit 32-byte key as a Buffer or base64 string. Skips the project vault entirely'),
  vaultId: z.string().optional().describe('Use this vault ID instead of the one in the project file'),
  keysDir: z.string().optional().describe('Folder that holds key files (default: <LUCA_HOME>/vaults, i.e. ~/.luca/vaults)'),
  projectFile: z.string().optional().describe('Project file that records the vault ID and key fingerprint (default: .luca/vault.json, committed)'),
})
export type VaultOptions = z.infer<typeof VaultOptionsSchema>

type VaultProjectConfig = { vaultId: string; fingerprint?: string }
type VaultPayloads = string[] | Record<string, string>

const PAYLOAD_VERSION = 'v1'
const LEGACY_DELIMITER = '\n------\n'

/**
 * AES-256-GCM encryption with a per-project key that persists between runs.
 *
 * Each project gets its own vault. On first `encrypt()`, the vault writes a random
 * vault ID to `.luca/vault.json` (commit it, it is not secret) and a key to
 * `~/.luca/vaults/<vaultId>.key` (mode 600, never in the repo). Later runs, and
 * teammates who have the key file, load the same key. A project only ever loads the
 * key named by its own vault ID, so it cannot pick up another project's key.
 *
 * Key lookup, in order: the `secret` option, then the env var
 * `LUCA_VAULT_KEY_<VAULT_ID>` (for CI; there is deliberately no global key var),
 * then the key file. `vault.envVar` gives the exact env var name.
 *
 * Payloads are single-line text (`v1:<fingerprint>:<iv>:<ciphertext>:<tag>`, base64url),
 * safe in `.env` files, JSON, and shell args, and identical to the web vault's format.
 * The fingerprint means a wrong key gives a clear error instead of a generic auth
 * failure. Tampered payloads always throw. Payloads from older versions (the
 * multi-line format) still decrypt.
 *
 * **Losing the key file means losing the data.** Back it up with `vault.exportKey()`.
 *
 * @example
 * ```typescript
 * const vault = container.feature('vault')
 *
 * // First use creates .luca/vault.json and ~/.luca/vaults/<vaultId>.key
 * const token = vault.encrypt('sk_live_123')
 * vault.decrypt(token)                         // 'sk_live_123', in this run or any later one
 *
 * const config = vault.encryptJson({ user: 'app', password: 'hunter2' })
 * vault.decryptJson(config).password           // 'hunter2'
 *
 * console.log(vault.envVar)                    // 'LUCA_VAULT_KEY_VLT_...' - set this in CI
 * const backup = vault.exportKey()             // base64 key, store it somewhere safe
 *
 * // An explicit key skips the project vault (useful for ephemeral or derived keys)
 * const scratch = container.feature('vault', { secret: vault.generateKey() })
 * ```
 *
 * @extends Feature
 */
export class Vault extends Feature<VaultState, VaultOptions> {
  static override shortcut = 'features.vault' as const
  static override stability = 'stable' as const
  static override category = 'system' as const
  static override stateSchema = VaultStateSchema
  static override optionsSchema = VaultOptionsSchema
  static { Feature.register(this, 'vault') }

  // Kept off state on purpose: state is observable and serializable, the key must not be.
  private _key?: Buffer
  private ownsProjectFile = false

  constructor(options: VaultOptions, context: ContainerContext) {
    super(options, context)
  }

  /**
   * The project file that records this project's vault ID and key fingerprint.
   *
   * @returns {string} Absolute path, `.luca/vault.json` in the project by default
   */
  get projectFilePath(): string {
    return this.container.paths.resolve(this.options.projectFile ?? '.luca/vault.json')
  }

  /**
   * The vault ID for this project, or undefined if the project has no vault yet
   * (one is created on the first `encrypt()`), or an explicit `secret` is in use.
   *
   * @returns {string | undefined} The vault ID
   */
  get vaultId(): string | undefined {
    if (this.options.secret) return undefined
    return this.options.vaultId ?? this.state.get('vaultId') ?? this.readProjectConfig()?.vaultId
  }

  /**
   * Where this project's key file lives: `<keysDir>/<vaultId>.key`.
   *
   * @returns {string | undefined} Absolute path, or undefined when there is no vault ID
   */
  get keyPath(): string | undefined {
    const id = this.vaultId
    if (!id) return undefined
    const dir = this.options.keysDir ?? this.container.paths.resolve(lucaHome(), 'vaults')
    return this.container.paths.resolve(dir, `${id}.key`)
  }

  /**
   * The env var that supplies this vault's key in CI, e.g. `LUCA_VAULT_KEY_VLT_1A2B3C`.
   * It is named by vault ID so a key exported in your shell for one project is never
   * used by another.
   *
   * @returns {string | undefined} The env var name, or undefined when there is no vault ID
   */
  get envVar(): string | undefined {
    const id = this.vaultId
    return id ? `LUCA_VAULT_KEY_${id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}` : undefined
  }

  /**
   * Short hash of the loaded key, recorded in every payload and in the project file.
   *
   * @returns {string | undefined} 16 hex characters, or undefined until a key is loaded
   */
  get fingerprint(): string | undefined {
    return this.state.get('fingerprint')
  }

  /**
   * Creates a new random 32-byte key and returns it as base64. Has no side effects:
   * it does not change this vault's key. Pass the result as `secret` to use it.
   *
   * @returns {string} A base64-encoded 256-bit key
   *
   * @example
   * ```typescript
   * const key = vault.generateKey()
   * const other = container.feature('vault', { secret: key })
   * ```
   */
  generateKey(): string {
    return crypto.randomBytes(32).toString('base64')
  }

  /**
   * Returns the loaded key as base64, for backups or for setting `vault.envVar` in CI.
   * Throws if the project has no key yet, rather than creating one.
   *
   * @returns {string} The base64-encoded key
   */
  exportKey(): string {
    return this.loadKey({ create: false }).toString('base64')
  }

  /**
   * Encrypts a string. Creates the project vault and key on first use.
   *
   * A fresh random IV is used every call, so the same input gives a different payload
   * each time. Both still decrypt to the same value.
   *
   * @param {string} plaintext - The string to encrypt
   * @returns {string} A single-line payload: `v1:<fingerprint>:<iv>:<ciphertext>:<tag>`
   *
   * @example
   * ```typescript
   * const a = vault.encrypt('same-input')
   * const b = vault.encrypt('same-input')
   * console.log(a === b)                                // false
   * console.log(vault.decrypt(a) === vault.decrypt(b))  // true
   * ```
   */
  encrypt(plaintext: string): string {
    const key = this.loadKey({ create: true })
    return encryptWith(key, fingerprintOf(key), plaintext)
  }

  /**
   * Decrypts a payload made by `encrypt()`, by this vault or the web vault with the
   * same key. Never creates a key.
   *
   * @param {string} payload - A payload from `encrypt()`
   * @returns {string} The plaintext
   * @throws {Error} If the payload was made with a different key, was tampered with, or is malformed
   *
   * @example
   * ```typescript
   * const encrypted = vault.encrypt('my-database-password')
   * vault.decrypt(encrypted)   // 'my-database-password'
   * ```
   */
  decrypt(payload: string): string {
    return decryptWith(this.loadKey({ create: false }), payload)
  }

  /**
   * Encrypts any JSON-serializable value.
   *
   * @param {any} value - The value to encrypt
   * @returns {string} A payload, as from `encrypt()`
   *
   * @example
   * ```typescript
   * const payload = vault.encryptJson({ user: 'app', password: 'hunter2' })
   * vault.decryptJson(payload).password   // 'hunter2'
   * ```
   */
  encryptJson(value: any): string {
    return this.encrypt(JSON.stringify(value))
  }

  /**
   * Decrypts a payload made by `encryptJson()` and parses it.
   *
   * @param {string} payload - A payload from `encryptJson()`
   * @returns {any} The original value
   */
  decryptJson<T = any>(payload: string): T {
    return JSON.parse(this.decrypt(payload))
  }

  /**
   * Replaces the key and re-encrypts the payloads you pass with it.
   *
   * Every payload is decrypted with the old key first, so a bad payload throws before
   * anything changes. For a file-backed key, the old key is kept as
   * `<vaultId>.<oldFingerprint>.key.bak` next to the new one, and the project file
   * records the new fingerprint. Payloads you do not pass stay encrypted with the old
   * key. For an env-backed key, update the env var with `exportKey()` afterwards.
   *
   * @param {string[] | Record<string, string>} payloads - Payloads to re-encrypt, as an array or a name-to-payload map
   * @returns {string[] | Record<string, string>} The re-encrypted payloads, in the same shape
   *
   * @example
   * ```typescript
   * const secrets = container.fs.readJson('secrets.enc.json')
   * container.fs.writeJson('secrets.enc.json', vault.rotate(secrets))
   * ```
   */
  rotate<T extends VaultPayloads>(payloads: T = [] as unknown as T): T {
    const oldKey = this.loadKey({ create: false })
    const entries = Array.isArray(payloads) ? payloads.map((p, i) => [String(i), p] as const) : Object.entries(payloads)
    const plain = entries.map(([name, p]) => [name, decryptWith(oldKey, p)] as const)

    const newKey = crypto.randomBytes(32)
    const newFingerprint = fingerprintOf(newKey)
    const rotated = plain.map(([name, text]) => [name, encryptWith(newKey, newFingerprint, text)] as const)

    const source = this.state.get('keySource')
    if (source === 'file' || source === 'created') {
      const keyPath = this.keyPath!
      const fs = this.container.fs
      const backup = keyPath.replace(/\.key$/, `.${fingerprintOf(oldKey)}.key.bak`)
      fs.writeFile(backup, oldKey.toString('base64'))
      chmodSync(backup, 0o600)
      fs.writeFile(keyPath, newKey.toString('base64'))
      chmodSync(keyPath, 0o600)
    }
    if (source !== 'option' && this.ownsProjectFile) {
      this.writeProjectConfig({ vaultId: this.vaultId!, fingerprint: newFingerprint })
    }

    this._key = newKey
    this.state.set('fingerprint', newFingerprint)

    return (Array.isArray(payloads) ? rotated.map(([, p]) => p) : Object.fromEntries(rotated)) as T
  }

  private readProjectConfig(): VaultProjectConfig | undefined {
    const fs = this.container.fs
    return fs.exists(this.projectFilePath) ? fs.readJson(this.projectFilePath) : undefined
  }

  private writeProjectConfig(config: VaultProjectConfig) {
    this.container.fs.ensureFolder(this.container.paths.dirname(this.projectFilePath))
    this.container.fs.writeJson(this.projectFilePath, config)
  }

  private loadKey({ create }: { create: boolean }): Buffer {
    if (this._key) return this._key

    if (this.options.secret) {
      const secret = this.options.secret
      return this.useKey(typeof secret === 'string' ? Buffer.from(secret, 'base64') : secret, 'option')
    }

    const fs = this.container.fs
    const projectConfig = this.readProjectConfig()
    // An explicit vaultId for some other vault must not read or rewrite this project's file.
    const config = !this.options.vaultId || projectConfig?.vaultId === this.options.vaultId ? projectConfig : undefined
    const ownsProjectFile = config !== undefined || !this.options.vaultId
    let vaultId = this.options.vaultId ?? config?.vaultId

    if (!vaultId) {
      if (!create) {
        throw new Error(`This project has no vault yet (${this.projectFilePath} is missing). Encrypt something to create one.`)
      }
      vaultId = `vlt_${crypto.randomBytes(8).toString('hex')}`
      this.writeProjectConfig({ vaultId })
    }
    this.state.set('vaultId', vaultId)

    const envValue = process.env[this.envVar!]
    let key: Buffer
    let source: 'env' | 'file' | 'created'

    if (envValue) {
      key = Buffer.from(envValue.trim(), 'base64')
      source = 'env'
    } else if (fs.exists(this.keyPath!)) {
      key = Buffer.from(String(fs.readFile(this.keyPath!)).trim(), 'base64')
      source = 'file'
    } else if (create && !config?.fingerprint) {
      key = crypto.randomBytes(32)
      fs.ensureFolder(this.container.paths.dirname(this.keyPath!))
      fs.writeFile(this.keyPath!, key.toString('base64'))
      chmodSync(this.keyPath!, 0o600)
      source = 'created'
    } else {
      // A recorded fingerprint means a key existed once. Never silently replace it.
      throw new Error(
        `No key for vault ${vaultId}. Expected it at ${this.keyPath} or in $${this.envVar}. ` +
        `Restore it from your backup; data encrypted with it cannot be recovered without it.`,
      )
    }

    const fingerprint = fingerprintOf(key)
    if (config?.fingerprint && config.fingerprint !== fingerprint) {
      throw new Error(
        `The key for vault ${vaultId} (from ${source === 'env' ? '$' + this.envVar : this.keyPath}) has fingerprint ${fingerprint}, ` +
        `but ${this.projectFilePath} expects ${config.fingerprint}. Refusing to use a key that does not belong to this project.`,
      )
    }
    if (!config?.fingerprint && ownsProjectFile) {
      this.writeProjectConfig({ vaultId, fingerprint })
    }
    this.ownsProjectFile = ownsProjectFile

    return this.useKey(key, source)
  }

  private useKey(key: Buffer, source: VaultState['keySource']): Buffer {
    if (key.length !== 32) {
      throw new Error(`Vault keys must be 32 bytes (got ${key.length}). Use vault.generateKey() to make one.`)
    }
    this._key = key
    this.state.set('keySource', source)
    this.state.set('fingerprint', fingerprintOf(key))
    return key
  }
}

export default Vault

function fingerprintOf(key: Buffer): string {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16)
}

function encryptWith(key: Buffer, fingerprint: string, plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [PAYLOAD_VERSION, fingerprint, iv.toString('base64url'), ciphertext.toString('base64url'), tag.toString('base64url')].join(':')
}

function decryptWith(key: Buffer, payload: string): string {
  let iv: Buffer, ciphertext: Buffer, tag: Buffer

  if (payload.startsWith(`${PAYLOAD_VERSION}:`)) {
    const parts = payload.split(':')
    if (parts.length !== 5) throw new Error('Malformed vault payload')
    const [, payloadFingerprint, ivText, ctText, tagText] = parts as [string, string, string, string, string]
    const keyFingerprint = fingerprintOf(key)
    if (payloadFingerprint !== keyFingerprint) {
      throw new Error(`This payload was encrypted with a different key (fingerprint ${payloadFingerprint}); this vault's key is ${keyFingerprint}.`)
    }
    iv = Buffer.from(ivText, 'base64url')
    ciphertext = Buffer.from(ctText, 'base64url')
    tag = Buffer.from(tagText, 'base64url')
  } else {
    // Payloads written before v1, e.g. entries already in a diskCache.
    const parts = payload.split(LEGACY_DELIMITER)
    if (parts.length !== 3) throw new Error('Malformed vault payload')
    ;[iv, ciphertext, tag] = parts.map((p) => Buffer.from(p, 'base64')) as [Buffer, Buffer, Buffer]
  }

  if (iv.length !== 12 || tag.length !== 16) throw new Error('Malformed vault payload')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
