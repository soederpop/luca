# clients.openai

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



## State

| Property | Type | Description |

|----------|------|-------------|

| `connected` | `boolean` | Whether the client is currently connected |

| `requestCount` | `number` | Total number of API requests made |

| `lastRequestTime` | `any` | Timestamp of the last API request |

| `tokenUsage` | `object` | Cumulative token usage across all requests |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `baseURL` | `string` | Base URL for the client connection |

| `json` | `boolean` | Whether to automatically parse responses as JSON |

| `apiKey` | `string` | OpenAI API key (falls back to OPENAI_API_KEY env var) |

| `organization` | `string` | OpenAI organization ID |

| `project` | `string` | OpenAI project ID |

| `dangerouslyAllowBrowser` | `boolean` | Allow usage in browser environments |

| `defaultModel` | `string` | Default model for completions (default: gpt-4o) |

| `timeout` | `number` | Request timeout in milliseconds |

| `maxRetries` | `number` | Maximum number of retries on failure |

## Environment Variables

- `OPENAI_API_KEY`