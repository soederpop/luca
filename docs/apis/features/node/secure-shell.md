# SecureShell (features.secureShell)

> Stability: `stable`

SecureShell Feature -- SSH command execution and SCP file transfers. Uses the system `ssh` and `scp` binaries to run commands on remote hosts and transfer files, through the container's `proc` feature. All connections run with `BatchMode=yes`, so a command that would require an interactive prompt fails immediately instead of hanging. In practice this means authentication must be non-interactive: a `key` option pointing at a private key file, an IdentityFile in the ssh config, or an already-loaded ssh-agent identity. The feature can be created with no host at all. The `hosts` getter parses the ssh client config (`~/.ssh/config` by default, including `Include`d files) and lists every concrete Host entry, and `useHost()` switches the active target at any time — to a config alias, or to a literal `user@host` destination. When the target is a config alias, only the alias is passed to ssh/scp so the user's real config resolution (User, Port, IdentityFile, ProxyJump, ...) applies in full. Connection state is tracked on the feature: `testConnection()` and `exec()` update `state.connected`, and `state.currentHost` reflects the active target.

## Usage

```ts
container.feature('secureShell', {
  // Remote host address, or a Host alias from the ssh config
  host,
  // SSH port number (default: 22)
  port,
  // Username for SSH authentication
  username,
  // Path to SSH private key file
  key,
  // Path to the ssh client config file to parse for host definitions (default: ~/.ssh/config)
  configPath,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `host` | `string` | Remote host address, or a Host alias from the ssh config |
| `port` | `number` | SSH port number (default: 22) |
| `username` | `string` | Username for SSH authentication |
| `key` | `string` | Path to SSH private key file |
| `configPath` | `string` | Path to the ssh client config file to parse for host definitions (default: ~/.ssh/config) |

## Methods

### setupToolsConsumer

When an assistant consumes these tools, tell it what the current target is (if any) and that it can list and switch hosts itself.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `consumer` | `Helper` | ✓ | Parameter consumer |

**Returns:** `void`



### parseSshConfig

Parse the ssh client config into a list of concrete Host entries. Follows `Include` directives (with simple `*` globs, resolved relative to the config file's directory). Wildcard/negated Host patterns (`*`, `?`, `!`) are skipped — they are pattern defaults, not connectable hosts, and ssh applies them itself when we connect by alias. This parser is a listing aid; it does not replicate full ssh_config semantics (no `Match`, no cross-block option merging).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `configPath` | `string` |  | Config file to parse (default: the feature's `configPath`) |

**Returns:** `SshConfigHost[]`

```ts
const ssh = container.feature('secureShell')
for (const h of ssh.parseSshConfig()) {
 console.log(h.host, h.hostname ?? '', h.user ?? '')
}
```



### useHost

Switch the target host for all subsequent exec/upload/download calls. If the name matches a Host alias in the ssh config, only the alias is passed to ssh/scp from then on — the user's real ssh config resolution supplies User, Port, IdentityFile, ProxyJump, etc. Otherwise the name is treated as a literal destination (`host` or `user@host`), keeping the feature's `port` and `key` options as defaults. Updates `state.currentHost`. Does not test reachability — call `testConnection()` after switching.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | A Host alias from the ssh config, or a literal `host` / `user@host` |

**Returns:** `SshConfigHost | { host: string; username?: string }`

```ts
// (no-run) requires a reachable SSH host
const ssh = container.feature('secureShell')
ssh.useHost('chief')                 // alias from ~/.ssh/config
ssh.useHost('deploy@192.168.1.100')  // literal destination
if (await ssh.testConnection()) console.log(await ssh.exec('hostname'))
```



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

Executes a command on the remote host. The command string is passed to ssh as a single argv element — it never touches the LOCAL shell, so `$VARS`, backticks, and `$(...)` are expanded on the remote host (by the remote shell), exactly as written.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | `string` | ✓ | The command to execute on the remote shell — the string reaches the remote shell verbatim |

**Returns:** `Promise<string>`

```ts
// (no-run) requires a reachable SSH host
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
const uptime = await ssh.exec('uptime')
console.log('Remote uptime:', uptime)

// $HOME expands on the REMOTE host, not locally
const remoteHome = await ssh.exec('echo "$HOME"')
```



### download

Downloads a file from the remote host via SCP. Uses the same authentication credentials configured on the feature instance. Remote paths are absolute, or relative to the remote user's home directory. Paths are passed as argv elements (no local shell), so local paths with spaces work as-is.

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

Uploads a file to the remote host via SCP. Uses the same authentication credentials configured on the feature instance. Remote paths are absolute, or relative to the remote user's home directory. Paths are passed as argv elements (no local shell), so local paths with spaces work as-is.

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
| `configPath` | `string` | Path to the ssh client config file being parsed (default: ~/.ssh/config) |
| `hosts` | `SshConfigHost[]` | The hosts defined in the ssh client config. Re-parses the config on every access so edits to ~/.ssh/config are picked up immediately. |

## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `connected` | `boolean` | Whether an SSH connection is currently active |
| `currentHost` | `string` | The host currently targeted by exec/upload/download — a config alias or literal destination |

## Examples

**features.secureShell**

```ts
// (no-run) requires a reachable SSH host
// No host needed up front — discover targets from ~/.ssh/config
const ssh = container.feature('secureShell')
console.log(ssh.hosts) // [{ host: 'chief', hostname: '10.0.0.5', user: 'jon', ... }]

ssh.useHost('chief')             // config alias — ssh config resolves the rest
const uptime = await ssh.exec('uptime')

ssh.useHost('deploy@192.168.1.100') // or a literal destination
await ssh.upload('./build/app.tar.gz', '/opt/releases/app.tar.gz')
await ssh.download('/var/log/app.log', './logs/app.log')
```



**parseSshConfig**

```ts
const ssh = container.feature('secureShell')
for (const h of ssh.parseSshConfig()) {
 console.log(h.host, h.hostname ?? '', h.user ?? '')
}
```



**useHost**

```ts
// (no-run) requires a reachable SSH host
const ssh = container.feature('secureShell')
ssh.useHost('chief')                 // alias from ~/.ssh/config
ssh.useHost('deploy@192.168.1.100')  // literal destination
if (await ssh.testConnection()) console.log(await ssh.exec('hostname'))
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

// $HOME expands on the REMOTE host, not locally
const remoteHome = await ssh.exec('echo "$HOME"')
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

