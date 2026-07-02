# Transpiler (features.transpiler)

> Stability: `core`

Transpile TypeScript, TSX, and JSX to JavaScript at runtime using Bun's built-in transpiler. Compile code strings on the fly without touching the filesystem or spawning external processes.

## Usage

```ts
container.feature('transpiler')
```

## Methods

### transformSync

Transform code synchronously

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | The code to transform |
| `options` | `TransformOptions` |  | Transform options (loader, format, minify) |

`TransformOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `loader` | `'ts' | 'tsx' | 'jsx' | 'js'` |  |
| `format` | `'esm' | 'cjs'` |  |
| `minify` | `boolean` |  |

**Returns:** `TransformResult`



### transform

Transform code asynchronously

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | The code to transform |
| `options` | `TransformOptions` |  | Transform options (loader, format, minify) |

`TransformOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `loader` | `'ts' | 'tsx' | 'jsx' | 'js'` |  |
| `format` | `'esm' | 'cjs'` |  |
| `minify` | `boolean` |  |

**Returns:** `Promise<TransformResult>`



### bundle

Bundle a file using Bun.build, inlining all imports except those marked external. Returns CJS code ready for VM execution.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | ✓ | Absolute path to the entrypoint file |
| `external` | `string[]` |  | Module IDs to leave as require() calls (e.g. virtual modules) |

**Returns:** `Promise<string>`



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.transpiler**

```ts
const transpiler = container.feature('transpiler')
const result = transpiler.transformSync('const x: number = 1')
console.log(result.code) // 'const x = 1;\n'
```

