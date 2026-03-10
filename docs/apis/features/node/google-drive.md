# GoogleDrive (features.googleDrive)

Google Drive feature for listing, searching, browsing, and downloading files. Depends on the googleAuth feature for authentication. Creates a Drive v3 API client lazily and passes the auth client from googleAuth.

## Usage

```ts
container.feature('googleDrive')
```

## Methods

### listFiles

List files in the user's Drive with an optional query filter.

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

Browse a folder's contents, separating files from subfolders.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `folderId` | `string` |  | Folder ID to browse (defaults to 'root') |

**Returns:** `Promise<DriveBrowseResult>`



### search

Search files by name, content, or MIME type.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `term` | `string` | ✓ | Search term to look for in file names and content |
| `options` | `SearchOptions` |  | Additional search options like mimeType filter or folder restriction |

**Returns:** `Promise<DriveFileList>`



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

Event emitted by GoogleDrive



### error

Event emitted by GoogleDrive



### fileDownloaded

Event emitted by GoogleDrive



## Examples

**features.googleDrive**

```ts
const drive = container.feature('googleDrive')

// List recent files
const { files } = await drive.listFiles()

// Search for documents
const { files: docs } = await drive.search('quarterly report', { mimeType: 'application/pdf' })

// Browse a folder
const contents = await drive.browse('folder-id-here')

// Download a file to disk
await drive.downloadTo('file-id', './downloads/report.pdf')
```

