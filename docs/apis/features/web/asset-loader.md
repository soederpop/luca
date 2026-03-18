# AssetLoader (features.assetLoader)

Injects scripts and stylesheets into the page at runtime. Provides helpers for loading external libraries from unpkg.com, injecting arbitrary script/link tags, and managing load state. Used by other web features (e.g. Esbuild) to pull in dependencies on demand.

## Usage

```ts
container.feature('assetLoader')
```

## Methods

### removeStylesheet

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `href` | `string` | ✓ | Parameter href |

**Returns:** `void`



### loadScript

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | ✓ | Parameter url |

**Returns:** `Promise<void>`



### unpkg

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `packageName` | `string` | ✓ | Parameter packageName |
| `globalName` | `string` | ✓ | Parameter globalName |

**Returns:** `Promise<any>`



## Examples

**features.assetLoader**

```ts
const loader = container.feature('assetLoader')
await loader.loadScript('https://unpkg.com/lodash')
await AssetLoader.loadStylesheet('https://unpkg.com/normalize.css')
```

