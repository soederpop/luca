import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

function makeDb() {
  const container = new NodeContainer()
  const db = container.feature('sqlite', { path: ':memory:' })
  db.db.exec(`CREATE TABLE jobs (id INTEGER PRIMARY KEY, status TEXT NOT NULL DEFAULT 'pending', payload TEXT)`)
  return db
}

describe('sqlite.transaction', () => {
  it('commits when the function returns', async () => {
    const db = makeDb()
    db.transaction(() => {
      db.db.query(`INSERT INTO jobs (payload) VALUES (?)`).run('a')
      db.db.query(`INSERT INTO jobs (payload) VALUES (?)`).run('b')
    })
    const rows = await db.query(`SELECT COUNT(*) as n FROM jobs`)
    expect((rows[0] as any).n).toBe(2)
  })

  it('rolls back when the function throws', async () => {
    const db = makeDb()
    expect(() =>
      db.transaction(() => {
        db.db.query(`INSERT INTO jobs (payload) VALUES (?)`).run('a')
        throw new Error('abort')
      })
    ).toThrow('abort')
    const rows = await db.query(`SELECT COUNT(*) as n FROM jobs`)
    expect((rows[0] as any).n).toBe(0)
  })

  it('returns the function result', () => {
    const db = makeDb()
    const result = db.transaction(() => {
      db.db.query(`INSERT INTO jobs (payload) VALUES (?)`).run('x')
      return db.db.query(`SELECT last_insert_rowid() as id`).get()
    })
    expect((result as any).id).toBe(1)
  })

  it('supports the UPDATE ... RETURNING atomic job-claim idiom', async () => {
    const db = makeDb()
    await db.execute(`INSERT INTO jobs (payload) VALUES ('first'), ('second')`)

    const claimed = await db.query(`
      UPDATE jobs SET status = 'running'
      WHERE id = (SELECT id FROM jobs WHERE status = 'pending' ORDER BY id LIMIT 1)
      RETURNING id, payload
    `)
    expect(claimed.length).toBe(1)
    expect((claimed[0] as any).payload).toBe('first')

    const pending = await db.query(`SELECT COUNT(*) as n FROM jobs WHERE status = 'pending'`)
    expect((pending[0] as any).n).toBe(1)
  })
})
