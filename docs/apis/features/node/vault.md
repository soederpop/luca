# Vault (features.vault)

> Stability: `stable`

AES-256-GCM encryption with a per-project key that persists between runs. Each project gets its own vault. On first `encrypt()`, the vault writes a random vault ID to `.luca/vault.json` (commit it, it is not secret) and a key to `~/.luca/vaults/<vaultId>.key` (mode 600, never in the repo). Later runs, and teammates who have the key file, load the same key. A project only ever loads the key named by its own vault ID, so it cannot pick up another project's key. Key lookup, in order: the `secret` option, then the env var `LUCA_VAULT_KEY_<VAULT_ID>` (for CI; there is deliberately no global key var), then the key file. `vault.envVar` gives the exact env var name. Payloads are single-line text (`v1:<fingerprint>:<iv>:<ciphertext>:<tag>`, base64url), safe in `.env` files, JSON, and shell args, and identical to the web vault's format. The fingerprint means a wrong key gives a clear error instead of a generic auth failure. Tampered payloads always throw. Payloads from older versions (the multi-line format) still decrypt. **Losing the key file means losing the data.** Back it up with `vault.exportKey()`.

## Usage

```ts
container.feature('vault')
```

## Methods

### generateKey

Creates a new random 32-byte key and returns it as base64. Has no side effects: it does not change this vault's key. Pass the result as `secret` to use it.

**Returns:** `string`

```ts
const key = vault.generateKey()
const other = container.feature('vault', { secret: key })
```



### exportKey

Returns the loaded key as base64, for backups or for setting `vault.envVar` in CI. Throws if the project has no key yet, rather than creating one.

**Returns:** `string`



### encrypt

Encrypts a string. Creates the project vault and key on first use. A fresh random IV is used every call, so the same input gives a different payload each time. Both still decrypt to the same value.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `plaintext` | `string` | ✓ | The string to encrypt |

**Returns:** `string`

```ts
const a = vault.encrypt('same-input')
const b = vault.encrypt('same-input')
console.log(a === b)                                // false
console.log(vault.decrypt(a) === vault.decrypt(b))  // true
```



### decrypt

Decrypts a payload made by `encrypt()`, by this vault or the web vault with the same key. Never creates a key.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `payload` | `string` | ✓ | A payload from `encrypt()` |

**Returns:** `string`

```ts
const encrypted = vault.encrypt('my-database-password')
vault.decrypt(encrypted)   // 'my-database-password'
```



### encryptJson

Encrypts any JSON-serializable value.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `any` | ✓ | The value to encrypt |

**Returns:** `string`

```ts
const payload = vault.encryptJson({ user: 'app', password: 'hunter2' })
vault.decryptJson(payload).password   // 'hunter2'
```



### decryptJson

Decrypts a payload made by `encryptJson()` and parses it.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `payload` | `string` | ✓ | A payload from `encryptJson()` |

**Returns:** `T`



### rotate

Replaces the key and re-encrypts the payloads you pass with it. Every payload is decrypted with the old key first, so a bad payload throws before anything changes. For a file-backed key, the old key is kept as `<vaultId>.<oldFingerprint>.key.bak` next to the new one, and the project file records the new fingerprint. Payloads you do not pass stay encrypted with the old key. For an env-backed key, update the env var with `exportKey()` afterwards.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `payloads` | `T` |  | Payloads to re-encrypt, as an array or a name-to-payload map |

**Returns:** `T`

```ts
const secrets = container.fs.readJson('secrets.enc.json')
container.fs.writeJson('secrets.enc.json', vault.rotate(secrets))
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `projectFilePath` | `string` | The project file that records this project's vault ID and key fingerprint. |
| `vaultId` | `string | undefined` | The vault ID for this project, or undefined if the project has no vault yet (one is created on the first `encrypt()`), or an explicit `secret` is in use. |
| `keyPath` | `string | undefined` | Where this project's key file lives: `<keysDir>/<vaultId>.key`. |
| `envVar` | `string | undefined` | The env var that supplies this vault's key in CI, e.g. `LUCA_VAULT_KEY_VLT_1A2B3C`. It is named by vault ID so a key exported in your shell for one project is never used by another. |
| `fingerprint` | `string | undefined` | Short hash of the loaded key, recorded in every payload and in the project file. |

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
const vault = container.feature('vault')

// First use creates .luca/vault.json and ~/.luca/vaults/<vaultId>.key
const token = vault.encrypt('sk_live_123')
vault.decrypt(token)                         // 'sk_live_123', in this run or any later one

const config = vault.encryptJson({ user: 'app', password: 'hunter2' })
vault.decryptJson(config).password           // 'hunter2'

console.log(vault.envVar)                    // 'LUCA_VAULT_KEY_VLT_...' - set this in CI
const backup = vault.exportKey()             // base64 key, store it somewhere safe

// An explicit key skips the project vault (useful for ephemeral or derived keys)
const scratch = container.feature('vault', { secret: vault.generateKey() })
```



**generateKey**

```ts
const key = vault.generateKey()
const other = container.feature('vault', { secret: key })
```



**encrypt**

```ts
const a = vault.encrypt('same-input')
const b = vault.encrypt('same-input')
console.log(a === b)                                // false
console.log(vault.decrypt(a) === vault.decrypt(b))  // true
```



**decrypt**

```ts
const encrypted = vault.encrypt('my-database-password')
vault.decrypt(encrypted)   // 'my-database-password'
```



**encryptJson**

```ts
const payload = vault.encryptJson({ user: 'app', password: 'hunter2' })
vault.decryptJson(payload).password   // 'hunter2'
```



**rotate**

```ts
const secrets = container.fs.readJson('secrets.enc.json')
container.fs.writeJson('secrets.enc.json', vault.rotate(secrets))
```

