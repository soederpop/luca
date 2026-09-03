import { z } from 'zod'
import { Database } from 'bun:sqlite'
import { Feature } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import type { ContainerContext } from '../../container.js'
import type { Helper } from '../../helper.js'

type SqlValue = string | number | boolean | bigint | Uint8Array | Buffer | null

export const SqliteStateSchema = FeatureStateSchema.extend({
  connected: z.boolean().default(false).describe('Whether the sqlite database is currently open'),
  path: z.string().default(':memory:').describe('Path to the sqlite database file'),
  lastQuery: z.string().optional().describe('Most recent SQL query string that was executed'),
  lastChanges: z.number().optional().describe('Number of rows changed by the most recent execute call'),
  lastInsertRowid: z.union([z.number(), z.bigint()]).optional().describe('Last inserted row id from the most recent execute call'),
  lastError: z.string().optional().describe('Most recent sqlite error message, if any'),
})

export const SqliteOptionsSchema = FeatureOptionsSchema.extend({
  path: z.string().optional().describe('Path to sqlite file. Use :memory: for in-memory database'),
  readonly: z.boolean().optional().describe('Open sqlite database in readonly mode'),
  readwrite: z.boolean().optional().describe('Open sqlite database in readwrite mode (defaults to true when readonly is false)'),
  create: z.boolean().optional().describe('Create the sqlite database file if it does not exist'),
})

export type SqliteState = z.infer<typeof SqliteStateSchema>
export type SqliteOptions = z.infer<typeof SqliteOptionsSchema>

export const SqliteEventsSchema = FeatureEventsSchema.extend({
  query: z.tuple([
    z.string().describe('The SQL query text that was executed'),
    z.array(z.any()).describe('Bound parameter values'),
    z.number().describe('Number of rows returned'),
  ]).describe('Emitted after a SELECT-like query completes successfully'),
  execute: z.tuple([
    z.string().describe('The SQL statement text that was executed'),
    z.array(z.any()).describe('Bound parameter values'),
    z.number().describe('Number of rows changed'),
  ]).describe('Emitted after a write/update/delete statement completes successfully'),
  error: z.tuple([
    z.any().describe('The error that occurred'),
  ]).describe('Emitted when a SQL operation fails'),
  closed: z.tuple([]).describe('Emitted when the database connection is closed'),
})

/**
 * SQLite feature for safe SQL execution through Bun's native sqlite binding.
 *
 * Supports:
 * - parameterized query execution (`query` / `execute`)
 * - tagged-template query execution (`sql`) to avoid manual placeholder wiring
 *
 * Pass `{ path: ':memory:' }` (the default when no path is given) for an
 * ephemeral in-memory database with zero setup, or a file path to persist
 * to disk.
 *
 * @example
 * ```typescript
 * // In-memory by default; pass { path: 'app.db' } to persist to disk
 * // (the parent folder of a file path must already exist)
 * const sqlite = container.feature('sqlite')
 *
 * await sqlite.execute(
 *   'create table if not exists users (id integer primary key, email text not null unique)'
 * )
 *
 * await sqlite.execute('insert into users (email) values (?)', ['hello@example.com'])
 *
 * const users = await sqlite.sql<{ id: number; email: string }>`
 *   select id, email from users where email = ${'hello@example.com'}
 * `
 * console.log(users) // [{ id: 1, email: 'hello@example.com' }]
 * ```
 */
export class Sqlite extends Feature<SqliteState, SqliteOptions> {
  static override shortcut = 'features.sqlite' as const
  static override stability = 'core' as const
  static override category = 'data-storage' as const
  static override stateSchema = SqliteStateSchema
  static override optionsSchema = SqliteOptionsSchema
  static override eventsSchema = SqliteEventsSchema
  static { Feature.register(this, 'sqlite') }

  // Read and write are separate tools so consumers can scope access
  // structurally: toTools({ only: ['sqliteQuery', 'sqliteListTables', 'sqliteDescribeTable'] }).
  // sqliteQuery rejects non-read statements itself — bun:sqlite's .all() would
  // otherwise happily execute an INSERT, which would make that scoping a lie.
  static override tools: Record<string, { schema: z.ZodType; description?: string; handler?: Function }> = {
    sqliteQuery: {
      description: 'Run a read-only SQL query (SELECT, WITH, PRAGMA, EXPLAIN) and get rows back as JSON. Use ? placeholders with params for values. Writes are rejected — use sqliteExecute for those.',
      schema: z.object({
        sql: z.string().describe('SQL query using ? placeholders, e.g. "SELECT * FROM users WHERE active = ?"'),
        params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().describe('Values bound to the ? placeholders, in order'),
      }).describe('Run a read-only SQL query and get rows back as JSON.'),
      handler: async (args: { sql: string; params?: any[] }, db: Sqlite) => {
        if (!isRowReturningStatement(args.sql)) {
          return 'Error: sqliteQuery only accepts read statements (SELECT, WITH, PRAGMA, EXPLAIN). Use sqliteExecute for writes and DDL.'
        }
        return jsonify(await db.query(args.sql, args.params ?? []))
      },
    },
    sqliteExecute: {
      description: 'Run a write or DDL statement (INSERT, UPDATE, DELETE, CREATE TABLE, ...). Use ? placeholders with params for values. Returns { changes, lastInsertRowid }.',
      schema: z.object({
        sql: z.string().describe('SQL statement using ? placeholders, e.g. "INSERT INTO users (email) VALUES (?)"'),
        params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().describe('Values bound to the ? placeholders, in order'),
      }).describe('Run a write or DDL statement.'),
      handler: async (args: { sql: string; params?: any[] }, db: Sqlite) =>
        jsonify(await db.execute(args.sql, args.params ?? [])),
    },
    sqliteListTables: {
      description: 'List all tables and views in the database with their SQL definitions. Start here — never guess table names.',
      schema: z.object({}).describe('List all tables and views in the database.'),
      handler: async (_args: {}, db: Sqlite) =>
        jsonify(await db.query("SELECT name, type, sql FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name")),
    },
    sqliteDescribeTable: {
      description: 'Get the columns of a table: name, type, nullability, default, and primary key. Use before writing queries against an unfamiliar table.',
      schema: z.object({
        table: z.string().describe('Table name (from sqliteListTables)'),
      }).describe('Get the columns of a table.'),
      handler: async (args: { table: string }, db: Sqlite) =>
        jsonify(await db.query('SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info(?)', [args.table])),
    },
  }

  /**
   * When an assistant consumes these tools, inject guidance about the
   * placeholder style and the read/write tool split.
   */
  override setupToolsConsumer(consumer: Helper) {
    if (typeof (consumer as any).addSystemPromptExtension === 'function') {
      (consumer as any).addSystemPromptExtension('sqlite', [
        '## SQLite Tools',
        '',
        `Database: ${this.state.current.path}`,
        '',
        'Start with `sqliteListTables` and `sqliteDescribeTable` — never guess table or column names.',
        '',
        'Always pass values via `params` with `?` placeholders, never interpolated into the SQL string.',
        '',
        '`sqliteQuery` is for reads only and rejects writes; `sqliteExecute` is for INSERT/UPDATE/DELETE/DDL and returns `{ changes, lastInsertRowid }`.',
      ].join('\n'))
    }
  }

  private _db: Database

  /**
   * Default state for the SQLite feature before a database is opened.
   * @returns The initial SqliteState with `connected: false` and in-memory path
   */
  override get initialState(): SqliteState {
    return {
      enabled: false,
      connected: false,
      path: ':memory:',
    }
  }

  constructor(options: SqliteOptions, context: ContainerContext) {
    super(options, context)

    const path = options.path || ':memory:'
    const openOptions = options.readonly
      ? { readonly: true }
      : { readwrite: options.readwrite ?? true, create: options.create ?? true }

    this._db = new Database(path, openOptions)

    this.hide('_db')
    this.setState({
      connected: true,
      path,
    })
  }

  /** Returns the underlying Bun sqlite database instance. */
  get db() {
    return this._db
  }

  /**
   * Executes a SELECT-like query and returns result rows.
   *
   * Use sqlite placeholders (`?`) for `params`.
   *
   * @param queryText - The SQL query string with optional `?` placeholders
   * @param params - Ordered array of values to bind to the placeholders
   * @returns Promise resolving to an array of typed result rows
   * @throws {Error} When query text is empty or params contain `undefined`
   *
   * @example
   * ```typescript
   * const db = container.feature('sqlite') // in-memory
   * await db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, active INTEGER)')
   * await db.execute('INSERT INTO users (email, active) VALUES (?, ?)', ['hello@example.com', 1])
   *
   * const users = await db.query<{ id: number; email: string }>(
   *   'SELECT id, email FROM users WHERE active = ?',
   *   [1]
   * )
   * console.log(users) // [{ id: 1, email: 'hello@example.com' }]
   * ```
   */
  async query<T extends object = Record<string, unknown>>(queryText: string, params: SqlValue[] = []): Promise<T[]> {
    assertQueryText(queryText)
    assertParams(params)

    try {
      const statement = this.db.query(queryText)
      const rows = statement.all(...params) as T[]

      this.setState({
        lastQuery: queryText,
        lastError: undefined,
      })

      this.emit('query', queryText, params, rows.length)
      return rows
    } catch (error: any) {
      this.setState({
        lastQuery: queryText,
        lastError: error?.message || String(error),
      })

      this.emit('error', error)
      throw error
    }
  }

  /**
   * Executes a write/update/delete statement and returns metadata.
   *
   * Use sqlite placeholders (`?`) for `params`.
   *
   * @param queryText - The SQL statement string with optional `?` placeholders
   * @param params - Ordered array of values to bind to the placeholders
   * @returns Promise resolving to `{ changes, lastInsertRowid }` metadata
   * @throws {Error} When query text is empty or params contain `undefined`
   *
   * @example
   * ```typescript
   * const db = container.feature('sqlite') // in-memory
   * await db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE)')
   *
   * const { changes, lastInsertRowid } = await db.execute(
   *   'INSERT INTO users (email) VALUES (?)',
   *   ['hello@example.com']
   * )
   * console.log(`Inserted row ${lastInsertRowid}, ${changes} change(s)`)
   * ```
   */
  async execute(queryText: string, params: SqlValue[] = []): Promise<{ changes: number; lastInsertRowid: number | bigint | null }> {
    assertQueryText(queryText)
    assertParams(params)

    try {
      const statement = this.db.query(queryText)
      const result = statement.run(...params) as { changes: number; lastInsertRowid: number | bigint }

      this.setState({
        lastQuery: queryText,
        lastChanges: result.changes,
        lastInsertRowid: result.lastInsertRowid,
        lastError: undefined,
      })

      this.emit('execute', queryText, params, result.changes)
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid ?? null,
      }
    } catch (error: any) {
      this.setState({
        lastQuery: queryText,
        lastError: error?.message || String(error),
      })

      this.emit('error', error)
      throw error
    }
  }

  /**
   * Executes a SELECT-like query expected to return a single row.
   *
   * Returns the first result row, or `null` when the query matches nothing —
   * no more `(await query(...))[0] ?? null` dance. Use sqlite placeholders
   * (`?`) for `params`.
   *
   * @param queryText - The SQL query string with optional `?` placeholders
   * @param params - Ordered array of values to bind to the placeholders
   * @returns Promise resolving to the first row, or `null` when there are no rows
   * @throws {Error} When query text is empty or params contain `undefined`
   *
   * @example
   * ```typescript
   * const db = container.feature('sqlite') // in-memory
   * await db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)')
   * await db.execute('INSERT INTO users (email) VALUES (?)', ['hello@example.com'])
   *
   * const user = await db.queryOne<{ id: number; email: string }>(
   *   'SELECT id, email FROM users WHERE email = ?',
   *   ['hello@example.com']
   * )
   * console.log(user) // { id: 1, email: 'hello@example.com' }
   *
   * const missing = await db.queryOne('SELECT * FROM users WHERE id = ?', [999])
   * console.log(missing) // null
   * ```
   */
  async queryOne<T extends object = Record<string, unknown>>(queryText: string, params: SqlValue[] = []): Promise<T | null> {
    const rows = await this.query<T>(queryText, params)
    return rows[0] ?? null
  }

  /**
   * Runs any SQL statement and returns the shape that fits it — no
   * SELECT-vs-write classification required from the caller.
   *
   * The statement's leading keyword (after skipping whitespace, `--` line
   * comments, and `/* ... *\/` block comments) decides the path:
   * `SELECT`, `WITH`, `PRAGMA`, and `EXPLAIN` go through `query()` and return
   * rows; everything else goes through `execute()` and returns
   * `{ changes, lastInsertRowid }`. This removes the silent-failure gotcha
   * where `query('INSERT ...')` returns `[]` or `execute('SELECT ...')`
   * discards the rows.
   *
   * @param queryText - The SQL statement string with optional `?` placeholders
   * @param params - Ordered array of values to bind to the placeholders
   * @returns Promise resolving to result rows for SELECT-like statements, or `{ changes, lastInsertRowid }` for writes
   * @throws {Error} When query text is empty or params contain `undefined`
   *
   * @example
   * ```typescript
   * const db = container.feature('sqlite') // in-memory
   * await db.run('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)')
   *
   * const meta = await db.run('INSERT INTO users (email) VALUES (?)', ['hello@example.com'])
   * console.log(meta) // { changes: 1, lastInsertRowid: 1 }
   *
   * const rows = await db.run('SELECT id, email FROM users')
   * console.log(rows) // [{ id: 1, email: 'hello@example.com' }]
   * ```
   */
  async run<T extends object = Record<string, unknown>>(queryText: string, params: SqlValue[] = []): Promise<T[] | { changes: number; lastInsertRowid: number | bigint | null }> {
    assertQueryText(queryText)

    if (isRowReturningStatement(queryText)) {
      return this.query<T>(queryText, params)
    }

    return this.execute(queryText, params)
  }

  /**
   * Safe tagged-template SQL helper.
   *
   * Values become bound parameters automatically, preventing SQL injection.
   *
   * @param strings - Template literal string segments
   * @param values - Interpolated values that become bound `?` parameters
   * @returns Promise resolving to an array of typed result rows
   *
   * @example
   * ```typescript
   * const db = container.feature('sqlite') // in-memory
   * await db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)')
   * await db.execute('INSERT INTO users (email) VALUES (?)', ['hello@example.com'])
   *
   * const email = 'hello@example.com'
   * const rows = await db.sql<{ id: number }>`
   *   SELECT id FROM users WHERE email = ${email}
   * `
   * console.log(rows) // [{ id: 1 }]
   * ```
   */
  async sql<T extends object = Record<string, unknown>>(strings: TemplateStringsArray, ...values: SqlValue[]): Promise<T[]> {
    const built = buildQuestionQuery(strings, values)
    return this.query<T>(built.text, built.params)
  }

  /**
   * Runs a function inside a database transaction. Delegates to Bun's native
   * `db.transaction()` — the transaction commits when the function returns and
   * rolls back if it throws. The function must be synchronous (bun:sqlite
   * transactions do not span awaits); use the raw `db` getter's prepared
   * statements inside it for speed.
   *
   * Combined with `UPDATE ... RETURNING`, this gives you atomic job-claiming
   * for durable queues and workers.
   *
   * @param fn - Synchronous function containing the transactional work
   * @returns The function's return value
   *
   * @example
   * ```typescript
   * const db = container.feature('sqlite') // in-memory
   * await db.execute(`CREATE TABLE jobs (id INTEGER PRIMARY KEY, payload TEXT, status TEXT DEFAULT 'pending', claimed_at TEXT)`)
   * await db.execute(`CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance INTEGER)`)
   * await db.execute(`INSERT INTO jobs (payload) VALUES ('build'), ('deploy')`)
   * await db.execute(`INSERT INTO accounts (balance) VALUES (500), (500)`)
   *
   * // Atomically claim the next pending job (single statement — no explicit
   * // transaction needed thanks to UPDATE ... RETURNING)
   * const [job] = await db.query(`
   *   UPDATE jobs SET status = 'running', claimed_at = datetime('now')
   *   WHERE id = (SELECT id FROM jobs WHERE status = 'pending' ORDER BY id LIMIT 1)
   *   RETURNING id, payload
   * `)
   * console.log(job) // { id: 1, payload: 'build' }
   *
   * // Multi-statement atomic work: all-or-nothing
   * db.transaction(() => {
   *   db.db.query('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(100, 1)
   *   db.db.query('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(100, 2)
   * })
   * ```
   */
  transaction<T>(fn: () => T): T {
    try {
      const result = this.db.transaction(fn)()
      this.setState({ lastError: undefined })
      return result
    } catch (error: any) {
      this.setState({ lastError: error?.message || String(error) })
      this.emit('error', error)
      throw error
    }
  }

  /**
   * Closes the sqlite database and updates feature state.
   *
   * Emits `closed` after the database handle is released.
   *
   * @returns This Sqlite feature instance for method chaining
   *
   * @example
   * ```typescript
   * const db = container.feature('sqlite', { path: 'app.db' })
   * // ... run queries ...
   * db.close()
   * ```
   */
  close() {
    this.db.close()
    this.setState({ connected: false })
    this.emit('closed')
    return this
  }
}

export default Sqlite
declare module '../../feature.js' {
  interface AvailableFeatures {
    sqlite: typeof Sqlite
  }
}

function assertQueryText(queryText: string) {
  if (typeof queryText !== 'string' || queryText.trim().length === 0) {
    throw new Error('SQL query text must be a non-empty string')
  }
}

function assertParams(params: SqlValue[]) {
  if (!Array.isArray(params)) {
    throw new Error('SQL params must be an array')
  }

  if (params.some((param) => param === undefined)) {
    throw new Error('SQL params cannot contain undefined values. Use null instead.')
  }
}

/**
 * Whether a SQL statement's leading keyword indicates it returns rows.
 * Skips whitespace, `--` line comments, and block comments before looking
 * at the first word, so commented SQL classifies correctly.
 */
function isRowReturningStatement(queryText: string): boolean {
  let text = queryText
  // Strip leading whitespace and comments until we hit real SQL
  for (;;) {
    const before = text
    text = text.replace(/^\s+/, '')
    text = text.replace(/^--[^\n]*(\n|$)/, '')
    text = text.replace(/^\/\*[\s\S]*?\*\//, '')
    if (text === before) break
  }

  const keyword = /^[a-zA-Z]+/.exec(text)?.[0]?.toUpperCase()
  return keyword === 'SELECT' || keyword === 'WITH' || keyword === 'PRAGMA' || keyword === 'EXPLAIN'
}

/** JSON.stringify that survives bigint values (e.g. lastInsertRowid). */
function jsonify(value: unknown): string {
  return JSON.stringify(value, (_key, v) => typeof v === 'bigint' ? v.toString() : v)
}

function buildQuestionQuery(strings: TemplateStringsArray, values: SqlValue[]) {
  if (strings.length !== values.length + 1) {
    throw new Error('Invalid SQL template literal input')
  }

  const chunks: string[] = []

  for (let i = 0; i < strings.length; i++) {
    chunks.push(strings[i]!)
    if (i < values.length) {
      chunks.push('?')
    }
  }

  return { text: chunks.join(''), params: values }
}
