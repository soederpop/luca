# GoogleDrive (features.googleDrive)

> Stability: `stable`

Google Drive feature for listing, searching, browsing, and downloading files. Depends on the googleAuth feature for authentication (requires Google OAuth2 credentials or a service account with Drive access, e.g. the `drive.readonly` scope). Creates a Drive v3 API client lazily and passes the auth client from googleAuth — authenticate once via googleAuth and this feature picks it up. Use `download()`/`downloadTo()` for binary files and `exportFile()` to convert Google Workspace documents (Docs, Sheets, Slides) to formats like PDF, CSV, or plain text. Listing defaults: 100 results per page, ordered by modifiedTime desc.

## Usage

```ts
container.feature('googleDrive', {
  // An authorized instance of the googleAuth feature
  auth,
  // Default corpus for file queries (default: user)
  defaultCorpora,
  // Default number of results per page (default: 100)
  pageSize,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `auth` | `any` | An authorized instance of the googleAuth feature |
| `defaultCorpora` | `string` | Default corpus for file queries (default: user) |
| `pageSize` | `number` | Default number of results per page (default: 100) |

## Methods

### listFiles

List files in the user's Drive with an optional query filter. Defaults to 100 results ordered by modifiedTime desc. Paginate via the returned nextPageToken. Pass `corpora: 'allDrives'` to include shared drives.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` |  | Drive search query (e.g. "name contains 'report'", "mimeType='application/pdf'") |
| `options` | `ListFilesOptions` |  | Pagination and filtering options |

`ListFilesOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `pageSize` | `number` |  |
| `pageToken` | `string` |  |
| `orderBy` | `string` |  |
| `fields` | `string` |  |
| `corpora` | `'user' | 'drive' | 'allDrives'` |  |

**Returns:** `Promise<DriveFileList>`

```ts
// (no-run) requires Google OAuth credentials
const drive = container.feature('googleDrive')

// Recent files
const { files } = await drive.listFiles()

// With a Drive query filter
const { files: pdfs } = await drive.listFiles("mimeType = 'application/pdf'")

// Paginate
const page1 = await drive.listFiles(undefined, { pageSize: 10 })
const page2 = await drive.listFiles(undefined, { pageSize: 10, pageToken: page1.nextPageToken })
```



### listFolder

List files within a specific folder.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `folderId` | `string` | ✓ | The Drive folder ID |
| `options` | `ListFilesOptions` |  | Pagination and filtering options |

`ListFilesOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `pageSize` | `number` |  |
| `pageToken` | `string` |  |
| `orderBy` | `string` |  |
| `fields` | `string` |  |
| `corpora` | `'user' | 'drive' | 'allDrives'` |  |

**Returns:** `Promise<DriveFileList>`



### browse

Browse a folder's contents, separating files from subfolders for easy navigation.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `folderId` | `string` |  | Folder ID to browse (defaults to 'root') |

**Returns:** `Promise<DriveBrowseResult>`

```ts
// (no-run) requires Google OAuth credentials
const drive = container.feature('googleDrive')
const root = await drive.browse()  // defaults to the root folder
root.folders.forEach(f => console.log(`[dir]  ${f.name}`))
root.files.forEach(f => console.log(`[file] ${f.name}`))

const sub = await drive.browse('folder-id-here')
```



### search

Search files by name, content, or MIME type (full-text search, trashed files excluded). A simpler interface than raw Drive query strings on `listFiles()`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `term` | `string` | ✓ | Search term to look for in file names and content |
| `options` | `DriveSearchOptions` |  | Additional search options like mimeType filter or folder restriction |

**Returns:** `Promise<DriveFileList>`

```ts
// (no-run) requires Google OAuth credentials
const drive = container.feature('googleDrive')

// Search by name and content
const { files } = await drive.search('quarterly report')

// Filter by MIME type, or restrict to a folder
const { files: pdfs } = await drive.search('report', { mimeType: 'application/pdf' })
const { files: notes } = await drive.search('notes', { inFolder: 'folder-id-here' })
```



### getFile

Get file metadata by file ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileId` | `string` | ✓ | The Drive file ID |
| `fields` | `string` |  | Specific fields to request (defaults to common fields) |

**Returns:** `Promise<DriveFile>`



### download

Download a file's content as a Buffer. Uses alt=media for binary download of non-Google files.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileId` | `string` | ✓ | The Drive file ID |

**Returns:** `Promise<Buffer>`



### downloadTo

Download a file and save it to a local path.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileId` | `string` | ✓ | The Drive file ID |
| `localPath` | `string` | ✓ | Local file path (resolved relative to container cwd) |

**Returns:** `Promise<string>`



### exportFile

Export a Google Workspace file (Docs, Sheets, Slides) to a given MIME type. Uses the Files.export endpoint.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileId` | `string` | ✓ | The Drive file ID of a Google Workspace document |
| `mimeType` | `string` | ✓ | Target MIME type (e.g. 'text/plain', 'application/pdf', 'text/csv') |

**Returns:** `Promise<Buffer>`



### listDrives

List all shared drives the user has access to.

**Returns:** `Promise<SharedDrive[]>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `auth` | `GoogleAuth` | Access the google-auth feature lazily. |

## Events (Zod v4 schema)

### filesFetched

Files were fetched from Drive

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `number` | Number of files returned |



### error

Drive API error occurred

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error |



### fileDownloaded

A file was downloaded

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | File ID |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `lastQuery` | `string` | Last search query or folder ID browsed |
| `lastResultCount` | `number` | Number of results from last list/search operation |
| `lastError` | `string` | Last Drive API error message |

## Examples

**features.googleDrive**

```ts
// (no-run) requires Google OAuth credentials
// Authenticate once via googleAuth (cached tokens restore automatically)
const auth = container.feature('googleAuth', {
 scopes: ['https://www.googleapis.com/auth/drive.readonly'],
})
if (!(await auth.tryRestoreTokens())) await auth.authorize()

const drive = container.feature('googleDrive')

// List recent files
const { files } = await drive.listFiles()
files.forEach(f => console.log(f.name, f.mimeType))

// Search, then download a match to disk
const { files: pdfs } = await drive.search('quarterly report', {
 mimeType: 'application/pdf',
})
await drive.downloadTo(pdfs[0].id, './downloads/report.pdf')
```



**listFiles**

```ts
// (no-run) requires Google OAuth credentials
const drive = container.feature('googleDrive')

// Recent files
const { files } = await drive.listFiles()

// With a Drive query filter
const { files: pdfs } = await drive.listFiles("mimeType = 'application/pdf'")

// Paginate
const page1 = await drive.listFiles(undefined, { pageSize: 10 })
const page2 = await drive.listFiles(undefined, { pageSize: 10, pageToken: page1.nextPageToken })
```



**browse**

```ts
// (no-run) requires Google OAuth credentials
const drive = container.feature('googleDrive')
const root = await drive.browse()  // defaults to the root folder
root.folders.forEach(f => console.log(`[dir]  ${f.name}`))
root.files.forEach(f => console.log(`[file] ${f.name}`))

const sub = await drive.browse('folder-id-here')
```



**search**

```ts
// (no-run) requires Google OAuth credentials
const drive = container.feature('googleDrive')

// Search by name and content
const { files } = await drive.search('quarterly report')

// Filter by MIME type, or restrict to a folder
const { files: pdfs } = await drive.search('report', { mimeType: 'application/pdf' })
const { files: notes } = await drive.search('notes', { inFolder: 'folder-id-here' })
```

