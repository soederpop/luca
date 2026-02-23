# features.helpers

The Helpers feature is a unified gateway for discovering and registering project-level helpers from conventional folder locations. It scans known folder names (features/, clients/, servers/, commands/, endpoints/) and handles registration differently based on the helper type: - Class-based (features, clients, servers): Dynamic import, validate subclass, register - Config-based (commands, endpoints): Delegate to existing discovery mechanisms

## Methods

### discover

Discover and register project-level helpers of the given type. For class-based types (features, clients, servers), scans the matching directory for .ts files, dynamically imports each, validates the default export is a subclass of the registry's base class, and registers it. For config-based types (commands, endpoints), delegates to existing discovery mechanisms.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `type` | `RegistryType` | ✓ | Which type of helpers to discover |

| `options` | `{ directory?: string }` |  | Optional overrides |



`{ directory?: string }` properties:

| Property | Type | Description |

|----------|------|-------------|

| `directory` | `any` | Override the directory to scan |

**Returns:** `Promise<string[]>`

```ts
const names = await container.helpers.discover('features')
console.log(names) // ['myCustomFeature']
```



### discoverAll

Discover all helper types from their conventional folder locations.

**Returns:** `Promise<Record<string, string[]>>`

```ts
const results = await container.helpers.discoverAll()
// { features: ['myFeature'], clients: [], servers: [], commands: ['deploy'], endpoints: [] }
```



### lookup

Look up a helper class by type and name.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `type` | `RegistryType` | ✓ | The registry type (features, clients, servers, commands, endpoints) |

| `name` | `string` | ✓ | The helper name within that registry |

**Returns:** `any`

```ts
const FsClass = container.helpers.lookup('features', 'fs')
```



### describe

Get the introspection description for a specific helper.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `type` | `RegistryType` | ✓ | The registry type |

| `name` | `string` | ✓ | The helper name |

**Returns:** `string`



## Getters

| Property | Type | Description |

|----------|------|-------------|

| `rootDir` | `string` | The root directory to scan for helper folders. |

| `available` | `Record<string, string[]>` | Returns a unified view of all available helpers across all registries. Each key is a registry type, each value is the list of helper names in that registry. |

## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `discovered` | `object` | Which registry types have been discovered |

| `registered` | `array` | Names of project-level helpers that were discovered (type.name) |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `rootDir` | `string` | Root directory to scan for helper folders. Defaults to container.cwd |

## Examples

**features.helpers**

```ts
const helpers = container.feature('helpers', { enable: true })

// Discover all helper types
await helpers.discoverAll()

// Discover a specific type
await helpers.discover('features')

// Unified view of all available helpers
console.log(helpers.available)
```



**discover**

```ts
const names = await container.helpers.discover('features')
console.log(names) // ['myCustomFeature']
```



**discoverAll**

```ts
const results = await container.helpers.discoverAll()
// { features: ['myFeature'], clients: [], servers: [], commands: ['deploy'], endpoints: [] }
```



**lookup**

```ts
const FsClass = container.helpers.lookup('features', 'fs')
```



**available**

```ts
container.helpers.available
// { features: ['fs', 'git', ...], clients: ['rest', 'websocket'], ... }
```

