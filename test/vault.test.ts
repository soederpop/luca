import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import crypto from 'node:crypto'
import { mkdtempSync, rmSync, statSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeContainer } from '../src/node/container'

const withSecret = (secret?: Buffer | string) => new NodeContainer().feature('vault', { secret: secret ?? crypto.randomBytes(32) })

describe('Vault encryption', () => {
  it.each([['empty', ''], ['ASCII', 'hello world'], ['Unicode and control characters', '🔐 café\n日本語\u0000'], ['large', 'long payload '.repeat(1000)]])('round-trips %s payloads', (_label, plaintext) => {
    const vault = withSecret()
    expect(vault.decrypt(vault.encrypt(plaintext))).toBe(plaintext)
  })

  it('round-trips JSON', () => {
    const vault = withSecret()
    expect(vault.decryptJson(vault.encryptJson({ user: 'app', ports: [1, 2] }))).toEqual({ user: 'app', ports: [1, 2] })
  })

  it('writes single-line v1 payloads with the key fingerprint and a fresh IV', () => {
    const vault = withSecret()
    const first = vault.encrypt('same input')
    const second = vault.encrypt('same input')
    expect(first).not.toBe(second)
    for (const payload of [first, second]) {
      expect(payload).not.toContain('\n')
      const [version, fingerprint, iv, , tag] = payload.split(':')
      expect(version).toBe('v1')
      expect(fingerprint).toBe(vault.fingerprint)
      expect(Buffer.from(iv!, 'base64url').length).toBe(12)
      expect(Buffer.from(tag!, 'base64url').length).toBe(16)
    }
  })

  it('accepts a key as Buffer or base64', () => {
    const key = crypto.randomBytes(32)
    const encrypted = withSecret(key).encrypt('saved secret')
    expect(withSecret(key.toString('base64')).decrypt(encrypted)).toBe('saved secret')
  })

  it('names the fingerprint mismatch when the key is wrong', () => {
    expect(() => withSecret().decrypt(withSecret().encrypt('private'))).toThrow(/different key/)
  })

  it.each([2, 3, 4])('authenticates payload component %i', (index) => {
    const vault = withSecret()
    const parts = vault.encrypt('authenticated data').split(':')
    const bytes = Buffer.from(parts[index]!, 'base64url')
    bytes[0] = bytes[0]! ^ 1
    parts[index] = bytes.toString('base64url')
    expect(() => vault.decrypt(parts.join(':'))).toThrow()
  })

  it.each(['', 'invalid', 'v1:a:b', 'a\n------\nb'])('rejects malformed payload %j', (payload) => {
    expect(() => withSecret().decrypt(payload)).toThrow()
  })

  it('still decrypts the pre-v1 multi-line format', () => {
    const key = crypto.randomBytes(32)
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const ciphertext = Buffer.concat([cipher.update('legacy', 'utf8'), cipher.final()])
    const legacy = [iv, ciphertext, cipher.getAuthTag()].map((b) => b.toString('base64')).join('\n------\n')
    expect(withSecret(key).decrypt(legacy)).toBe('legacy')
  })

  it('generateKey returns a new key without changing the vault', () => {
    const vault = withSecret()
    const before = vault.encrypt('x')
    expect(Buffer.from(vault.generateKey(), 'base64').length).toBe(32)
    expect(vault.decrypt(before)).toBe('x')
  })

  it('rejects keys that are not 32 bytes', () => {
    expect(() => withSecret(Buffer.alloc(16)).encrypt('x')).toThrow(/32 bytes/)
  })
})

describe('Vault project keys', () => {
  let root: string
  let projectFile: string
  let keysDir: string
  const projectVault = (extra: Record<string, any> = {}) => new NodeContainer().feature('vault', { projectFile, keysDir, ...extra })

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'luca-vault-'))
    projectFile = join(root, 'project', '.luca', 'vault.json')
    keysDir = join(root, 'keys')
  })
  afterEach(() => {
    for (const name of Object.keys(process.env)) if (name.startsWith('LUCA_VAULT_KEY_')) delete process.env[name]
    rmSync(root, { recursive: true, force: true })
  })

  it('creates the project file and a mode-600 key file on first encrypt, then reuses them', () => {
    const first = projectVault()
    const payload = first.encrypt('persisted')
    const config = JSON.parse(readFileSync(projectFile, 'utf8'))

    expect(config.vaultId).toMatch(/^vlt_[0-9a-f]{16}$/)
    expect(config.fingerprint).toBe(first.fingerprint)
    expect(first.keyPath).toBe(join(keysDir, `${config.vaultId}.key`))
    expect(statSync(first.keyPath!).mode & 0o777).toBe(0o600)

    // A new container is a new "run": same key, no new vault
    expect(projectVault().decrypt(payload)).toBe('persisted')
    expect(JSON.parse(readFileSync(projectFile, 'utf8')).vaultId).toBe(config.vaultId)
  })

  it('decrypt and exportKey never create a vault', () => {
    expect(() => projectVault().decrypt('v1:x:y:z:w')).toThrow(/no vault yet/)
    expect(() => projectVault().exportKey()).toThrow(/no vault yet/)
    expect(existsSync(projectFile)).toBe(false)
  })

  it('refuses to create a new key when the recorded one is missing', () => {
    projectVault().encrypt('x')
    rmSync(keysDir, { recursive: true })
    expect(() => projectVault().encrypt('y')).toThrow(/Restore it from your backup/)
  })

  it('refuses a key whose fingerprint does not match the project', () => {
    const vault = projectVault()
    vault.encrypt('x')
    writeFileSync(vault.keyPath!, crypto.randomBytes(32).toString('base64'))
    expect(() => projectVault().decrypt('v1:x:y:z:w')).toThrow(/does not belong to this project/)
  })

  it('reads the key from the per-vault env var, and a wrong env key is refused', () => {
    const vault = projectVault()
    const payload = vault.encrypt('from ci')
    const key = vault.exportKey()
    rmSync(keysDir, { recursive: true })

    expect(vault.envVar).toMatch(/^LUCA_VAULT_KEY_VLT_[0-9A-F]{16}$/)
    process.env[vault.envVar!] = key
    expect(projectVault().decrypt(payload)).toBe('from ci')

    process.env[vault.envVar!] = crypto.randomBytes(32).toString('base64')
    expect(() => projectVault().decrypt(payload)).toThrow(/does not belong to this project/)
  })

  it('ignores another vault\'s env var', () => {
    projectVault().encrypt('x')
    process.env.LUCA_VAULT_KEY_VLT_SOMEONE_ELSE = crypto.randomBytes(32).toString('base64')
    expect(projectVault().keyPath).toBeDefined()
    expect(() => projectVault().encrypt('y')).not.toThrow()
  })

  it('an explicit vaultId for another vault does not touch the project file', () => {
    const own = projectVault()
    own.encrypt('x')
    const before = readFileSync(projectFile, 'utf8')
    const other = projectVault({ vaultId: 'vlt_other' })
    expect(other.decrypt(other.encrypt('other'))).toBe('other')
    expect(other.keyPath).toBe(join(keysDir, 'vlt_other.key'))
    expect(readFileSync(projectFile, 'utf8')).toBe(before)
  })

  it('rotate re-encrypts payloads, keeps a backup key, and updates the project fingerprint', () => {
    const vault = projectVault()
    const secrets = { A: vault.encrypt('alpha'), B: vault.encrypt('beta') }
    const oldKey = vault.exportKey()
    const oldFingerprint = vault.fingerprint

    const rotated = vault.rotate(secrets)

    expect(Object.keys(rotated)).toEqual(['A', 'B'])
    expect(vault.fingerprint).not.toBe(oldFingerprint)
    expect(JSON.parse(readFileSync(projectFile, 'utf8')).fingerprint).toBe(vault.fingerprint)
    expect(readFileSync(join(keysDir, `${vault.vaultId}.${oldFingerprint}.key.bak`), 'utf8')).toBe(oldKey)

    const fresh = projectVault()
    expect(fresh.decrypt(rotated.A)).toBe('alpha')
    expect(() => fresh.decrypt(secrets.A)).toThrow(/different key/)
    expect(vault.rotate([rotated.B]).map((p) => vault.decrypt(p))).toEqual(['beta'])
  })

  it('rotate changes nothing when a payload does not decrypt', () => {
    const vault = projectVault()
    const good = vault.encrypt('good')
    const fingerprint = vault.fingerprint
    expect(() => vault.rotate([good, withSecret().encrypt('foreign')])).toThrow()
    expect(vault.fingerprint).toBe(fingerprint)
    expect(projectVault().decrypt(good)).toBe('good')
  })
})

describe('Web vault', () => {
  it('matches the node payload format and keeps vaults apart', async () => {
    const key = crypto.randomBytes(32)
    const nodeVault = withSecret(key)
    const child = Bun.spawnSync(['bun', 'run', join(import.meta.dir, 'fixtures', 'web-vault-check.ts')], {
      env: { ...process.env, KEY: key.toString('base64'), NODE_PAYLOAD: nodeVault.encrypt('hi from node') },
    })
    expect(child.exitCode, child.stderr.toString()).toBe(0)
    const r = JSON.parse(child.stdout.toString().trim().split('\n').pop()!)

    expect(r.roundTrip).toBe('🔐 café\n日本語')
    expect(r.json).toEqual({ a: [1, 2] })
    expect(r.fromNode).toBe('hi from node')
    expect(nodeVault.decrypt(r.webPayload)).toBe('hi from web')
    expect(r.wrongKey.error).toMatch(/different key/)
    expect(r.tampered.ok).toBe(false)
    expect(r.noVaultId.error).toMatch(/needs a vaultId/)
    expect(r.noIndexedDb.error).toMatch(/IndexedDB is not available/)
    expect(r.passphraseSameVault).toBe(true)
    expect(r.passphraseOtherVaultDiffers).toBe(true)
    expect(r.lockedIsUnlocked).toBe(false)
  }, 30000)
})
