# Esbuild (features.esbuild)

Browser-side TypeScript/ESM compilation feature using esbuild-wasm. Loads esbuild's WebAssembly build via the AssetLoader, then provides `compile()` and `transform()` methods that work entirely in the browser. Useful for live playgrounds, in-browser REPLs, and client-side bundling.

## Usage

```ts
container.feature('esbuild')
```

## Methods

### compile

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | Parameter code |
| `options` | `esbuild.TransformOptions` |  | Parameter options |

**Returns:** `void`



### clearCache

**Returns:** `void`



### start

**Returns:** `void`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `assetLoader` | `any` | Returns the assetLoader feature for loading external libraries from unpkg. |

## Examples

**features.esbuild**

```ts
const esbuild = container.feature('esbuild')
await esbuild.start()
const result = await esbuild.compile('const x: number = 1')
console.log(result.code)
```

