import container from '@/node'

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

type TableRow = {
  table_schema: string
  table_name: string
}

async function main() {
  const url = process.env.DATABASE_URL || DEFAULT_DATABASE_URL
  const postgres = container.feature('postgres', { url })

  try {
    const tables = await withTimeout(
      postgres.query<TableRow>(
        `
        select table_schema, table_name
        from information_schema.tables
        where table_type = 'BASE TABLE'
          and table_schema not in ('pg_catalog', 'information_schema')
        order by table_schema, table_name
        `
      ),
      8000,
      `Timed out connecting/querying ${url}`
    )

    if (tables.length === 0) {
      console.log('No user tables found.')
      return
    }

    console.log(`Found ${tables.length} table(s):`)
    for (const table of tables) {
      console.log(`- ${table.table_schema}.${table.table_name}`)
    }
  } finally {
    await withTimeout(postgres.close(), 1000, 'Timed out while closing Postgres connection').catch(() => {})
  }
}

main().catch((error) => {
  console.error('Failed to list Postgres tables:', error)
  process.exit(1)
})

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs)
    }),
  ])
}
