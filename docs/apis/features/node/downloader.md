# Downloader (features.downloader)

> Stability: `stable`

A feature that provides file downloading capabilities from URLs. The Downloader feature allows you to fetch files from remote URLs and save them to the local filesystem. It handles the network request, buffering, and file writing operations automatically. Use it when you need to programmatically pull remote assets — images, documents, data files — into your project. When you call `download()`: (1) the URL is fetched, (2) the response body is buffered fully into memory, (3) the buffer is written to the target path, which is resolved relative to the container's working directory. The resolved absolute path is returned.

## Usage

```ts
container.feature('downloader')
```

## Methods

### download

Downloads a file from a URL and saves it to the specified local path. This method fetches the file from the provided URL, buffers the entire response body in memory, and writes it to the filesystem at the target path. The target path is resolved relative to the container's working directory (`container.paths.resolve(targetPath)`). NOTE: HTTP error statuses (404, 500, ...) do NOT throw — the response body is written as-is, whatever it contains (a 404 HTML error page gets saved at your target path as if it were the file). Only network-level failures (DNS, refused connection, invalid URL) reject. Unless you specifically want that write-whatever-came-back behavior, use `downloadFile()` (throws on 4xx/5xx and empty bodies) or `downloadJson()` (for JSON API responses, no file written).

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



### downloadJson

Fetches a URL expected to return JSON and returns the parsed value. The safe default for JSON APIs: unlike `download()`, a non-2xx response THROWS — the error message includes the HTTP status and a truncated copy of the response body, so the failure surfaces at the call site instead of as a parse error far from the cause. No file is written.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | ✓ | The URL to fetch. Must be a valid HTTP/HTTPS URL returning JSON. |
| `opts` | `RequestInit` |  | Optional fetch options (headers, method, body, ...) passed straight to `fetch()`. |

**Returns:** `Promise<T>`

```ts
// (no-run) fetches from the network
const downloader = container.feature('downloader')

const release = await downloader.downloadJson<{ tag_name: string }>(
 'https://api.github.com/repos/oven-sh/bun/releases/latest',
 { headers: { 'User-Agent': 'luca' } }
)
console.log(release.tag_name)

// A 404 throws with the status and body in the message:
// Error: downloadJson failed: HTTP 404 for https://... — body: {"message":"Not Found"...
```



### downloadFile

Downloads a file from a URL and saves it to the specified local path, throwing on HTTP errors instead of writing the error page to disk. The safe default for file downloads: like `download()`, but a 4xx/5xx response THROWS with the status code in the message (so a 404 HTML page never gets saved as your file), and an empty response body also throws. The target path is resolved relative to the container's working directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | ✓ | The URL to download the file from. Must be a valid HTTP/HTTPS URL. |
| `targetPath` | `string` | ✓ | The local file path where the downloaded file should be saved, |
| `opts` | `RequestInit` |  | Optional fetch options (headers, method, ...) passed straight to `fetch()`. |

**Returns:** `Promise<string>`

```ts
// (no-run) fetches from the network
const downloader = container.feature('downloader')

const localPath = await downloader.downloadFile(
 'https://example.com/data.json',
 'downloads/data.json'
)
console.log(`File saved to: ${localPath}`)

// A misconfigured URL fails loudly instead of saving an error page:
// Error: downloadFile failed: HTTP 404 for https://... — body: <html>...
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



**downloadJson**

```ts
// (no-run) fetches from the network
const downloader = container.feature('downloader')

const release = await downloader.downloadJson<{ tag_name: string }>(
 'https://api.github.com/repos/oven-sh/bun/releases/latest',
 { headers: { 'User-Agent': 'luca' } }
)
console.log(release.tag_name)

// A 404 throws with the status and body in the message:
// Error: downloadJson failed: HTTP 404 for https://... — body: {"message":"Not Found"...
```



**downloadFile**

```ts
// (no-run) fetches from the network
const downloader = container.feature('downloader')

const localPath = await downloader.downloadFile(
 'https://example.com/data.json',
 'downloads/data.json'
)
console.log(`File saved to: ${localPath}`)

// A misconfigured URL fails loudly instead of saving an error page:
// Error: downloadFile failed: HTTP 404 for https://... — body: <html>...
```

