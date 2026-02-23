# features.scriptRunner

The ScriptRunner feature provides convenient access to npm scripts defined in package.json. This feature automatically generates camelCase methods for each script in the package.json file, allowing you to execute them programmatically with additional arguments and options.

## Getters

| Property | Type | Description |

|----------|------|-------------|

| `scripts` | `any` | Gets an object containing executable functions for each npm script. Each script name from package.json is converted to camelCase and becomes a method that can be called with additional arguments and spawn options. Script names with colons (e.g., "build:dev") are converted by replacing colons with underscores before camelCasing. |

## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

## Examples

**features.scriptRunner**

```ts
const scriptRunner = container.feature('scriptRunner')

// If package.json has "build:dev" script, you can call:
await scriptRunner.scripts.buildDev(['--watch'], { cwd: '/custom/path' })

// If package.json has "test" script:
await scriptRunner.scripts.test(['--verbose'])
```



**scripts**

```ts
const runner = scriptRunner.scripts

// For a script named "build:dev" in package.json:
await runner.buildDev(['--watch'], { stdio: 'inherit' })

// For a script named "test":
const result = await runner.test(['--coverage'])
console.log(result.stdout)
```

