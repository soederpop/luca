import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

function makeDb() {
  const container = new NodeContainer()
  const db = container.feature('sqlite', { path: ':memory:' })
  db.db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)`)
  return db
}

describe('sqlite.queryOne', () => {
  it('returns the first row', async () => {
    const db = makeDb()
    await db.execute(`INSERT INTO users (email) VALUES (?), (?)`, ['a@x.com', 'b@x.com'])
    const row = await db.queryOne<{ id: number; email: string }>(`SELECT id, email FROM users ORDER BY id`)
    expect(row).toEqual({ id: 1, email: 'a@x.com' })
  })

  it('returns null when no rows match', async () => {
    const db = makeDb()
    const row = await db.queryOne(`SELECT * FROM users WHERE id = ?`, [999])
    expect(row).toBeNull()
  })

  it('throws on invalid SQL like query()', async () => {
    const db = makeDb()
    await expect(db.queryOne(`SELECT * FROM no_such_table`)).rejects.toThrow()
  })
})

describe('sqlite.run', () => {
  it('routes SELECT to the query path and returns rows', async () => {
    const db = makeDb()
    await db.execute(`INSERT INTO users (email) VALUES (?)`, ['a@x.com'])
    const rows = await db.run(`SELECT email FROM users`)
    expect(rows).toEqual([{ email: 'a@x.com' }])
  })

  it('routes INSERT to the execute path and returns metadata', async () => {
    const db = makeDb()
    const result = await db.run(`INSERT INTO users (email) VALUES (?)`, ['a@x.com'])
    expect(result).toEqual({ changes: 1, lastInsertRowid: 1 })
  })

  it('routes WITH (CTE) to the query path', async () => {
    const db = makeDb()
    await db.execute(`INSERT INTO users (email) VALUES (?)`, ['a@x.com'])
    const rows = await db.run(`WITH active AS (SELECT * FROM users) SELECT email FROM active`)
    expect(rows).toEqual([{ email: 'a@x.com' }])
  })

  it('routes PRAGMA and EXPLAIN to the query path', async () => {
    const db = makeDb()
    const pragma = await db.run(`PRAGMA table_info(users)`)
    expect(Array.isArray(pragma)).toBe(true)
    expect((pragma as any[]).length).toBe(2)

    const plan = await db.run(`EXPLAIN QUERY PLAN SELECT * FROM users`)
    expect(Array.isArray(plan)).toBe(true)
  })

  it('classifies past leading whitespace and line comments', async () => {
    const db = makeDb()
    await db.execute(`INSERT INTO users (email) VALUES (?)`, ['a@x.com'])
    const rows = await db.run(`
      -- fetch everyone
      SELECT email FROM users
    `)
    expect(rows).toEqual([{ email: 'a@x.com' }])
  })

  it('classifies past block comments', async () => {
    const db = makeDb()
    const result = await db.run(`/* seed data */ INSERT INTO users (email) VALUES (?)`, ['a@x.com'])
    expect(result).toMatchObject({ changes: 1 })
  })

  it('routes UPDATE and DELETE to the execute path', async () => {
    const db = makeDb()
    await db.run(`INSERT INTO users (email) VALUES ('a@x.com'), ('b@x.com')`)
    const updated = await db.run(`UPDATE users SET email = ? WHERE id = ?`, ['c@x.com', 1])
    expect(updated).toMatchObject({ changes: 1 })
    const deleted = await db.run(`DELETE FROM users`)
    expect(deleted).toMatchObject({ changes: 2 })
  })

  it('throws on empty SQL', async () => {
    const db = makeDb()
    await expect(db.run('   ')).rejects.toThrow('non-empty')
  })
})
