import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

const createVault = (secret?: Buffer | string) => new NodeContainer().feature('vault', { secret })

describe('Vault encryption', () => {
  it.each([['empty', ''], ['ASCII', 'hello world'], ['Unicode and control characters', '🔐 café\n日本語\u0000'], ['large', 'long payload '.repeat(1000)]])('round-trips %s payloads', (_label, plaintext) => {
    const vault = createVault()
    expect(vault.decrypt(vault.encrypt(plaintext))).toBe(plaintext)
  })

  it('generates and reuses a 256-bit key', () => {
    const vault = createVault()
    const key = vault.secret()
    expect(key.length).toBe(32)
    expect(vault.secret()).toEqual(key)
    expect(vault.secretText).toBe(key.toString('base64'))
  })

  it('can generate a key without storing it', () => {
    const vault = createVault()
    expect(vault.secret({ set: false }).length).toBe(32)
    expect(vault.secretText).toBeUndefined()
  })

  it('restores a saved key in a separate container from Buffer or base64', () => {
    const original = createVault()
    const encrypted = original.encrypt('saved secret')
    expect(createVault(original.secret()).decrypt(encrypted)).toBe('saved secret')
    expect(createVault(original.secretText).decrypt(encrypted)).toBe('saved secret')
  })

  it('uses a fresh IV for repeated encryptions', () => {
    const vault = createVault()
    const first = vault.encrypt('same input')
    const second = vault.encrypt('same input')
    expect(first).not.toBe(second)
    for (const payload of [first, second]) {
      const parts = payload.split('\n------\n')
      expect(parts).toHaveLength(3)
      expect(Buffer.from(parts[0]!, 'base64').length).toBe(12)
      expect(Buffer.from(parts[2]!, 'base64').length).toBe(16)
      expect(vault.decrypt(payload)).toBe('same input')
    }
  })

  it('rejects decryption with a different key', () => {
    expect(() => createVault().decrypt(createVault().encrypt('private'))).toThrow()
  })

  it.each([0, 1, 2])('authenticates payload component %i', (index) => {
    const vault = createVault()
    const parts = vault.encrypt('authenticated data').split('\n------\n')
    const bytes = Buffer.from(parts[index]!, 'base64')
    bytes[0] = bytes[0]! ^ 1
    parts[index] = bytes.toString('base64')
    expect(() => vault.decrypt(parts.join('\n------\n'))).toThrow()
  })

  it.each(['', 'invalid', 'a\n------\nb'])('rejects malformed payload %j', (payload) => {
    expect(() => createVault().decrypt(payload)).toThrow()
  })
})
