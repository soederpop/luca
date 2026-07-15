import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import cacache from "cacache";
import { Feature, type FeatureState } from "../feature.js";
import { NodeContainer } from "../container.js";
import { partial } from "lodash-es";
import type { ContainerContext } from "../../container.js";

export const DiskCacheOptionsSchema = FeatureOptionsSchema.extend({
  /** Whether to enable encryption for cached data */
  encrypt: z.boolean().optional().describe('Whether to enable encryption for cached data'),
  /** Secret key used for encryption operations */
  secret: z.custom<Buffer>().optional().describe('Secret key buffer used for encryption operations'),
  /** Custom directory path for the cache storage */
  path: z.string().optional().describe('Custom directory path for the cache storage'),
  /** Default time-to-live in seconds for all entries */
  ttl: z.number().optional().describe('Default time-to-live in seconds for cached entries. Expired entries behave like cache misses. Override per entry with meta.ttl on set()'),
})

export type DiskCacheOptions = z.infer<typeof DiskCacheOptionsSchema>

/**
 * File-backed key-value cache built on top of the cacache library (the same store
 * that powers npm). Suitable for persisting arbitrary data including very large
 * blobs when necessary, with optional encryption support.
 *
 * Supports time-to-live expiry: pass `ttl` (seconds) in the feature options as a default
 * for every entry, or per entry via `meta.ttl` on `set()`. Expired entries are removed
 * on access and behave exactly like cache misses.
 *
 * The cache directory (from the `path` option, or a default under the OS cache dir)
 * is created automatically on first use — no setup step is required.
 *
 * @extends Feature
 * @example
 * ```typescript
 * const diskCache = container.feature('diskCache', { path: '/tmp/cache' })
 * await diskCache.set('greeting', 'Hello World')
 * const value = await diskCache.get('greeting')
 * ```
 *
 * @example
 * ```typescript
 * // TTL: entries expire and read as cache misses afterwards
 * const cache = container.feature('diskCache', { ttl: 3600 }) // default: 1 hour
 * const token = 'abc123'
 * const data = { symbol: 'LUCA', price: 42 }
 * await cache.set('session', token)                  // expires in 1 hour
 * await cache.set('quote', data, { ttl: 60 })        // per-entry override: 60 seconds
 * ```
 */
export class DiskCache extends Feature<FeatureState,DiskCacheOptions> {
  static override shortcut = "features.diskCache" as const
  static override stability = 'core' as const
  static override category = 'data-storage' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = DiskCacheOptionsSchema
  static { Feature.register(this, 'diskCache') }

  /** Returns the underlying cacache instance configured with the cache directory path. */
  get cache(): ReturnType<typeof this.create> {
    if(this._cache) { 
	    return this._cache
    }

    const cache = this.create()

    Object.defineProperty(this, '_cache', { value: cache, enumerable: false })

    return cache
  }
  
  /**
   * Retrieve a file from the disk cache and save it to the local disk
   * @param key - The cache key to retrieve
   * @param outputPath - The local path where the file should be saved
   * @param isBase64 - Whether the cached content is base64 encoded
   * @returns Promise that resolves to the file data as Buffer
   * @example
   * ```typescript
   * await diskCache.set('myFile', 'file contents')
   * await diskCache.saveFile('myFile', './file.txt')
   *
   * // Base64-encoded entries (e.g. images) are decoded before writing
   * await diskCache.set('encodedImage', Buffer.from('binary data').toString('base64'))
   * await diskCache.saveFile('encodedImage', './photo.jpg', true)
   * ```
   */
  async saveFile(key: string, outputPath: string, isBase64 = false): Promise<Buffer | string> {
    const outPath = this.container.paths.resolve(outputPath)
    const content = await this.get(key)  
    const data = isBase64 ? Buffer.from(content, 'base64') : content 
    await this.container.fs.writeFileAsync(outPath, data)
    return data
  }

  /**
   * Ensure a key exists in the cache, setting it with the provided content if it doesn't exist
   * @param key - The cache key to check/set
   * @param content - The content to set if the key doesn't exist
   * @returns Promise that resolves to the key
   * @example
   * ```typescript
   * const defaultConfig = { theme: 'dark', retries: 3 }
   * await diskCache.ensure('config', JSON.stringify(defaultConfig))
   * ```
   */
  async ensure(key: string, content: string): Promise<string> {
    const exists = await this.has(key)
    
    if (!exists) {
      await this.set(key, content)
    }
    
    return key 
  }

  /**
   * Copy a cached item from one key to another
   * @param source - The source cache key
   * @param destination - The destination cache key
   * @param overwrite - Whether to overwrite if destination exists (default: false)
   * @returns Promise that resolves to the destination key
   * @throws Error if destination exists and overwrite is false
   * @example
   * ```typescript
   * await diskCache.set('original', 'important data')
   * await diskCache.set('file1', 'v1')
   * await diskCache.copy('original', 'backup')
   * await diskCache.copy('file1', 'file2', true) // force overwrite
   * ```
   */
  async copy(source: string, destination: string, overwrite: boolean = false): Promise<string> {
    if(!overwrite && (await this.has(destination))) {
      throw new Error('Destination already exists')
    }
    
    const content = await this.get(source)
    await this.set(destination, content)
    return destination
  }

  /**
   * Move a cached item from one key to another (copy then delete source)
   * @param source - The source cache key
   * @param destination - The destination cache key  
   * @param overwrite - Whether to overwrite if destination exists (default: false)
   * @returns Promise that resolves to the destination key
   * @throws Error if destination exists and overwrite is false
   * @example
   * ```typescript
   * await diskCache.set('temp', 'work in progress')
   * await diskCache.set('old_key', 'legacy value')
   * await diskCache.move('temp', 'permanent')
   * await diskCache.move('old_key', 'new_key', true) // force overwrite
   * ```
   */
  async move(source: string, destination: string, overwrite: boolean = false): Promise<string> {
    if(!overwrite && (await this.has(destination))) {
      throw new Error('Destination already exists')
    }
    
    const content = await this.get(source)
    await this.set(destination, content)
    await this.rm(source)
    return destination
  }

  /**
   * Check if a key exists in the cache
   * @param key - The cache key to check
   * @returns Promise that resolves to true if key exists, false otherwise
   * @example
   * ```typescript
   * if (await diskCache.has('myKey')) {
   *   console.log('Key exists!')
   * }
   * ```
   */
  async has(key: string): Promise<boolean> {
    const info = await this.cache.get.info(key)
    if (info == null) return false
    if (this._isExpired(info)) {
      await this.rm(key)
      return false
    }
    return true
  }

  /** Whether a cacache entry's metadata carries an expiresAt timestamp in the past. */
  private _isExpired(info: any): boolean {
    const expiresAt = info?.metadata?.expiresAt
    return typeof expiresAt === 'number' && Date.now() > expiresAt
  }

  /** Remove the entry if it has expired, so subsequent reads behave like a cache miss. */
  private async _evictIfExpired(key: string): Promise<void> {
    const info = await this.cache.get.info(key)
    if (info != null && this._isExpired(info)) {
      await this.rm(key)
    }
  }

  /**
   * Retrieve a value from the cache
   * @param key - The cache key to retrieve
   * @param json - Whether to parse the value as JSON (default: false)
   * @returns Promise that resolves to the cached value (string or parsed JSON)
   * @throws If the key does not exist (or has expired) — a cache miss rejects rather
   *   than returning undefined. Guard with `has()` first, or use `ensure()` to seed
   *   a default value.
   * @example
   * ```typescript
   * await diskCache.set('myText', 'Hello World')
   * await diskCache.set('myData', { count: 42 })
   * const text = await diskCache.get('myText')
   * const data = await diskCache.get('myData', true) // parse as JSON
   * ```
   */
  async get(key: string, json = false): Promise<any> {
    await this._evictIfExpired(key)

    const val = this.options.encrypt
      ? await this.securely.get(key)
      : await this.cache.get(key).then((data: any) => data.data.toString())
    
    if (json) {
      try {
        return JSON.parse(val)
      } catch(error) {
        return { error: "parse error "}
      }
    } else {
      return val
    }
  }
  
  /**
   * Store a value in the cache
   * @param key - The cache key to store under
   * @param value - The value to store (string, object, or any serializable data)
   * @param meta - Optional metadata to associate with the cached item. `meta.ttl`
   *   (seconds) sets a time-to-live for this entry, overriding the feature-level
   *   `ttl` option; after expiry the entry behaves like a cache miss.
   * @returns Promise that resolves when the value is stored
   * @example
   * ```typescript
   * const content = Buffer.from('binary data').toString('base64')
   * const jwt = 'header.payload.signature'
   * await diskCache.set('myKey', 'Hello World')
   * await diskCache.set('userData', { name: 'John', age: 30 })
   * await diskCache.set('file', content, { size: 1024, type: 'image' })
   * await diskCache.set('token', jwt, { ttl: 900 }) // expires in 15 minutes
   * ```
   */
  async set(key: string, value: any, meta?: any): Promise<any> {
    const { ttl = this.options.ttl, ...userMeta } = meta ?? {}
    const hasUserMeta = Object.keys(userMeta).length > 0
    const expiresAt = typeof ttl === 'number' ? Date.now() + ttl * 1000 : undefined

    if (this.options.encrypt) {
      return this.securely.set(key, value, hasUserMeta ? userMeta : undefined, expiresAt)
    }

    const metadata = (hasUserMeta || expiresAt != null)
      ? { ...userMeta, ...(expiresAt != null && { expiresAt }) }
      : undefined

    if(typeof value !== 'string') {
      return this.cache.put(key, Buffer.from(JSON.stringify(value)), {
        ...(metadata && { metadata })
      })
    } else {
      return this.cache.put(key, Buffer.from(value), {
        ...(metadata && { metadata })
      })
    }
  }

  /**
   * Remove a cached item
   * @param key - The cache key to remove
   * @returns Promise that resolves when the item is removed
   * @example
   * ```typescript
   * await diskCache.rm('obsoleteKey')
   * ```
   */
  async rm(key: string): Promise<any> {
    return this.cache.rm.entry(key)
  }
  
  /**
   * Clear all cached items
   * @param confirm - Must be set to true to confirm the operation
   * @returns Promise that resolves to this instance for chaining
   * @throws Error if confirm is not true
   * @example
   * ```typescript
   * await diskCache.clearAll(true) // Must explicitly confirm
   * ```
   */
  async clearAll(confirm = false): Promise<this> {
    if(confirm !== true) {
      throw new Error('Must confirm with clearAll(true)')
    }
    await this.cache.rm.all()
    return this
  }

  /**
   * Get all cache keys
   * @returns Promise that resolves to an array of all cache keys
   * @example
   * ```typescript
   * const allKeys = await diskCache.keys()
   * console.log(`Cache contains ${allKeys.length} items`)
   * ```
   */
  async keys() : Promise<string[]> {
    return this.cache.ls().then((results: Record<string,any>) => Object.keys(results))
  }

  /**
   * List all cache keys (alias for keys())
   * @returns Promise that resolves to an array of all cache keys
   * @example
   * ```typescript
   * const keyList = await diskCache.listKeys()
   * ```
   */
  async listKeys() : Promise<string[]> {
    return this.cache.ls().then((results: Record<string,any>) => Object.keys(results))
  }
  
  /**
   * Get encrypted cache operations interface
   * Requires encryption to be enabled and a secret to be provided
   * @returns Object with encrypted get/set operations
   * @throws Error if encryption is not enabled or no secret is provided
   * @example
   * ```typescript
   * // Initialize with encryption (secret must be a 32-byte key for AES-256)
   * const cache = container.feature('diskCache', {
   *   encrypt: true,
   *   secret: Buffer.alloc(32, 'my-secret-key')
   * })
   * 
   * // Use encrypted operations
   * await cache.securely.set('sensitive', 'secret data')
   * const decrypted = await cache.securely.get('sensitive')
   * ```
   */
  get securely(): { set(name: string, payload: any, meta?: any, expiresAt?: number): Promise<any>; get(name: string): Promise<any> } {
    const { secret, encrypt } = this.options
    
    if (!encrypt) {
      throw new Error(`Cannot use securely without encryption enabled`)
    }

    if (!secret) {
      throw new Error(`Cannot use securely without a secret`) 
    }
    
    const vault = this.container.feature('vault', {
      secret
    })
    
    const { cache } = this

    return {
      /**
       * Store an encrypted value in the cache
       * @param name - The cache key
       * @param payload - The data to encrypt and store
       * @param meta - Optional metadata (will also be encrypted)
       * @param expiresAt - Optional expiry timestamp (ms since epoch), stored in
       *   plaintext so expiry can be checked without decryption
       * @returns Promise that resolves when stored
       */
      async set(name: string, payload: any, meta?: any, expiresAt?: number) {
        const encrypted = vault.encrypt(payload)
        const metadata = {
          ...(meta && { encrypted: vault.encrypt(JSON.stringify(meta)) }),
          ...(expiresAt != null && { expiresAt }),
        }
        return cache.put(name, Buffer.from(encrypted), {
          ...(Object.keys(metadata).length > 0 && { metadata })
        })
      },
      /**
       * Retrieve and decrypt a value from the cache
       * @param name - The cache key
       * @returns Promise that resolves to the decrypted data
       */
      async get(name: string) {
        const value = await cache.get(name).then((data: any) => data.data.toString())
        return vault.decrypt(value)
      }  
    }
  }
 
  _cache!: ReturnType<typeof this.create>
 
  /**
   * Create a cacache instance with the specified path
   * @param path - Optional cache directory path (defaults to options.path or ~/.cache/luca/disk-cache-{cwdHash})
   * @returns Configured cacache instance with all methods bound to the path
   * @example
   * ```typescript
   * const cachePath = container.paths.resolve(container.feature('os').tmpdir, 'my-cache')
   * const customCache = diskCache.create(cachePath)
   * ```
   */
  create(path?: string) {
    if (!path && !this.options.path) {
      const cwdHash = this.container.utils.hashObject(this.container.cwd)
      path = this.container.paths.resolve(this.container.feature('os').cacheDir, `disk-cache-${cwdHash}`)
    } else {
      path = path || this.options.path!
    }
    this.container.fs.ensureFolder(path)
    const arg = (fn: (...args: any) => any) => partial(fn, path);

    const ls = arg(cacache.ls);
    const get = arg(cacache.get);
    const put = arg(cacache.put);
    const rm = arg(cacache.rm);
    const verify = arg(cacache.verify);

    return {
      ...cacache,
      cachePath: path, 
      ls: Object.assign(ls, {
        stream: arg(cacache.ls.stream),
      }),
      get: Object.assign(get, {
        stream: arg(cacache.get.stream),
        byDigest: arg(cacache.get.byDigest),
        copy: arg(cacache.get.copy),
        info: arg(cacache.get.info),
        hasContent: arg(cacache.get.hasContent),
      }),
      put: Object.assign(put, {
        stream: arg(cacache.put.stream),
      }),
      rm: Object.assign(rm, {
        all: arg(cacache.rm.all),
        entry: arg(cacache.rm.entry),
        content: arg(cacache.rm.content),
      }),
      tmp: {
        mkdir: arg(cacache.tmp.mkdir),
        withTmp: arg(cacache.tmp.withTmp),
      },
      verify: Object.assign(verify, {
        lastRun: arg(cacache.verify.lastRun),
      }),
    };
  }
}

export default DiskCache;
