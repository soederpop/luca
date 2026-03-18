# VM (features.vm)

Sandboxed JavaScript execution environment for the browser. Automatically injects the container's context object into the global scope, so evaluated code can use anything provided by the container. Useful for live code playgrounds, plugin systems, and dynamic script evaluation.

## Usage

```ts
container.feature('vm', {
  // Default context object to inject into the VM execution environment
  context,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `context` | `any` | Default context object to inject into the VM execution environment |

## Methods

### createScript

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | Parameter code |

**Returns:** `void`



### createContext

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ctx` | `any` |  | Parameter ctx |

**Returns:** `void`



### run

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | Parameter code |
| `ctx` | `any` |  | Parameter ctx |
| `options` | `any` |  | Parameter options |

**Returns:** `void`



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.vm**

```ts
const vm = container.feature('vm')
const result = vm.run('1 + 2 + 3') // 6
const greeting = vm.run('container.uuid') // accesses container globals
```

