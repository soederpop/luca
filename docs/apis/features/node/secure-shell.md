# SecureShell (features.secureShell)

> Stability: `stable`

SecureShell Feature -- SSH command execution and SCP file transfers. Uses the system `ssh` and `scp` binaries to run commands on remote hosts and transfer files, through the container's `proc` feature. All connections run with `BatchMode=yes`, so a command that would require an interactive prompt fails immediately instead of hanging. In practice this means authentication must be non-interactive: a `key` option pointing at a private key file, or an already-loaded ssh-agent identity. (A `password` option exists in the schema but is not wired into the ssh/scp command line — BatchMode suppresses password prompts.) Connection state is tracked on the feature: `testConnection()` and `exec()` update `state.connected` based on whether the remote host responded.

## Usage

```ts
container.feature('secureShell', {
  // Remote host address
  host,
  // SSH port number (default: 22)
  port,
  // Username for SSH authentication
  username,
  // Password for SSH authentication
  password,
  // Path to SSH private key file
  key,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `host` | `string` | Remote host address |
| `port` | `number` | SSH port number (default: 22) |
| `username` | `string` | Username for SSH authentication |
| `password` | `string` | Password for SSH authentication |
| `key` | `string` | Path to SSH private key file |

## Methods

### testConnection

Test the SSH connection by running a simple echo command on the remote host. Updates `state.connected` based on the result.

**Returns:** `Promise<boolean>`

```ts
// (no-run) requires a reachable SSH host
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
const ok = await ssh.testConnection()
if (!ok) console.error('SSH connection failed')
console.log('state connected:', ssh.state.get('connected'))
```



### exec

Executes a command on the remote host.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | `string` | ✓ | The command to execute on the remote shell |

**Returns:** `Promise<string>`

```ts
// (no-run) requires a reachable SSH host
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
const uptime = await ssh.exec('uptime')
console.log('Remote uptime:', uptime)

const listing = await ssh.exec('ls -la /var/log')
console.log(listing)
```



### download

Downloads a file from the remote host via SCP. Uses the same authentication credentials configured on the feature instance. Remote paths are absolute, or relative to the remote user's home directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` | ✓ | The source file path on the remote host |
| `target` | `string` | ✓ | The target file path on the local machine |

**Returns:** `Promise<string>`

```ts
// (no-run) requires a reachable SSH host
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
await ssh.download('/var/log/app.log', './logs/app.log')
```



### upload

Uploads a file to the remote host via SCP. Uses the same authentication credentials configured on the feature instance. Remote paths are absolute, or relative to the remote user's home directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` | ✓ | The source file path on the local machine |
| `target` | `string` | ✓ | The target file path on the remote host |

**Returns:** `Promise<string>`

```ts
// (no-run) requires a reachable SSH host
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
await ssh.upload('./build/app.tar.gz', '/opt/releases/app.tar.gz')
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `sshPath` | `string` | Resolved path to the ssh binary |
| `scpPath` | `string` | Resolved path to the scp binary |

## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `connected` | `boolean` | Whether an SSH connection is currently active |

## Examples

**features.secureShell**

```ts
// (no-run) requires a reachable SSH host
const ssh = container.feature('secureShell', {
 host: '192.168.1.100',
 port: 22,                  // default: 22
 username: 'deploy',
 key: '~/.ssh/id_ed25519',
})

// Verify reachability before doing real work — never throws
if (await ssh.testConnection()) {
 console.log('connected:', ssh.state.get('connected')) // true

 // exec() returns the command's trimmed stdout
 const uptime = await ssh.exec('uptime')
 console.log(uptime)

 // SCP round-trip. Remote paths are absolute, or relative to
 // the remote user's home directory.
 await ssh.upload('./build/app.tar.gz', '/opt/releases/app.tar.gz')
 await ssh.download('/var/log/app.log', './logs/app.log')
}
```



**testConnection**

```ts
// (no-run) requires a reachable SSH host
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
const ok = await ssh.testConnection()
if (!ok) console.error('SSH connection failed')
console.log('state connected:', ssh.state.get('connected'))
```



**exec**

```ts
// (no-run) requires a reachable SSH host
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
const uptime = await ssh.exec('uptime')
console.log('Remote uptime:', uptime)

const listing = await ssh.exec('ls -la /var/log')
console.log(listing)
```



**download**

```ts
// (no-run) requires a reachable SSH host
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
await ssh.download('/var/log/app.log', './logs/app.log')
```



**upload**

```ts
// (no-run) requires a reachable SSH host
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
await ssh.upload('./build/app.tar.gz', '/opt/releases/app.tar.gz')
```

