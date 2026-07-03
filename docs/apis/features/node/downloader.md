# Downloader (features.downloader)

> Stability: `stable`

A feature that provides file downloading capabilities from URLs. The Downloader feature allows you to fetch files from remote URLs and save them to the local filesystem. It handles the network request, buffering, and file writing operations automatically. Use it when you need to programmatically pull remote assets — images, documents, data files — into your project. When you call `download()`: (1) the URL is fetched, (2) the response body is buffered fully into memory, (3) the buffer is written to the target path, which is resolved relative to the container's working directory. The resolved absolute path is returned.

## Usage

```ts
container.feature('downloader')
```

## Methods

### download

Downloads a file from a URL and saves it to the specified local path. This method fetches the file from the provided URL, buffers the entire response body in memory, and writes it to the filesystem at the target path. The target path is resolved relative to the container's working directory (`container.paths.resolve(targetPath)`). Note: HTTP error statuses (404, 500, ...) do NOT throw — the response body is written as-is, whatever it contains. Only network-level failures (DNS, refused connection, invalid URL) reject. Check the URL is correct before trusting the downloaded file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | ✓ | The URL to download the file from. Must be a valid HTTP/HTTPS URL. |
| `targetPath` | `string` | ✓ | The local file path where the downloaded file should be saved. |

**Returns:** `Promise<string>`

```ts
// (no-run) fetches from the network
// Download an image file
const imagePath = await downloader.download(
 'https://example.com/photo.jpg',
 'images/downloaded-photo.jpg'
)

// Download a document
const docPath = await downloader.download(
 'https://api.example.com/files/document.pdf',
 'documents/report.pdf'
)
```



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.downloader**

```ts
// (no-run) fetches from the network
const downloader = container.feature('downloader')

// Download a file — target path is resolved relative to container.cwd
const localPath = await downloader.download(
 'https://example.com/image.jpg',
 'downloads/image.jpg'
)
console.log(`File saved to: ${localPath}`) // absolute path to the saved file
```



**download**

```ts
// (no-run) fetches from the network
// Download an image file
const imagePath = await downloader.download(
 'https://example.com/photo.jpg',
 'images/downloaded-photo.jpg'
)

// Download a document
const docPath = await downloader.download(
 'https://api.example.com/files/document.pdf',
 'documents/report.pdf'
)
```

