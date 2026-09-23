# WebVault (features.vault)

> Stability: `stable`

AES-256-GCM encryption for the browser, with a key the page can use but never read. Keys are WebCrypto `CryptoKey` objects created as non-extractable: page code can encrypt and decrypt with them, but cannot export the raw bytes. Script injected into the page can still decrypt while it runs there, but cannot steal the key. Every vault needs a `vaultId`. The browser already keeps each origin's storage apart; the ID keeps two apps on the same origin apart. There is no default key. Two ways to get a key: - **Device key** (default): created on first `encrypt()` and kept in IndexedDB under the vault ID. It stays on this browser. Good for local data at rest. - **Passphrase**: `unlock(passphrase)` derives the key with PBKDF2, so the same passphrase gives the same key on any device. It is never stored; `lock()` drops it. Payloads use the same single-line format as the node vault (`v1:<fingerprint>:<iv>:<ciphertext>:<tag>`, base64url), so a payload from either side decrypts on the other with the same key. **Never send server secrets (API keys, database passwords) to the browser**, even encrypted. The page must decrypt them to use them, and then the user can read them.

## Usage

```ts
container.feature('vault')
```

## Methods

### generateKey

Creates a new random 32-byte key and returns it as base64. Has no side effects: it does not change this vault's key. Pass the result as `secret` to use it.

**Returns:** `string`



### unlock

Derives this vault's key from a passphrase (PBKDF2-SHA256, 600,000 iterations, salted by vault ID). The same passphrase and vault ID give the same key on any device. The key is kept in memory only; it replaces any device key for this instance until `lock()`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `passphrase` | `string` | ✓ | The passphrase to derive the key from |

**Returns:** `Promise<string>`

```ts
const vault = container.feature('vault', { vaultId: 'notes-sync' })
await vault.unlock('correct horse battery staple')
```



### lock

Drops the key from memory. A passphrase key needs `unlock()` again; a device key reloads from IndexedDB on next use.

**Returns:** `void`



### forget

Deletes this vault's device key from IndexedDB, for example on sign-out. **Anything encrypted with it can no longer be decrypted.**

**Returns:** `Promise<void>`



### encrypt

Encrypts a string. Creates the device key on first use, unless a `secret` was passed or `unlock()` was called.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `plaintext` | `string` | ✓ | The string to encrypt |

**Returns:** `Promise<string>`



### decrypt

Decrypts a payload made by `encrypt()`, by this vault or the node vault with the same key. Never creates a key.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `payload` | `string` | ✓ | A payload from `encrypt()` |

**Returns:** `Promise<string>`



### encryptJson

Encrypts any JSON-serializable value.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `any` | ✓ | The value to encrypt |

**Returns:** `Promise<string>`



### decryptJson

Decrypts a payload made by `encryptJson()` and parses it.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `payload` | `string` | ✓ | A payload from `encryptJson()` |

**Returns:** `Promise<T>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `vaultId` | `string | undefined` | This vault's ID, from the `vaultId` option. |
| `fingerprint` | `string | undefined` | Short hash of the loaded key, recorded in every payload. |
| `isUnlocked` | `boolean` | True when a key is loaded in memory. |

## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `vaultId` | `string` | ID of the project vault this key belongs to (undefined for an explicit `secret`) |
| `fingerprint` | `string` | Short hash of the loaded key. Every payload records it, so the wrong key is caught before decrypting |
| `keySource` | `string` | Where the loaded key came from |

## Examples

**features.vault**

```ts
const vault = container.feature('vault', { vaultId: 'notes-app' })
const encrypted = await vault.encrypt('draft text')   // creates the device key on first use
await vault.decrypt(encrypted)                         // 'draft text'

// Same key on every device: derive it from a passphrase
const synced = container.feature('vault', { vaultId: 'notes-sync' })
await synced.unlock('correct horse battery staple')
const payload = await synced.encryptJson({ title: 'hello' })
synced.lock()
```



**unlock**

```ts
const vault = container.feature('vault', { vaultId: 'notes-sync' })
await vault.unlock('correct horse battery staple')
```

