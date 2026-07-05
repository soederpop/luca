# Store (features.store)

> Stability: `stable`

Store Feature — durable, cross-process JSON state with safe concurrent updates THE blessed answer to "two luca processes need to share state." Every `luca <command>` invocation is a separate process: a server and its `--stats` sibling, a fleet manager and its `stop` command, a watcher and a reporter — none of them share memory. This feature gives each piece of shared state a named, schema-validated JSON document with atomic writes and a read-modify-write `update()` that takes a file lock, so concurrent invocations can't clobber each other. **Reach for it via the container sugar:** ```ts const stats = container.store('proxy-stats', { schema: z.object({ hits: z.number().default(0), misses: z.number().default(0) }), }) await stats.update(s => { s.hits++ })     // lock → read → mutate → validate → atomic write const { hits } = await stats.read()       // always re-reads — sees sibling processes' writes console.log(stats.path)                   // .luca/store/proxy-stats.json — cat it, commit it ``` **Which store when?** (the full spectrum) - `container.state` / `container.entity` — in-process, observable, dies with the process - **`container.store` (this)** — cross-process, durable, one JSON document per name; counters, manifests, process lists, small configs - `sqlite` — the moment you want to query, filter, or run a real queue under contention - `diskCache` — caches only: TTL expiry means entries are *losable by contract* - `redis` — cross-process pub/sub and shared state across machines If you're building a job queue on `update()`, you've outgrown this feature — use `sqlite` (`transaction()` + `UPDATE … RETURNING`). **Scopes:** `project` (default) puts files in `<cwd>/.luca/store/`, so `ls .luca/store` answers "what state does this app keep?"; `machine` uses `~/.luca/store/` for state shared across projects; `tmp` for scratch.

## Usage

```ts
container.feature('store', {
  // Default ms to wait for another process's lock before update() gives up
  lockTimeout,
  // Default ms after which an abandoned lock file is considered stale and stolen
  lockStale,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `lockTimeout` | `number` | Default ms to wait for another process's lock before update() gives up |
| `lockStale` | `number` | Default ms after which an abandoned lock file is considered stale and stolen |

## Methods

### open

Open (or reuse) a named store handle. Handles are cached per `scope:name` within the process; the schema and options from the most recent open win. Prefer the container sugar `container.store(name, opts)` — it calls this.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The store's name; becomes the filename `<name>.json` |
| `opts` | `StoreHandleOptions<T>` |  | Schema, initial value, scope, and lock tuning |

**Returns:** `StoreHandle<T>`

```ts
const stores = container.feature('store')
const flags = stores.open(`flags-${Date.now()}`, {
 scope: 'tmp',
 schema: z.object({ darkMode: z.boolean().default(false) }),
})

const initial = await flags.read()
console.log(initial.darkMode) // false — schema defaults apply to a missing file

await flags.update(f => { f.darkMode = true })
console.log((await flags.read()).darkMode) // true
await flags.delete()
```



### list

List the store names that exist in a scope (files in its directory). The discovery story: `container.stores.list()` (or `ls .luca/store`) answers "what state does this app keep on disk?"

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `scope` | `StoreScope` |  | Which scope's directory to list (default 'project') |

**Returns:** `string[]`

```ts
const stores = container.feature('store')
const name = `inventory-${Date.now()}`
const inv = stores.open(name, { scope: 'tmp' })
await inv.write({ widgets: 12 })

console.log(stores.list('tmp').includes(name)) // true
await inv.delete()
```



### dirFor

The directory a scope's store files live in.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `scope` | `StoreScope` |  | Parameter scope |

**Returns:** `string`



## Events (Zod v4 schema)

### changed

Emitted after a store file is written: (storeName, absolutePath). In-process only — other processes must re-read.

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` |  |
| `arg1` | `string` |  |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.store**

```ts
const stores = container.feature('store')

const counter = stores.open(`demo-${Date.now()}`, { scope: 'tmp' })
await counter.update(s => { s.count = (s.count ?? 0) + 1 })
await counter.update(s => { s.count++ })
const { count } = await counter.read()
console.log(count) // 2
await counter.delete()
```



**open**

```ts
const stores = container.feature('store')
const flags = stores.open(`flags-${Date.now()}`, {
 scope: 'tmp',
 schema: z.object({ darkMode: z.boolean().default(false) }),
})

const initial = await flags.read()
console.log(initial.darkMode) // false — schema defaults apply to a missing file

await flags.update(f => { f.darkMode = true })
console.log((await flags.read()).darkMode) // true
await flags.delete()
```



**list**

```ts
const stores = container.feature('store')
const name = `inventory-${Date.now()}`
const inv = stores.open(name, { scope: 'tmp' })
await inv.write({ widgets: 12 })

console.log(stores.list('tmp').includes(name)) // true
await inv.delete()
```

