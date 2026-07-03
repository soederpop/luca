# Sqlite (features.sqlite)

> Stability: `core`

SQLite feature for safe SQL execution through Bun's native sqlite binding. Supports: - parameterized query execution (`query` / `execute`) - tagged-template query execution (`sql`) to avoid manual placeholder wiring Pass `{ path: ':memory:' }` (the default when no path is given) for an ephemeral in-memory database with zero setup, or a file path to persist to disk.

## Usage

```ts
container.feature('sqlite', {
  // Path to sqlite file. Use :memory: for in-memory database
  path,
  // Open sqlite database in readonly mode
  readonly,
  // Open sqlite database in readwrite mode (defaults to true when readonly is false)
  readwrite,
  // Create the sqlite database file if it does not exist
  create,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `path` | `string` | Path to sqlite file. Use :memory: for in-memory database |
| `readonly` | `boolean` | Open sqlite database in readonly mode |
| `readwrite` | `boolean` | Open sqlite database in readwrite mode (defaults to true when readonly is false) |
| `create` | `boolean` | Create the sqlite database file if it does not exist |

## Methods

### query

Executes a SELECT-like query and returns result rows. Use sqlite placeholders (`?`) for `params`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `queryText` | `string` | ✓ | The SQL query string with optional `?` placeholders |
| `params` | `SqlValue[]` |  | Ordered array of values to bind to the placeholders |

**Returns:** `Promise<T[]>`

```ts
const db = container.feature('sqlite') // in-memory
await db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, active INTEGER)')
await db.execute('INSERT INTO users (email, active) VALUES (?, ?)', ['hello@example.com', 1])

const users = await db.query<{ id: number; email: string }>(
 'SELECT id, email FROM users WHERE active = ?',
 [1]
)
console.log(users) // [{ id: 1, email: 'hello@example.com' }]
```



### execute

Executes a write/update/delete statement and returns metadata. Use sqlite placeholders (`?`) for `params`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `queryText` | `string` | ✓ | The SQL statement string with optional `?` placeholders |
| `params` | `SqlValue[]` |  | Ordered array of values to bind to the placeholders |

**Returns:** `Promise<{ changes: number; lastInsertRowid: number | bigint | null }>`

```ts
const db = container.feature('sqlite') // in-memory
await db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE)')

const { changes, lastInsertRowid } = await db.execute(
 'INSERT INTO users (email) VALUES (?)',
 ['hello@example.com']
)
console.log(`Inserted row ${lastInsertRowid}, ${changes} change(s)`)
```



### sql

Safe tagged-template SQL helper. Values become bound parameters automatically, preventing SQL injection.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `strings` | `TemplateStringsArray` | ✓ | Template literal string segments |
| `values` | `SqlValue[]` | ✓ | Interpolated values that become bound `?` parameters |

**Returns:** `Promise<T[]>`

```ts
const db = container.feature('sqlite') // in-memory
await db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)')
await db.execute('INSERT INTO users (email) VALUES (?)', ['hello@example.com'])

const email = 'hello@example.com'
const rows = await db.sql<{ id: number }>`
 SELECT id FROM users WHERE email = ${email}
`
console.log(rows) // [{ id: 1 }]
```



### transaction

Runs a function inside a database transaction. Delegates to Bun's native `db.transaction()` — the transaction commits when the function returns and rolls back if it throws. The function must be synchronous (bun:sqlite transactions do not span awaits); use the raw `db` getter's prepared statements inside it for speed. Combined with `UPDATE ... RETURNING`, this gives you atomic job-claiming for durable queues and workers.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fn` | `() => T` | ✓ | Synchronous function containing the transactional work |

**Returns:** `T`

```ts
const db = container.feature('sqlite') // in-memory
await db.execute(`CREATE TABLE jobs (id INTEGER PRIMARY KEY, payload TEXT, status TEXT DEFAULT 'pending', claimed_at TEXT)`)
await db.execute(`CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance INTEGER)`)
await db.execute(`INSERT INTO jobs (payload) VALUES ('build'), ('deploy')`)
await db.execute(`INSERT INTO accounts (balance) VALUES (500), (500)`)

// Atomically claim the next pending job (single statement — no explicit
// transaction needed thanks to UPDATE ... RETURNING)
const [job] = await db.query(`
 UPDATE jobs SET status = 'running', claimed_at = datetime('now')
 WHERE id = (SELECT id FROM jobs WHERE status = 'pending' ORDER BY id LIMIT 1)
 RETURNING id, payload
`)
console.log(job) // { id: 1, payload: 'build' }

// Multi-statement atomic work: all-or-nothing
db.transaction(() => {
 db.db.query('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(100, 1)
 db.db.query('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(100, 2)
})
```



### close

Closes the sqlite database and updates feature state. Emits `closed` after the database handle is released.

**Returns:** `void`

```ts
const db = container.feature('sqlite', { path: 'app.db' })
// ... run queries ...
db.close()
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `db` | `any` | Returns the underlying Bun sqlite database instance. |

## Events (Zod v4 schema)

### query

Emitted after a SELECT-like query completes successfully

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The SQL query text that was executed |
| `arg1` | `array` | Bound parameter values |
| `arg2` | `number` | Number of rows returned |



### error

Emitted when a SQL operation fails

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error that occurred |



### execute

Emitted after a write/update/delete statement completes successfully

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The SQL statement text that was executed |
| `arg1` | `array` | Bound parameter values |
| `arg2` | `number` | Number of rows changed |



### closed

Emitted when the database connection is closed



## Examples

**features.sqlite**

```ts
// In-memory by default; pass { path: 'app.db' } to persist to disk
// (the parent folder of a file path must already exist)
const sqlite = container.feature('sqlite')

await sqlite.execute(
 'create table if not exists users (id integer primary key, email text not null unique)'
)

await sqlite.execute('insert into users (email) values (?)', ['hello@example.com'])

const users = await sqlite.sql<{ id: number; email: string }>`
 select id, email from users where email = ${'hello@example.com'}
`
console.log(users) // [{ id: 1, email: 'hello@example.com' }]
```



**query**

```ts
const db = container.feature('sqlite') // in-memory
await db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, active INTEGER)')
await db.execute('INSERT INTO users (email, active) VALUES (?, ?)', ['hello@example.com', 1])

const users = await db.query<{ id: number; email: string }>(
 'SELECT id, email FROM users WHERE active = ?',
 [1]
)
console.log(users) // [{ id: 1, email: 'hello@example.com' }]
```



**execute**

```ts
const db = container.feature('sqlite') // in-memory
await db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE)')

const { changes, lastInsertRowid } = await db.execute(
 'INSERT INTO users (email) VALUES (?)',
 ['hello@example.com']
)
console.log(`Inserted row ${lastInsertRowid}, ${changes} change(s)`)
```



**sql**

```ts
const db = container.feature('sqlite') // in-memory
await db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)')
await db.execute('INSERT INTO users (email) VALUES (?)', ['hello@example.com'])

const email = 'hello@example.com'
const rows = await db.sql<{ id: number }>`
 SELECT id FROM users WHERE email = ${email}
`
console.log(rows) // [{ id: 1 }]
```



**transaction**

```ts
const db = container.feature('sqlite') // in-memory
await db.execute(`CREATE TABLE jobs (id INTEGER PRIMARY KEY, payload TEXT, status TEXT DEFAULT 'pending', claimed_at TEXT)`)
await db.execute(`CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance INTEGER)`)
await db.execute(`INSERT INTO jobs (payload) VALUES ('build'), ('deploy')`)
await db.execute(`INSERT INTO accounts (balance) VALUES (500), (500)`)

// Atomically claim the next pending job (single statement — no explicit
// transaction needed thanks to UPDATE ... RETURNING)
const [job] = await db.query(`
 UPDATE jobs SET status = 'running', claimed_at = datetime('now')
 WHERE id = (SELECT id FROM jobs WHERE status = 'pending' ORDER BY id LIMIT 1)
 RETURNING id, payload
`)
console.log(job) // { id: 1, payload: 'build' }

// Multi-statement atomic work: all-or-nothing
db.transaction(() => {
 db.db.query('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(100, 1)
 db.db.query('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(100, 2)
})
```



**close**

```ts
const db = container.feature('sqlite', { path: 'app.db' })
// ... run queries ...
db.close()
```

