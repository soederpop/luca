---
name: querying-contentbase
description: >
  How to write correct filters for the queryDocuments tool (and the contentbase
  query DSL behind it). Covers the where/sort JSON syntax, every supported
  operator, and the gotchas that make queries silently return []. Use this skill
  whenever you call queryDocuments, need to filter documents by status, tags,
  project, cost, or date, or a query returned an empty result you didn't expect.
user-invocable: false
metadata:
  author: soederpop
  version: "1.0.0"
---

# Querying Contentbase with queryDocuments

`queryDocuments` filters the docs/ collection by model and metadata. It is the right tool when you know *what fields* you are filtering on. For natural-language questions use `semanticSearch`; for raw text patterns use `searchContent`.

## Tool arguments

```json
{
  "model": "Idea",
  "where": "{\"meta.status\": \"exploring\"}",
  "sort": "{\"createdAt\": \"desc\"}",
  "limit": 10,
  "offset": 0,
  "select": ["id", "title", "meta.status"]
}
```

- `model` — exact model name (e.g. `Post`, `Project`, `Task`, `Report`). Get names from `getCollectionOverview`. Unknown names return an error listing valid ones.
- `where` — **a JSON string, not an object.** Pass `"{\"meta.status\": \"approved\"}"`, not a nested object. Dot notation reaches into frontmatter (`meta.status`) and top-level fields (`id`, `title`, `createdAt`).
- `sort` — also a JSON string: `"{\"createdAt\": \"desc\"}"`. Directions are `"asc"` / `"desc"`.
- `select` — array of field paths to keep in the output. Always use it; it cuts noise dramatically.
- `limit` / `offset` — plain numbers for pagination.

## The where syntax

Three value shapes, all inside the JSON string:

1. **Literal → equals.** `{"meta.status": "approved"}` matches documents whose status is exactly `approved`.
2. **Array → "is one of".** `{"meta.status": ["approved", "exploring"]}` is an implicit `$in`.
3. **Operator object.** `{"meta.costUsd": {"$gt": 1}}` applies an operator. Two operators in one object AND together: `{"meta.costUsd": {"$gte": 1, "$lt": 5}}`.

Multiple keys in one where AND together. **There is no `$or`, `$and`, or `$not`.** For OR across different fields, run two queries.

### Operators

| Operator | Meaning | Example value |
|---|---|---|
| `$eq` / `$neq` | equals / not equals | `{"$neq": "completed"}` |
| `$in` / `$notIn` | scalar field is (not) in the list; array field (does not) overlap the list | `{"$in": ["approved", "building"]}` |
| `$gt` `$gte` `$lt` `$lte` | comparison (numbers, ISO date strings) | `{"$gt": 1.5}` |
| `$contains` | string contains substring; array field contains the value | `{"$contains": "voice"}` |
| `$startsWith` / `$endsWith` | string prefix / suffix | `{"$startsWith": "projects/"}` |
| `$regex` | pattern match (max 200 chars) | `{"$regex": "voice|audio"}` |
| `$exists` | field is present (`true`) or absent (`false`) | `{"$exists": true}` |

An unknown operator (e.g. `$ne`, `$size`) throws an error, it does not return `[]`.

## Verified examples

Ideas that are exploring or approved:

```json
{ "model": "Idea",
  "where": "{\"meta.status\": {\"$in\": [\"exploring\", \"approved\"]}}",
  "select": ["id", "title", "meta.status"] }
```

Plans for specific projects (project is a scalar string on Plan, so `$in` works):

```json
{ "model": "Plan",
  "where": "{\"meta.project\": {\"$in\": [\"channel-routing-rollout\", \"status-center\"]}}",
  "select": ["id", "meta.status"] }
```

Plans that cost more than $1:

```json
{ "model": "Plan",
  "where": "{\"meta.costUsd\": {\"$gt\": 1}}",
  "sort": "{\"meta.costUsd\": \"desc\"}",
  "select": ["id", "meta.costUsd"] }
```

Newest ideas first (note: `createdAt` is top-level, not `meta.createdAt`):

```json
{ "model": "Idea",
  "sort": "{\"createdAt\": \"desc\"}",
  "limit": 5,
  "select": ["id", "title", "createdAt"] }
```

Documents created since a date (ISO strings compare correctly with `$gt`):

```json
{ "model": "Idea",
  "where": "{\"createdAt\": {\"$gt\": \"2026-08-01\"}}",
  "select": ["id", "createdAt"] }
```

Everything under one project folder, via the path id:

```json
{ "model": "Plan",
  "where": "{\"id\": {\"$startsWith\": \"projects/prompt-eval-modes\"}}",
  "select": ["id"] }
```

Ideas tagged `bug` (array field, `$contains` checks membership):

```json
{ "model": "Idea",
  "where": "{\"meta.tags\": {\"$contains\": \"bug\"}}",
  "select": ["id", "meta.tags"] }
```

Ideas tagged with any of several tags (array field, `$in` checks overlap):

```json
{ "model": "Idea",
  "where": "{\"meta.tags\": {\"$in\": [\"bug\", \"desktop-app\"]}}",
  "select": ["id", "meta.tags"] }
```

## Gotchas that cause silent `[]`

1. **On array-valued fields (`meta.tags`, `meta.needs`, `meta.skills`), use `$contains` for one value or `$in` for "any of these".** A bare literal (`{"meta.tags": "bug"}`) is an exact-equality check against the whole array and matches only `["bug"]`.
2. **`where` and `sort` must be JSON *strings*.** Passing a raw object may work in some runtimes but the contract is a string — always `JSON.stringify` the filter.
3. **`createdAt` / `updatedAt` are top-level**, not under `meta`. Sorting on `meta.createdAt` silently sorts nothing.
4. **Field paths and values are case-sensitive and exact.** `meta.Status` or a status value that isn't in the model's enum matches nothing. When unsure, run the query with no `where` and `select: ["id", "meta.<field>"]` to see the real values first.
5. **No `$or`.** Split into multiple queries and merge.
6. **Zero matches is a valid answer, not an error.** If you expected matches, drop the `where`, look at the actual field values, then re-add conditions one at a time.

## Result shape

Each result is `{ id, title, meta, createdAt, updatedAt, size }` — frontmatter under `meta`, no body content. To read a matching document's body, follow up with `readDocument` using the returned `id`.

## Same syntax elsewhere

The `where` object shape (literal / array / operator object) is the contentbase query DSL (`parseWhereClause` in the contentbase repo). It is identical in the REST API (`POST /api/query`) and the MCP `query` tool. The TypeScript builder equivalents are `q.where(path, value)`, `q.where(path, "gt", value)`, `q.whereIn(path, list)`.
