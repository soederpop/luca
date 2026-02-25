# Heartbeat (features.heartbeat)

No description provided

## Usage

```ts
container.feature('heartbeat', {
  // Document ID in container.docs collection
  documentId,
  // Override interval in minutes (default from frontmatter)
  minuteInterval,
  // Log plays without executing them
  dryRun,
})
```

## Options

| Property | Type | Description |

|----------|------|-------------|

| `documentId` | `string` | Document ID in container.docs collection |

| `minuteInterval` | `number` | Override interval in minutes (default from frontmatter) |

| `dryRun` | `boolean` | Log plays without executing them |

## Methods

### loadPlays

Load the HEARTBEAT document from container.docs and parse all plays. Reads minuteInterval from frontmatter. Parses the ## Plays section for tier headings (h3) and their code blocks / prompt sub-headings (h4).

**Returns:** `Promise<Tier[]>`



### start

Start the heartbeat timer. Loads plays from the document on first call.

**Returns:** `Promise<this>`



### stop

Stop the heartbeat timer.

**Returns:** `Promise<void>`



### tick

Execute a single tick. Determines which tiers should fire based on the current time and last-run state, then executes all plays for those tiers.

**Returns:** `Promise<void>`



## Getters

| Property | Type | Description |

|----------|------|-------------|

| `tiers` | `Tier[]` | The parsed tiers and their plays. |

| `minuteInterval` | `number` | The resolved interval in minutes. |

## Events

### started

Emitted when the heartbeat loop starts



### stopped

Emitted when the heartbeat loop stops



### tick

Emitted on each interval tick

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `number` | Tick count |



### playStarted

Emitted when a play begins execution

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `string` | Tier name |

| `arg1` | `any` | Play definition |



### playCompleted

Emitted when a play finishes successfully

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `string` | Tier name |

| `arg1` | `any` | Play definition |

| `arg2` | `any` | Result |



### playError

Emitted when a play fails

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `string` | Tier name |

| `arg1` | `any` | Play definition |

| `arg2` | `any` | Error |



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `running` | `boolean` | Whether the heartbeat timer is active |

| `tickCount` | `number` | Number of ticks since start |

| `lastTick` | `string` | ISO timestamp of last tick |

| `lastRunEveryTime` | `string` | ISO timestamp of last everyTime run |

| `lastRunHourly` | `string` | ISO timestamp of last hourly run |

| `lastRunHourlyHour` | `number` | Hour number of last hourly run |

| `lastRunThreeTimesDaily` | `string` | ISO timestamp of last threeTimesDaily run |

| `lastRunThreeTimesDailyHour` | `number` | Hour of last threeTimesDaily trigger |

| `lastRunEndOfDay` | `string` | ISO timestamp of last endOfDay run |

| `lastRunEndOfDayDate` | `string` | Date string of last endOfDay run |

| `runCountEveryTime` | `number` | Total everyTime runs |

| `runCountHourly` | `number` | Total hourly runs |

| `runCountThreeTimesDaily` | `number` | Total threeTimesDaily runs |

| `runCountEndOfDay` | `number` | Total endOfDay runs |

## Examples

**features.heartbeat**

```ts
const heartbeat = container.feature('heartbeat', { enable: true })
await heartbeat.start()
// ... runs until stopped
await heartbeat.stop()
```

