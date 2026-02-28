# Networking (features.networking)

The Networking feature provides utilities for network-related operations. This feature includes utilities for port detection and availability checking, which are commonly needed when setting up servers or network services.

## Usage

```ts
container.feature('networking')
```

## Methods

### findOpenPort

Finds the next available port starting from the specified port number. This method will search for the first available port starting from the given port number. If the specified port is available, it returns that port. Otherwise, it returns the next available port.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `startAt` | `any` |  | The port number to start searching from (0 means system will choose) |

**Returns:** `void`

```ts
// Find any available port
const anyPort = await networking.findOpenPort()

// Find an available port starting from 3000
const port = await networking.findOpenPort(3000)
console.log(`Server can use port: ${port}`)
```



### isPortOpen

Checks if a specific port is available for use. This method attempts to detect if the specified port is available. It returns true if the port is available, false if it's already in use.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `checkPort` | `any` |  | The port number to check for availability |

**Returns:** `void`

```ts
// Check if port 8080 is available
const isAvailable = await networking.isPortOpen(8080)
if (isAvailable) {
 console.log('Port 8080 is free to use')
} else {
 console.log('Port 8080 is already in use')
}
```



## State

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.networking**

```ts
const networking = container.feature('networking')

// Find an available port starting from 3000
const port = await networking.findOpenPort(3000)
console.log(`Available port: ${port}`)

// Check if a specific port is available
const isAvailable = await networking.isPortOpen(8080)
if (isAvailable) {
 console.log('Port 8080 is available')
}
```



**findOpenPort**

```ts
// Find any available port
const anyPort = await networking.findOpenPort()

// Find an available port starting from 3000
const port = await networking.findOpenPort(3000)
console.log(`Server can use port: ${port}`)
```



**isPortOpen**

```ts
// Check if port 8080 is available
const isAvailable = await networking.isPortOpen(8080)
if (isAvailable) {
 console.log('Port 8080 is free to use')
} else {
 console.log('Port 8080 is already in use')
}
```

