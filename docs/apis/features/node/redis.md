# RedisFeature (features.redis)

Redis feature for shared state and pub/sub communication between container instances. Wraps ioredis with a focused API for the primitives that matter most: key/value state, pub/sub messaging, and cross-instance coordination. Uses a dedicated subscriber connection for pub/sub (ioredis requirement), created lazily on first subscribe call.

## Usage

```ts
container.feature('redis', {
  // Redis connection URL, e.g. redis://localhost:6379. Defaults to redis://localhost:6379
  url,
  // Key prefix applied to all get/set/del operations for namespace isolation
  prefix,
  // If true, connection is deferred until first command
  lazyConnect,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `url` | `string` | Redis connection URL, e.g. redis://localhost:6379. Defaults to redis://localhost:6379 |
| `prefix` | `string` | Key prefix applied to all get/set/del operations for namespace isolation |
| `lazyConnect` | `boolean` | If true, connection is deferred until first command |

## Methods

### set

Set a key to a string value with optional TTL.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | The key name |
| `value` | `string` | ✓ | The string value to store |
| `ttl` | `number` |  | Optional time-to-live in seconds |

**Returns:** `Promise<void>`



### get

Get a key's value. Returns null if the key doesn't exist.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | The key name |

**Returns:** `Promise<string | null>`



### del

Delete one or more keys.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `keys` | `string[]` | ✓ | One or more key names to delete |

**Returns:** `Promise<number>`



### exists

Check if a key exists.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | The key name |

**Returns:** `Promise<boolean>`



### expire

Set a key's TTL in seconds.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | The key name |
| `seconds` | `number` | ✓ | TTL in seconds |

**Returns:** `Promise<boolean>`



### keys

Find keys matching a glob pattern (respects prefix).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pattern` | `string` |  | Glob pattern, e.g. "worker:*" |

**Returns:** `Promise<string[]>`



### setJSON

Store a value as JSON.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | The key name |
| `value` | `unknown` | ✓ | Any JSON-serializable value |
| `ttl` | `number` |  | Optional TTL in seconds |

**Returns:** `Promise<void>`



### getJSON

Retrieve and parse a JSON value.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | The key name |

**Returns:** `Promise<T | null>`



### hset

Set fields on a hash.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | The hash key |
| `fields` | `Record<string, string>` | ✓ | Object of field/value pairs |

**Returns:** `Promise<void>`



### hgetall

Get all fields from a hash.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | The hash key |

**Returns:** `Promise<Record<string, string>>`



### hget

Get a single field from a hash.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | The hash key |
| `field` | `string` | ✓ | The field name |

**Returns:** `Promise<string | null>`



### subscribe

Subscribe to one or more channels. Optionally pass a handler that fires only for these channels. The feature also emits a `message` event for all messages.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `channels` | `string | string[]` | ✓ | Channel name(s) to subscribe to |
| `handler` | `MessageHandler` |  | Optional per-channel message handler |

**Returns:** `Promise<void>`

```ts
await redis.subscribe('tasks', (channel, msg) => {
 console.log(`Got ${msg} on ${channel}`)
})
```



### unsubscribe

Unsubscribe from one or more channels.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `channels` | `string[]` | ✓ | Channel name(s) to unsubscribe from |

**Returns:** `Promise<void>`



### publish

Publish a message to a channel.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `channel` | `string` | ✓ | The channel to publish to |
| `message` | `string` | ✓ | The message string (use JSON.stringify for objects) |

**Returns:** `Promise<number>`



### ensureLocalDocker

Spin up a local Redis instance via Docker. Checks if a container with the given name already exists and starts it if stopped, or creates a new one from redis:alpine. Requires the docker feature to be available on the container.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ name?: string; port?: number; image?: string }` |  | Container name and host port |

**Returns:** `Promise<string>`

```ts
const redis = container.feature('redis', { url: 'redis://localhost:6379', lazyConnect: true })
await redis.ensureLocalDocker()
```



### close

Close all redis connections (main client + subscriber).

**Returns:** `Promise<this>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `client` | `Redis` | The underlying ioredis client for advanced operations. |
| `subscriber` | `Redis | null` | The dedicated subscriber connection, if pub/sub is active. |

## Events (Zod v4 schema)

### message

When a message is received on a subscribed channel

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The channel name |
| `arg1` | `string` | The message payload |



### error

When a redis operation fails

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The error message |



### subscribed

When successfully subscribed to a channel

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The channel name |



### unsubscribed

When unsubscribed from a channel

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The channel name |



### closed

When the redis connection is closed



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `connected` | `boolean` | Whether the redis connection is currently open |
| `url` | `string` | Connection URL used for this redis feature instance |
| `subscriberConnected` | `boolean` | Whether the dedicated subscriber connection is open |
| `subscribedChannels` | `array` | List of channels currently subscribed to |
| `lastError` | `string` | Most recent redis error message, if any |

## Examples

**features.redis**

```ts
const redis = container.feature('redis', { url: 'redis://localhost:6379' })

// Shared state
await redis.set('worker:status', 'active')
const status = await redis.get('worker:status')

// Pub/sub between instances
redis.on('message', (channel, msg) => console.log(`${channel}: ${msg}`))
await redis.subscribe('tasks')
await redis.publish('tasks', JSON.stringify({ type: 'ping' }))

// JSON helpers
await redis.setJSON('config', { workers: 4, debug: true })
const config = await redis.getJSON<{ workers: number }>('config')
```



**subscribe**

```ts
await redis.subscribe('tasks', (channel, msg) => {
 console.log(`Got ${msg} on ${channel}`)
})
```



**ensureLocalDocker**

```ts
const redis = container.feature('redis', { url: 'redis://localhost:6379', lazyConnect: true })
await redis.ensureLocalDocker()
```

