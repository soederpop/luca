# features.assistantsManager

No description provided

## Methods

### afterInitialize

**Returns:** `void`



### discover

Scans the assistants folder for subdirectories and probes each for CORE.md, tools.ts, hooks.ts, and docs/. Populates the internal entries map.

**Returns:** `this`



### list

Returns all discovered assistant entries as an array.

**Returns:** `AssistantEntry[]`



### get

Looks up a single assistant entry by name.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `name` | `string` | ✓ | The assistant subdirectory name |

**Returns:** `AssistantEntry | undefined`



### create

Creates and returns a new Assistant feature instance for the given name. The assistant is configured with the discovered folder path. Any additional options are merged in.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `name` | `string` | ✓ | The assistant name (must match a discovered entry) |

| `options` | `Record<string, any>` |  | Additional options to pass to the Assistant constructor |

**Returns:** `Assistant`

```ts
const assistant = manager.create('my-helper', { model: 'gpt-4.1' })
```



### getInstance

Returns a previously created assistant instance by name.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `name` | `string` | ✓ | The assistant name |

**Returns:** `Assistant | undefined`



### toSummary

Generates a markdown summary of all discovered assistants, listing their names and which definition files are present.

**Returns:** `string`



## Getters

| Property | Type | Description |

|----------|------|-------------|

| `assistantsFolder` | `string` | The absolute path to the assistants folder. |

## Events

### discovered

Emitted when assistant discovery scan completes



### assistantCreated

Emitted when a new assistant instance is created

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `string` | The assistant name |

| `arg1` | `any` | The assistant instance |



### stateChange

Event: stateChange

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `any` | The current state object |



### enabled

Emitted when the feature is enabled



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `discovered` | `boolean` | Whether discovery has been run |

| `assistantCount` | `number` | Number of discovered assistant definitions |

| `activeCount` | `number` | Number of currently instantiated assistants |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

| `folder` | `string` | Folder to scan for assistant subdirectories |

| `autoDiscover` | `boolean` | Automatically discover assistants on init |

## Examples

**features.assistantsManager**

```ts
const manager = container.feature('assistantsManager', { folder: 'assistants' })
await manager.discover()
console.log(manager.list()) // [{ name: 'my-helper', folder: '...', ... }]
const assistant = manager.create('my-helper')
const answer = await assistant.ask('Hello!')
```



**create**

```ts
const assistant = manager.create('my-helper', { model: 'gpt-4.1' })
```

