---
title: 'Cross-Process State Handoff: store, diskCache, or sqlite'
tags:
  - state
  - store
  - entity
  - diskCache
  - sqlite
  - persistence
  - proc
  - composition
lastTested: '2026-07-05'
lastTestPassed: true
---

# Cross-Process State Handoff: store, diskCache, or sqlite

Every script eventually asks: *where does this value live?* The container gives you four stores with four different lifetimes, and picking the wrong one is how you end up serializing a database into a cache key. The heuristic:

- **`container.state` / `container.entity`** — in-process, observable, dies with the process.
- **`container.store`** — cross-process *state*: one durable, schema-validated JSON document per name, with locked read-modify-write updates. The default answer for counters, manifests, process lists, small configs.
- **`diskCache`** — cross-process *cache* with optional TTL; entries are losable by contract. Fetch by key, no questions asked.
- **`sqlite`** — cross-process *and queryable*; the moment you want to filter, group, or count, it's this one.

This doc exercises all four — including proving the handoffs by reading values back **from a genuinely fresh process**.

## In-process: entities are memoized by id

`container.entity(id)` returns the *same* cached object for the same id anywhere in the process — that memoization **is** the in-process handoff. Module A writes state, module B calls `container.entity('...')` with the same id and observes it. No exporting singletons, no plumbing. State is observable: observers receive `(changeType, key, value)` per mutation — not a state object. (Full API: `luca describe`, and see [entity.md](./entity.md).)

```ts
// bare assignments — these survive into later blocks
worker = container.entity('handoff:worker')
worker.setState({ progress: 0 })

observed = []
worker.state.observe((changeType, key, value) => {
  if (key === 'progress') observed.push(value)
})

// "another module" asks for the same id — identical instance, same state
const sameWorker = container.entity('handoff:worker')
if (sameWorker !== worker) throw new Error('entity memoization broke — same id must return the same instance')

sameWorker.setState({ progress: 50 })

if (worker.state.get('progress') !== 50) throw new Error('write through one handle must be visible through the other')
if (!observed.includes(50)) throw new Error('observer never saw the update')
console.log('one entity, two handles, observed progress values:', JSON.stringify(observed))
```

The catch: all of it evaporates when the process exits. Entities and feature state are wiring, not storage.

## Cross-process state: container.store

Every `luca <command>` invocation is a separate process — a server and its `--stats` sibling share no memory. `container.store(name)` gives that shared state a home: one JSON document, atomic writes, and the method that matters, **`update()`** — a locked read-modify-write, so two processes bumping the same counter can never overwrite each other (the classic lost-update bug is impossible by construction, not by discipline).

```ts
statsStore = container.store(`handoff-stats-${Date.now()}`, {
  scope: 'tmp',   // demo hygiene — real apps default to 'project': <cwd>/.luca/store/<name>.json
  schema: z.object({ hits: z.number().default(0), misses: z.number().default(0) }),
})

// A missing file reads as the schema's defaults — no init step, no exists-check dance
const empty = await statsStore.read()
if (empty.hits !== 0) throw new Error('schema defaults should apply to a missing file')

// Ten concurrent updates — same-process calls serialize, cross-process calls take a file lock
await Promise.all(Array.from({ length: 10 }, () => statsStore.update(s => { s.hits++ })))

const after = await statsStore.read()
if (after.hits !== 10) throw new Error(`lost update! expected 10 hits, got ${after.hits}`)
console.log('10 concurrent updates, 10 recorded hits:', JSON.stringify(after))
```

The backing file is ordinary pretty-printed JSON — `cat` it, diff it, commit it:

```ts
console.log('state lives at:', statsStore.path)
console.log(String(fs.readFile(statsStore.path)))
```

### Prove it: a fresh process updates the same store

```ts
const devCli2 = container.paths.resolve('src', 'cli', 'cli.ts')
const [cmd2, baseArgs2] = fs.exists(devCli2) ? ['bun', ['run', devCli2, 'eval']] : ['luca', ['eval']]

const storeExpr = `const s = container.store(${JSON.stringify(statsStore.name)}, { scope: 'tmp' }); await s.update(d => { d.misses = (d.misses ?? 0) + 1 }); console.log('CHILD_WROTE')`
const storeChild = await proc.spawnAndCapture(cmd2, [...baseArgs2, storeExpr])

if (storeChild.error !== null) throw new Error(`child process failed: ${storeChild.stderr.slice(-300)}`)
const merged = await statsStore.read()
if (merged.misses !== 1 || merged.hits !== 10) throw new Error(`child write lost or clobbered ours: ${JSON.stringify(merged)}`)
console.log('fresh process bumped misses without touching our hits:', JSON.stringify(merged))
```

Scope note: `'project'` (the default) puts files in `<cwd>/.luca/store/` — so `ls .luca/store` (or `container.stores.list()`) answers "what state does this app keep?". `'machine'` (`~/.luca/store/`) is for state shared across projects. And if you're building a job queue on `update()`, you've outgrown it — that's sqlite's job below.

## Cross-process KV: diskCache

`diskCache` is a file-backed key-value store (the same cacache engine npm uses). Anything you `set()` in one process can be `get()` from any other process that opens the same cache path. It has native TTL support: pass `{ ttl: seconds }` as the third argument to `set()` (or a feature-level `ttl` option as a default) — expired entries are evicted on access and behave exactly like cache misses. Remember the miss contract: `get()` on a missing *or expired* key **throws**, so guard with `has()` (see [error-handling-conventions.md](./error-handling-conventions.md)).

```ts
cachePath = container.paths.resolve(os.tmpdir, `handoff-cache-${Date.now()}`)
cache = container.feature('diskCache', { path: cachePath })

token = `handoff-token-${Date.now()}`
await cache.set('handoff:token', token)

// TTL: this entry self-destructs after 1 second
await cache.set('handoff:flash', 'gone-soon', { ttl: 1 })
if (!(await cache.has('handoff:flash'))) throw new Error('ttl entry should exist immediately after set')

await container.utils.sleep(1300)

if (await cache.has('handoff:flash')) throw new Error('ttl entry should have expired and read as a miss')
console.log('ttl entry expired; durable token still cached:', await cache.get('handoff:token'))
```

### Prove it: read the key back from a fresh process

The real test of "cross-process" is a process that shares nothing with this one. We spawn `luca eval` as a child, point a brand-new container at the same cache path, and read the token back. Note `spawnAndCapture` with an **args array** — the expression contains spaces, and `execAndCapture` splits its command string naively.

```ts
// in the framework repo run through the dev CLI; in your project, `luca` is on the PATH
const devCli = container.paths.resolve('src', 'cli', 'cli.ts')
const [cmd, baseArgs] = fs.exists(devCli) ? ['bun', ['run', devCli, 'eval']] : ['luca', ['eval']]

const expr = `const cache = container.feature('diskCache', { path: ${JSON.stringify(cachePath)} }); console.log('CHILD_READ=' + await cache.get('handoff:token'))`

const child = await proc.spawnAndCapture(cmd, [...baseArgs, expr])

if (child.error !== null) throw new Error(`child process failed: ${child.stderr.slice(-300)}`)
if (!child.stdout.includes(`CHILD_READ=${token}`)) {
  throw new Error(`fresh process did not read the cached token back; stdout: ${child.stdout.slice(-300)}`)
}
console.log('fresh process read the token back through diskCache')
```

That is the whole handoff pattern: writer sets a key, any later process gets it by key. Scalars, JSON blobs, file contents — as long as access is *by key*, diskCache is the right shelf.

## Cross-process and queryable: sqlite

The moment "read the value" becomes "which ones, how many, grouped by what" — stop stuffing arrays into cache keys and give the data a schema. The `sqlite` feature is file-backed too: any process that opens the same path sees the same tables.

```ts
dbPath = container.paths.resolve(os.tmpdir, `handoff-${Date.now()}.sqlite`)
db = container.feature('sqlite', { path: dbPath })

await db.execute('CREATE TABLE runs (id INTEGER PRIMARY KEY, status TEXT NOT NULL)')
await db.execute('INSERT INTO runs (status) VALUES (?), (?), (?)', ['done', 'done', 'failed'])

// a question a KV store cannot answer without you re-implementing GROUP BY
const byStatus = await db.sql`SELECT status, COUNT(*) AS n FROM runs GROUP BY status ORDER BY n DESC`

if (byStatus[0].status !== 'done' || byStatus[0].n !== 2) throw new Error('GROUP BY answer was wrong')
console.log('run counts by status:', JSON.stringify(byStatus))
```

For the full extract → normalize → load → query workflow (bulk inserts inside `db.transaction()`, tagged-template parameters, cross-checking SQL against lodash), see [data-pipeline-fs-grep-sqlite.md](./data-pipeline-fs-grep-sqlite.md).

## Clean up

```ts
db.close()
await fs.rm(dbPath)
await fs.rmdir(cachePath)
await statsStore.delete()
console.log('removed scratch db, cache dir, and store')
```

## The decision heuristic

| The value... | Reach for | Why |
|---|---|---|
| Stays inside this process; other modules should react to it | `container.state` / `container.entity` | Observable, memoized by id, zero persistence |
| Is *state* other processes read and mutate — counters, manifests, process lists, small configs | `container.store` | One durable JSON doc; `update()` is a locked read-modify-write, so concurrent commands can't lose writes |
| Is a *cache* — recomputable, fetch-by-key, may expire | `diskCache` | KV with native TTL (`set(key, value, { ttl })`); remember `get()` throws on a miss |
| You will ask questions of it — filter, count, group, join, claim-one-atomically | `sqlite` | A file path makes it durable and shared; SQL makes it queryable |

When in doubt: if losing the value is a bug, it's a store; if losing it is a cache miss, it's a cache; if the access pattern is a question, table it; if nobody outside this process cares, keep it in state.
