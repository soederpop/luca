# features.vm

The VM features providers a virtual machine for executing JavaScript code in a sandboxed environment. The Vm feature automatically injects the container.context object into the global scope, so these things can be referenced in the code and the code can use anything provided by the container.

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



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

| `context` | `any` | Default context object to inject into the VM execution environment |

## Examples

**features.vm**

```ts
const vm = container.feature('vm')

// Execute simple code
const result = vm.run('1 + 2 + 3')
console.log(result) // 6

// Execute code with custom context
const result2 = vm.run('greeting + " " + name', { 
 greeting: 'Hello', 
 name: 'World' 
})
console.log(result2) // 'Hello World'
```

