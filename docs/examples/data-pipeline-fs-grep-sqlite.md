---
title: 'Data Pipeline: grep → normalize → SQLite'
tags:
  - pipeline
  - grep
  - sqlite
  - fs
  - data
  - composition
lastTested: '2026-07-05'
lastTestPassed: true
---

# Data Pipeline: grep → normalize → SQLite

A recurring shape: scan something with `grep`/`fs`, normalize the hits in plain JavaScript, load them into SQLite, then answer questions with SQL. The store-choice heuristic that drives it: **the moment you want to ask questions of your data — group it, count it, filter it, join it — put it in `sqlite`**. `diskCache` is for opaque values you fetch by key; container state is for in-process wiring. Anything *queryable* belongs in a database, and the `sqlite` feature makes that a one-liner.

This pipeline scans this repo's `src/` tree for code annotations (TODO, FIXME, HACK, XXX), loads them into a temp database, and asks it questions. Run `luca describe grep` and `luca describe sqlite` for the full API of each helper.

## Extract — scan the codebase with grep

`grep.todos()` is a canned search for `TODO|FIXME|HACK|XXX` that returns structured `{ file, line, column, content }` matches with paths relative to the container cwd. One caveat worth knowing: it matches the words *anywhere on the line* — including inside string literals and generated documentation — not just in comments. We'll deal with that in the normalize step.

```ts
// bare assignment (no const) — hits survives into the later blocks
hits = await grep.todos({ path: 'src', include: '*.ts' })
console.log(`raw hits in src/: ${hits.length}`)
console.log('first hit:', JSON.stringify(hits[0]))
```

(`grep`, `fs`, and `os` are already in scope in these runnable docs — the container injects its context. In your own scripts, `container.feature('grep')` gets you the same instance.)

## Transform — normalize the raw matches

Raw grep output is not yet *data*. Each row we load should carry the fields we'll want to query by: which tag, which file, which top-level area of the codebase. This is also where we drop noise — generated build artifacts (`*generated*.ts`) mention TODO in prose constantly, and they're not actionable annotations.

```ts
const TAG = /\b(TODO|FIXME|HACK|XXX)\b/

annotations = hits
  .filter(h => !/generated/.test(h.file))
  .map(h => ({
    tag: h.content.match(TAG)[1],
    file: h.file,
    line: h.line,
    area: h.file.split('/').slice(0, 2).join('/'),
    text: h.content.trim().slice(0, 160),
  }))

if (annotations.length === 0) throw new Error('expected at least one annotation in src/')
console.log(`normalized: ${annotations.length} annotations (dropped ${hits.length - annotations.length} from generated files)`)
```

## Load — bulk insert into a temp SQLite database

Use a real file in the OS temp dir — `container.paths.resolve(os.tmpdir, ...)`, **not** `paths.join`, which prepends the cwd even to absolute paths. For the bulk insert, `db.transaction()` with a prepared statement is the fast, all-or-nothing idiom: the transaction function must be synchronous, so we use the raw `db.db` prepared statement inside it.

```ts
dbPath = container.paths.resolve(os.tmpdir, `annotations-${Date.now()}.sqlite`)
db = container.feature('sqlite', { path: dbPath })

db.db.exec(`
  CREATE TABLE annotations (
    id INTEGER PRIMARY KEY,
    tag TEXT NOT NULL,
    file TEXT NOT NULL,
    line INTEGER NOT NULL,
    area TEXT NOT NULL,
    text TEXT NOT NULL
  )
`)

db.transaction(() => {
  const insert = db.db.query(`INSERT INTO annotations (tag, file, line, area, text) VALUES (?, ?, ?, ?, ?)`)
  for (const a of annotations) insert.run(a.tag, a.file, a.line, a.area, a.text)
})

const [{ n }] = await db.sql`SELECT COUNT(*) AS n FROM annotations`
if (n !== annotations.length) throw new Error(`loaded ${n}, expected ${annotations.length}`)
console.log(`loaded ${n} rows into ${dbPath}`)
```

## Query — answer questions with tagged-template SQL

This is the payoff. Questions that would be awkward loops over an array are one `GROUP BY` away. `db.sql` is a tagged template — every `${value}` becomes a bound `?` parameter automatically, so there's no injection risk and no placeholder wiring.

```ts
byTag = await db.sql`
  SELECT tag, COUNT(*) AS count
  FROM annotations
  GROUP BY tag
  ORDER BY count DESC
`
console.log('annotations by tag:', JSON.stringify(byTag))

const hotspots = await db.sql`
  SELECT area, COUNT(*) AS count
  FROM annotations
  GROUP BY area
  ORDER BY count DESC
  LIMIT 3
`
console.log('busiest areas:', JSON.stringify(hotspots))
```

Interpolated values are bound, not spliced — filter by whatever the previous step produced:

```ts
const topTag = byTag[0].tag

const examples = await db.sql`
  SELECT file, line, text
  FROM annotations
  WHERE tag = ${topTag}
  ORDER BY file, line
  LIMIT 3
`
console.log(`sample ${topTag} annotations:`)
for (const e of examples) console.log(`  ${e.file}:${e.line}  ${e.text.slice(0, 80)}`)
```

## Verify — SQL and JavaScript agree

A pipeline you can't cross-check is a pipeline you can't trust. `container.utils.lodash.groupBy` gives us the same aggregation on the in-memory array — the two views of the data must match.

```ts
const { groupBy } = container.utils.lodash
const jsCounts = groupBy(annotations, 'tag')

for (const row of byTag) {
  const expected = jsCounts[row.tag].length
  if (row.count !== expected) throw new Error(`mismatch for ${row.tag}: sql=${row.count} js=${expected}`)
}

const sqlTotal = byTag.reduce((sum, r) => sum + r.count, 0)
if (sqlTotal !== annotations.length) throw new Error('totals diverged')
console.log(`verified: SQL GROUP BY matches lodash groupBy across ${byTag.length} tags, ${sqlTotal} rows total`)
```

## Clean up

Close the connection and remove the temp database file — a pipeline that leaves artifacts behind isn't finished.

```ts
db.close()
await fs.rm(dbPath)
if (fs.exists(dbPath)) throw new Error('db file should have been removed')
console.log('closed connection and removed', dbPath)
```

## Summary

The pipeline shape is always the same: **extract** with a scanning helper (`grep.search`/`grep.todos`, `fs`), **transform** with plain JavaScript into rows that carry your query dimensions, **load** with `db.transaction()` + a prepared statement, **query** with `db.sql` tagged templates. The heuristic to internalize: as soon as "look at the data" means grouping, counting, or filtering, stop reaching for `Array.prototype` gymnastics or a KV store — load it into `sqlite` and ask in SQL.
