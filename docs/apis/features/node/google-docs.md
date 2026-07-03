# GoogleDocs (features.googleDocs)

> Stability: `stable`

Google Docs feature for reading documents and converting them to Markdown. Depends on googleAuth for authentication (requires Google OAuth2 credentials or a service account with Docs access, e.g. the `documents.readonly` scope) and uses googleDrive for listing and searching docs (which needs Drive access too). The standout capability is Markdown conversion: the converter handles headings (H1-H6), bold/italic/strikethrough, links, code spans (Courier/monospace fonts), ordered and unordered lists with nesting, tables (pipe format), images, and section breaks. Also supports plain text extraction and raw Docs API structure. The document ID is in the doc URL: `https://docs.google.com/document/d/{DOCUMENT_ID}/edit`

## Usage

```ts
container.feature('googleDocs', {
  // An authorized instance of the googleAuth feature
  auth,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `auth` | `any` | An authorized instance of the googleAuth feature |

## Methods

### getDocument

Get the raw document structure from the Docs API. Use this when you need the full Docs API structure for custom processing.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `documentId` | `string` | ✓ | The Google Docs document ID |

**Returns:** `Promise<docs_v1.Schema$Document>`

```ts
// (no-run) requires Google OAuth credentials
const docs = container.feature('googleDocs')
const rawDoc = await docs.getDocument('1abc_document_id')
console.log(rawDoc.title)
console.log(rawDoc.body?.content?.length)  // structural elements
console.log(rawDoc.inlineObjects)          // embedded images
```



### getAsMarkdown

Read a Google Doc and convert it to Markdown. Handles headings, bold/italic/strikethrough, links, code fonts, ordered/unordered lists with nesting, tables, images, and section breaks. This is the primary method for extracting document content.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `documentId` | `string` | ✓ | The Google Docs document ID |

**Returns:** `Promise<string>`

```ts
// (no-run) requires Google OAuth credentials
const docs = container.feature('googleDocs')
const markdown = await docs.getAsMarkdown('1abc_document_id')
console.log(markdown)
```



### getAsText

Read a Google Doc as plain text (strips all formatting). Use this when you only need the words without any Markdown syntax.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `documentId` | `string` | ✓ | The Google Docs document ID |

**Returns:** `Promise<string>`

```ts
// (no-run) requires Google OAuth credentials
const docs = container.feature('googleDocs')
const text = await docs.getAsText('1abc_document_id')
console.log('Plain text length:', text.length)
```



### saveAsMarkdown

Download a Google Doc as Markdown and save to a local file in one step.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `documentId` | `string` | ✓ | The Google Docs document ID |
| `localPath` | `string` | ✓ | Local file path (resolved relative to container cwd) |

**Returns:** `Promise<string>`

```ts
// (no-run) requires Google OAuth credentials
const docs = container.feature('googleDocs')
const path = await docs.saveAsMarkdown('1abc_document_id', './output/doc.md')
console.log('Saved to:', path)  // absolute path
```



### listDocs

List Google Docs in Drive (filters by the Docs MIME type, excludes trashed files). Passing a query filters by document name.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` |  | Optional name filter (matches "name contains" in Drive) |
| `options` | `{ pageSize?: number; pageToken?: string }` |  | Pagination options |

**Returns:** `Promise<DriveFile[]>`

```ts
// (no-run) requires Google OAuth credentials
const docs = container.feature('googleDocs')
const allDocs = await docs.listDocs()
console.log(`Found ${allDocs.length} Google Docs`)

// Filter by name
const reports = await docs.listDocs('report')
```



### searchDocs

Search for Google Docs by name or content (full-text search via Drive, filtered to the Google Docs MIME type).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `term` | `string` | ✓ | Search term |

**Returns:** `Promise<DriveFile[]>`

```ts
// (no-run) requires Google OAuth credentials
const docs = container.feature('googleDocs')
const results = await docs.searchDocs('quarterly earnings')
results.forEach(d => console.log(d.name, d.id))
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `auth` | `GoogleAuth` | Access the google-auth feature lazily. |
| `drive` | `GoogleDrive` | Access the google-drive feature lazily. |

## Events (Zod v4 schema)

### documentFetched

A document was fetched

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Document ID |
| `arg1` | `string` | Title |



### error

Docs API error occurred

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `lastDocId` | `string` | Last document ID accessed |
| `lastDocTitle` | `string` | Title of the last document accessed |
| `lastError` | `string` | Last Docs API error message |

## Examples

**features.googleDocs**

```ts
// (no-run) requires Google OAuth credentials
// Authenticate once via googleAuth (cached tokens restore automatically)
const auth = container.feature('googleAuth', {
 scopes: [
   'https://www.googleapis.com/auth/documents.readonly',
   'https://www.googleapis.com/auth/drive.readonly',
 ],
})
if (!(await auth.tryRestoreTokens())) await auth.authorize()

const docs = container.feature('googleDocs')

// Convert a doc to clean Markdown
const markdown = await docs.getAsMarkdown('1abc_document_id')

// Find docs by name or content (via Drive)
const results = await docs.searchDocs('meeting notes')
results.forEach(d => console.log(d.name, d.id))
```



**getDocument**

```ts
// (no-run) requires Google OAuth credentials
const docs = container.feature('googleDocs')
const rawDoc = await docs.getDocument('1abc_document_id')
console.log(rawDoc.title)
console.log(rawDoc.body?.content?.length)  // structural elements
console.log(rawDoc.inlineObjects)          // embedded images
```



**getAsMarkdown**

```ts
// (no-run) requires Google OAuth credentials
const docs = container.feature('googleDocs')
const markdown = await docs.getAsMarkdown('1abc_document_id')
console.log(markdown)
```



**getAsText**

```ts
// (no-run) requires Google OAuth credentials
const docs = container.feature('googleDocs')
const text = await docs.getAsText('1abc_document_id')
console.log('Plain text length:', text.length)
```



**saveAsMarkdown**

```ts
// (no-run) requires Google OAuth credentials
const docs = container.feature('googleDocs')
const path = await docs.saveAsMarkdown('1abc_document_id', './output/doc.md')
console.log('Saved to:', path)  // absolute path
```



**listDocs**

```ts
// (no-run) requires Google OAuth credentials
const docs = container.feature('googleDocs')
const allDocs = await docs.listDocs()
console.log(`Found ${allDocs.length} Google Docs`)

// Filter by name
const reports = await docs.listDocs('report')
```



**searchDocs**

```ts
// (no-run) requires Google OAuth credentials
const docs = container.feature('googleDocs')
const results = await docs.searchDocs('quarterly earnings')
results.forEach(d => console.log(d.name, d.id))
```

