# WebVault (features.vault)

AES-256-GCM encryption and decryption for the browser using the Web Crypto API. Generates or accepts a secret key and provides `encrypt()` / `decrypt()` methods that work entirely client-side. Keys are stored as base64-encoded state so they can persist across sessions when needed.

## Usage

```ts
container.feature('vault')
```

## Methods

### secret

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `{ refresh = false, set = true }` | `any` |  | Parameter { refresh = false, set = true } |

**Returns:** `Promise<ArrayBuffer>`



### decrypt

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `payload` | `string` | ✓ | Parameter payload |

**Returns:** `void`



### encrypt

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `payload` | `string` | ✓ | Parameter payload |

**Returns:** `void`



## Examples

**features.vault**

```ts
const vault = container.feature('vault')
const encrypted = await vault.encrypt('secret data')
const decrypted = await vault.decrypt(encrypted)
console.log(decrypted) // 'secret data'
```

