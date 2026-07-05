import { z } from 'zod'
// Exclusive-create (flag 'wx') is the one fs primitive the fs feature doesn't
// wrap — it's what makes the lockfile race-free, so we take it from node directly.
import { writeFileSync } from 'fs'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'

// ─── Schemas ────────────────────────────────────────────────────────────────

export const StoreOptionsSchema = FeatureOptionsSchema.extend({
  /** Default ms to wait for another process's lock before update() gives up */
  lockTimeout: z.number().default(5_000).describe("Default ms to wait for another process's lock before update() gives up"),
  /** Default ms after which an abandoned lock file is considered stale and stolen */
  lockStale: z.number().default(10_000).describe('Default ms after which an abandoned lock file is considered stale and stolen'),
})
type StoreFeatureOptions = z.infer<typeof StoreOptionsSchema>

export const StoreEventsSchema = FeatureEventsSchema.extend({
  changed: z.tuple([z.string(), z.string()]).describe('Emitted after a store file is written: (storeName, absolutePath). In-process only — other processes must re-read.'),
})

/** Where a store's JSON file lives. */
export type StoreScope = 'project' | 'machine' | 'tmp'

/** Options accepted by `container.store(name, opts)` / `stores.open(name, opts)`. */
export interface StoreHandleOptions<T = any> {
  /** Zod schema applied on every read AND before every write. Give fields `.default()`s and a missing file parses cleanly. */
  schema?: z.ZodType<T>
  /** Value a missing file reads as (before schema validation). Defaults to `{}`. */
  initial?: T
  /** 'project' → `<cwd>/.luca/store/<name>.json` (default), 'machine' → `~/.luca/store/<name>.json`, 'tmp' → `<os.tmpdir>/luca-store/<name>.json` */
  scope?: StoreScope
  /** Ms to wait for a contended lock before update() throws (default: feature option, 5000) */
  lockTimeout?: number
  /** Ms after which an abandoned lock is stolen (default: feature option, 10000) */
  lockStale?: number
}

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/

/**
 * A handle to one named JSON store — a single durable document shared safely
 * between separate luca processes.
 *
 * Obtained via `container.store(name, opts)` (or `container.feature('store').open()`).
 * The backing file is plain, pretty-printed JSON you can `cat`, diff, and commit.
 *
 * The one method to internalize is {@link update}: it takes a file lock,
 * re-reads the latest state, applies your mutation, validates, and writes
 * atomically — so concurrent commands can never overwrite each other's writes
 * (the classic read-modify-write lost-update bug is impossible by construction).
 * Plain {@link write} is for when you own the whole document.
 */
export class StoreHandle<T = any> {
  constructor(
    private feature: Store,
    /** The store's name — also its filename (`<name>.json`) */
    readonly name: string,
    private opts: StoreHandleOptions<T> = {},
  ) {
    if (!NAME_RE.test(name)) {
      throw new Error(`Invalid store name "${name}" — use letters, numbers, dashes, dots, underscores (it becomes a filename).`)
    }
  }

  private get container(): any {
    return (this.feature as any).container
  }

  /** The scope this handle resolves paths against ('project' unless overridden). */
  get scope(): StoreScope {
    return this.opts.scope ?? 'project'
  }

  /** Absolute path of the backing JSON file — it's just a file; inspect it freely. */
  get path(): string {
    return this.container.paths.resolve(this.feature.dirFor(this.scope), `${this.name}.json`)
  }

  /** Whether the backing file currently exists on disk. */
  get exists(): boolean {
    return this.container.fs.exists(this.path)
  }

  private validate(value: any): T {
    return this.opts.schema ? this.opts.schema.parse(value) : value
  }

  /**
   * Read the current state from disk.
   *
   * A missing file is not an error — it reads as `initial` (default `{}`),
   * run through the schema so `.default()`s apply. Always hits disk: state
   * written by other processes since your last read is picked up.
   *
   * @returns The validated state
   * @throws {Error} When the file contains invalid JSON, or the schema rejects it
   */
  async read(): Promise<T> {
    const { fs } = this.container
    if (!fs.exists(this.path)) {
      return this.validate(this.opts.initial ?? {})
    }
    let raw: any
    try {
      raw = fs.readJson(this.path)
    } catch (err: any) {
      throw new Error(`store "${this.name}": ${this.path} contains invalid JSON (${err.message}). Fix or delete the file.`)
    }
    return this.validate(raw)
  }

  /**
   * Replace the entire document, atomically.
   *
   * The value is validated, written to a temp file, then renamed over the
   * real one — a crash mid-write can never leave a half-written file behind.
   * Prefer {@link update} whenever other processes might also be writing.
   *
   * @param value - The full new state
   * @returns The validated value that was persisted
   */
  async write(value: T): Promise<T> {
    const next = this.validate(value)
    const { fs, paths } = this.container
    fs.ensureFolder(paths.dirname(this.path))
    const tmp = `${this.path}.${process.pid}.${this.container.utils.uuid().slice(0, 8)}.tmp`
    fs.writeFile(tmp, JSON.stringify(next, null, 2) + '\n')
    fs.renameSync(tmp, this.path)
    this.feature.emit('changed', this.name, this.path)
    return next
  }

  /**
   * Read-modify-write under a cross-process lock — the safe way to change
   * state that concurrent commands share.
   *
   * Acquires `<file>.lock`, re-reads the latest state, applies `fn`, validates,
   * writes atomically, releases. Mutate the draft in place or return a
   * replacement; either works. Calls from the same process are also serialized,
   * so `Promise.all` over updates is safe.
   *
   * Keep `fn` fast (milliseconds) — it runs while other processes wait on the
   * lock, and a lock older than `lockStale` (10s) is presumed abandoned.
   *
   * @param fn - Receives the current state; mutate it or return the next state
   * @returns The state that was persisted
   * @throws {Error} When the lock stays contended past `lockTimeout`
   */
  async update(fn: (draft: T) => T | void | Promise<T | void>): Promise<T> {
    return this.feature._serialized(this.path, async () => {
      const release = await this.acquireLock()
      try {
        const current = await this.read()
        const returned = await fn(current)
        return await this.write(returned === undefined ? current : returned)
      } finally {
        await release()
      }
    })
  }

  /**
   * Delete the backing file (and any leftover lock). Missing files are a no-op.
   * The next read() starts fresh from `initial`.
   */
  async delete(): Promise<void> {
    const { fs } = this.container
    await fs.rm(this.path, { force: true })
    await fs.rm(`${this.path}.lock`, { force: true })
  }

  /** @internal Acquire the advisory lockfile, stealing it if stale. Returns an async release fn. */
  private async acquireLock(): Promise<() => Promise<void>> {
    const { fs } = this.container
    const proc = this.container.feature('proc')
    const featureOpts = (this.feature as any).options as StoreFeatureOptions
    const lockPath = `${this.path}.lock`
    const timeout = this.opts.lockTimeout ?? featureOpts.lockTimeout ?? 5_000
    const stale = this.opts.lockStale ?? featureOpts.lockStale ?? 10_000
    const startedAt = Date.now()
    let delay = 5

    fs.ensureFolder(this.container.paths.dirname(this.path))

    while (true) {
      try {
        writeFileSync(lockPath, JSON.stringify({ pid: process.pid, at: Date.now() }), { flag: 'wx' })
        return () => fs.rm(lockPath, { force: true }).catch(() => {})
      } catch (err: any) {
        if (err?.code !== 'EEXIST') throw err
      }

      // Contended — is the holder dead or the lock ancient?
      let holder: { pid?: number; at?: number } = {}
      try { holder = JSON.parse(String(fs.readFile(lockPath))) } catch {}
      const holderAlive = typeof holder.pid === 'number' && proc.kill(holder.pid, 0)
      const isStale = !holderAlive || (typeof holder.at === 'number' && Date.now() - holder.at > stale)
      if (isStale) {
        await fs.rm(lockPath, { force: true }).catch(() => {})
        continue
      }

      if (Date.now() - startedAt > timeout) {
        throw new Error(
          `store "${this.name}": timed out after ${timeout}ms waiting for lock ${lockPath}` +
          (holder.pid ? ` (held by pid ${holder.pid})` : '')
        )
      }
      await new Promise(resolve => setTimeout(resolve, delay))
      delay = Math.min(delay * 2, 100)
    }
  }
}

/**
 * Store Feature — durable, cross-process JSON state with safe concurrent updates
 *
 * THE blessed answer to "two luca processes need to share state." Every
 * `luca <command>` invocation is a separate process: a server and its `--stats`
 * sibling, a fleet manager and its `stop` command, a watcher and a reporter —
 * none of them share memory. This feature gives each piece of shared state a
 * named, schema-validated JSON document with atomic writes and a
 * read-modify-write `update()` that takes a file lock, so concurrent
 * invocations can't clobber each other.
 *
 * **Reach for it via the container sugar:**
 * ```ts
 * const stats = container.store('proxy-stats', {
 *   schema: z.object({ hits: z.number().default(0), misses: z.number().default(0) }),
 * })
 *
 * await stats.update(s => { s.hits++ })     // lock → read → mutate → validate → atomic write
 * const { hits } = await stats.read()       // always re-reads — sees sibling processes' writes
 * console.log(stats.path)                   // .luca/store/proxy-stats.json — cat it, commit it
 * ```
 *
 * **Which store when?** (the full spectrum)
 * - `container.state` / `container.entity` — in-process, observable, dies with the process
 * - **`container.store` (this)** — cross-process, durable, one JSON document per name; counters, manifests, process lists, small configs
 * - `sqlite` — the moment you want to query, filter, or run a real queue under contention
 * - `diskCache` — caches only: TTL expiry means entries are *losable by contract*
 * - `redis` — cross-process pub/sub and shared state across machines
 *
 * If you're building a job queue on `update()`, you've outgrown this feature —
 * use `sqlite` (`transaction()` + `UPDATE … RETURNING`).
 *
 * **Scopes:** `project` (default) puts files in `<cwd>/.luca/store/`, so
 * `ls .luca/store` answers "what state does this app keep?"; `machine` uses
 * `~/.luca/store/` for state shared across projects; `tmp` for scratch.
 *
 * @example
 * ```typescript
 * const stores = container.feature('store')
 *
 * const counter = stores.open(`demo-${Date.now()}`, { scope: 'tmp' })
 * await counter.update(s => { s.count = (s.count ?? 0) + 1 })
 * await counter.update(s => { s.count++ })
 * const { count } = await counter.read()
 * console.log(count) // 2
 * await counter.delete()
 * ```
 *
 * @extends Feature
 */
export class Store extends Feature<z.infer<typeof FeatureStateSchema>, StoreFeatureOptions> {
  static override shortcut = 'features.store' as const
  static override stability = 'stable' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = StoreOptionsSchema
  static override eventsSchema = StoreEventsSchema
  static { Feature.register(this, 'store') }

  /**
   * @internal `container.store(name)` is the factory method, so the enabled
   * feature instance attaches as `container.stores` (plural) instead of
   * clobbering it.
   */
  protected override attachToContainer() {
    Object.defineProperty(this.container, 'stores', {
      get: () => this,
      configurable: true,
      enumerable: true,
    })
  }

  /** Handles cached per scope:name so repeat opens share config */
  private _handles = new Map<string, StoreHandle<any>>()
  /** Per-file promise chains — serializes same-process update() calls */
  private _chains = new Map<string, Promise<any>>()

  /**
   * Open (or reuse) a named store handle.
   *
   * Handles are cached per `scope:name` within the process; the schema and
   * options from the most recent open win. Prefer the container sugar
   * `container.store(name, opts)` — it calls this.
   *
   * @param name - The store's name; becomes the filename `<name>.json`
   * @param opts - Schema, initial value, scope, and lock tuning
   * @returns A {@link StoreHandle} with read / write / update / delete
   *
   * @example
   * ```typescript
   * const stores = container.feature('store')
   * const flags = stores.open(`flags-${Date.now()}`, {
   *   scope: 'tmp',
   *   schema: z.object({ darkMode: z.boolean().default(false) }),
   * })
   *
   * const initial = await flags.read()
   * console.log(initial.darkMode) // false — schema defaults apply to a missing file
   *
   * await flags.update(f => { f.darkMode = true })
   * console.log((await flags.read()).darkMode) // true
   * await flags.delete()
   * ```
   */
  open<T = any>(name: string, opts: StoreHandleOptions<T> = {}): StoreHandle<T> {
    const key = `${opts.scope ?? 'project'}:${name}`
    const existing = this._handles.get(key)
    if (existing && Object.keys(opts).length === 0) return existing as StoreHandle<T>
    const handle = new StoreHandle<T>(this, name, opts)
    this._handles.set(key, handle)
    return handle
  }

  /**
   * List the store names that exist in a scope (files in its directory).
   *
   * The discovery story: `container.stores.list()` (or `ls .luca/store`)
   * answers "what state does this app keep on disk?"
   *
   * @param scope - Which scope's directory to list (default 'project')
   * @returns Store names, without the `.json` extension
   *
   * @example
   * ```typescript
   * const stores = container.feature('store')
   * const name = `inventory-${Date.now()}`
   * const inv = stores.open(name, { scope: 'tmp' })
   * await inv.write({ widgets: 12 })
   *
   * console.log(stores.list('tmp').includes(name)) // true
   * await inv.delete()
   * ```
   */
  list(scope: StoreScope = 'project'): string[] {
    const dir = this.dirFor(scope)
    const { fs } = this.container as any
    if (!fs.exists(dir)) return []
    return (fs.readdirSync(dir) as string[])
      .filter((f: string) => f.endsWith('.json'))
      .map((f: string) => f.slice(0, -'.json'.length))
      .sort()
  }

  /** The directory a scope's store files live in. */
  dirFor(scope: StoreScope = 'project'): string {
    const { paths } = this.container
    const os = this.container.feature('os')
    switch (scope) {
      case 'machine': return paths.resolve(os.homedir, '.luca', 'store')
      case 'tmp': return paths.resolve(os.tmpdir, 'luca-store')
      default: return paths.resolve('.luca', 'store')
    }
  }

  /** @internal Chain `work` onto the per-file queue so same-process updates never interleave. */
  _serialized<R>(path: string, work: () => Promise<R>): Promise<R> {
    const prev = this._chains.get(path) ?? Promise.resolve()
    const next = prev.then(work, work)
    // Keep the chain alive but don't let one failure poison the next caller
    this._chains.set(path, next.catch(() => {}))
    return next
  }
}

export default Store
declare module '../../feature' {
  interface AvailableFeatures {
    store: typeof Store
  }
}
