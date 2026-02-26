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
  // Run even outside configured working hours
  overtime,
  // Suppress console output (for TUI mode)
  quiet,
})
```

## Options

| Property | Type | Description |

|----------|------|-------------|

| `documentId` | `string` | Document ID in container.docs collection |

| `minuteInterval` | `number` | Override interval in minutes (default from frontmatter) |

| `dryRun` | `boolean` | Log plays without executing them |

| `overtime` | `boolean` | Run even outside configured working hours |

| `quiet` | `boolean` | Suppress console output (for TUI mode) |

## Methods

### describe

Returns a human-readable description of the heartbeat schedule. Shows each tier, when it fires, and what plays it contains.

**Returns:** `string`



### loadPlays

Load the HEARTBEAT document from container.docs and parse all plays. Reads minuteInterval, startHour, endHour from frontmatter.

**Returns:** `Promise<Tier[]>`



### loadState

Load persisted state from diskCache. Hydrates this.state with saved values.

**Returns:** `Promise<void>`



### saveState

Save current state to diskCache for persistence across runs.

**Returns:** `Promise<void>`



### run

Main entry point. Loads plays, hydrates state from disk, checks working hours, determines which tiers are due, executes them, and saves state.

**Returns:** `Promise<void>`



## Getters

| Property | Type | Description |

|----------|------|-------------|

| `tiers` | `Tier[]` | The parsed tiers and their plays. |

| `minuteInterval` | `number` | The resolved interval in minutes. |

| `startHour` | `number` | Configured start hour for working hours. |

| `endHour` | `number` | Configured end hour for working hours. |

## Events

### runComplete

Emitted when the full run finishes



### tick

Emitted on each run

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `number` | Tick count |



### tierDue

Emitted when a tier is due to run

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `string` | Tier name |

| `arg1` | `string` | Reason |



### tierSkipped

Emitted when a tier is skipped

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `string` | Tier name |

| `arg1` | `string` | Reason |



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

| `arg3` | `string` | Captured output |



### playError

Emitted when a play fails

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `string` | Tier name |

| `arg1` | `any` | Play definition |

| `arg2` | `any` | Error |

| `arg3` | `string` | Captured output |



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `tickCount` | `number` | Number of runs |

| `lastTick` | `string` | ISO timestamp of last run |

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
await heartbeat.run() // loads, checks schedule, runs due tiers, saves state
```

