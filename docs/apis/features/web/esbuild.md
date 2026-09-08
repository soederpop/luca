# Esbuild (features.esbuild)

> Stability: `stable`

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
| `options` | `EsbuildTransformOptions` |  | Parameter options |

`EsbuildTransformOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `loader` | `EsbuildLoader` | Which syntax to parse the input as. Defaults to `'ts'`. |
| `sourcefile` | `string` | Name reported in error messages and source maps. |
| `banner` | `string` |  |
| `footer` | `string` |  |
| `tsconfigRaw` | `string | {
    compilerOptions?: {
      alwaysStrict?: boolean
      importsNotUsedAsValues?: 'remove' | 'preserve' | 'error'
      jsx?: 'react' | 'react-jsx' | 'react-jsxdev' | 'preserve'
      jsxFactory?: string
      jsxFragmentFactory?: string
      jsxImportSource?: string
      preserveValueImports?: boolean
      target?: string
      useDefineForClassFields?: boolean
    }
  }` |  |
| `sourcemap` | `boolean | 'linked' | 'inline' | 'external' | 'both'` |  |
| `sourceRoot` | `string` |  |
| `sourcesContent` | `boolean` |  |
| `legalComments` | `'none' | 'inline' | 'eof' | 'linked' | 'external'` |  |
| `format` | `EsbuildFormat` |  |
| `globalName` | `string` |  |
| `target` | `string | string[]` | Language level to downlevel to, e.g. `'es2015'`. |
| `supported` | `Record<string, boolean>` |  |
| `platform` | `EsbuildPlatform` |  |
| `minify` | `boolean` |  |
| `minifyWhitespace` | `boolean` |  |
| `minifyIdentifiers` | `boolean` |  |
| `minifySyntax` | `boolean` |  |
| `mangleProps` | `RegExp` |  |
| `reserveProps` | `RegExp` |  |
| `mangleQuoted` | `boolean` |  |
| `mangleCache` | `Record<string, string | false>` |  |
| `drop` | `EsbuildDrop[]` |  |
| `charset` | `EsbuildCharset` |  |
| `treeShaking` | `boolean` |  |
| `ignoreAnnotations` | `boolean` |  |
| `jsx` | `'transform' | 'preserve' | 'automatic'` |  |
| `jsxFactory` | `string` |  |
| `jsxFragment` | `string` |  |
| `jsxImportSource` | `string` |  |
| `jsxDev` | `boolean` |  |
| `jsxSideEffects` | `boolean` |  |
| `define` | `{ [key: string]: string }` |  |
| `pure` | `string[]` |  |
| `keepNames` | `boolean` |  |
| `color` | `boolean` |  |
| `logLevel` | `EsbuildLogLevel` |  |
| `logLimit` | `number` |  |
| `logOverride` | `Record<string, EsbuildLogLevel>` |  |

**Returns:** `Promise<EsbuildTransformResult>`



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

