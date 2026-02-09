# The Archivist

A content pipeline that treats a directory of markdown files as a structured, queryable, watchable database — with AI-powered categorization and an encrypted vault for sensitive drafts.

## The Demo

Point the Archivist at a directory of markdown files (blog posts, docs, changelogs, meeting notes). It:

1. Loads them into ContentDb with defined models (each model expects certain frontmatter and heading structure)
2. Watches the directory for new/changed files via FileManager
3. When a new file appears, AI reads it and auto-categorizes it (which model? what tags? what frontmatter is missing?)
4. Sensitive drafts get encrypted and stored in the Vault
5. Everything is queryable: "show me all blog posts tagged with 'release'" or "what docs are missing a summary?"
6. Changes are tracked in git with meaningful commit messages

## What It Demonstrates

- ContentDb as a "markdown ORM" — structured data from flat files
- FileManager as a reactive trigger for content pipelines
- The Vault for encryption of sensitive content at rest
- How Luca can power content management without a database server
- AI as a librarian, not an author

## Features Used

- `ContentDb` — model definitions, querying, collection management
- `FileManager` — file watching, scanning, pattern matching
- `Conversation` — AI categorization and metadata extraction
- `Vault` — encrypting/decrypting sensitive drafts
- `YAML` / `YamlTree` — frontmatter parsing and manipulation
- `DiskCache` — caching parsed content and AI classifications
- `Git` — tracking content changes with auto-generated commit messages
- `UI` — pretty table views of content inventory, status indicators

## Key Moments

- Dropping a new markdown file into the folder and watching it auto-classify
- Querying "all posts missing a publish date" and getting instant results
- Encrypting a draft and later decrypting it with the vault
- The content inventory table rendering in the terminal with colored status
