# Network (features.network)

Tracks browser online/offline connectivity state. Listens for the browser's `online` and `offline` events and keeps the feature state in sync. Other features can observe the `offline` state value or listen for change events to react to connectivity changes.

## Usage

```ts
container.feature('network')
```

## Methods

### start

**Returns:** `void`



### disable

**Returns:** `void`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `isOffline` | `any` | Whether the browser is currently offline. |
| `isOnline` | `any` | Whether the browser is currently online. |

## Examples

**features.network**

```ts
const network = container.feature('network')
console.log(network.state.get('offline')) // false when online

network.on('stateChanged', ({ offline }) => {
 console.log(offline ? 'Went offline' : 'Back online')
})
```

