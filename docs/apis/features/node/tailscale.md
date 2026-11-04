# Tailscale (features.tailscale)

> Stability: `experimental`

Wraps the `tailscale` CLI so the tailnet becomes typed, observable container state. Call `refresh()` (or `watch()`) to load peers into state, then look machines up by name with `findPeer()`. `serve()` and `funnel()` put a local server on an HTTPS URL, private to the tailnet or public. The CLI's JSON is not a stable API, so the parse reads only a few well-known fields and ignores the rest.

## Usage

```ts
container.feature('tailscale', {
  // Explicit path to the tailscale binary. Auto-detected if omitted
  binaryPath,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `binaryPath` | `string` | Explicit path to the tailscale binary. Auto-detected if omitted |

## Methods

### ensureAvailable

Find a working tailscale binary and record it in state. Never throws.

**Returns:** `Promise<string | null>`

```ts
if (!await ts.ensureAvailable()) console.log('install tailscale first')
```



### run

Run any tailscale subcommand. The low-level escape hatch for anything the API doesn't cover. Does not throw on a non-zero exit; check `exitCode`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `string[]` | ✓ | Arguments after `tailscale`, e.g. `['netcheck']` |
| `options` | `{ onOutput?: (chunk: string) => void; onStart?: (child: any) => void; detached?: boolean }` |  | Parameter options |

`{ onOutput?: (chunk: string) => void; onStart?: (child: any) => void; detached?: boolean }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `onOutput` | `any` | Called with each chunk of stdout or stderr as it arrives |
| `onStart` | `any` | Called with the child process once it spawns, e.g. to kill it early |
| `detached` | `any` | Run in its own process group, so `process.kill(-child.pid)` reaches its children too |

**Returns:** `Promise<TailscaleRunResult>`

```ts
const { stdout } = await ts.run(['netcheck'])
```



### status

The raw parsed output of `tailscale status --json`. Prefer `refresh()` unless you need a field it drops.

**Returns:** `Promise<any>`

```ts
const raw = await ts.status()
console.log(raw.Health)
```



### refresh

Load status into state, and emit `peer:online` / `peer:offline` for peers whose state changed since the last refresh. The first refresh emits no peer events.

**Returns:** `Promise<{ self?: TailscaleNode; peers: TailscaleNode[] }>`

```ts
const { self, peers } = await ts.refresh()
```



### findPeer

Find a peer from the last refresh by hostname, MagicDNS name (short or full), or tailscale IP. Matching is case-insensitive. Call `refresh()` first.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` | ✓ | e.g. `chief`, `chief.tailnet.ts.net`, or `100.64.0.2` |

**Returns:** `TailscaleNode | undefined`

```ts
await ts.refresh()
const box = ts.findPeer('chief')
```



### ip

This machine's tailscale IPv4 address.

**Returns:** `Promise<string | undefined>`

```ts
const myIp = await ts.ip()
```



### ping

Ping a peer through tailscale once and report latency and whether the path is direct. Never throws for an unreachable peer; returns `ok: false`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `target` | `string` | ✓ | Peer name or tailscale IP |
| `options` | `{ timeout?: number }` |  | Parameter options |

`{ timeout?: number }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `timeout` | `any` | Seconds to wait for a pong (default 5) |

**Returns:** `Promise<TailscalePingResult>`

```ts
const { ok, latencyMs, direct } = await ts.ping('chief')
```



### whois

Who owns a tailscale IP: the machine and the user. Useful to check who is calling an endpoint.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ip` | `string` | ✓ | A tailscale IP, optionally with :port |

**Returns:** `Promise<any>`

```ts
const who = await ts.whois('100.64.0.2')
console.log(who.UserProfile?.LoginName)
```



### serve

Expose a local server on this machine's MagicDNS name over HTTPS, private to the tailnet. Runs in the background and persists until `stopServe()` or `resetServe()`. HTTPS certificates must be enabled for the tailnet in the admin console.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `target` | `number | string` | ✓ | A port (3000), host:port, or full URL of the local service |
| `options` | `TailscaleServeOptions` |  | Parameter options |

`TailscaleServeOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `https` | `number` | HTTPS port to expose on the tailnet side. Defaults to 443. Funnel only allows 443, 8443 and 10000. |
| `http` | `number` | Expose plain HTTP on this port instead of HTTPS. Ignored by funnel. |
| `path` | `string` | Mount the target under this path, e.g. /api. |

**Returns:** `Promise<string>`

```ts
const url = await ts.serve(3000)
const api = await ts.serve('http://localhost:8080', { path: '/api' })
```



### funnel

Expose a local server on the public internet through Tailscale Funnel. Anyone with the URL can reach it. Funnel must be allowed for this node in the tailnet ACLs.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `target` | `number | string` | ✓ | A port (3000), host:port, or full URL of the local service |
| `options` | `Omit<TailscaleServeOptions, 'http'>` |  | Parameter options |

**Returns:** `Promise<string>`

```ts
const publicUrl = await ts.funnel(3000)
```



### stopServe

Turn off one serve or funnel mapping, by the same port and path it was started with.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `TailscaleServeOptions & { funnel?: boolean }` |  | Parameter options |

**Returns:** `Promise<void>`

```ts
await ts.stopServe({ https: 8443 })
```



### resetServe

Remove every serve and funnel mapping on this machine.

**Returns:** `Promise<void>`

```ts
await ts.resetServe()
```



### serveStatus

The current serve and funnel config as parsed JSON. An empty object means nothing is served.

**Returns:** `Promise<any>`

```ts
const config = await ts.serveStatus()
```



### sendFile

Send a file to a peer with Taildrop.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | ✓ | Local file to send |
| `target` | `string` | ✓ | Peer name or tailscale IP |

**Returns:** `Promise<void>`

```ts
await ts.sendFile('./build.zip', 'chief')
```



### watch

Poll status and emit `peer:online` / `peer:offline` as machines come and go. Runs never overlap. A failed refresh is skipped, not fatal.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ interval?: number }` |  | Parameter options |

`{ interval?: number }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `interval` | `any` | Milliseconds between refreshes (default 30000) |

**Returns:** `() => void`

```ts
ts.on('peer:online', peer => console.log(`${peer.shortName} is up`))
ts.watch({ interval: 10_000 })
```



### unwatch

Stop the polling started by `watch()`.

**Returns:** `void`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `available` | `boolean` | Whether a working tailscale binary was found. Only meaningful after `ensureAvailable()` or any CLI call. |
| `self` | `TailscaleNode | undefined` | This machine, from the last refresh. |
| `peers` | `TailscaleNode[]` | All other machines on the tailnet, from the last refresh. |
| `onlinePeers` | `TailscaleNode[]` | Peers the coordination server sees as online, from the last refresh. |
| `isRunning` | `boolean` | Whether the daemon reported Running on the last refresh. |

## Events (Zod v4 schema)

### peer:online

Emitted when a known or new peer goes online between refreshes

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | Stable node ID from the tailnet |
| `hostname` | `string` | The machine hostname as the node reports it |
| `dnsName` | `string` | MagicDNS name without the trailing dot, e.g. chief.tailnet.ts.net |
| `shortName` | `string` | First label of the MagicDNS name, e.g. chief |
| `ips` | `array` | All tailscale IPs (v4 and v6) |
| `ipv4` | `string` | The tailscale IPv4 address, if any |
| `os` | `string` | Operating system the node reports |
| `online` | `boolean` | Whether the coordination server sees the node as online |
| `exitNode` | `boolean` | Whether this node is the exit node in use right now |
| `exitNodeOption` | `boolean` | Whether this node offers itself as an exit node |
| `lastSeen` | `string` | ISO timestamp the node was last seen |
| `tags` | `array` | ACL tags on the node |



### peer:offline

Emitted when a peer goes offline or leaves the tailnet between refreshes

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | Stable node ID from the tailnet |
| `hostname` | `string` | The machine hostname as the node reports it |
| `dnsName` | `string` | MagicDNS name without the trailing dot, e.g. chief.tailnet.ts.net |
| `shortName` | `string` | First label of the MagicDNS name, e.g. chief |
| `ips` | `array` | All tailscale IPs (v4 and v6) |
| `ipv4` | `string` | The tailscale IPv4 address, if any |
| `os` | `string` | Operating system the node reports |
| `online` | `boolean` | Whether the coordination server sees the node as online |
| `exitNode` | `boolean` | Whether this node is the exit node in use right now |
| `exitNodeOption` | `boolean` | Whether this node offers itself as an exit node |
| `lastSeen` | `string` | ISO timestamp the node was last seen |
| `tags` | `array` | ACL tags on the node |



### refreshed

Emitted after every successful status refresh

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `array` | The peers after the refresh |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `available` | `boolean` | Whether a working tailscale binary was found |
| `binaryPath` | `string` | Path to the tailscale binary in use |
| `backendState` | `string` | Daemon state from the last refresh, e.g. Running, Stopped, NeedsLogin |
| `tailnet` | `string` | MagicDNS suffix of the tailnet, e.g. tailnet.ts.net |
| `self` | `object` | This machine, from the last refresh |
| `peers` | `array` | Other machines on the tailnet, from the last refresh |
| `lastRefreshedAt` | `number` | Timestamp (ms) of the last successful refresh |
| `watching` | `boolean` | Whether watch() is polling status |

## Examples

**features.tailscale**

```ts
const ts = container.feature('tailscale')
await ts.refresh()
const chief = ts.findPeer('chief')
console.log(chief?.ipv4, chief?.online)

const url = await ts.serve(3000)   // https://this-machine.tailnet.ts.net
```



**ensureAvailable**

```ts
if (!await ts.ensureAvailable()) console.log('install tailscale first')
```



**run**

```ts
const { stdout } = await ts.run(['netcheck'])
```



**status**

```ts
const raw = await ts.status()
console.log(raw.Health)
```



**refresh**

```ts
const { self, peers } = await ts.refresh()
```



**findPeer**

```ts
await ts.refresh()
const box = ts.findPeer('chief')
```



**ip**

```ts
const myIp = await ts.ip()
```



**ping**

```ts
const { ok, latencyMs, direct } = await ts.ping('chief')
```



**whois**

```ts
const who = await ts.whois('100.64.0.2')
console.log(who.UserProfile?.LoginName)
```



**serve**

```ts
const url = await ts.serve(3000)
const api = await ts.serve('http://localhost:8080', { path: '/api' })
```



**funnel**

```ts
const publicUrl = await ts.funnel(3000)
```



**stopServe**

```ts
await ts.stopServe({ https: 8443 })
```



**resetServe**

```ts
await ts.resetServe()
```



**serveStatus**

```ts
const config = await ts.serveStatus()
```



**sendFile**

```ts
await ts.sendFile('./build.zip', 'chief')
```



**watch**

```ts
ts.on('peer:online', peer => console.log(`${peer.shortName} is up`))
ts.watch({ interval: 10_000 })
```

