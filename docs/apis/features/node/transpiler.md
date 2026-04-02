# Transpiler (features.transpiler)

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

