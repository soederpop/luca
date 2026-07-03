import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import crypto from 'node:crypto'
import { Feature } from '../feature.js'
import { type ContainerContext } from '../../container.js'

export const VaultStateSchema = FeatureStateSchema.extend({
  /** Secret key buffer used for encryption/decryption */
  secret: z.custom<Buffer>().optional().describe('Secret key buffer used for encryption/decryption'),
})
export type VaultState = z.infer<typeof VaultStateSchema>

export const VaultOptionsSchema = FeatureOptionsSchema.extend({
  /** Secret key as Buffer or base64 string for encryption */
  secret: z.union([z.custom<Buffer>(), z.string()]).optional().describe('Secret key as Buffer or base64 string for encryption'),
})
export type VaultOptions = z.infer<typeof VaultOptionsSchema>

/**
 * The Vault feature provides encryption and decryption capabilities using AES-256-GCM.
 *
 * This feature allows you to securely encrypt and decrypt sensitive data using
 * industry-standard encryption. It manages secret keys and provides a simple
 * interface for cryptographic operations.
 *
 * **Keys are NOT persisted.** Unless you pass a `secret` option, the vault mints a
 * brand-new random key the first time one is needed, and that key lives only in
 * process memory. Every `luca` invocation (every process) gets a fresh key, so data
 * encrypted in one run CANNOT be decrypted in a later run unless you save the key
 * yourself and pass it back via `container.feature('vault', { secret })`.
 *
 * @example
 * ```typescript
 * const vault = container.feature('vault')
 *
 * // Encrypt sensitive data
 * const encrypted = vault.encrypt('sensitive information')
 * console.log(encrypted) // Base64 encoded encrypted data
 *
 * // Decrypt the data (same process — the in-memory key is still around)
 * const decrypted = vault.decrypt(encrypted)
 * console.log(decrypted) // 'sensitive information'
 *
 * // ── Cross-invocation decryption: persist the key and pass it back ──
 * // Run 1: encrypt and save the base64 key alongside (or apart from) the data
 * const v1 = container.feature('vault')
 * const payload = v1.encrypt('remember me')
 * await container.fs.writeFileAsync('secret.key', v1.secretText!)  // base64 key
 * await container.fs.writeFileAsync('payload.enc', payload)
 *
 * // Run 2 (a NEW process): restore the key via the `secret` option
 * const key = container.fs.readFile('secret.key') as string
 * const v2 = container.feature('vault', { secret: key })            // base64 string or Buffer
 * v2.decrypt(container.fs.readFile('payload.enc') as string)        // 'remember me'
 * ```
 *
 * @extends Feature
 */
export class Vault extends Feature<VaultState, VaultOptions> {
  static override shortcut = 'features.vault' as const
  static override stability = 'stable' as const
  static override stateSchema = VaultStateSchema
  static override optionsSchema = VaultOptionsSchema
  static { Feature.register(this, 'vault') }

  constructor(options: VaultOptions, context: ContainerContext) {
    let secret = options.secret
    
    if (typeof secret === 'string') {
      secret = Buffer.from(secret, 'base64')
    }

    super({ ...options, secret }, context)  
    
    this.state.set('secret', secret)
  }
  
  /**
   * Gets the secret key as a base64-encoded string.
   *
   * Lazily populated: unless a `secret` option was passed at construction, this is
   * `undefined` until something forces key generation — i.e. until `secret()`,
   * `encrypt()`, or `decrypt()` has run. Call `vault.secret()` first if you want to
   * read `secretText` before encrypting anything.
   *
   * @returns {string | undefined} The secret key encoded as base64, or undefined if no secret has been set or generated yet
   */
  get secretText() {
    return this.state.get('secret')!?.toString('base64')
  }

  /**
   * Gets or generates a secret key for encryption operations.
   *
   * If no key exists yet, this mints a NEW cryptographically random 32-byte key —
   * it is not derived from anything and is never written to disk. Each process
   * therefore gets its own key: data encrypted with it is undecryptable in any
   * other `luca` invocation unless you persist the key (see `secretText`) and pass
   * it back via `container.feature('vault', { secret })`.
   *
   * @param {object} [options={}] - Options for secret key handling
   * @param {boolean} [options.refresh=false] - Whether to generate a new secret key
   * @param {boolean} [options.set=true] - Whether to store the generated key in state
   * @returns {Buffer} The secret key as a Buffer
   */
  secret({ refresh = false, set = true } = {}) : Buffer {
    if (!refresh && this.state.get('secret')) {
      return this.state.get('secret')!
    }

    const val = generateSecretKey()   

    if(set && !this.state.get('secret')) {
      this.state.set('secret', val)
    }

    return val
  }
 
  /**
   * Decrypts an encrypted payload that was created by the encrypt method.
   *
   * Because AES-256-GCM is authenticated encryption, decryption verifies the
   * auth tag — a tampered or truncated payload, or the wrong key, throws rather
   * than silently returning garbage.
   *
   * @param {string} payload - The encrypted payload to decrypt (base64 encoded with delimiters)
   * @returns {string} The decrypted plaintext
   * @throws {Error} Throws an error if decryption fails or the payload is malformed
   *
   * @example
   * ```typescript
   * const vault = container.feature('vault')
   * const encrypted = vault.encrypt('my-database-password-12345')
   *
   * const decrypted = vault.decrypt(encrypted)
   * console.log(decrypted)                                    // 'my-database-password-12345'
   * console.log(decrypted === 'my-database-password-12345')   // true — exact round-trip
   * ```
   */
  decrypt(payload: string) {
    const [iv, ciphertext, authTag] = payload.split('\n------\n').map((v) => Buffer.from(v, 'base64'))
    return this._decrypt(ciphertext!, iv!, authTag!)
  }

  /**
   * Encrypts a plaintext string using AES-256-GCM encryption.
   *
   * The output is an opaque text payload — three base64 segments (IV, ciphertext,
   * auth tag) joined by a delimiter — safe to store in config files or databases.
   *
   * A fresh random IV is generated on every call, so encrypting the same input
   * twice produces different ciphertexts (semantic security): an attacker cannot
   * tell whether two payloads contain the same plaintext. Both still decrypt to
   * the same value.
   *
   * @param {string} payload - The plaintext string to encrypt
   * @returns {string} The encrypted payload as a base64 encoded string with delimiters
   *
   * @example
   * ```typescript
   * const vault = container.feature('vault')
   *
   * // Same input, unique ciphertext every time — a fresh IV is used per call
   * const a = vault.encrypt('same-input')
   * const b = vault.encrypt('same-input')
   * console.log(a === b)                                   // false
   * console.log(vault.decrypt(a) === vault.decrypt(b))     // true — both round-trip
   * ```
   */
  encrypt(payload: string) {
    const { iv, ciphertext, authTag } = this._encrypt(payload)
    
    return [
      iv.toString('base64'),
      ciphertext.toString('base64'),
      authTag.toString('base64')
    ].join('\n------\n')
  }
  
  private _encrypt(payload: string) {
    const secret = this.secret()
    const { iv, ciphertext, authTag } = encrypt(payload, secret)
    return { iv, ciphertext, authTag }
  }
  
  private _decrypt(cipher: Buffer, iv: Buffer, authTag: Buffer) {
    return decrypt(cipher, this.secret(), iv, authTag)
  }
}

export default Vault
function generateSecretKey(): Buffer {
  return crypto.randomBytes(32);
}

type EncryptionResult = {
  iv: Buffer;
  ciphertext: Buffer;
  authTag: Buffer;
};

function encrypt(plaintext: string, secretKey: Buffer): EncryptionResult {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { iv, ciphertext, authTag };
}

function decrypt(ciphertext: Buffer, secretKey: Buffer, iv: Buffer, authTag: Buffer): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  return plaintext;
}
