import { z } from 'zod'
import Redis from 'ioredis'
import { Feature } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import type { ContainerContext } from '../../container.js'

export const RedisStateSchema = FeatureStateSchema.extend({
  connected: z.boolean().default(false).describe('Whether the redis connection is currently open'),
  url: z.string().default('').describe('Connection URL used for this redis feature instance'),
  subscriberConnected: z.boolean().default(false).describe('Whether the dedicated subscriber connection is open'),
  subscribedChannels: z.array(z.string()).default([]).describe('List of channels currently subscribed to'),
  lastError: z.string().optional().describe('Most recent redis error message, if any'),
})

export const RedisOptionsSchema = FeatureOptionsSchema.extend({
  url: z.string().optional().describe('Redis connection URL, e.g. redis://localhost:6379. Defaults to redis://localhost:6379'),
  prefix: z.string().optional().describe('Key prefix applied to all get/set/del operations for namespace isolation'),
  lazyConnect: z.boolean().default(false).describe('If true, connection is deferred until first command'),
})

export type RedisState = z.infer<typeof RedisStateSchema>
export type RedisOptions = z.infer<typeof RedisOptionsSchema>

export const RedisEventsSchema = FeatureEventsSchema.extend({
  message: z.tuple([
    z.string().describe('The channel name'),
    z.string().describe('The message payload'),
  ]).describe('When a message is received on a subscribed channel'),
  subscribed: z.tuple([
    z.string().describe('The channel name'),
  ]).describe('When successfully subscribed to a channel'),
  unsubscribed: z.tuple([
    z.string().describe('The channel name'),
  ]).describe('When unsubscribed from a channel'),
  error: z.tuple([z.string().describe('The error message')]).describe('When a redis operation fails'),
  closed: z.tuple([]).describe('When the redis connection is closed'),
}).describe('Redis events')

type MessageHandler = (channel: string, message: string) => void

/**
 * Redis feature for shared state and pub/sub communication between container instances.
 *
 * Wraps ioredis with a focused API for the primitives that matter most:
 * key/value state, pub/sub messaging, and cross-instance coordination.
 *
 * Uses a dedicated subscriber connection for pub/sub (ioredis requirement),
 * created lazily on first subscribe call.
 *
 * @example
 * ```typescript
 * const redis = container.feature('redis', { url: 'redis://localhost:6379' })
 *
 * // Shared state
 * await redis.set('worker:status', 'active')
 * const status = await redis.get('worker:status')
 *
 * // Pub/sub between instances
 * redis.on('message', (channel, msg) => console.log(`${channel}: ${msg}`))
 * await redis.subscribe('tasks')
 * await redis.publish('tasks', JSON.stringify({ type: 'ping' }))
 *
 * // JSON helpers
 * await redis.setJSON('config', { workers: 4, debug: true })
 * const config = await redis.getJSON<{ workers: number }>('config')
 * ```
 */
export class RedisFeature extends Feature<RedisState, RedisOptions> {
  static override shortcut = 'features.redis' as const
  static override stateSchema = RedisStateSchema
  static override optionsSchema = RedisOptionsSchema
  static override eventsSchema = RedisEventsSchema
  static { Feature.register(this, 'redis') }

  private _client: Redis
  private _subscriber: Redis | null = null
  private _prefix: string
  private _messageHandlers: Map<string, Set<MessageHandler>> = new Map()

  override get initialState(): RedisState {
    return {
      enabled: false,
      connected: false,
      url: '',
      subscriberConnected: false,
      subscribedChannels: [],
    }
  }

  constructor(options: RedisOptions, context: ContainerContext) {
    super(options, context)

    const url = options.url || 'redis://localhost:6379'
    this._prefix = options.prefix || ''

    this._client = new Redis(url, {
      lazyConnect: options.lazyConnect ?? false,
      retryStrategy: (times: number) => Math.min(times * 200, 5000),
    })

    this.hide('_client')
    this.hide('_subscriber')
    this.hide('_messageHandlers')

    this._client.on('connect', () => {
      this.setState({ connected: true, url })
    })

    this._client.on('error', (err: Error) => {
      this.setState({ lastError: err.message })
      this.emit('error', err.message)
    })

    this._client.on('close', () => {
      this.setState({ connected: false })
    })

    if (!options.lazyConnect) {
      this.setState({ connected: true, url })
    }
  }

  /** The underlying ioredis client for advanced operations. */
  get client(): Redis {
    return this._client
  }

  /** The dedicated subscriber connection, if pub/sub is active. */
  get subscriber(): Redis | null {
    return this._subscriber
  }

  // ── Key/Value Primitives ──────────────────────────────────────────

  private _key(key: string): string {
    return this._prefix ? `${this._prefix}:${key}` : key
  }

  /**
   * Set a key to a string value with optional TTL.
   *
   * @param key - The key name
   * @param value - The string value to store
   * @param ttl - Optional time-to-live in seconds
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this._client.set(this._key(key), value, 'EX', ttl)
    } else {
      await this._client.set(this._key(key), value)
    }
  }

  /**
   * Get a key's value. Returns null if the key doesn't exist.
   *
   * @param key - The key name
   * @returns The stored value, or null
   */
  async get(key: string): Promise<string | null> {
    return this._client.get(this._key(key))
  }

  /**
   * Delete one or more keys.
   *
   * @param keys - One or more key names to delete
   * @returns Number of keys that were deleted
   */
  async del(...keys: string[]): Promise<number> {
    return this._client.del(...keys.map(k => this._key(k)))
  }

  /**
   * Check if a key exists.
   *
   * @param key - The key name
   */
  async exists(key: string): Promise<boolean> {
    return (await this._client.exists(this._key(key))) === 1
  }

  /**
   * Set a key's TTL in seconds.
   *
   * @param key - The key name
   * @param seconds - TTL in seconds
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    return (await this._client.expire(this._key(key), seconds)) === 1
  }

  /**
   * Find keys matching a glob pattern (respects prefix).
   *
   * @param pattern - Glob pattern, e.g. "worker:*"
   * @returns Array of matching key names (with prefix stripped)
   */
  async keys(pattern: string = '*'): Promise<string[]> {
    const results = await this._client.keys(this._key(pattern))
    if (!this._prefix) return results
    const strip = `${this._prefix}:`
    return results.map(k => k.startsWith(strip) ? k.slice(strip.length) : k)
  }

  // ── JSON Helpers ──────────────────────────────────────────────────

  /**
   * Store a value as JSON.
   *
   * @param key - The key name
   * @param value - Any JSON-serializable value
   * @param ttl - Optional TTL in seconds
   */
  async setJSON(key: string, value: unknown, ttl?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttl)
  }

  /**
   * Retrieve and parse a JSON value.
   *
   * @param key - The key name
   * @returns The parsed value, or null if the key doesn't exist
   */
  async getJSON<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.get(key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  }

  // ── Hash Helpers ──────────────────────────────────────────────────

  /**
   * Set fields on a hash.
   *
   * @param key - The hash key
   * @param fields - Object of field/value pairs
   */
  async hset(key: string, fields: Record<string, string>): Promise<void> {
    await this._client.hset(this._key(key), fields)
  }

  /**
   * Get all fields from a hash.
   *
   * @param key - The hash key
   * @returns Object of field/value pairs
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    return this._client.hgetall(this._key(key))
  }

  /**
   * Get a single field from a hash.
   *
   * @param key - The hash key
   * @param field - The field name
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this._client.hget(this._key(key), field)
  }

  // ── Pub/Sub ───────────────────────────────────────────────────────

  /**
   * Ensures the dedicated subscriber connection exists.
   * ioredis requires a separate connection for subscriptions.
   */
  private _ensureSubscriber(): Redis {
    if (this._subscriber) return this._subscriber

    const url = this.state.get('url') || 'redis://localhost:6379'
    this._subscriber = new Redis(url)

    this._subscriber.on('message', (channel: string, message: string) => {
      this.emit('message', channel, message)

      const handlers = this._messageHandlers.get(channel)
      if (handlers) {
        for (const handler of handlers) {
          handler(channel, message)
        }
      }
    })

    this._subscriber.on('connect', () => {
      this.setState({ subscriberConnected: true })
    })

    this._subscriber.on('error', (err: Error) => {
      this.setState({ lastError: err.message })
      this.emit('error', err.message)
    })

    this._subscriber.on('close', () => {
      this.setState({ subscriberConnected: false })
    })

    this.setState({ subscriberConnected: true })
    return this._subscriber
  }

  /**
   * Subscribe to one or more channels.
   *
   * Optionally pass a handler that fires only for these channels.
   * The feature also emits a `message` event for all messages.
   *
   * @param channels - Channel name(s) to subscribe to
   * @param handler - Optional per-channel message handler
   *
   * @example
   * ```typescript
   * await redis.subscribe('tasks', (channel, msg) => {
   *   console.log(`Got ${msg} on ${channel}`)
   * })
   * ```
   */
  async subscribe(channels: string | string[], handler?: MessageHandler): Promise<void> {
    const sub = this._ensureSubscriber()
    const list = Array.isArray(channels) ? channels : [channels]

    await sub.subscribe(...list)

    const current = this.state.get('subscribedChannels') || []
    const next = [...new Set([...current, ...list])]
    this.setState({ subscribedChannels: next })

    if (handler) {
      for (const ch of list) {
        if (!this._messageHandlers.has(ch)) {
          this._messageHandlers.set(ch, new Set())
        }
        this._messageHandlers.get(ch)!.add(handler)
      }
    }

    for (const ch of list) {
      this.emit('subscribed', ch)
    }
  }

  /**
   * Unsubscribe from one or more channels.
   *
   * @param channels - Channel name(s) to unsubscribe from
   */
  async unsubscribe(...channels: string[]): Promise<void> {
    if (!this._subscriber) return

    await this._subscriber.unsubscribe(...channels)

    const current = this.state.get('subscribedChannels') || []
    this.setState({
      subscribedChannels: current.filter((ch: string) => !channels.includes(ch)),
    })

    for (const ch of channels) {
      this._messageHandlers.delete(ch)
      this.emit('unsubscribed', ch)
    }
  }

  /**
   * Publish a message to a channel.
   *
   * @param channel - The channel to publish to
   * @param message - The message string (use JSON.stringify for objects)
   * @returns Number of subscribers that received the message
   */
  async publish(channel: string, message: string): Promise<number> {
    return this._client.publish(channel, message)
  }

  // ── Docker Convenience ──────────────────────────────────────────

  /**
   * Spin up a local Redis instance via Docker. Checks if a container with
   * the given name already exists and starts it if stopped, or creates a
   * new one from redis:alpine.
   *
   * Requires the docker feature to be available on the container.
   *
   * @param options - Container name and host port
   * @returns The docker container ID
   *
   * @example
   * ```typescript
   * const redis = container.feature('redis', { url: 'redis://localhost:6379', lazyConnect: true })
   * await redis.ensureLocalDocker()
   * ```
   */
  async ensureLocalDocker(options: { name?: string; port?: number; image?: string } = {}): Promise<string> {
    const { name = 'luca-redis', port = 6379, image = 'redis:alpine' } = options
    const docker = this.container.feature('docker', { enable: true })

    const containers = await docker.listContainers({ all: true })
    const existing = containers.find((c: any) =>
      c.names?.includes(name) || c.names?.includes(`/${name}`)
    )

    if (existing) {
      if (existing.status !== 'running') {
        await docker.startContainer(name)
      }
      return existing.id
    }

    return docker.runContainer(image, {
      name,
      ports: [`${port}:6379`],
      detach: true,
      restart: 'unless-stopped',
    })
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  /**
   * Close all redis connections (main client + subscriber).
   */
  async close(): Promise<this> {
    if (this._subscriber) {
      this._subscriber.disconnect()
      this._subscriber = null
    }
    this._client.disconnect()
    this._messageHandlers.clear()
    this.setState({
      connected: false,
      subscriberConnected: false,
      subscribedChannels: [],
    })
    this.emit('closed')
    return this
  }
}

export { RedisFeature as Redis }
export default RedisFeature

declare module '../../feature.js' {
  interface AvailableFeatures {
    redis: typeof RedisFeature
  }
}
