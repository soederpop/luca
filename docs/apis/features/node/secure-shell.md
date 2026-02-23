# features.secureShell

SecureShell Feature -- SSH command execution and SCP file transfers. Uses the system `ssh` and `scp` binaries to run commands on remote hosts and transfer files. Supports key-based and password-based authentication through the container's `proc` feature.

## Methods

### testConnection

Test the SSH connection by running a simple echo command on the remote host. Updates `state.connected` based on the result.

**Returns:** `Promise<boolean>`

```ts
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
const ok = await ssh.testConnection()
if (!ok) console.error('SSH connection failed')
```



### exec

Executes a command on the remote host.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `command` | `string` | ✓ | The command to execute on the remote shell |

**Returns:** `Promise<string>`

```ts
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
const listing = await ssh.exec('ls -la /var/log')
console.log(listing)
```



### download

Downloads a file from the remote host via SCP.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `source` | `string` | ✓ | The source file path on the remote host |

| `target` | `string` | ✓ | The target file path on the local machine |

**Returns:** `Promise<string>`

```ts
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
await ssh.download('/var/log/app.log', './logs/app.log')
```



### upload

Uploads a file to the remote host via SCP.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `source` | `string` | ✓ | The source file path on the local machine |

| `target` | `string` | ✓ | The target file path on the remote host |

**Returns:** `Promise<string>`

```ts
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
await ssh.upload('./build/app.tar.gz', '/opt/releases/app.tar.gz')
```



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `connected` | `boolean` | Whether an SSH connection is currently active |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

| `host` | `string` | Remote host address |

| `port` | `number` | SSH port number (default: 22) |

| `username` | `string` | Username for SSH authentication |

| `password` | `string` | Password for SSH authentication |

| `key` | `string` | Path to SSH private key file |

## Examples

**features.secureShell**

```ts
const ssh = container.feature('secureShell', {
 host: '192.168.1.100',
 username: 'deploy',
 key: '~/.ssh/id_ed25519',
})

if (await ssh.testConnection()) {
 const uptime = await ssh.exec('uptime')
 console.log(uptime)
}
```



**testConnection**

```ts
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
const ok = await ssh.testConnection()
if (!ok) console.error('SSH connection failed')
```



**exec**

```ts
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
const listing = await ssh.exec('ls -la /var/log')
console.log(listing)
```



**download**

```ts
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
await ssh.download('/var/log/app.log', './logs/app.log')
```



**upload**

```ts
const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
await ssh.upload('./build/app.tar.gz', '/opt/releases/app.tar.gz')
```

