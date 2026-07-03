# DiskCache (features.diskCache)

> Stability: `core`

File-backed key-value cache built on top of the cacache library (the same store that powers npm). Suitable for persisting arbitrary data including very large blobs when necessary, with optional encryption support. Supports time-to-live expiry: pass `ttl` (seconds) in the feature options as a default for every entry, or per entry via `meta.ttl` on `set()`. Expired entries are removed on access and behave exactly like cache misses. The cache directory (from the `path` option, or a default under the OS cache dir) is created automatically on first use — no setup step is required.

## Usage

```ts
container.feature('diskCache')
```

## Methods

### saveFile

Retrieve a file from the disk cache and save it to the local disk

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | The cache key to retrieve |
| `outputPath` | `string` | ✓ | The local path where the file should be saved |
| `isBase64` | `any` |  | Whether the cached content is base64 encoded |

**Returns:** `Promise<Buffer | string>`

```ts
await diskCache.set('myFile', 'file contents')
await diskCache.saveFile('myFile', './file.txt')

// Base64-encoded entries (e.g. images) are decoded before writing
await diskCache.set('encodedImage', Buffer.from('binary data').toString('base64'))
await diskCache.saveFile('encodedImage', './photo.jpg', true)
```



### ensure

Ensure a key exists in the cache, setting it with the provided content if it doesn't exist

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | The cache key to check/set |
| `content` | `string` | ✓ | The content to set if the key doesn't exist |

**Returns:** `Promise<string>`

```ts
const defaultConfig = { theme: 'dark', retries: 3 }
await diskCache.ensure('config', JSON.stringify(defaultConfig))
```



### copy

Copy a cached item from one key to another

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` | ✓ | The source cache key |
| `destination` | `string` | ✓ | The destination cache key |
| `overwrite` | `boolean` |  | Whether to overwrite if destination exists (default: false) |

**Returns:** `Promise<string>`

```ts
await diskCache.set('original', 'important data')
await diskCache.set('file1', 'v1')
await diskCache.copy('original', 'backup')
await diskCache.copy('file1', 'file2', true) // force overwrite
```



### move

Move a cached item from one key to another (copy then delete source)

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` | ✓ | The source cache key |
| `destination` | `string` | ✓ | The destination cache key |
| `overwrite` | `boolean` |  | Whether to overwrite if destination exists (default: false) |

**Returns:** `Promise<string>`

```ts
await diskCache.set('temp', 'work in progress')
await diskCache.set('old_key', 'legacy value')
await diskCache.move('temp', 'permanent')
await diskCache.move('old_key', 'new_key', true) // force overwrite
```



### has

Check if a key exists in the cache

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | The cache key to check |

**Returns:** `Promise<boolean>`

```ts
if (await diskCache.has('myKey')) {
 console.log('Key exists!')
}
```



### get

Retrieve a value from the cache

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | The cache key to retrieve |
| `json` | `any` |  | Whether to parse the value as JSON (default: false) |

**Returns:** `Promise<any>`

```ts
await diskCache.set('myText', 'Hello World')
await diskCache.set('myData', { count: 42 })
const text = await diskCache.get('myText')
const data = await diskCache.get('myData', true) // parse as JSON
```



### set

Store a value in the cache

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | The cache key to store under |
| `value` | `any` | ✓ | The value to store (string, object, or any serializable data) |
| `meta` | `any` |  | Optional metadata to associate with the cached item. `meta.ttl` |

**Returns:** `Promise<any>`

```ts
const content = Buffer.from('binary data').toString('base64')
const jwt = 'header.payload.signature'
await diskCache.set('myKey', 'Hello World')
await diskCache.set('userData', { name: 'John', age: 30 })
await diskCache.set('file', content, { size: 1024, type: 'image' })
await diskCache.set('token', jwt, { ttl: 900 }) // expires in 15 minutes
```



### rm

Remove a cached item

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | The cache key to remove |

**Returns:** `Promise<any>`

```ts
await diskCache.rm('obsoleteKey')
```



### clearAll

Clear all cached items

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `confirm` | `any` |  | Must be set to true to confirm the operation |

**Returns:** `Promise<this>`

```ts
await diskCache.clearAll(true) // Must explicitly confirm
```



### keys

Get all cache keys

**Returns:** `Promise<string[]>`

```ts
const allKeys = await diskCache.keys()
console.log(`Cache contains ${allKeys.length} items`)
```



### listKeys

List all cache keys (alias for keys())

**Returns:** `Promise<string[]>`

```ts
const keyList = await diskCache.listKeys()
```



### create

Create a cacache instance with the specified path

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` |  | Optional cache directory path (defaults to options.path or ~/.cache/luca/disk-cache-{cwdHash}) |

**Returns:** `void`

```ts
const cachePath = container.paths.resolve(container.feature('os').tmpdir, 'my-cache')
const customCache = diskCache.create(cachePath)
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `cache` | `ReturnType<typeof this.create>` | Returns the underlying cacache instance configured with the cache directory path. |
| `securely` | `{ set(name: string, payload: any, meta?: any, expiresAt?: number): Promise<any>; get(name: string): Promise<any> }` | Get encrypted cache operations interface Requires encryption to be enabled and a secret to be provided |

## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.diskCache**

```ts
const diskCache = container.feature('diskCache', { path: '/tmp/cache' })
await diskCache.set('greeting', 'Hello World')
const value = await diskCache.get('greeting')
```

```ts
// TTL: entries expire and read as cache misses afterwards
const cache = container.feature('diskCache', { ttl: 3600 }) // default: 1 hour
const token = 'abc123'
const data = { symbol: 'LUCA', price: 42 }
await cache.set('session', token)                  // expires in 1 hour
await cache.set('quote', data, { ttl: 60 })        // per-entry override: 60 seconds
```



**saveFile**

```ts
await diskCache.set('myFile', 'file contents')
await diskCache.saveFile('myFile', './file.txt')

// Base64-encoded entries (e.g. images) are decoded before writing
await diskCache.set('encodedImage', Buffer.from('binary data').toString('base64'))
await diskCache.saveFile('encodedImage', './photo.jpg', true)
```



**ensure**

```ts
const defaultConfig = { theme: 'dark', retries: 3 }
await diskCache.ensure('config', JSON.stringify(defaultConfig))
```



**copy**

```ts
await diskCache.set('original', 'important data')
await diskCache.set('file1', 'v1')
await diskCache.copy('original', 'backup')
await diskCache.copy('file1', 'file2', true) // force overwrite
```



**move**

```ts
await diskCache.set('temp', 'work in progress')
await diskCache.set('old_key', 'legacy value')
await diskCache.move('temp', 'permanent')
await diskCache.move('old_key', 'new_key', true) // force overwrite
```



**has**

```ts
if (await diskCache.has('myKey')) {
 console.log('Key exists!')
}
```



**get**

```ts
await diskCache.set('myText', 'Hello World')
await diskCache.set('myData', { count: 42 })
const text = await diskCache.get('myText')
const data = await diskCache.get('myData', true) // parse as JSON
```



**set**

```ts
const content = Buffer.from('binary data').toString('base64')
const jwt = 'header.payload.signature'
await diskCache.set('myKey', 'Hello World')
await diskCache.set('userData', { name: 'John', age: 30 })
await diskCache.set('file', content, { size: 1024, type: 'image' })
await diskCache.set('token', jwt, { ttl: 900 }) // expires in 15 minutes
```



**rm**

```ts
await diskCache.rm('obsoleteKey')
```



**clearAll**

```ts
await diskCache.clearAll(true) // Must explicitly confirm
```



**keys**

```ts
const allKeys = await diskCache.keys()
console.log(`Cache contains ${allKeys.length} items`)
```



**listKeys**

```ts
const keyList = await diskCache.listKeys()
```



**create**

```ts
const cachePath = container.paths.resolve(container.feature('os').tmpdir, 'my-cache')
const customCache = diskCache.create(cachePath)
```



**securely**

```ts
// Initialize with encryption (secret must be a 32-byte key for AES-256)
const cache = container.feature('diskCache', {
 encrypt: true,
 secret: Buffer.alloc(32, 'my-secret-key')
})

// Use encrypted operations
await cache.securely.set('sensitive', 'secret data')
const decrypted = await cache.securely.get('sensitive')
```

