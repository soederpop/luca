# OS (features.os)

> Stability: `core`

The OS feature provides access to operating system utilities and information. This feature wraps Node.js's built-in `os` module and provides convenient getters for system information like architecture, platform, directories, network interfaces, and hardware details.

## Usage

```ts
container.feature('os')
```

## Methods

### whichCommand

Resolve the absolute path to a binary using the platform's lookup command. Uses `where` on Windows, `which` on Unix. Returns the binary name as-is if resolution fails (so downstream code can still try the bare name).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `bin` | `string` | ✓ | The binary name to look up (e.g. 'git', 'docker', 'ssh') |

**Returns:** `string`

```ts
const gitPath = os.whichCommand('git')
// '/usr/bin/git' on macOS, 'C:\Program Files\Git\cmd\git.exe' on Windows
```



### getDisplayInfo

Gets information about all connected displays. Platform-specific: currently implemented for macOS (darwin). Linux and Windows will throw with a clear "not yet implemented" message.

**Returns:** `DisplayInfo[]`

```ts
const displays = os.getDisplayInfo()
displays.forEach(d => {
 console.log(`${d.name}: ${d.resolution.width}x${d.resolution.height}${d.retina ? ' (Retina)' : ''}`)
})
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `arch` | `string` | Gets the operating system CPU architecture. |
| `tmpdir` | `string` | Gets the operating system's default directory for temporary files. |
| `homedir` | `string` | Gets the current user's home directory path. |
| `cpuCount` | `number` | Gets the number of logical CPU cores available on the system. |
| `hostname` | `string` | Gets the hostname of the operating system. |
| `platform` | `string` | Gets the operating system platform. |
| `networkInterfaces` | `NodeJS.Dict<os.NetworkInterfaceInfo[]>` | Gets information about the system's network interfaces. |
| `macAddresses` | `string[]` | Gets an array of MAC addresses for non-internal IPv4 network interfaces. This filters the network interfaces to only include external IPv4 interfaces and returns their MAC addresses, which can be useful for system identification. |
| `isWindows` | `boolean` | Whether the current platform is Windows. |
| `isMac` | `boolean` | Whether the current platform is macOS. |
| `isLinux` | `boolean` | Whether the current platform is Linux. |
| `shell` | `string` | The platform's default shell for executing command strings. Returns `cmd.exe` on Windows, `sh` on Unix. |
| `shellFlag` | `string` | The flag used to pass a command string to the platform shell. Returns `/c` on Windows, `-c` on Unix. |
| `pathSeparator` | `string` | The separator used in the PATH environment variable. Returns `;` on Windows, `:` on Unix. |
| `cacheDir` | `string` | Platform-appropriate cache directory for luca. - Windows: `%LOCALAPPDATA%\luca` - macOS/Linux: `~/.cache/luca` (respects `XDG_CACHE_HOME`) |
| `configDir` | `string` | Platform-appropriate config directory for luca. - Windows: `%APPDATA%\luca` - macOS: `~/.luca` - Linux: `~/.config/luca` (respects `XDG_CONFIG_HOME`) |

## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.os**

```ts
const osInfo = container.feature('os')

console.log(`Platform: ${osInfo.platform}`)
console.log(`Architecture: ${osInfo.arch}`)
console.log(`CPU cores: ${osInfo.cpuCount}`)
console.log(`Home directory: ${osInfo.homedir}`)
```



**whichCommand**

```ts
const gitPath = os.whichCommand('git')
// '/usr/bin/git' on macOS, 'C:\Program Files\Git\cmd\git.exe' on Windows
```



**getDisplayInfo**

```ts
const displays = os.getDisplayInfo()
displays.forEach(d => {
 console.log(`${d.name}: ${d.resolution.width}x${d.resolution.height}${d.retina ? ' (Retina)' : ''}`)
})
```



**arch**

```ts
const arch = os.arch
console.log(`Running on ${arch} architecture`)
```



**tmpdir**

```ts
const tempDir = os.tmpdir
console.log(`Temp directory: ${tempDir}`)
```



**homedir**

```ts
const home = os.homedir
console.log(`User home: ${home}`)
```



**cpuCount**

```ts
const cores = os.cpuCount
console.log(`System has ${cores} CPU cores`)
```



**hostname**

```ts
const hostname = os.hostname
console.log(`Hostname: ${hostname}`)
```



**platform**

```ts
const platform = os.platform
if (platform === 'darwin') {
 console.log('Running on macOS')
}
```



**networkInterfaces**

```ts
const interfaces = os.networkInterfaces
Object.keys(interfaces).forEach(name => {
 console.log(`Interface ${name}:`, interfaces[name])
})
```



**macAddresses**

```ts
const macAddresses = os.macAddresses
console.log(`External MAC addresses: ${macAddresses.join(', ')}`)
```



**isWindows**

```ts
if (os.isWindows) {
 console.log('Running on Windows')
}
```



**isMac**

```ts
if (os.isMac) {
 console.log('Running on macOS')
}
```



**isLinux**

```ts
if (os.isLinux) {
 console.log('Running on Linux')
}
```



**shell**

```ts
// spawn a shell command cross-platform
await proc.spawnAndCapture(os.shell, [os.shellFlag, 'echo hello'])
```



**shellFlag**

```ts
await proc.spawnAndCapture(os.shell, [os.shellFlag, command])
```



**pathSeparator**

```ts
const dirs = process.env.PATH?.split(os.pathSeparator) ?? []
```



**cacheDir**

```ts
const cachePath = os.cacheDir
// '/home/user/.cache/luca' on Linux
// 'C:\Users\user\AppData\Local\luca' on Windows
```



**configDir**

```ts
const configPath = os.configDir
```

