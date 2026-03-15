# Docs

This folder contains structured content documents managed by the [contentbase](https://github.com/soederpop/contentbase) system.

## How it works

Documents are markdown files with YAML frontmatter. Each document belongs to a **model** defined in `docs/models.ts`. Models specify:
- A **prefix** (subfolder name, e.g. `notes/`)
- A **metadata schema** (validated frontmatter fields)

## Accessing documents at runtime

The `contentDb` feature (aliased to `container.docs`) loads and queries documents:

```typescript
const docs = container.docs
if (!docs.isLoaded) await docs.load()

// Query all notes
const notes = await docs.query(docs.models.Note).fetchAll()

// Get a specific document
const doc = docs.collection('notes').document('my-note')
```

## Creating a new document

Add a markdown file in the appropriate subfolder:

```markdown
---
title: My First Note
tags: [example]
status: draft
---

Content goes here.
```

## Learn more

- [Contentbase GitHub](https://github.com/soederpop/contentbase) — full documentation and API reference
- `luca describe contentDb` — runtime docs for the contentDb feature
