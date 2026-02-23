# clients.graph

No description provided

## Events

### stateChange

Event: stateChange

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `any` | The current state object |



### failure

Emitted when a request fails

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `any` | The error object |



### graphqlError

Emitted when GraphQL-level errors are present in the response

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `array` | Array of GraphQL errors |



## State

| Property | Type | Description |

|----------|------|-------------|

| `connected` | `boolean` | Whether the client is currently connected |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `baseURL` | `string` | Base URL for the client connection |

| `json` | `boolean` | Whether to automatically parse responses as JSON |

| `endpoint` | `string` | The GraphQL endpoint path, defaults to /graphql |