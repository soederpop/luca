# Opener (features.opener)

> Stability: `stable`

The Opener feature opens files, URLs, desktop applications, and code editors. HTTP/HTTPS URLs are opened in Google Chrome. Desktop apps can be launched by name. VS Code and Cursor can be opened to a specific path. All other paths are opened with the platform's default handler (e.g. Preview for images, Finder for folders). Under the hood it delegates to platform-appropriate commands (`open` on macOS, `start` on Windows, `xdg-open` / direct binary invocation on Linux). Every method triggers a side effect on the host — launching an application or browser — so treat all of these as no-run in automated/headless contexts.

## Usage

```ts
container.feature('opener')
```

## Methods

### open

Opens a path or URL with the appropriate application. HTTP and HTTPS URLs are opened in Google Chrome (on Linux it tries `google-chrome`, then `chromium`, then falls back to `xdg-open`). Everything else is opened with the system default handler (`open` on macOS, `start` on Windows, `xdg-open` on Linux).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `target` | `string` | ✓ | A URL or file path to open |

**Returns:** `Promise<void>`

```ts
// (no-run) opens applications on the host
await opener.open('https://github.com/soederpop/luca') // opens in Chrome
await opener.open('/Users/jon/screenshots/diagram.png') // default handler (Preview on macOS)
```



### app

Opens a desktop application by name. On macOS, uses `open -a` to launch the app — the application name should match what appears in `/Applications`. On Windows, uses `start`. On Linux, attempts to run the lowercase app name as a command.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The application name (e.g. "Slack", "Finder", "Safari") |

**Returns:** `Promise<void>`

```ts
// (no-run) opens applications on the host
await opener.app('Slack')
await opener.app('Finder')
```



### code

Opens VS Code at the specified path. Uses the `code` CLI command if it is found in PATH. Falls back to `open -a "Visual Studio Code"` on macOS; on other platforms a missing CLI throws with install instructions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` |  | The file or folder path to open |

**Returns:** `Promise<void>`

```ts
// (no-run) opens applications on the host
await opener.code('/Users/jon/projects/my-app')
```



### cursor

Opens Cursor at the specified path. Uses the `cursor` CLI command if it is found in PATH. Falls back to `open -a "Cursor"` on macOS; on other platforms a missing CLI throws with install instructions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` |  | The file or folder path to open |

**Returns:** `Promise<void>`

```ts
// (no-run) opens applications on the host
await opener.cursor('/Users/jon/projects/my-app/src/index.ts')
```



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.opener**

```ts
// (no-run) opens applications on the host
const opener = container.feature('opener')

// Open a URL in Chrome (the default browser for HTTP/HTTPS targets)
await opener.open('https://github.com/soederpop/luca')

// Open a file with the system default handler (e.g. Preview for a .png on macOS)
await opener.open('/Users/jon/screenshots/diagram.png')

// Launch a desktop application by name
await opener.app('Slack')

// Open VS Code at a project path
await opener.code('/Users/jon/projects/my-app')

// Open Cursor at a specific file
await opener.cursor('/Users/jon/projects/my-app/src/index.ts')
```



**open**

```ts
// (no-run) opens applications on the host
await opener.open('https://github.com/soederpop/luca') // opens in Chrome
await opener.open('/Users/jon/screenshots/diagram.png') // default handler (Preview on macOS)
```



**app**

```ts
// (no-run) opens applications on the host
await opener.app('Slack')
await opener.app('Finder')
```



**code**

```ts
// (no-run) opens applications on the host
await opener.code('/Users/jon/projects/my-app')
```



**cursor**

```ts
// (no-run) opens applications on the host
await opener.cursor('/Users/jon/projects/my-app/src/index.ts')
```

