# Models

Models define the structure of markdown documents in this collection. Each document is a markdown file with YAML frontmatter (metadata attributes) and a heading-based structure (sections). Models specify the expected frontmatter fields via a schema, named sections that map to `##` headings in the document body, relationships to other models, and computed properties derived at query time.

## Examples

**Prefix:** `examples`

### Attributes

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| tags | string[] | optional | `[]` | Arbitrary tags for categorizing the example |

### Example

```markdown
---
tags: []
---
# Example Title
```

---

## Ideas

**Prefix:** `ideas`

### Attributes

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| goal | string | optional | — | Slug of the goal this idea is aligned to |
| tags | string[] | optional | `[]` | Arbitrary tags for categorizing the idea |
| status | enum(`spark`, `exploring`, `parked`, `promoted`) | optional | `"spark"` | spark is a new raw idea, exploring means actively thinking about it, parked means on hold, promoted means it became a plan |

### Example

```markdown
---
tags: []
status: spark
---
# Idea Title
```

---

## Reports

**Prefix:** `reports`

### Attributes

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| tags | string[] | optional | `[]` | Arbitrary tags for categorizing the report |

### Example

```markdown
---
tags: []
---
# Report Title
```

---

## Tutorials

**Prefix:** `tutorials`

### Attributes

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| tags | string[] | optional | `[]` | Arbitrary tags for categorizing the tutorial |

### Example

```markdown
---
tags: []
---
# Tutorial Title
```
