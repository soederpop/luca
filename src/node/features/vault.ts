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
 * @example
 * ```typescript
 * const vault = container.feature('vault')
 * 
 * // Encrypt sensitive data
 * const encrypted = vault.encrypt('sensitive information')
 * console.log(encrypted) // Base64 encoded encrypted data
 * 
 * // Decrypt the data
 * const decrypted = vault.decrypt(encrypted)
 * console.log(decrypted) // 'sensitive information'
 * ```
 * 
 * @extends Feature
 */
export class Vault extends Feature<VaultState, VaultOptions> {
  static { Feature.register(this, 'vault') }
  static override shortcut = 'features.vault' as const
  static override stateSchema = VaultStateSchema
  static override optionsSchema = VaultOptionsSchema

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
   * @returns {string | undefined} The secret key encoded as base64, or undefined if no secret is set
   */
  get secretText() {
    return this.state.get('secret')!?.toString('base64')
  }

  /**
   * Gets or generates a secret key for encryption operations.
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
   * @param {string} payload - The encrypted payload to decrypt (base64 encoded with delimiters)
   * @returns {string} The decrypted plaintext
   * @throws {Error} Throws an error if decryption fails or the payload is malformed
   */
  decrypt(payload: string) {
    const [iv, ciphertext, authTag] = payload.split('\n------\n').map((v) => Buffer.from(v, 'base64'))
    return this._decrypt(ciphertext!, iv!, authTag!)
  }

  /**
   * Encrypts a plaintext string using AES-256-GCM encryption.
   * 
   * @param {string} payload - The plaintext string to encrypt
   * @returns {string} The encrypted payload as a base64 encoded string with delimiters
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
