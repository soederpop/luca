import { z } from 'zod'
import { SQL } from 'bun'
import { Feature } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import type { ContainerContext } from '../../container.js'
import type { Helper } from '../../helper.js'

type SqlValue = string | number | boolean | bigint | Uint8Array | Buffer | null

export const PostgresStateSchema = FeatureStateSchema.extend({
  connected: z.boolean().default(false).describe('Whether the postgres connection is currently open'),
  url: z.string().default('').describe('Connection URL used for this postgres feature instance'),
  lastQuery: z.string().optional().describe('Most recent SQL query string that was executed'),
  lastRowCount: z.number().optional().describe('Row count returned by the most recent query execution'),
  lastError: z.string().optional().describe('Most recent postgres error message, if any'),
})

export const PostgresOptionsSchema = FeatureOptionsSchema.extend({
  url: z.string().min(1).optional().describe('Postgres connection URL, e.g. postgres://user:pass@host:5432/db'),
  readOnly: z.boolean().optional().describe('Open the session read-only: sets default_transaction_read_only=on via the connection URL so the server rejects writes, and makes execute() throw locally. A determined SQL author can still SET it off — use a SELECT-only role for hard enforcement.'),
})

export type PostgresState = z.infer<typeof PostgresStateSchema>
export type PostgresOptions = z.infer<typeof PostgresOptionsSchema>

export const PostgresEventsSchema = FeatureEventsSchema.extend({
  query: z.tuple([
    z.string().describe('The SQL query text'),
    z.array(z.any()).describe('Bound parameter values'),
    z.number().describe('Number of rows returned'),
  ]).describe('When a SELECT-like query is executed'),
  execute: z.tuple([
    z.string().describe('The SQL statement text'),
    z.array(z.any()).describe('Bound parameter values'),
    z.number().describe('Number of rows affected'),
  ]).describe('When a write/update/delete statement is executed'),
  error: z.tuple([z.any().describe('The error object')]).describe('When a postgres operation fails'),
  closed: z.tuple([]).describe('When the postgres connection is closed'),
}).describe('Postgres events')

/**
 * Postgres feature for safe SQL execution through Bun's native SQL client.
 *
 * Supports:
 * - parameterized query execution (`query` / `execute`)
 * - tagged-template query execution (`sql`) to avoid manual placeholder wiring
 *
 * Requires a running PostgreSQL server and a connection URL — `options.url`
 * is required (the constructor throws without it). In production, read the
 * URL from an environment variable rather than hardcoding credentials.
 *
 * @example
 * ```typescript
 * const postgres = container.feature('postgres', { url: process.env.DATABASE_URL! })
 *
 * const users = await postgres.query<{ id: number; email: string }>(
 *   'select id, email from users where id = $1',
 *   [123]
 * )
 *
 * const rows = await postgres.sql<{ id: number }>`
 *   select id from users where email = ${'hello@example.com'}
 * `
 *
 * // Read-only session: the server rejects writes and execute() throws locally.
 * // Guardrail, not a boundary — arbitrary SQL can SET it back off, so use a
 * // SELECT-only role when the caller is untrusted (e.g. an AI assistant).
 * const reader = container.feature('postgres', { url: process.env.DATABASE_URL!, readOnly: true })
 * ```
 */
export class Postgres extends Feature<PostgresState, PostgresOptions> {
  static override shortcut = 'features.postgres' as const
  static override stability = 'stable' as const
  static override category = 'data-storage' as const
  static override stateSchema = PostgresStateSchema
  static override optionsSchema = PostgresOptionsSchema
  static override eventsSchema = PostgresEventsSchema
  static { Feature.register(this, 'postgres') }

  // Read and write are separate tools so consumers can scope access
  // structurally: toTools({ only: ['pgQuery', 'pgListTables', 'pgDescribeTable'] }).
  // pgQuery's leading-keyword check is best-effort — postgres allows DML inside
  // a WITH clause — so pair `only` scoping with `readOnly: true` (or a
  // SELECT-only role) when the caller must not write.
  static override tools: Record<string, { schema: z.ZodType; description?: string; handler?: Function }> = {
    pgQuery: {
      description: 'Run a read-only SQL query (SELECT, WITH, EXPLAIN, SHOW) and get rows back as JSON. Use $1, $2, ... placeholders with params for values. Writes are rejected — use pgExecute for those.',
      schema: z.object({
        sql: z.string().describe('SQL query using $N placeholders, e.g. "SELECT * FROM users WHERE active = $1"'),
        params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().describe('Values bound to the $N placeholders, in order'),
      }).describe('Run a read-only SQL query and get rows back as JSON.'),
      handler: async (args: { sql: string; params?: any[] }, pg: Postgres) => {
        if (!isReadStatement(args.sql)) {
          return 'Error: pgQuery only accepts read statements (SELECT, WITH, EXPLAIN, SHOW). Use pgExecute for writes and DDL.'
        }
        return jsonify(await pg.query(args.sql, args.params ?? []))
      },
    },
    pgExecute: {
      description: 'Run a write or DDL statement (INSERT, UPDATE, DELETE, CREATE TABLE, ...). Use $1, $2, ... placeholders with params for values. Returns { rowCount }. Fails on a readOnly feature instance.',
      schema: z.object({
        sql: z.string().describe('SQL statement using $N placeholders, e.g. "INSERT INTO users (email) VALUES ($1)"'),
        params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().describe('Values bound to the $N placeholders, in order'),
      }).describe('Run a write or DDL statement.'),
      handler: async (args: { sql: string; params?: any[] }, pg: Postgres) =>
        jsonify(await pg.execute(args.sql, args.params ?? [])),
    },
    pgListTables: {
      description: 'List tables and views in a schema (default: public). Start here — never guess table names.',
      schema: z.object({
        schema: z.string().optional().describe('Schema to list (default: "public")'),
      }).describe('List tables and views in a schema.'),
      handler: async (args: { schema?: string }, pg: Postgres) =>
        jsonify(await pg.query(
          "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name",
          [args.schema ?? 'public'],
        )),
    },
    pgDescribeTable: {
      description: 'Get the columns of a table: name, type, nullability, and default. Use before writing queries against an unfamiliar table.',
      schema: z.object({
        table: z.string().describe('Table name (from pgListTables)'),
        schema: z.string().optional().describe('Schema the table lives in (default: "public")'),
      }).describe('Get the columns of a table.'),
      handler: async (args: { table: string; schema?: string }, pg: Postgres) =>
        jsonify(await pg.query(
          'SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position',
          [args.schema ?? 'public', args.table],
        )),
    },
  }

  /**
   * When an assistant consumes these tools, inject guidance about the
   * placeholder style, the read/write tool split, and read-only mode.
   */
  override setupToolsConsumer(consumer: Helper) {
    if (typeof (consumer as any).addSystemPromptExtension === 'function') {
      (consumer as any).addSystemPromptExtension('postgres', [
        '## Postgres Tools',
        '',
        'Start with `pgListTables` and `pgDescribeTable` — never guess table or column names.',
        '',
        'Always pass values via `params` with `$1, $2, ...` placeholders, never interpolated into the SQL string.',
        '',
        '`pgQuery` is for reads only and rejects writes; `pgExecute` is for INSERT/UPDATE/DELETE/DDL and returns `{ rowCount }`.',
        ...(this.options.readOnly ? ['', 'This connection is READ-ONLY: the server rejects all writes and pgExecute is disabled.'] : []),
      ].join('\n'))
    }
  }

  private _client: SQL

  /**
   * Default state for the Postgres feature before a connection is established.
   * @returns The initial PostgresState with `connected: false` and empty `url`
   */
  override get initialState(): PostgresState {
    return {
      enabled: false,
      connected: false,
      url: '',
    }
  }

  constructor(options: PostgresOptions, context: ContainerContext) {
    super(options, context)

    if (!options.url) {
      throw new Error('Postgres feature requires options.url')
    }

    const url = options.readOnly ? applyReadOnly(options.url) : options.url

    this._client = new SQL(url)
    this.hide('_client')

    this.setState({
      connected: true,
      url,
    })
  }

  /**
   * Returns the underlying Bun SQL postgres client.
   * @returns The raw `SQL` instance used for all database operations
   */
  get client() {
    return this._client
  }

  /**
   * Executes a SELECT-like query and returns result rows.
   *
   * Use postgres placeholders (`$1`, `$2`, ...) for `params`.
   *
   * @param queryText - The SQL query string with optional `$N` placeholders
   * @param params - Ordered array of values to bind to the placeholders
   * @returns Promise resolving to an array of typed result rows
   * @throws {Error} When query text is empty or params contain `undefined`
   *
   * @example
   * ```typescript
   * const pg = container.feature('postgres', { url: process.env.DATABASE_URL! })
   * const users = await pg.query<{ id: number; email: string }>(
   *   'SELECT id, email FROM users WHERE active = $1',
   *   [true]
   * )
   * ```
   */
  async query<T extends object = Record<string, unknown>>(queryText: string, params: SqlValue[] = []): Promise<T[]> {
    assertQueryText(queryText)
    assertParams(params)

    try {
      const result = await this.client.unsafe(queryText, params)
      const rows = Array.isArray(result) ? result as T[] : []
      const rowCount = resolveRowCount(result)

      this.setState({
        lastQuery: queryText,
        lastRowCount: rowCount,
        lastError: undefined,
      })

      this.emit('query', queryText, params, rowCount)
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
   * Use postgres placeholders (`$1`, `$2`, ...) for `params`.
   *
   * @param queryText - The SQL statement string with optional `$N` placeholders
   * @param params - Ordered array of values to bind to the placeholders
   * @returns Promise resolving to `{ rowCount }` indicating affected rows
   * @throws {Error} When query text is empty, params contain `undefined`, or the instance was created with `readOnly: true`
   *
   * @example
   * ```typescript
   * const pg = container.feature('postgres', { url: process.env.DATABASE_URL! })
   * const { rowCount } = await pg.execute(
   *   'UPDATE users SET active = $1 WHERE last_login < $2',
   *   [false, '2024-01-01']
   * )
   * console.log(`Deactivated ${rowCount} users`)
   * ```
   */
  async execute(queryText: string, params: SqlValue[] = []): Promise<{ rowCount: number }> {
    if (this.options.readOnly) {
      throw new Error('This postgres feature instance is read-only (options.readOnly) — execute() is disabled. Use query() for reads.')
    }
    assertQueryText(queryText)
    assertParams(params)

    try {
      const result = await this.client.unsafe(queryText, params)
      const rowCount = resolveRowCount(result)

      this.setState({
        lastQuery: queryText,
        lastRowCount: rowCount,
        lastError: undefined,
      })

      this.emit('execute', queryText, params, rowCount)
      return { rowCount }
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
   * Safe tagged-template SQL helper.
   *
   * Values become bound parameters automatically, preventing SQL injection.
   *
   * @param strings - Template literal string segments
   * @param values - Interpolated values that become bound `$N` parameters
   * @returns Promise resolving to an array of typed result rows
   *
   * @example
   * ```typescript
   * const pg = container.feature('postgres', { url: process.env.DATABASE_URL! })
   * const email = 'hello@example.com'
   * const rows = await pg.sql<{ id: number }>`
   *   SELECT id FROM users WHERE email = ${email}
   * `
   * ```
   */
  async sql<T extends object = Record<string, unknown>>(strings: TemplateStringsArray, ...values: SqlValue[]): Promise<T[]> {
    const built = buildDollarQuery(strings, values)
    return this.query<T>(built.text, built.params)
  }

  /**
   * Closes the postgres connection and updates feature state.
   *
   * Emits `closed` after the connection is torn down.
   *
   * @returns This Postgres feature instance for method chaining
   *
   * @example
   * ```typescript
   * const pg = container.feature('postgres', { url: process.env.DATABASE_URL! })
   * // ... run queries ...
   * await pg.close()
   * ```
   */
  async close() {
    await this.client.close()
    this.setState({ connected: false })
    this.emit('closed')
    return this
  }
}

export default Postgres
declare module '../../feature.js' {
  interface AvailableFeatures {
    postgres: typeof Postgres
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

function buildDollarQuery(strings: TemplateStringsArray, values: SqlValue[]) {
  if (strings.length !== values.length + 1) {
    throw new Error('Invalid SQL template literal input')
  }

  const chunks: string[] = []

  for (let i = 0; i < strings.length; i++) {
    chunks.push(strings[i]!)
    if (i < values.length) {
      chunks.push(`$${i + 1}`)
    }
  }

  return { text: chunks.join(''), params: values }
}

/**
 * Append `-c default_transaction_read_only=on` to the URL's libpq `options`
 * startup parameter (preserving any options the caller already set), so the
 * server opens every session read-only.
 */
function applyReadOnly(urlString: string): string {
  const url = new URL(urlString)
  const existing = url.searchParams.get('options')
  const flag = '-c default_transaction_read_only=on'
  const value = existing ? `${existing} ${flag}` : flag

  // Percent-encode by hand: URLSearchParams serializes spaces as '+', which
  // libpq-style URI parsing does not decode back to a space.
  url.searchParams.delete('options')
  const rest = url.searchParams.toString()
  url.search = ''
  return `${url.toString()}?${rest ? `${rest}&` : ''}options=${encodeURIComponent(value)}`
}

/** JSON.stringify that survives bigint values (e.g. count() results). */
function jsonify(value: unknown): string {
  return JSON.stringify(value, (_key, v) => typeof v === 'bigint' ? v.toString() : v)
}

/**
 * Whether a SQL statement's leading keyword (after whitespace and comments)
 * is read-shaped. Best-effort only: postgres permits DML inside WITH clauses,
 * so hard read-only enforcement belongs to `readOnly: true` or a SELECT-only role.
 */
function isReadStatement(queryText: string): boolean {
  let text = queryText
  for (;;) {
    const before = text
    text = text.replace(/^\s+/, '')
    text = text.replace(/^--[^\n]*(\n|$)/, '')
    text = text.replace(/^\/\*[\s\S]*?\*\//, '')
    if (text === before) break
  }

  const keyword = /^[a-zA-Z]+/.exec(text)?.[0]?.toUpperCase()
  return keyword === 'SELECT' || keyword === 'WITH' || keyword === 'EXPLAIN' || keyword === 'SHOW'
}

function resolveRowCount(result: any): number {
  if (typeof result?.count === 'number') return result.count
  if (typeof result?.rowCount === 'number') return result.rowCount
  if (Array.isArray(result)) return result.length
  return 0
}
