---
title: SQLite Job Queue Worker
tags:
  - sqlite
  - queue
  - worker
  - transaction
  - returning
  - wal
lastTested: '2026-07-03'
lastTestPassed: true
---

# SQLite Job Queue Worker

A durable job queue needs exactly two SQLite tricks the docs rarely lead with: `UPDATE … RETURNING` to claim a job atomically in one statement, and `transaction()` for multi-statement all-or-nothing work. With WAL mode, several worker processes can share one queue file safely.

## Create the queue

```ts
const db = container.feature('sqlite', { path: ':memory:' })

// For a real multi-process queue use a file path — and WAL mode, so readers
// never block the writer: db.db.exec('PRAGMA journal_mode = WAL')

db.db.exec(`
  CREATE TABLE jobs (
    id INTEGER PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending',
    payload TEXT NOT NULL,
    claimed_at TEXT,
    finished_at TEXT
  )
`)
console.log('queue table created')
```

## Enqueue some work

```ts
await db.execute(`INSERT INTO jobs (payload) VALUES (?), (?), (?)`, [
  JSON.stringify({ task: 'send-email', to: 'a@example.com' }),
  JSON.stringify({ task: 'resize-image', file: 'photo.jpg' }),
  JSON.stringify({ task: 'sync-crm' }),
])

const pending = await db.query(`SELECT COUNT(*) AS n FROM jobs WHERE status = 'pending'`)
console.log('pending jobs:', pending[0].n)
```

## Claim a job atomically with UPDATE … RETURNING

This is the heart of the worker. One statement finds the oldest pending job, marks it running, and hands it back — no read-then-write race, no explicit transaction needed. Two workers running this concurrently can never claim the same job.

```ts
const claimed = await db.query(`
  UPDATE jobs
  SET status = 'running', claimed_at = datetime('now')
  WHERE id = (
    SELECT id FROM jobs WHERE status = 'pending' ORDER BY id LIMIT 1
  )
  RETURNING id, payload
`)

console.log('claimed job:', claimed[0].id, '→', JSON.parse(claimed[0].payload).task)
```

An empty array means the queue is drained — that's the worker's signal to idle.

## Multi-statement work: transaction()

When finishing a job touches more than one row, wrap it in `transaction()` — it commits when the function returns, rolls back if it throws. The function must be synchronous (bun:sqlite transactions don't span awaits), so use the raw `db.db` prepared statements inside.

```ts
const [job] = await db.query(`SELECT id FROM jobs WHERE status = 'running' LIMIT 1`)

db.transaction(() => {
  db.db.query(`UPDATE jobs SET status = 'done', finished_at = datetime('now') WHERE id = ?`).run(job.id)
  db.db.query(`INSERT INTO jobs (payload) VALUES (?)`).run(JSON.stringify({ task: 'send-receipt' }))
})

const counts = await db.query(`SELECT status, COUNT(*) AS n FROM jobs GROUP BY status ORDER BY status`)
console.log('queue state:', JSON.stringify(counts))
```

If anything inside throws, neither statement lands:

```ts
try {
  db.transaction(() => {
    db.db.query(`UPDATE jobs SET status = 'cancelled' WHERE status = 'pending'`).run()
    throw new Error('something went wrong mid-job')
  })
} catch (err) {
  console.log('rolled back:', err.message)
}

const counts2 = await db.query(`
  SELECT
    SUM(status = 'cancelled') AS cancelled,
    SUM(status = 'pending') AS pending
  FROM jobs
`)
console.log(`cancelled: ${counts2[0].cancelled}, pending: ${counts2[0].pending} — the UPDATE never landed`)
```

## The worker loop

The complete worker command shape — poll with `utils.every`, claim with RETURNING, guard single-instance with `proc.establishLock`. (Shown, not executed — it runs forever. See the *Daemon & Poll-Loop Commands* example for the lifecycle details.)

```ts skip
export default async function worker(options, context) {
  const { container } = context
  container.feature('proc').establishLock('tmp/worker.pid')

  const db = container.feature('sqlite', { path: 'queue.db' })
  db.db.exec('PRAGMA journal_mode = WAL')

  const stop = container.utils.every(5000, async () => {
    const [job] = await db.query(`
      UPDATE jobs SET status = 'running', claimed_at = datetime('now')
      WHERE id = (SELECT id FROM jobs WHERE status = 'pending' ORDER BY id LIMIT 1)
      RETURNING id, payload
    `)
    if (!job) return // queue drained — idle until the next tick

    await processJob(JSON.parse(job.payload))
    await db.execute(`UPDATE jobs SET status = 'done', finished_at = datetime('now') WHERE id = ?`, [job.id])
  }, { immediate: true, onError: (err) => console.error('worker tick failed:', err) })

  process.on('SIGINT', () => { stop(); process.exit(0) })
  await new Promise(() => {})
}
```

## Summary

`UPDATE … RETURNING` claims jobs atomically in one statement — the idiom that makes SQLite a real queue. `transaction()` covers multi-statement commits with automatic rollback. Add WAL mode for multi-process access, `utils.every` for the poll loop, and `proc.establishLock` for single-instance workers.
