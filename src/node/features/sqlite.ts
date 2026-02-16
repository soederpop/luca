import { z } from 'zod'
import { Database } from 'bun:sqlite'
import { Feature, features } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { ContainerContext } from '../../container.js'

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

/**
 * SQLite feature for safe SQL execution through Bun's native sqlite binding.
 *
 * Supports:
 * - parameterized query execution (`query` / `execute`)
 * - tagged-template query execution (`sql`) to avoid manual placeholder wiring
 *
 * @example
 * ```typescript
 * const sqlite = container.feature('sqlite', { path: 'data/app.db' })
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
 * ```
 */
export class Sqlite extends Feature<SqliteState, SqliteOptions> {
  static override shortcut = 'features.sqlite' as const
  static override stateSchema = SqliteStateSchema
  static override optionsSchema = SqliteOptionsSchema

  private _db: Database

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
   * Safe tagged-template SQL helper.
   *
   * Values become bound parameters automatically.
   */
  async sql<T extends object = Record<string, unknown>>(strings: TemplateStringsArray, ...values: SqlValue[]): Promise<T[]> {
    const built = buildQuestionQuery(strings, values)
    return this.query<T>(built.text, built.params)
  }

  /** Closes the sqlite database and updates feature state. */
  close() {
    this.db.close()
    this.setState({ connected: false })
    this.emit('closed')
    return this
  }
}

export default features.register('sqlite', Sqlite)

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
