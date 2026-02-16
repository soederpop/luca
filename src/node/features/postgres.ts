import { z } from 'zod'
import { SQL } from 'bun'
import { Feature, features } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { ContainerContext } from '../../container.js'

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
})

export type PostgresState = z.infer<typeof PostgresStateSchema>
export type PostgresOptions = z.infer<typeof PostgresOptionsSchema>

/**
 * Postgres feature for safe SQL execution through Bun's native SQL client.
 *
 * Supports:
 * - parameterized query execution (`query` / `execute`)
 * - tagged-template query execution (`sql`) to avoid manual placeholder wiring
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
 * ```
 */
export class Postgres extends Feature<PostgresState, PostgresOptions> {
  static override shortcut = 'features.postgres' as const
  static override stateSchema = PostgresStateSchema
  static override optionsSchema = PostgresOptionsSchema

  private _client: SQL

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

    this._client = new SQL(options.url)
    this.hide('_client')

    this.setState({
      connected: true,
      url: options.url,
    })
  }

  /** Returns the underlying Bun SQL postgres client. */
  get client() {
    return this._client
  }

  /**
   * Executes a SELECT-like query and returns result rows.
   *
   * Use postgres placeholders (`$1`, `$2`, ...) for `params`.
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
   */
  async execute(queryText: string, params: SqlValue[] = []): Promise<{ rowCount: number }> {
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
   * Values become bound parameters automatically.
   */
  async sql<T extends object = Record<string, unknown>>(strings: TemplateStringsArray, ...values: SqlValue[]): Promise<T[]> {
    const built = buildDollarQuery(strings, values)
    return this.query<T>(built.text, built.params)
  }

  /** Closes the postgres connection and updates feature state. */
  async close() {
    await this.client.close()
    this.setState({ connected: false })
    this.emit('closed')
    return this
  }
}

export default features.register('postgres', Postgres)

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

function resolveRowCount(result: any): number {
  if (typeof result?.count === 'number') return result.count
  if (typeof result?.rowCount === 'number') return result.rowCount
  if (Array.isArray(result)) return result.length
  return 0
}
